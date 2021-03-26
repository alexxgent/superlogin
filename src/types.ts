import { Data } from 'ejs'
import { RequestHandler, Router } from 'express'
import { Transport, TransportOptions } from 'nodemailer'
import { PassportStatic, Strategy } from 'passport'

export declare namespace Superlogin {
  export interface IAdapter {
    _getFilepath?(path: string): string
    _removeExpired?(path: string): void
    deleteKeys(keys: string[]): Promise<number>
    getKey(path: string): Promise<string>
    quit(path?: string): Promise<string>
    storeKey(key: string, life: number, data: string): Promise<string>
  }

  export interface ISecurityDoc {
    admins: { roles: string[]; names: string[]; members?: string[] }
    members: { roles: string[]; names: string[]; members?: string[] }
  }
  interface IMailer {
    sendEmail(templateName: string, email: string, locals: Data): void
  }
  export type DBType = 'private' | 'shared'
  interface IConfiguration {
    // Useful settings for testing and debugging your app
    testMode?: {
      oauthTest?: boolean
      // Use a stub transport so no email is actually sent
      noEmail?: boolean
      // Displays debug information in the oauth dialogs
      oauthDebug?: boolean
      // Logs out-going emails to the console
      debugEmail: boolean
    }
    security: {
      // Default roles given to a new user
      defaultRoles: string[]
      // Disables the ability to link additional providers to an account when set to true
      disableLinkAccounts?: boolean
      // Maximum number of failed logins before the account is locked
      maxFailedLogins: number
      // The amount of time the account will be locked for (in seconds) after the maximum failed logins is exceeded
      lockoutTime: number
      // The amount of time a new session is valid for (default: 24 hours)
      sessionLife: number
      // The amount of time a password reset token is valid for
      tokenLife: number
      // The maximum number of entries in the activity log in each user doc. Zero to disable completely
      userActivityLogSize?: number
      // If set to true, the user will be logged in automatically after registering
      loginOnRegistration: boolean
      // If set to true, the user will be logged in automatically after resetting the password
      loginOnPasswordReset: boolean
    }
    local: {
      // Send out a confirm email after each user signs up with local login
      sendConfirmEmail?: boolean
      // Require the email be confirmed before the user can login
      requireEmailConfirm?: boolean
      // If this is set, the user will be redirected to this location after confirming email instead of JSON response
      confirmEmailRedirectURL?: string
      // Set this to true to disable usernames and use emails instead
      emailUsername?: boolean
      // Custom names for the username and password fields in your sign-in form
      usernameField: string
      passwordField: string
      // Override default constraints
      passwordConstraints?: {
        length?: {
          minimum: number
          message?: string
        }
        matches?: string
      }
    }
    dbServer: {
      designDocDir: string
      // The CouchDB compatible server where all your databases are stored on
      protocol: string
      host: string
      user: string
      password: string
      // If the public uses a separate URL from your Node.js server to access the database specify it here.
      // This will be the access URL for all your user's personalDBs
      publicURL?: string
      // Set this to true if you are using Cloudant
      cloudant?: boolean
      // The name for the database that stores all your user information. This is distinct from CouchDB's _user database.
      // Alternatively you can pass in a PouchDB object to the SuperLogin constructor and leave this blank
      userDB: string
      // CouchDB's _users database. Each session generates the user a unique login and password. This is not used with Cloudant.
      couchAuthDB: string
    }
    session: {
      // 'redis' or 'memory'
      adapter: 'redis' | 'memory' | 'file'
      file?: { sessionsRoot: string }
      redis?: {
        // If url is supplied, port and host will be ignored
        url?: string
        port?: number
        host?: string
        // If a UNIX domain socket is specified, port, host and url will be ignored
        unix_socket?: string
        options?: {}
        password?: string
      }
    }
    mailer?: {
      // Email address that all your system emails will be from
      fromEmail?: string
      // Use this if you want to specify a custom Nodemailer transport. Defaults to SMTP or sendmail.
      transport?: Transport
      // The options object that will be passed into your transport. These should usually be your SMTP settings.
      // If this is left blank, it will default to sendmail.
      options: TransportOptions
    }
    emails: {
      [name: string]: {
        subject: string
        template: string
        format: string
      }
    }
    // Custom settings to manage personal databases for your users
    userDBs?: {
      // These databases will be set up automatically for each new user
      defaultDBs?: {
        // Private databases are personal to each user. They will be prefixed with your setting below and postfixed with $USERNAME.
        private?: string[]
        // Shared databases that you want the user to be authorized to use. These will not be prefixed, so type the exact name.
        shared?: string[]
      }
      // If you specify default roles here (and use CouchDB not Cloudant) then these will be added to the _security object
      // of each new user database created. This is useful for preventing anonymous access.
      defaultSecurityRoles?: {
        admins?: string[]
        members?: string[]
      }
      // These are settings for each personal database
      model?: {
        // If your database is not listed below, these default settings will be applied

        [name: string]: {
          designDocs?: string[]
          permissions?: string[]
          // 'private' or 'shared'
          type: string
          // Roles that will be automatically added to the db's _security object of this specific db
          adminRoles?: string[]
          memberRoles?: string[]
        }
      }
      // Your private user databases will be prefixed with this:
      privatePrefix?: string
      // Directory that contains all your design docs
      designDocDir?: string
    }
    // Configure all your authentication providers here
    providers: {
      // Each provider follows the following pattern
      [name: string]: {
        // Supply your app's credentials here. The callback url is generated automatically.
        // See the Passport documentation for your specific strategy for details.
        credentials: {
          // Anything under credentials will be passed in to passport.use
          // It is a best practice to put any sensitive credentials in environment variables rather than your code
          // tslint:disable-next-line:no-any
          [key: string]: any
        }
        // Any additional options you want to supply your authentication strategy such as requested permissions
        options: {
          // Anything under options will be passed in with passport.authenticate
          // tslint:disable-next-line:no-any
          [key: string]: any
        }
        // This will pass in the user's auth token as a variable called 'state' when linking to this provider
        // Defaults to true for Apple, Google, and LinkedIn, but you can enable it for other providers if needed
        stateRequired?: boolean
      }
    }
    // Anything here will be merged with the userModel that validates your local sign-up form.
    // See [Sofa Model documentation](http://github.com/colinskow/sofa-model) for details.
    userModel: {
      // For example, this will require each new user to specify a valid age on the sign-up form or registration will fail
      whitelist?: string[]
      customValidators?: {
        // tslint:disable-next-line:no-any
        [key: string]: (value: any, opts: boolean, key: string, allValues: any) => any
      }
      validate?: {
        [key: string]: {
          // tslint:disable-next-line:no-any
          [key: string]: any
        }
      }
    }
  }
  interface IConfigure {
    get(): IConfiguration
    set(setFunc: (oldCfg: IConfiguration) => IConfiguration): void
  }

