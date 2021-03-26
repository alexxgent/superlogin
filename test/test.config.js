module.exports = {
  port: 5000,
  testMode: {
    noEmail: true,
    oauthDebug: true
  },
  dbServer: {
    protocol: process.env.COUCH_PROTOCOL || 'http://',
    host: process.env.COUCH_HOST || 'localhost:5984',
    user: process.env.COUCH_USER || 'admin',
    password: process.env.COUCH_PASS || 'local',
    userDB: 'sl_test-users',
    couchAuthDB: 'sl_test-keys'
  },
  security: {
    maxFailedLogins: 2,
    lockoutTime: 600
  },
  local: {
    sendConfirmEmail: true
  },
  session: {
    adapter: 'redis',
    redis: { password: 'local' }
  },
  mailer: {
    fromEmail: 'me@example.com',
    logger: true
  },
  userDBs: {
    designDocDir: __dirname + '/ddocs',
    privatePrefix: 'test'
  },
  providers: {
    facebook: {
      clientID: 'FAKE_ID',
      clientSecret: 'FAKE_SECRET'
    },
    twitter: {
      consumerKey: 'FAKE_KEY',
      consumerSecret: 'FAKE_SECRET'
    }
  }
}
