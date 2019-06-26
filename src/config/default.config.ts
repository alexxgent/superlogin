import { join } from 'path'

// These are the default settings that will be used if you don't override them in your config
const defaultConfig = {
  security: {
    defaultRoles: ['user'],
    maxFailedLogins: 4,
    lockoutTime: 300,
    sessionLife: 86400,
    tokenLife: 86400,
    loginOnRegistration: false,
    loginOnPasswordReset: false
  },
  local: {
    usernameField: 'username',
    passwordField: 'password'
  },
  session: {
    adapter: 'memory',
    file: {
      sessionsRoot: '.sessions'
    }
  },
  dbServer: {
    // tslint:disable-next-line:no-http-string
    protocol: 'http://',
    host: 'localhost:5984',
    designDocDir: join(__dirname, '../../designDocs'),
    userDB: 'sl_users',
    // CouchDB's _users database. Each session generates the user a unique login and password. This is not used with Cloudant.
    couchAuthDB: '_users'
  },
  emails: {
    confirmEmail: {
      subject: 'Please confirm your email',
      template: join(__dirname, '../../templates/email/confirm-email.ejs'),
      format: 'text'
    },
    forgotPassword: {
      subject: 'Your password reset link',
      template: join(__dirname, '../../templates/email/forgot-password.ejs'),
      format: 'text'
    }
  },
  mailer: {
    logger: true
  }
}

export default defaultConfig

declare global {
  export type IDefaultConfig = typeof defaultConfig
}