  export interface IUserConfig {
    testMode?: IConfiguration['testMode']
    security?: Partial<IConfiguration['security']>
    local?: Partial<IConfiguration['local']>
    dbServer?: Partial<IConfiguration['dbServer']>
    session?: Partial<IConfiguration['session']>
    mailer?: IConfiguration['mailer']
    emails?: IConfiguration['emails']
    userDBs?: IConfiguration['userDBs']
    providers?: IConfiguration['providers']
    userModel?: IConfiguration['userModel']
  }

  export interface ISession {
    _id: string
    derived_key?: string
    expires: number
    ip?: string
    issued: number
    key: string
    password: string
    provider?: string
    roles: string[]
    salt?: string
    token?: string
    userDBs?: { [name: string]: string }
    user_id?: string
    profile?: Superlogin.IProfile
  }

  interface IProfile {
    [key: string]: {}
    name: { firstName: string; lastName: string }
    displayName: string
    username?: string
    id: string
    email: string
    emails: Array<{ value: string }>
  }

  interface IActivity {
    timestamp: string
    action: string
    provider: string
    ip: string
  }

  type UserDocSession = Pick<ISession, 'issued' | 'expires' | 'provider' | 'ip'>

  interface IUserDoc {
    activity?: IActivity[] | IActivity
    _rev: string
    rev?: string
    unverifiedEmail: { email: string; token: string }
    password?: string
    confirmPassword?: string
    name: string
    email: string
    _id: string
    type?: string
    roles: string[]
    displayName?: string
    companyName?: string
    providers: string[]
    profile: IProfile
    forgotPassword?: {
      expires: number
      token: string
      issued: number
    }
    local: {
      iterations?: number
      failedLoginAttempts?: number
      salt?: string
      derived_key?: string
      lockedUntil?: number
    }
    signUp: {
      provider: string
      timestamp: string
      ip: string
    }
    apple?: {}
    google?: {}
    session?: { [name: string]: UserDocSession }
    personalDBs: { [dbName: string]: { name: string; type?: string } }
  }

