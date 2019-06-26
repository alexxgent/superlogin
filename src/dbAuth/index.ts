import PouchDB from 'pouchdb-node'
import seed from 'pouchdb-seed-design'
import { Superlogin } from '../types'
import util from './../util'
import CloudantAdapter from './cloudant'
import CouchAdapter from './couchdb'

// Escapes any characters that are illegal in a CouchDB database name using percent codes inside parenthesis
// Example: 'My.name@example.com' => 'my(2e)name(40)example(2e)com'
const getLegalDBName = (input: string) =>
  encodeURIComponent(input.toLowerCase())
    .replace(/\./g, '%2E')
    .replace(/!/g, '%21')
    .replace(/~/g, '%7E')
    .replace(/\*/g, '%2A')
    .replace(/!/g, '%21')
    .replace(/~/g, '%7E')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/-/g, '%2D')
    .toLowerCase()
    .replace(/(%..)/g, esc => `(${esc.substr(1)})`)

const dbAuth = (config: IConfigure, userDB: PouchDB.Database, couchAuthDB: PouchDB.Database) => {
  const cloudant = config.get().dbServer.cloudant

  const adapter: IDBAdapter = cloudant ? CloudantAdapter : CouchAdapter(couchAuthDB)

  const createDB = async (dbName: string) => {
    const finalUrl = `${util.getDBURL(config.get().dbServer)}/${dbName}`
    try {
      const db = new PouchDB(finalUrl)
      return db.info()
    } catch (error) {
      console.error('create DB error', error)
      throw error
    }
  }

  const getDesignDoc = (docName: string) => {
    if (!docName) {
      return null
    }
    const userDBs = config.get().userDBs
    const designDocDir = userDBs ? userDBs.designDocDir : __dirname
    try {
      // tslint:disable-next-line:non-literal-require
      return require(`${designDocDir}/${docName}`)
    } catch (err) {
      console.warn(`Design doc: ${designDocDir}/${docName} not found.`)
      return undefined
    }
  }

  const storeKey = async (
    username: string,
    key: string,
    password: string,
    expires?: number,
    roles?: string[]
  ) => adapter.storeKey(username, key, password, expires, roles)

  const removeKeys = async (keys: string | string[]) => adapter.removeKeys(keys)

  const authorizeKeys = async (
    user_id: string,
    db: PouchDB.Database,
    keys: string[],
    permissions?: string[],
    roles?: string[]
  ) => adapter.authorizeKeys(user_id, db, keys, permissions, roles)

  const deauthorizeKeys = async (db: PouchDB.Database, keys: string[] | string) =>
    adapter.deauthorizeKeys(db, keys)

  const deauthorizeUser = async (userDoc: Superlogin.IUserDoc, keys: string[] | string) => {
    if (!userDoc) {
      console.error('deauthorizeUser error - no userdoc specified')
      return false
    }
    // If keys is not specified we will deauthorize all of the users sessions
    const finalKeys = keys ? util.toArray(keys) : util.getSessions(userDoc)
    if (userDoc.personalDBs && typeof userDoc.personalDBs === 'object') {
      return Promise.all(
        Object.keys(userDoc.personalDBs).map(async personalDB => {
          try {
            const db = new PouchDB(`${util.getDBURL(config.get().dbServer)}/${personalDB}`, {
              skip_setup: true
            })
            return deauthorizeKeys(db, finalKeys)
          } catch (error) {
            console.error('error deauthorizing db!', error)
            return Promise.resolve()
          }
        })
      )
    }
    console.error('deauthorizeUser error - user has no personalDBs')
    return false
  }

  const authorizeUserSessions = async (
    user_id: string,
    personalDBs: {},
    keys: string | string[],
    roles: string[]
  ) => {
    const { userDBs } = config.get()
    try {
      const sessionKeys = util.toArray(keys)
      return Promise.all(
        Object.keys(personalDBs).map(async personalDB => {
          const { permissions, name } = personalDBs[personalDB]
          const configModel = userDBs && userDBs.model
          const finalPermissions =
            permissions ||
            (configModel
              ? (configModel[name] && configModel[name].permissions) ||
                (configModel._default && configModel._default.permissions)
              : undefined)
          const db = new PouchDB(`${util.getDBURL(config.get().dbServer)}/${personalDB}`, {
            skip_setup: true
          })
          return authorizeKeys(user_id, db, sessionKeys, finalPermissions, roles)
        })
      )
    } catch (error) {
      console.error('error authorizing user sessions', error)
      return undefined
    }
  }

  const addUserDB = async (
    userDoc: Superlogin.IUserDoc,
    dbName: string,
    designDocs?: string[],
    type?: string,
    permissions?: string[],
    aRoles?: string[],
    mRoles?: string[]
  ) => {
    const { userDBs } = config.get()
    const adminRoles = aRoles || []
    const memberRoles = mRoles || []
    // Create and the database and seed it if a designDoc is specified
    const prefix = userDBs && userDBs.privatePrefix ? `${userDBs.privatePrefix}_` : ''
    const username = getLegalDBName(userDoc._id)
    // Make sure we have a legal database name
    const finalDBName = type === 'shared' ? dbName : `${prefix}${dbName}$${username}`
    try {
      const newDB = new PouchDB(`${util.getDBURL(config.get().dbServer)}/${finalDBName}`)
      await adapter.initSecurity(newDB, adminRoles, memberRoles)

      // Seed the design docs
      if (designDocs && Array.isArray(designDocs)) {
        await Promise.all(
          designDocs.map(async ddName => {
            const dDoc = getDesignDoc(ddName)
            if (dDoc) {
              await seed(newDB, dDoc)
              return Promise.resolve()
            } else {
              console.warn(`Failed to locate design doc: ${ddName}`)
              return Promise.resolve()
            }
          })
        )
      }

      if (userDoc.session) {
        // Authorize the user's existing DB keys to access the new database
        const keysToAuthorize = Object.keys(userDoc.session).filter(k => {
          const { expires } = userDoc.session[k]
          return expires && expires > Date.now()
        })
        if (keysToAuthorize.length > 0) {
          await authorizeKeys(userDoc._id, newDB, keysToAuthorize, permissions, userDoc.roles)
        }
      }
      return finalDBName
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error('create user db error', error)
      return finalDBName
    }
  }

  const removeExpiredKeys = async () => {
    try {
      // query a list of expired keys by user
      const results = await userDB.query<Superlogin.IUserDoc>('auth/expiredKeys', {
        endkey: Date.now(),
        include_docs: true
      })
      const { expiredKeys, userDocs, keysByUser } = results.rows.reduce(
        (r, row) => {
          if (!row || !row.value) {
            return r
          }

          const { user, key } = row.value as { user: string; key: string }
          // Append expired keys
          const newExpiredKeys = [...r.expiredKeys, key]
          const newKeysByUser = { ...r.keysByUser, [user]: key }

          if (row.doc) {
            const { session, ...userDoc } = row.doc
            const { [key]: deleted, ...finalSession } = session
            const newUserDocs = { ...r.userDocs, [user]: { ...userDoc, session: finalSession } }
            return { expiredKeys: newExpiredKeys, userDocs: newUserDocs, keysByUser: newKeysByUser }
          }
          return { ...r, expiredKeys: newExpiredKeys, keysByUser: newKeysByUser }
        },
        { expiredKeys: [''], userDocs: {}, keysByUser: {} }
      )
      await removeKeys(expiredKeys)
      await Promise.all(
        Object.keys(keysByUser).map(async user => deauthorizeUser(userDocs[user], keysByUser[user]))
      )
      // Bulk save user doc updates
      await userDB.bulkDocs(Object.values(userDocs))
      return expiredKeys
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error('error expiring keys', error)
      return undefined
    }
  }

  const getDBConfig = (dbName: string, type?: string) => {
    const { userDBs } = config.get()
    if (!userDBs) {
      return {
        name: dbName,
        type: type || 'private',
        designDocs: [],
        permissions: [],
        adminRoles: [],
        memberRoles: []
      }
    }
    const { defaultSecurityRoles, model } = userDBs

    const adminRoles = (defaultSecurityRoles && defaultSecurityRoles.admins) || []
    const memberRoles = (defaultSecurityRoles && defaultSecurityRoles.members) || []

    const dbConfigRef = model && model[dbName]
    if (dbConfigRef) {
      const refAdminRoles = dbConfigRef.adminRoles || []
      const refMemberRoles = dbConfigRef.memberRoles || []
      return {
        name: dbName,
        permissions: dbConfigRef.permissions || [],
        designDocs: dbConfigRef.designDocs || [],
        type: type || dbConfigRef.type || 'private',
        adminRoles: [...adminRoles.filter(r => !refAdminRoles.includes(r)), ...refAdminRoles],
        memberRoles: [...memberRoles.filter(r => !refMemberRoles.includes(r)), ...refMemberRoles]
      }
    }

    const permissions = model && model._default ? model._default.permissions : []
    const designDocs =
      model && model._default && (!type || type === 'private')
        ? model._default.designDocs || []
        : []

    return {
      name: dbName,
      permissions,
      designDocs,
      type: type || 'private',
      adminRoles,
      memberRoles
    }
  }

  const removeDB = async (dbName: string) => {
    try {
      const db = new PouchDB(`${util.getDBURL(config.get().dbServer)}/${dbName}`, {
        skip_setup: true
      })
      return db.destroy()
    } catch (error) {
      throw error
    }
  }

  return {
    removeDB,
    createDB,
    getDBConfig,
    getDesignDoc,
    removeExpiredKeys,
    addUserDB,
    authorizeUserSessions,
    authorizeKeys,
    deauthorizeKeys,
    deauthorizeUser,
    removeKeys,
    storeKey
  }
}

export default dbAuth
