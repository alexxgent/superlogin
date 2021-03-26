import { EventEmitter } from 'events'
import { IProfile } from 'index'
import merge from 'lodash.merge'
import Model from 'sofa-model'
import url from 'url'

import DBAuth from './dbAuth'
import cloudant from './dbAuth/cloudant'
import Session from './session'
import { Superlogin } from './types'
import util from './util'

// regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/inupsert.js#L4
const EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/
const USER_REGEXP = /^[a-z0-9_-]{3,16}$/

const user = <Profile extends IProfile = IProfile>(
  config: IConfigure,
  userDB: PouchDB.Database<Superlogin.IUserDoc<Profile>>,
  couchAuthDB: PouchDB.Database,
  mailer: Superlogin.IMailer,
  emitter: EventEmitter
) => {
  const dbAuth = DBAuth(config, userDB, couchAuthDB)
  const session = Session(config)
  const onCreateActions: Array<
    (
      userDoc: Superlogin.IUserDoc<Profile>,
      provider: string
    ) => Promise<Superlogin.IUserDoc<Profile>>
  > = []
  const onLinkActions: Array<
    (
      userDoc: Superlogin.IUserDoc<Profile>,
      provider: string
    ) => Promise<Superlogin.IUserDoc<Profile>>
  > = []

  // Token valid for 24 hours by default
  // Forget password token life
  const tokenLife = config.get().security.tokenLife || 86400
  // Session token life
  const sessionLife = config.get().security.sessionLife || 86400

  const emailUsername = config.get().local.emailUsername

  const logActivity = async (
    user_id: string,
    action: string,
    provider: string,
    req: { ip?: string },
    userDoc: Superlogin.IUserDoc<Profile>,
    saveDoc?: boolean
  ) => {
    try {
      const logSize = config.get().security.userActivityLogSize
      if (!logSize) {
        return Promise.resolve(userDoc)
      }
      const thisUser = userDoc || (await userDB.get<Superlogin.IUserDoc>(user_id))

      const activity = [
        {
          timestamp: new Date().toISOString(),
          action,
          provider,
          ip: req.ip
        },
        ...(Array.isArray(thisUser.activity) ? thisUser.activity : [])
      ]

      if (activity.length > logSize) {
        activity.splice(logSize, activity.length - 1)
      }

      const finalUser = {
        ...userDoc,
        activity
      }

      if (saveDoc) {
        await userDB.upsert<Superlogin.IUserDoc<Profile>>(thisUser._id, oldUser => {
          const { activity: _, ...oldData } = oldUser as PouchDB.Core.Document<
            Superlogin.IUserDoc<Profile>
          >
          return merge({}, oldData, finalUser)
        })
      }
      return finalUser
    } catch (error) {
      return userDoc
    }
  }

  const logoutUserSessions = async (
    userDoc: Superlogin.IUserDoc<Profile>,
    op: string,
    currentSession?: string
  ) => {
    try {
      const sessions =
        op === 'all' || op === 'other'
          ? util.getSessions(userDoc)
          : util.getExpiredSessions(userDoc, Date.now())

      if (op === 'other' && currentSession) {
        // Remove the current session from the list of sessions we are going to delete
        const index = sessions.indexOf(currentSession)
        if (index > -1) {
          sessions.splice(index, 1)
        }
      }
      if (op === 'all') {
        delete userDoc.session
      }
      if (sessions.length) {
        if (op === 'expired' || op === 'other') {
          sessions.forEach(s => delete userDoc.session[s])
        }
        await Promise.all([
          // Delete the sessions from our session store
          await session.deleteTokens(sessions),
          // Remove the keys from our couchDB auth database
          await dbAuth.removeKeys(sessions),
          // Deauthorize keys from each personal database
          await dbAuth.deauthorizeUser(userDoc, sessions)
        ])
      }
      return userDoc
    } catch (error) {
      console.error('error logging out user sessions!', error)
      return Promise.resolve(userDoc)
    }
  }

  const changePassword = async (
    user_id: string,
    newPassword: string,
    userDoc: Superlogin.IUserDoc<Profile>,
    req: { ip?: string }
  ) => {
    req = req || {}
    let changePwUser: Superlogin.IUserDoc<Profile>
    let doc = userDoc
    try {
      if (!userDoc) {
        doc = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)
      }
    } catch (error) {
      return Promise.reject({
        error: 'User not found',
        status: 404
      })
    }
    changePwUser = doc
    const hash = await util.hashPassword(newPassword)

    if (!changePwUser.local) {
      changePwUser.local = {}
    }
    changePwUser.local.salt = hash.salt
    changePwUser.local.derived_key = hash.derived_key
    if (changePwUser.providers.indexOf('local') === -1) {
      changePwUser.providers.push('local')
    }
    const finalUser = await logActivity(
      changePwUser._id,
      'changed password',
      'local',
      req,
      changePwUser
    )
    await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
    return emitter.emit('password-change', changePwUser)
  }

  const logoutOthers = async (session_id: string) => {
    let logoutUserDoc: Superlogin.IUserDoc<Profile>
    let finalUser: Superlogin.IUserDoc<Profile> | undefined
    try {
      const results = await userDB.query<Superlogin.IUserDoc<Profile>>('auth/session', {
        key: session_id,
        include_docs: true
      })

      if (results.rows.length) {
        logoutUserDoc = results.rows[0].doc as Superlogin.IUserDoc<Profile>
        if (logoutUserDoc.session && logoutUserDoc.session[session_id]) {
          finalUser = await logoutUserSessions(logoutUserDoc, 'other', session_id)
        }
      }

      if (finalUser) {
        return userDB.upsert<Superlogin.IUserDoc<Profile>>(finalUser._id, rawUser => {
          const { session: _, ...oldUser } = rawUser as PouchDB.Core.Document<
            Superlogin.IUserDoc<Profile>
          >
          return (finalUser ? merge({}, oldUser, finalUser) : oldUser) as Superlogin.IUserDoc<
            Profile
          >
        })
      }
      return false
    } catch (error) {
      console.error('error logging out others', error)
      return false
    }
  }

  const addUserDBs = async (newUser: Superlogin.IUserDoc<Profile>) => {
    const { userDBs } = config.get()
    // Add personal DBs
    if (!userDBs || !userDBs.defaultDBs) {
      return Promise.resolve(newUser)
    }

    try {
      newUser.personalDBs = {}

      const processUserDBs = async (dbList: string[], type: string) =>
        Promise.all(
          dbList.map(async userDBName => {
            const dbConfig = dbAuth.getDBConfig(userDBName)
            const finalDBName = await dbAuth.addUserDB(
              newUser,
              userDBName,
              dbConfig.designDocs || [],
              type,
              dbConfig.permissions || [],
              dbConfig.adminRoles || [],
              dbConfig.memberRoles || []
            )
            delete dbConfig.permissions
            delete dbConfig.adminRoles
            delete dbConfig.memberRoles
            delete dbConfig.designDocs
            dbConfig.type = type
            newUser.personalDBs[finalDBName] = dbConfig
          })
        )

      // Just in case defaultDBs is not specified
      const defaultPrivateDBs = userDBs.defaultDBs && userDBs.defaultDBs.private
      if (Array.isArray(defaultPrivateDBs)) {
        await processUserDBs(defaultPrivateDBs, 'private')
      }
      const defaultSharedDBs = userDBs.defaultDBs.shared
      if (Array.isArray(defaultSharedDBs)) {
        await processUserDBs(defaultSharedDBs, 'shared')
      }

      return Promise.resolve(newUser)
    } catch (error) {
      console.error('addUserDBs failed', error)
      return newUser
    }
  }

  const generateSession = async (username: string, roles: string[]) => {
    try {
      let key: { key: string; password: string }
      if (config.get().dbServer.cloudant) {
        key = (await cloudant.getAPIKey(userDB)) as { key: string; password: string }
      } else {
        let token = util.URLSafeUUID()
        // Make sure our token doesn't start with illegal characters
        while (token[0] === '_' || token[0] === '-') {
          token = util.URLSafeUUID()
        }
        key = {
          key: token,
          password: util.URLSafeUUID()
        }
      }

      const now = Date.now()
      return Promise.resolve({
        _id: username,
        key: key.key,
        password: key.password,
        issued: now,
        expires: now + sessionLife * 1000,
        roles
      })
    } catch (error) {
      console.error('error generating session!', error)
      throw error
    }
  }

  // ------> FIXME <------
  // Adds numbers to a base name until it finds a unique database key
  const generateUsername = async (base: string) => {
    base = base.toLowerCase()
    const entries: string[] = []
    let finalName = ''
    const results = await userDB.allDocs({
      startkey: base,
      endkey: `${base}\uffff`,
      include_docs: false
    })

    if (results.rows.length === 0) {
      return base
    }
    results.rows.forEach(({ id }) => entries.push(id))
    if (entries.indexOf(base) === -1) {
      return base
    }
    let num = 0
    while (!finalName) {
      num += 1
      if (entries.indexOf(base + num) === -1) {
        finalName = base + num
      }
    }
    return finalName
  }

  const validateUsername = async (username: string) => {
    if (!username) {
      return Promise.resolve()
    }
    if (!username.match(USER_REGEXP)) {
      return Promise.resolve('Invalid username')
    }
    try {
      const result = await userDB.query('auth/username', { key: username })
      if (result.rows.length === 0) {
        // Pass!
        return Promise.resolve()
      }
      return Promise.resolve('already in use')
    } catch (error) {
      throw new Error(error)
    }
  }

  const validateEmail = async (email: string) => {
    if (!email) {
      return Promise.resolve()
    }
    if (!email.match(EMAIL_REGEXP)) {
      return Promise.resolve('invalid email')
    }
    try {
      const result = await userDB.query('auth/email', { key: email })
      if (result.rows.length === 0) {
        // Pass!
        return Promise.resolve()
      }
      return Promise.resolve('already in use')
    } catch (error) {
      console.error('error validating email', error)
      throw new Error(error)
    }
  }

  const validateEmailUsername = async (email: string) => {
    if (!email) {
      return Promise.resolve()
    }
    if (!email.match(EMAIL_REGEXP)) {
      return Promise.resolve('invalid email')
    }
    try {
      const result = await userDB.query('auth/emailUsername', { key: email })
      if (result.rows.length === 0) {
        return Promise.resolve()
      }
      return Promise.resolve('already in use')
    } catch (error) {
      console.error('error validating email/username', error)
      throw new Error(error)
    }
  }

  // Validation function for ensuring that two fields match
  const matches = (value: string, option: string, key: string, attributes: {}) => {
    if (attributes && attributes[option] !== value) {
      return `does not match ${option}`
    }
    return ''
  }

  let passwordConstraints = {
    presence: true,
    length: {
      minimum: 6,
      message: 'must be at least 6 characters'
    },
    matches: 'confirmPassword'
  }

  const defaultPConstraints = config.get().local.passwordConstraints as typeof passwordConstraints

  passwordConstraints = defaultPConstraints
    ? merge({}, passwordConstraints, defaultPConstraints)
    : passwordConstraints

  const userModel = {
    async: true,
    whitelist: ['name', 'username', 'email', 'password', 'confirmPassword'],
    customValidators: {
      validateEmail,
      validateUsername,
      validateEmailUsername,
      matches
    },
    sanitize: {
      name: ['trim'],
      username: ['trim', 'toLowerCase'],
      email: ['trim', 'toLowerCase']
    },
    validate: {
      email: {
        presence: true,
        validateEmail: true
      },
      username: {
        presence: true,
        validateUsername: true
      },
      password: passwordConstraints,
      confirmPassword: {
        presence: true
      }
    },
    static: {
      type: 'user',
      roles: config.get().security.defaultRoles,
      providers: ['local']
    },
    rename: {
      username: '_id'
    }
    // tslint:disable-next-line:no-any
  } as any

  if (emailUsername) {
    delete userModel.validate.username
    delete userModel.validate.email.validateEmail
    delete userModel.rename.username
    userModel.validate.email.validateEmailUsername = true
  }

  const resetPasswordModel = {
    async: true,
    customValidators: {
      matches
    },
    validate: {
      token: {
        presence: true
      },
      password: passwordConstraints,
      confirmPassword: {
        presence: true
      }
    }
  }

  const changePasswordModel = {
    async: true,
    customValidators: {
      matches
    },
    validate: {
      newPassword: passwordConstraints,
      confirmPassword: {
        presence: true
      }
    }
  }

  const onCreate = (
    fn: (
      userDoc: Superlogin.IUserDoc<Profile>,
      provider: string
    ) => Promise<Superlogin.IUserDoc<Profile>>
  ) => {
    if (typeof fn === 'function') {
      onCreateActions.push(fn)
    } else {
      throw new TypeError('onCreate: You must pass in a function')
    }
  }

  const onLink = (
    fn: (
      userDoc: Superlogin.IUserDoc<Profile>,
      provider: string
    ) => Promise<Superlogin.IUserDoc<Profile>>
  ) => {
    if (typeof fn === 'function') {
      onLinkActions.push(fn)
    } else {
      throw new TypeError('onLink: You must pass in a function')
    }
  }

  const processTransformations = async (
    fnArray: Array<
      (
        userDoc: Superlogin.IUserDoc<Profile>,
        provider: string
      ) => Promise<Superlogin.IUserDoc<Profile>>
    >,
    userDoc: Superlogin.IUserDoc<Profile>,
    provider: string
  ) => {
    let finalDoc = userDoc
    await Promise.all(fnArray.map(async fn => (finalDoc = await fn(finalDoc, provider))))
    return finalDoc
  }

  const get = async (login: string) => {
    let query
    if (emailUsername) {
      query = 'emailUsername'
    } else {
      query = EMAIL_REGEXP.test(login) ? 'email' : 'username'
    }
    const results = await userDB.query<Superlogin.IUserDoc<Profile>>(`auth/${query}`, {
      key: login,
      include_docs: true
    })
    if (results.rows.length > 0) {
      return results.rows[0].doc
    }
    return null
  }

  const create = async (form: {}, req: { ip?: string }) => {
    req = req || {}
    let finalUserModel = userModel
    const newUserModel = config.get().userModel
    if (typeof newUserModel === 'object') {
      let whitelist: string[] = []
      if (newUserModel.whitelist) {
        whitelist = util.arrayUnion(userModel.whitelist, newUserModel.whitelist)
      }
      finalUserModel = merge({}, userModel, config.get().userModel)
      finalUserModel.whitelist =
        whitelist && whitelist.length > 0 ? whitelist : finalUserModel.whitelist
    }
    const UserModel = new Model(finalUserModel)
    const u = new UserModel(form)
    let newUser: Superlogin.IUserDoc<Profile>
    try {
      newUser = await u.process()
      if (emailUsername) {
        newUser._id = newUser.email
      }
      if (config.get().local.sendConfirmEmail) {
        newUser.unverifiedEmail = {
          email: newUser.email,
          token: util.URLSafeUUID()
        }
        delete newUser.email
      }
      const defaultRoles = config.get().security.defaultRoles

      // Append/add default roles
      if (newUser.roles && Array.isArray(newUser.roles)) {
        newUser.roles.concat(defaultRoles)
      } else {
        newUser.roles = defaultRoles
      }

      // Store password hash
      const hash = await util.hashPassword(newUser.password)
      newUser.local = hash
      delete newUser.password
      delete newUser.confirmPassword
      newUser.signUp = {
        provider: 'local',
        timestamp: new Date().toISOString(),
        ip: req.ip
      }
      newUser = await addUserDBs(newUser)
      newUser = await logActivity(newUser._id, 'signup', 'local', req, newUser)
      newUser = await processTransformations(onCreateActions, newUser, 'local')
      const result = await userDB.upsert(newUser._id, oldUser => merge({}, oldUser, newUser))

      newUser._rev = result.rev
      if (config.get().local.sendConfirmEmail) {
        mailer.sendEmail('confirmEmail', newUser.unverifiedEmail.email, {
          req,
          user: newUser
        })
      }
      emitter.emit('signup', newUser, 'local')
      return Promise.resolve(newUser)
    } catch (error) {
      console.error('create user failed', error)
      return Promise.reject({
        error: 'Validation failed',
        validationErrors: error,
        status: 400
      })
    }
  }

  const socialAuth = async (
    provider: string,
    auth: string,
    profile: Profile,
    req: { ip?: string }
  ) => {
    let userDoc: Superlogin.IUserDoc<Profile>
    let newAccount = false
    let action: string
    let baseUsername: string
    let finalUsername = ''
    req = req || {}
    const { ip } = req

    try {
      const results = await userDB.query(`auth/${provider}`, {
        key: profile.id,
        include_docs: true
      })

      if (results.rows.length > 0) {
        userDoc = results.rows[0].doc as Superlogin.IUserDoc<Profile>
      } else {
        newAccount = true
        // tslint:disable-next-line:no-any
        userDoc = { [provider]: {} } as any
        if (profile.emails) {
          userDoc.email = profile.emails[0].value
        }
        if (profile.email) {
          userDoc.email = profile.email
        }
        userDoc.providers = [provider]
        userDoc.type = 'user'
        userDoc.roles = config.get().security.defaultRoles
        userDoc.signUp = {
          provider,
          timestamp: new Date().toISOString(),
          ip
        }
        const emailFail = async () =>
          Promise.reject({
            error: 'Email already in use',
            message:
              'Your email is already in use. Try signing in first and then linking this account.',
            status: 409
          })
        // Now we need to generate a username
        if (emailUsername) {
          if (!userDoc.email) {
            return Promise.reject({
              error: 'No email provided',
              message: `An email is required for registration, but ${provider} didn't supply one.`,
              status: 400
            })
          }
          const err = await validateEmailUsername(userDoc.email)
          if (err) {
            return emailFail()
          }
          finalUsername = userDoc.email.toLowerCase()
        } else {
          if (profile.username) {
            baseUsername = profile.username.toLowerCase()
            // If a username isn't specified we'll take it from the email
          } else if (userDoc.email) {
            const parseEmail = userDoc.email.split('@')
            baseUsername = parseEmail[0].toLowerCase()
          } else if (profile.displayName) {
            baseUsername = profile.displayName.replace(/\s/g, '').toLowerCase()
          } else {
            baseUsername = profile.id.toLowerCase()
          }

          const err = await validateEmail(userDoc.email)
          if (err) {
            return emailFail()
          }
          finalUsername = await generateUsername(baseUsername)
        }
      }
      if (finalUsername) {
        userDoc._id = finalUsername
      }
      userDoc[provider].auth = auth
      userDoc[provider].profile = profile
      if (!userDoc.name) {
        if (profile.displayName) {
          userDoc.name = profile.displayName
        }
        if (profile.name) {
          const firstName = profile.name.firstName || profile.name.givenName
          const lastName = profile.name.lastName || profile.name.familyName

          if (firstName && lastName) {
            userDoc.name = `${firstName} ${lastName}`
          }
        }
      }
      delete userDoc[provider].profile._raw
      if (newAccount) {
        await addUserDBs(userDoc)
      }
      action = newAccount ? 'signup' : 'login'
      userDoc = await logActivity(userDoc._id, action, provider, req, userDoc)
      const finalUser = await processTransformations(
        newAccount ? onCreateActions : onLinkActions,
        userDoc,
        provider
      )
      await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
      if (action === 'signup') {
        emitter.emit('signup', finalUser, provider)
      }
      return finalUser
    } catch (error) {
      console.error('social auth failed!', error)
      return undefined
    }
  }

  const linkSocial = async (
    user_id: string,
    provider: string,
    auth: string,
    profile: Profile,
    req: { ip?: string }
  ) => {
    req = req || {}
    let linkUser: Superlogin.IUserDoc<Profile>
    const results = await userDB.query(`auth/${provider}`, { key: profile.id })

    if (results.rows.length > 0 && results.rows[0].id !== user_id) {
      return Promise.reject({
        error: 'Conflict',
        message: `This ${provider} profile is already in use by another account.`,
        status: 409
      })
    }
    const theUser = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)

    linkUser = theUser
    // Check for conflicting provider
    if (linkUser[provider] && linkUser[provider].profile.id !== profile.id) {
      return Promise.reject({
        error: 'Conflict',
        message: `Your account is already linked with another ${provider}profile.`,
        status: 409
      })
    }
    let emailConflict: { rows: Array<{ id?: string }> }
    // Check email for conflict
    if (!profile.emails) {
      emailConflict = { rows: [] }
    } else if (emailUsername) {
      emailConflict = await userDB.query('auth/emailUsername', {
        key: profile.emails[0].value
      })
    } else {
      emailConflict = await userDB.query('auth/email', { key: profile.emails[0].value })
    }

    let passed = true
    if (emailConflict.rows.length > 0) {
      emailConflict.rows.forEach(row => {
        if (row.id !== user_id) {
          passed = false
        }
      })
    }
    if (!passed) {
      return Promise.reject({
        error: 'Conflict',
        message: `The email ${profile.emails[0].value} is already in use by another account.`,
        status: 409
      })
    }

    // Insert provider info
    linkUser = { ...linkUser, [provider]: { auth, profile } }
    if (!linkUser.providers) {
      linkUser.providers = []
    }
    if (linkUser.providers.indexOf(provider) === -1) {
      linkUser.providers.push(provider)
    }
    if (!linkUser.name) {
      linkUser.name = profile.displayName
    }
    delete linkUser[provider].profile._raw
    const userDoc = await logActivity(linkUser._id, 'link', provider, req, linkUser)
    const finalUser = await processTransformations(onLinkActions, userDoc, provider)
    await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
    return finalUser
  }

  const unlink = async (user_id: string, provider: 'apple' | 'local' | 'google') => {
    // We cannot unlink local
    if (provider === 'local') {
      return Promise.reject({
        error: 'Unlink failed',
        message: "You can't unlink local.",
        status: 400
      })
    }
    try {
      let unLinkUser = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)
      if (!provider) {
        return Promise.reject({
          error: 'Unlink failed',
          message: 'You must specify a provider to unlink.',
          status: 400
        })
      }
      // We can only unlink if there are at least two providers
      if (
        !unLinkUser.providers ||
        !Array.isArray(unLinkUser.providers) ||
        unLinkUser.providers.length < 2
      ) {
        console.error('unlink failed', unLinkUser)
        return Promise.reject({
          error: 'Unlink failed',
          message: "You can't unlink your only provider!",
          status: 400
        })
      }
      // Check that the provider exists
      if (!unLinkUser[provider] || typeof unLinkUser[provider] !== 'object') {
        return Promise.reject({
          error: 'Unlink failed',
          message: `Provider: ${util.capitalizeFirstLetter(provider)} not found.`,
          status: 404
        })
      }
      await userDB.upsert<Superlogin.IUserDoc<Profile>>(unLinkUser._id, oldUser => {
        const { [provider]: deleted, ...newUser } = oldUser
        if (newUser.providers) {
          // Remove the unlinked provider from the list of providers
          newUser.providers.splice(unLinkUser.providers.indexOf(provider), 1)
        }
        unLinkUser = newUser as Superlogin.IUserDoc<Profile>
        return newUser as Superlogin.IUserDoc<Profile>
      })
      return unLinkUser
    } catch (error) {
      console.error('error unlinking user', error)
      return undefined
    }
  }

  const createSession = async (user_id: string, provider: string, req: { ip?: string }) => {
    let createSessionUser: Superlogin.IUserDoc<Profile>
    let newToken: Superlogin.ISession
    let password: string
    req = req || {}
    const { ip } = req
    try {
      createSessionUser = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)
      const token = await generateSession(createSessionUser._id, createSessionUser.roles)
      password = token.password
      newToken = token
      newToken.provider = provider
      await session.storeToken(newToken)
      await dbAuth.storeKey(
        user_id,
        newToken.key,
        password,
        newToken.expires,
        createSessionUser.roles
      )

      // Refresh the session user just in case new dbs are created by this point
      createSessionUser = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)

      // authorize the new session across all dbs
      if (!!createSessionUser.personalDBs) {
        await dbAuth.authorizeUserSessions(
          user_id,
          createSessionUser.personalDBs,
          newToken.key,
          createSessionUser.roles
        )
      }

      if (!createSessionUser.session) {
        createSessionUser.session = {}
      }
      const userDocSession = {
        issued: newToken.issued,
        expires: newToken.expires,
        provider,
        ip
      }
      createSessionUser.session[newToken.key] = userDocSession
      // Clear any failed login attempts
      if (provider === 'local') {
        if (!createSessionUser.local) {
          createSessionUser.local = {}
        }
        createSessionUser.local.failedLoginAttempts = 0
        delete createSessionUser.local.lockedUntil
      }
      const userDoc = await logActivity(
        createSessionUser._id,
        'login',
        provider,
        req,
        createSessionUser
      )
      const finalUser = await logoutUserSessions(userDoc, 'expired')
      createSessionUser = finalUser
      await userDB.upsert<Superlogin.IUserDoc<Profile>>(finalUser._id, rawDoc => {
        const oldDoc = rawDoc as PouchDB.Core.Document<Superlogin.IUserDoc<Profile>>
        if (oldDoc.local) {
          delete oldDoc.local.lockedUntil
        }

        return merge({}, oldDoc, finalUser)
      })

      const finalSession: Partial<Superlogin.ISession> = {
        ...userDocSession
      }

      finalSession.token = newToken.key
      finalSession.password = password
      finalSession.user_id = createSessionUser._id
      finalSession.roles = createSessionUser.roles
      // Inject the list of userDBs
      if (typeof createSessionUser.personalDBs === 'object') {
        const userDBs = {}
        let publicURL: string
        const configPublicURL = config.get().dbServer.publicURL
        if (configPublicURL) {
          const dbObj = url.parse(configPublicURL)
          dbObj.auth = `${finalSession.token}:${finalSession.password}`
          publicURL = url.format(dbObj)
        } else {
          publicURL = `${config.get().dbServer.protocol}${finalSession.token}:${
            finalSession.password
          }@${config.get().dbServer.host}/`
        }
        Object.keys(createSessionUser.personalDBs).forEach(finalDBName => {
          userDBs[createSessionUser.personalDBs[finalDBName].name] = `${publicURL}${finalDBName}`
        })
        finalSession.userDBs = userDBs
      }
      if (createSessionUser.profile) {
        finalSession.profile = createSessionUser.profile
      }
      emitter.emit('login', finalSession, provider)
      return finalSession
    } catch (error) {
      console.error('failed creating a user session', error)
      return undefined
    }
  }

  const handleFailedLogin = async (
    loginUser: Superlogin.IUserDoc<Profile>,
    req: { ip?: string }
  ) => {
    req = req || {}
    const maxFailedLogins = config.get().security.maxFailedLogins
    if (!maxFailedLogins) {
      return Promise.resolve()
    }
    if (!loginUser.local) {
      loginUser.local = {}
    }
    if (!loginUser.local.failedLoginAttempts) {
      loginUser.local.failedLoginAttempts = 0
    }
    loginUser.local.failedLoginAttempts += 1
    if (loginUser.local.failedLoginAttempts > maxFailedLogins) {
      loginUser.local.failedLoginAttempts = 0
      loginUser.local.lockedUntil = Date.now() + config.get().security.lockoutTime * 1000
    }
    const finalUser = await logActivity(loginUser._id, 'failed login', 'local', req, loginUser)
    await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
    return !!loginUser.local.lockedUntil
  }

  const refreshSession = async (key: string, pass: string) => {
    let newSession: Superlogin.ISession
    try {
      const oldToken = await session.fetchToken(key)
      newSession = oldToken
      newSession.expires = Date.now() + sessionLife * 1000
      const results = await Promise.all([
        await userDB.get<Superlogin.IUserDoc<Profile>>(newSession._id),
        await session.storeToken(newSession)
      ])
      const userDoc: Superlogin.IUserDoc<Profile> = results[0]
      userDoc.session[key] = { ...userDoc.session[key], expires: newSession.expires }
      // Clean out expired sessions on refresh
      const finalUser = await logoutUserSessions(userDoc, 'expired')
      await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
      delete newSession.password
      newSession.token = newSession.key
      delete newSession.key
      newSession.user_id = newSession._id
      delete newSession._id
      delete newSession.salt
      delete newSession.derived_key
      emitter.emit('refresh', newSession)
      return newSession
    } catch (error) {
      console.error('error refreshing session', error)
      return undefined
    }
  }

  const resetPassword = (form: { token: string; password: string }, req: { ip?: string }) => {
    req = req || {}
    const ResetPasswordModel = new Model(resetPasswordModel)
    const passwordResetForm = new ResetPasswordModel(form)
    let resetUser: Superlogin.IUserDoc<Profile>
    return passwordResetForm
      .validate()
      .then(
        async () => {
          const tokenHash = util.hashToken(form.token)
          return userDB.query('auth/passwordReset', {
            key: tokenHash,
            include_docs: true
          })
        },
        async (err: string) =>
          Promise.reject({
            error: 'Validation failed',
            validationErrors: err,
            status: 400
          })
      )
      .then(async (results: { rows: Array<{ doc: Superlogin.IUserDoc<Profile> }> }) => {
        if (!results.rows.length) {
          return Promise.reject({ status: 400, error: 'Invalid token' })
        }
        resetUser = results.rows[0].doc
        if (resetUser.forgotPassword.expires < Date.now()) {
          return Promise.reject({ status: 400, error: 'Token expired' })
        }
        return util.hashPassword(form.password)
      })
      .then(async (hash: Superlogin.ISession) => {
        if (!resetUser.local) {
          resetUser.local = {}
        }
        resetUser.local.salt = hash.salt
        resetUser.local.derived_key = hash.derived_key
        if (!resetUser.providers) {
          resetUser.providers = ['local']
        } else if (resetUser.providers.indexOf('local') === -1) {
          resetUser.providers = [...resetUser.providers, 'local']
        }
        // logout user completely
        return logoutUserSessions(resetUser, 'all')
      })
      .then(async (userDoc: Superlogin.IUserDoc<Profile>) => {
        resetUser = userDoc
        delete resetUser.forgotPassword
        return logActivity(resetUser._id, 'reset password', 'local', req, resetUser)
      })
      .then(async (finalUser: Superlogin.IUserDoc<Profile>) =>
        userDB.upsert<Superlogin.IUserDoc<Profile>>(finalUser._id, rawUser => {
          const oldUser = rawUser as PouchDB.Core.Document<Superlogin.IUserDoc<Profile>>
          delete oldUser.forgotPassword
          return merge({}, oldUser, finalUser)
        })
      )
      .then(async () => {
        emitter.emit('password-reset', resetUser)
        return Promise.resolve(resetUser)
      })
  }

  const changePasswordSecure = async (
    user_id: string,
    form: { newPassword: string; currentPassword: string },
    req: { ip?: string; user?: { key: string } }
  ) => {
    req = req || {}
    const ChangePasswordModel = new Model(changePasswordModel)
    const changePasswordForm = new ChangePasswordModel(form)
    let changePwUser: Superlogin.IUserDoc<Profile>
    return changePasswordForm
      .validate()
      .then(
        async () => userDB.get(user_id),
        async (err: string) =>
          Promise.reject({
            error: 'Validation failed',
            validationErrors: err,
            status: 400
          })
      )
      .then(async () => userDB.get(user_id))
      .then(async (userDoc: Superlogin.IUserDoc<Profile>) => {
        changePwUser = userDoc
        if (changePwUser.local && changePwUser.local.salt && changePwUser.local.derived_key) {
          // Password is required
          if (!form.currentPassword) {
            return Promise.reject({
              error: 'Password change failed',
              message: 'You must supply your current password in order to change it.',
              status: 400
            })
          }
          return util.verifyPassword(changePwUser.local, form.currentPassword)
        }
        return Promise.resolve()
      })
      .then(
        async () => changePassword(changePwUser._id, form.newPassword, changePwUser, req),
        async (err: string) =>
          Promise.reject(
            err || {
              error: 'Password change failed',
              message: 'The current password you supplied is incorrect.',
              status: 400
            }
          )
      )
      .then(async () => {
        if (req.user && req.user.key) {
          return logoutOthers(req.user.key)
        }
        return Promise.resolve()
      })
  }

  const forgotPassword = async (email: string, req: { ip?: string }) => {
    req = req || {}
    let forgotPwUser: Superlogin.IUserDoc<Profile>
    let token: string
    let tokenHash: string
    try {
      const result = await userDB.query<Superlogin.IUserDoc<Profile>>('auth/email', {
        key: email,
        include_docs: true
      })

      if (!result.rows.length) {
        return Promise.reject({
          error: 'User not found',
          status: 404
        })
      }
      forgotPwUser = result.rows[0].doc as Superlogin.IUserDoc<Profile>
      token = util.URLSafeUUID()
      tokenHash = util.hashToken(token)
      forgotPwUser.forgotPassword = {
        token: tokenHash, // Store secure hashed token
        issued: Date.now(),
        expires: Date.now() + tokenLife * 1000
      }
      const finalUser = await logActivity(
        forgotPwUser._id,
        'forgot password',
        'local',
        req,
        forgotPwUser
      )
      await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
      mailer.sendEmail('forgotPassword', forgotPwUser.email || forgotPwUser.unverifiedEmail.email, {
        user: forgotPwUser,
        req,
        token
      }) // Send user the unhashed token
      emitter.emit('forgot-password', forgotPwUser)
      return forgotPwUser.forgotPassword
    } catch (error) {
      console.error('error in forgot password', error)
      return undefined
    }
  }

  const verifyEmail = async (token: string, req: { ip?: string }) => {
    req = req || {}
    let verifyEmailUser: Superlogin.IUserDoc<Profile>
    const result = await userDB.query<Superlogin.IUserDoc<Profile>>('auth/verifyEmail', {
      key: token,
      include_docs: true
    })

    if (!result.rows.length) {
      return Promise.reject({ error: 'Invalid token', status: 400 })
    }
    verifyEmailUser = result.rows[0].doc as Superlogin.IUserDoc<Profile>
    verifyEmailUser.email = verifyEmailUser.unverifiedEmail.email
    delete verifyEmailUser.unverifiedEmail
    emitter.emit('email-verified', verifyEmailUser)
    const finalUser = await logActivity(
      verifyEmailUser._id,
      'verified email',
      'local',
      req,
      verifyEmailUser
    )
    return userDB.upsert<Superlogin.IUserDoc<Profile>>(finalUser._id, rawUser => {
      const oldUser = rawUser as PouchDB.Core.Document<Superlogin.IUserDoc<Profile>>
      delete oldUser.unverifiedEmail
      return merge({}, oldUser, finalUser)
    })
  }

  const changeEmail = async (
    user_id: string,
    newEmail: string,
    req: { user?: { provider: string }; ip?: string }
  ) => {
    req = req || {}
    let changeEmailUser: Superlogin.IUserDoc<Profile>
    if (!req.user) {
      req.user = { provider: 'local' }
    }

    try {
      const err = await validateEmail(newEmail)

      if (err) {
        return Promise.reject(err)
      }
      changeEmailUser = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)

      if (config.get().local.sendConfirmEmail) {
        changeEmailUser.unverifiedEmail = {
          email: newEmail,
          token: util.URLSafeUUID()
        }
        mailer.sendEmail('confirmEmail', changeEmailUser.unverifiedEmail.email, {
          req,
          user: changeEmailUser
        })
      } else {
        changeEmailUser.email = newEmail
      }

      emitter.emit('email-changed', changeEmailUser)

      const finalUser = await logActivity(
        changeEmailUser._id,
        'changed email',
        req.user.provider,
        req,
        changeEmailUser
      )
      await userDB.upsert(finalUser._id, oldUser => merge({}, oldUser, finalUser))
      return finalUser
    } catch (error) {
      console.error('error changing email', error)
      return
    }
  }

  const addUserDB = async (
    user_id: string,
    dbName: string,
    type: string,
    designDocs: string[],
    permissions: string[]
  ) => {
    try {
      const dbConfig = dbAuth.getDBConfig(dbName, type || 'private')
      dbConfig.designDocs = designDocs || dbConfig.designDocs || []
      dbConfig.permissions = permissions || dbConfig.permissions
      const userDoc = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)

      const finalDBName = await dbAuth.addUserDB(
        userDoc,
        dbName,
        dbConfig.designDocs,
        dbConfig.type,
        dbConfig.permissions,
        dbConfig.adminRoles,
        dbConfig.memberRoles
      )
      if (!userDoc.personalDBs) {
        userDoc.personalDBs = {}
      }
      delete dbConfig.designDocs
      // If permissions is specified explicitly it will be saved, otherwise will be taken from defaults every session
      if (!permissions) {
        delete dbConfig.permissions
      }
      delete dbConfig.adminRoles
      delete dbConfig.memberRoles
      userDoc.personalDBs[finalDBName] = dbConfig
      emitter.emit('user-db-added', user_id, dbName)
      await userDB.upsert(userDoc._id, oldUser => merge({}, oldUser, userDoc))
      return userDoc
    } catch (error) {
      console.error('error adding user db', error)
      return undefined
    }
  }

  const removeUserDB = async (
    user_id: string,
    dbName: string,
    deletePrivate: boolean,
    deleteShared: boolean
  ) => {
    let removeUser: Superlogin.IUserDoc<Profile>
    let update = false
    let dbID: string
    try {
      const userDoc = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)
      removeUser = userDoc
      if (removeUser.personalDBs && typeof removeUser.personalDBs === 'object') {
        await Promise.all(
          Object.keys(removeUser.personalDBs).map(async db => {
            if (removeUser.personalDBs[db].name === dbName) {
              dbID = db
              const { type } = removeUser.personalDBs[db]
              delete removeUser.personalDBs[db]
              update = true
              try {
                if (type === 'private' && deletePrivate) {
                  await dbAuth.removeDB(db)
                  return Promise.resolve()
                }
                if (type === 'shared' && deleteShared) {
                  await dbAuth.removeDB(db)
                  return Promise.resolve()
                }
              } catch (error) {
                console.error('error removing user db', db, dbName, error)
              }
            }
            return Promise.resolve()
          })
        )
      }

      if (update) {
        emitter.emit('user-db-removed', user_id, dbName)
        return userDB.upsert<Superlogin.IUserDoc<Profile>>(removeUser._id, rawUser => {
          const oldUser = rawUser as PouchDB.Core.Document<Superlogin.IUserDoc<Profile>>
          if (oldUser.personalDBs[dbID]) {
            delete oldUser.personalDBs[dbID]
          }
          return merge({}, oldUser, removeUser)
        })
      }
      return Promise.resolve()
    } catch (error) {
      console.error('error removing user db', error)
      return Promise.resolve()
    }
  }

  const logoutUser = async (user_id: string, session_id: string) => {
    let logoutUserDoc: Superlogin.IUserDoc<Profile>
    if (user_id) {
      logoutUserDoc = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)
    } else {
      if (!session_id) {
        return Promise.reject({
          error: 'unauthorized',
          message: 'Either user_id or session_id must be specified',
          status: 401
        })
      }
      const results = await userDB.query<Superlogin.IUserDoc<Profile>>('auth/session', {
        key: session_id,
        include_docs: true
      })

      if (!results.rows.length) {
        return Promise.reject({
          error: 'unauthorized',
          status: 401
        })
      }
      logoutUserDoc = results.rows[0].doc as Superlogin.IUserDoc<Profile>
    }
    user_id = logoutUserDoc._id
    await logoutUserSessions(logoutUserDoc, 'all')
    emitter.emit('logout', user_id)
    emitter.emit('logout-all', user_id)
    return userDB.upsert<Superlogin.IUserDoc<Profile>>(logoutUserDoc._id, rawUser => {
      const oldUser = rawUser as PouchDB.Core.Document<Superlogin.IUserDoc<Profile>>
      delete oldUser.session
      return merge({}, oldUser, logoutUserDoc)
    })
  }

  const logoutSession = async (session_id: string) => {
    let logoutUserDoc: Superlogin.IUserDoc<Profile>
    let startSessions = 0
    let endSessions = 0
    try {
      const results = await userDB.query<Superlogin.IUserDoc<Profile>>('auth/session', {
        key: session_id,
        include_docs: true
      })

      if (!results.rows.length) {
        return Promise.reject({
          error: 'unauthorized',
          status: 401
        })
      }
      logoutUserDoc = results.rows[0].doc as Superlogin.IUserDoc<Profile>
      if (logoutUserDoc.session) {
        startSessions = Object.keys(logoutUserDoc.session).length
        if (logoutUserDoc.session[session_id]) {
          delete logoutUserDoc.session[session_id]
        }
      }
      await Promise.all([
        await session.deleteTokens(session_id),
        await dbAuth.removeKeys(session_id),
        logoutUserDoc
          ? await dbAuth.deauthorizeUser(logoutUserDoc, session_id)
          : await Promise.resolve()
      ])
      const finalUser = await logoutUserSessions(logoutUserDoc, 'expired')

      logoutUserDoc = finalUser
      if (logoutUserDoc.session) {
        endSessions = Object.keys(logoutUserDoc.session).length
      }
      emitter.emit('logout', logoutUserDoc._id)
      if (startSessions !== endSessions) {
        return userDB.upsert<Superlogin.IUserDoc<Profile>>(logoutUserDoc._id, rawUser => {
          const oldUser = rawUser as PouchDB.Core.Document<Superlogin.IUserDoc<Profile>>
          delete oldUser.session
          return merge({}, oldUser, logoutUserDoc)
        })
      }
      return false
    } catch (error) {
      console.error('error logging out session', error)
      return false
    }
  }

  const remove = async (user_id: string, destroyDBs: boolean) => {
    let removeUser: Superlogin.IUserDoc<Profile>
    try {
      const userDoc = await userDB.get<Superlogin.IUserDoc<Profile>>(user_id)
      await logoutUserSessions(userDoc, 'all')
      removeUser = userDoc
      if (destroyDBs !== true || !removeUser.personalDBs) {
        return Promise.resolve()
      }
      await Promise.all(
        Object.keys(removeUser.personalDBs).map(async userdb => {
          if (removeUser.personalDBs[userdb].type === 'private') {
            await dbAuth.removeDB(userdb)
          }
          return Promise.resolve()
        })
      )
      return userDB.remove(removeUser)
    } catch (error) {
      console.error('error removing user!', error)
      return Promise.resolve()
    }
  }

  const confirmSession = async (key: string, password: string) =>
    session.confirmToken(key, password)

  const quitRedis = session.quit

  return {
    dbAuth,
    session,
    onCreateActions,
    onLinkActions,

    // Token valid for 24 hours by default
    // Forget password token life
    tokenLife,
    // Session token life
    sessionLife,

    emailUsername,

    addUserDBs,

    generateSession,

    // ------> FIXME <------
    // Adds numbers to a base name until it finds a unique database key
    generateUsername,

    validateUsername,

    validateEmail,

    validateEmailUsername,

    // Validation function for ensuring that two fields match
    matches,

    passwordConstraints,

    userModel,

    resetPasswordModel,

    changePasswordModel,

    onCreate,

    onLink,

    processTransformations,

    get,

    create,

    socialAuth,

    linkSocial,

    unlink,

    createSession,

    handleFailedLogin,

    refreshSession,

    resetPassword,

    changePasswordSecure,

    changePassword,

    forgotPassword,

    verifyEmail,

    changeEmail,

    addUserDB,

    removeUserDB,

    logoutUser,

    logoutSession,

    logoutOthers,

    logoutUserSessions,

    remove,

    removeExpiredKeys: dbAuth.removeExpiredKeys,

    confirmSession,

    quitRedis
  }
}

declare global {
  // tslint:disable-next-line:no-any
  export type User = any
}

export default user