  interface IBaseSLInstance {
    config: IConfigure
    router: Router
    mailer: IMailer
    passport: PassportStatic
    userDB: PouchDB.Database<IUserDoc>
    couchAuthDB: PouchDB.Database | undefined
    requireAuth: RequestHandler
    removeExpiredKeys(): Promise<undefined | string[]>
    registerProvider(
      provider: string,
      configFunction: (credentials: {}, passport: {}, authHandler: {}) => void
    ): void
    registerOAuth2(providerName: string, Strategy: Strategy): void
    registerTokenProvider(providerName: string, Strategy: Strategy): void
    validateUsername(username: string): Promise<string | void>
    validateEmail(email: string): Promise<string | void>
    validateEmailUsername(email: string): Promise<string | void>
    getUser(login: string): Promise<PouchDB.Core.ExistingDocument<IUserDoc> | null | undefined>
    createUser(
      form: {},
      req: {
        ip: string
      }
    ): Promise<IUserDoc>
    onCreate(fn: (userDoc: IUserDoc, provider: string) => Promise<IUserDoc>): void
    onLink(fn: (userDoc: IUserDoc, provider: string) => Promise<IUserDoc>): void
    socialAuth(
      provider: string,
      auth: string,
      profile: IProfile,
      req: {
        ip: string
      }
    ): Promise<IUserDoc | undefined>
    hashPassword(
      password: string
    ): Promise<{
      salt: string
      derived_key: string
    }>
    verifyPassword(
      hashObj: {
        iterations?: number | undefined
        salt?: string | undefined
        derived_key?: string | undefined
      },
      password: string
    ): Promise<boolean>
    createSession(
      user_id: string,
      provider: string,
      req: {
        ip: string
      }
    ): Promise<Partial<IUserDoc> | undefined>
    changePassword(
      user_id: string,
      newPassword: string,
      userDoc: IUserDoc,
      req: {
        ip: string
      }
    ): Promise<boolean>
    changeEmail(
      user_id: string,
      newEmail: string,
      req: {
        user: {
          provider: string
        }
        ip: string
      }
    ): Promise<IUserDoc | undefined>
    resetPassword(
      form: {
        token: string
        password: string
      },
      req: {
        ip: string
      }
    ): {}
    forgotPassword(
      email: string,
      req: {
        ip: string
      }
    ): Promise<
      | {
          expires: number
          token: string
          issued: number
        }
      | undefined
    >
    verifyEmail(
      token: string,
      req: {
        ip: string
      }
    ): Promise<PouchDB.UpsertResponse>
    addUserDB(
      user_id: string,
      dbName: string,
      type: string,
      designDocs?: string[],
      permissions?: string[]
    ): Promise<(IUserDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta) | undefined>
    removeUserDB(
      user_id: string,
      dbName: string,
      deletePrivate: boolean,
      deleteShared: boolean
    ): Promise<void | PouchDB.UpsertResponse>
    logoutUser(user_id: string, session_id: string): Promise<PouchDB.UpsertResponse>
    logoutSession(session_id: string): Promise<boolean | PouchDB.UpsertResponse>
    logoutOthers(session_id: string): Promise<boolean | PouchDB.UpsertResponse>
    removeUser(user_id: string, destroyDBs: boolean): Promise<void | PouchDB.Core.Response>
    confirmSession(
      key: string,
      password: string
    ): Promise<{
      userDBs?:
        | {
            [name: string]: string
          }
        | undefined
      user_id?: string | undefined
      token?: string | undefined
      issued?: number | undefined
      expires: number
      provider?: string | undefined
      ip?: string | undefined
      _id: string
      key: string
      password: string
      roles: string[]
    }>
    sendEmail(templateName: string, email: string, locals: Data): void
    quitRedis(): Promise<string>
    requireRole(requiredRole: string): RequestHandler
    requireAnyRole(possibleRoles: string[]): RequestHandler
    requireAllRoles(requiredRoles: string[]): RequestHandler
  }

  export interface ISLInstance extends IBaseSLInstance {
    on(event: string, cb: {}): void
  }
}
