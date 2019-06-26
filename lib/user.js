"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _lodash = _interopRequireDefault(require("lodash.merge"));

var _sofaModel = _interopRequireDefault(require("sofa-model"));

var _url = _interopRequireDefault(require("url"));

var _dbAuth = _interopRequireDefault(require("./dbAuth"));

var _cloudant = _interopRequireDefault(require("./dbAuth/cloudant"));

var _session = _interopRequireDefault(require("./session"));

var _util = _interopRequireDefault(require("./util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }

function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

// regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/inupsert.js#L4
var EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;
var USER_REGEXP = /^[a-z0-9_-]{3,16}$/;

var user = function user(config, userDB, couchAuthDB, mailer, emitter) {
  var dbAuth = (0, _dbAuth["default"])(config, userDB, couchAuthDB);
  var session = (0, _session["default"])(config);
  var onCreateActions = [];
  var onLinkActions = []; // Token valid for 24 hours by default
  // Forget password token life

  var tokenLife = config.get().security.tokenLife || 86400; // Session token life

  var sessionLife = config.get().security.sessionLife || 86400;
  var emailUsername = config.get().local.emailUsername;

  var logActivity =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (user_id, action, provider, req, userDoc, saveDoc) {
      try {
        var logSize = config.get().security.userActivityLogSize;

        if (!logSize) {
          return Promise.resolve(userDoc);
        }

        var thisUser = userDoc || (yield userDB.get(user_id));
        var activity = [{
          timestamp: new Date().toISOString(),
          action: action,
          provider: provider,
          ip: req.ip
        }].concat(Array.isArray(thisUser.activity) ? thisUser.activity : []);

        if (activity.length > logSize) {
          activity.splice(logSize, activity.length - 1);
        }

        var finalUser = Object.assign({}, userDoc, {
          activity: activity
        });

        if (saveDoc) {
          yield userDB.upsert(thisUser._id, function (oldUser) {
            var _ref2 = oldUser,
                _ = _ref2.activity,
                oldData = _objectWithoutPropertiesLoose(_ref2, ["activity"]);

            return (0, _lodash["default"])({}, oldData, finalUser);
          });
        }

        return finalUser;
      } catch (error) {
        return userDoc;
      }
    });

    return function logActivity(_x, _x2, _x3, _x4, _x5, _x6) {
      return _ref.apply(this, arguments);
    };
  }();

  var logoutUserSessions =
  /*#__PURE__*/
  function () {
    var _ref3 = _asyncToGenerator(function* (userDoc, op, currentSession) {
      try {
        var sessions = op === 'all' || op === 'other' ? _util["default"].getSessions(userDoc) : _util["default"].getExpiredSessions(userDoc, Date.now());

        if (op === 'other' && currentSession) {
          // Remove the current session from the list of sessions we are going to delete
          var index = sessions.indexOf(currentSession);

          if (index > -1) {
            sessions.splice(index, 1);
          }
        }

        if (op === 'all') {
          delete userDoc.session;
        }

        if (sessions.length) {
          if (op === 'expired' || op === 'other') {
            sessions.forEach(function (s) {
              return delete userDoc.session[s];
            });
          }

          yield Promise.all([// Delete the sessions from our session store
          yield session.deleteTokens(sessions), // Remove the keys from our couchDB auth database
          yield dbAuth.removeKeys(sessions), // Deauthorize keys from each personal database
          yield dbAuth.deauthorizeUser(userDoc, sessions)]);
        }

        return userDoc;
      } catch (error) {
        console.error('error logging out user sessions!', error);
        return Promise.resolve(userDoc);
      }
    });

    return function logoutUserSessions(_x7, _x8, _x9) {
      return _ref3.apply(this, arguments);
    };
  }();

  var changePassword =
  /*#__PURE__*/
  function () {
    var _ref4 = _asyncToGenerator(function* (user_id, newPassword, userDoc, req) {
      req = req || {};
      var changePwUser;
      var doc = userDoc;

      try {
        if (!userDoc) {
          doc = yield userDB.get(user_id);
        }
      } catch (error) {
        return Promise.reject({
          error: 'User not found',
          status: 404
        });
      }

      changePwUser = doc;
      var hash = yield _util["default"].hashPassword(newPassword);

      if (!changePwUser.local) {
        changePwUser.local = {};
      }

      changePwUser.local.salt = hash.salt;
      changePwUser.local.derived_key = hash.derived_key;

      if (changePwUser.providers.indexOf('local') === -1) {
        changePwUser.providers.push('local');
      }

      var finalUser = yield logActivity(changePwUser._id, 'changed password', 'local', req, changePwUser);
      yield userDB.upsert(finalUser._id, function (oldUser) {
        return (0, _lodash["default"])({}, oldUser, finalUser);
      });
      return emitter.emit('password-change', changePwUser);
    });

    return function changePassword(_x10, _x11, _x12, _x13) {
      return _ref4.apply(this, arguments);
    };
  }();

  var logoutOthers =
  /*#__PURE__*/
  function () {
    var _ref5 = _asyncToGenerator(function* (session_id) {
      var logoutUserDoc;
      var finalUser;

      try {
        var results = yield userDB.query('auth/session', {
          key: session_id,
          include_docs: true
        });

        if (results.rows.length) {
          logoutUserDoc = results.rows[0].doc;

          if (logoutUserDoc.session && logoutUserDoc.session[session_id]) {
            finalUser = yield logoutUserSessions(logoutUserDoc, 'other', session_id);
          }
        }

        if (finalUser) {
          return userDB.upsert(finalUser._id, function (rawUser) {
            var _ref6 = rawUser,
                _ = _ref6.session,
                oldUser = _objectWithoutPropertiesLoose(_ref6, ["session"]);

            return finalUser ? (0, _lodash["default"])({}, oldUser, finalUser) : oldUser;
          });
        }

        return false;
      } catch (error) {
        console.error('error logging out others', error);
        return false;
      }
    });

    return function logoutOthers(_x14) {
      return _ref5.apply(this, arguments);
    };
  }();

  var addUserDBs =
  /*#__PURE__*/
  function () {
    var _ref7 = _asyncToGenerator(function* (newUser) {
      var _config$get = config.get(),
          userDBs = _config$get.userDBs; // Add personal DBs


      if (!userDBs || !userDBs.defaultDBs) {
        return Promise.resolve(newUser);
      }

      try {
        newUser.personalDBs = {};

        var processUserDBs =
        /*#__PURE__*/
        function () {
          var _ref8 = _asyncToGenerator(function* (dbList, type) {
            return Promise.all(dbList.map(
            /*#__PURE__*/
            function () {
              var _ref9 = _asyncToGenerator(function* (userDBName) {
                var dbConfig = dbAuth.getDBConfig(userDBName);
                var finalDBName = yield dbAuth.addUserDB(newUser, userDBName, dbConfig.designDocs || [], type, dbConfig.permissions || [], dbConfig.adminRoles || [], dbConfig.memberRoles || []);
                delete dbConfig.permissions;
                delete dbConfig.adminRoles;
                delete dbConfig.memberRoles;
                delete dbConfig.designDocs;
                dbConfig.type = type;
                newUser.personalDBs[finalDBName] = dbConfig;
              });

              return function (_x18) {
                return _ref9.apply(this, arguments);
              };
            }()));
          });

          return function processUserDBs(_x16, _x17) {
            return _ref8.apply(this, arguments);
          };
        }(); // Just in case defaultDBs is not specified


        var defaultPrivateDBs = userDBs.defaultDBs && userDBs.defaultDBs["private"];

        if (Array.isArray(defaultPrivateDBs)) {
          yield processUserDBs(defaultPrivateDBs, 'private');
        }

        var defaultSharedDBs = userDBs.defaultDBs.shared;

        if (Array.isArray(defaultSharedDBs)) {
          yield processUserDBs(defaultSharedDBs, 'shared');
        }

        return Promise.resolve(newUser);
      } catch (error) {
        console.error('addUserDBs failed', error);
        return newUser;
      }
    });

    return function addUserDBs(_x15) {
      return _ref7.apply(this, arguments);
    };
  }();

  var generateSession =
  /*#__PURE__*/
  function () {
    var _ref10 = _asyncToGenerator(function* (username, roles) {
      try {
        var key;

        if (config.get().dbServer.cloudant) {
          key = yield _cloudant["default"].getAPIKey(userDB);
        } else {
          var token = _util["default"].URLSafeUUID(); // Make sure our token doesn't start with illegal characters


          while (token[0] === '_' || token[0] === '-') {
            token = _util["default"].URLSafeUUID();
          }

          key = {
            key: token,
            password: _util["default"].URLSafeUUID()
          };
        }

        var now = Date.now();
        return Promise.resolve({
          _id: username,
          key: key.key,
          password: key.password,
          issued: now,
          expires: now + sessionLife * 1000,
          roles: roles
        });
      } catch (error) {
        console.error('error generating session!', error);
        throw error;
      }
    });

    return function generateSession(_x19, _x20) {
      return _ref10.apply(this, arguments);
    };
  }(); // ------> FIXME <------
  // Adds numbers to a base name until it finds a unique database key


  var generateUsername =
  /*#__PURE__*/
  function () {
    var _ref11 = _asyncToGenerator(function* (base) {
      base = base.toLowerCase();
      var entries = [];
      var finalName = '';
      var results = yield userDB.allDocs({
        startkey: base,
        endkey: base + "\uFFFF",
        include_docs: false
      });

      if (results.rows.length === 0) {
        return base;
      }

      results.rows.forEach(function (_ref12) {
        var id = _ref12.id;
        return entries.push(id);
      });

      if (entries.indexOf(base) === -1) {
        return base;
      }

      var num = 0;

      while (!finalName) {
        num += 1;

        if (entries.indexOf(base + num) === -1) {
          finalName = base + num;
        }
      }

      return finalName;
    });

    return function generateUsername(_x21) {
      return _ref11.apply(this, arguments);
    };
  }();

  var validateUsername =
  /*#__PURE__*/
  function () {
    var _ref13 = _asyncToGenerator(function* (username) {
      if (!username) {
        return Promise.resolve();
      }

      if (!username.match(USER_REGEXP)) {
        return Promise.resolve('Invalid username');
      }

      try {
        var result = yield userDB.query('auth/username', {
          key: username
        });

        if (result.rows.length === 0) {
          // Pass!
          return Promise.resolve();
        }

        return Promise.resolve('already in use');
      } catch (error) {
        throw new Error(error);
      }
    });

    return function validateUsername(_x22) {
      return _ref13.apply(this, arguments);
    };
  }();

  var validateEmail =
  /*#__PURE__*/
  function () {
    var _ref14 = _asyncToGenerator(function* (email) {
      if (!email) {
        return Promise.resolve();
      }

      if (!email.match(EMAIL_REGEXP)) {
        return Promise.resolve('invalid email');
      }

      try {
        var result = yield userDB.query('auth/email', {
          key: email
        });

        if (result.rows.length === 0) {
          // Pass!
          return Promise.resolve();
        }

        return Promise.resolve('already in use');
      } catch (error) {
        console.error('error validating email', error);
        throw new Error(error);
      }
    });

    return function validateEmail(_x23) {
      return _ref14.apply(this, arguments);
    };
  }();

  var validateEmailUsername =
  /*#__PURE__*/
  function () {
    var _ref15 = _asyncToGenerator(function* (email) {
      if (!email) {
        return Promise.resolve();
      }

      if (!email.match(EMAIL_REGEXP)) {
        return Promise.resolve('invalid email');
      }

      try {
        var result = yield userDB.query('auth/emailUsername', {
          key: email
        });

        if (result.rows.length === 0) {
          return Promise.resolve();
        }

        return Promise.resolve('already in use');
      } catch (error) {
        console.error('error validating email/username', error);
        throw new Error(error);
      }
    });

    return function validateEmailUsername(_x24) {
      return _ref15.apply(this, arguments);
    };
  }(); // Validation function for ensuring that two fields match


  var matches = function matches(value, option, key, attributes) {
    if (attributes && attributes[option] !== value) {
      return "does not match " + option;
    }

    return '';
  };

  var passwordConstraints = {
    presence: true,
    length: {
      minimum: 6,
      message: 'must be at least 6 characters'
    },
    matches: 'confirmPassword'
  };
  var defaultPConstraints = config.get().local.passwordConstraints;
  passwordConstraints = defaultPConstraints ? (0, _lodash["default"])({}, passwordConstraints, defaultPConstraints) : passwordConstraints;
  var userModel = {
    async: true,
    whitelist: ['name', 'username', 'email', 'password', 'confirmPassword'],
    customValidators: {
      validateEmail: validateEmail,
      validateUsername: validateUsername,
      validateEmailUsername: validateEmailUsername,
      matches: matches
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
    "static": {
      type: 'user',
      roles: config.get().security.defaultRoles,
      providers: ['local']
    },
    rename: {
      username: '_id' // tslint:disable-next-line:no-any

    }
  };

  if (emailUsername) {
    delete userModel.validate.username;
    delete userModel.validate.email.validateEmail;
    delete userModel.rename.username;
    userModel.validate.email.validateEmailUsername = true;
  }

  var resetPasswordModel = {
    async: true,
    customValidators: {
      matches: matches
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
  };
  var changePasswordModel = {
    async: true,
    customValidators: {
      matches: matches
    },
    validate: {
      newPassword: passwordConstraints,
      confirmPassword: {
        presence: true
      }
    }
  };

  var onCreate = function onCreate(fn) {
    if (typeof fn === 'function') {
      onCreateActions.push(fn);
    } else {
      throw new TypeError('onCreate: You must pass in a function');
    }
  };

  var onLink = function onLink(fn) {
    if (typeof fn === 'function') {
      onLinkActions.push(fn);
    } else {
      throw new TypeError('onLink: You must pass in a function');
    }
  };

  var processTransformations =
  /*#__PURE__*/
  function () {
    var _ref16 = _asyncToGenerator(function* (fnArray, userDoc, provider) {
      var finalDoc = userDoc;
      yield Promise.all(fnArray.map(
      /*#__PURE__*/
      function () {
        var _ref17 = _asyncToGenerator(function* (fn) {
          return finalDoc = yield fn(finalDoc, provider);
        });

        return function (_x28) {
          return _ref17.apply(this, arguments);
        };
      }()));
      return finalDoc;
    });

    return function processTransformations(_x25, _x26, _x27) {
      return _ref16.apply(this, arguments);
    };
  }();

  var get =
  /*#__PURE__*/
  function () {
    var _ref18 = _asyncToGenerator(function* (login) {
      var query;

      if (emailUsername) {
        query = 'emailUsername';
      } else {
        query = EMAIL_REGEXP.test(login) ? 'email' : 'username';
      }

      var results = yield userDB.query("auth/" + query, {
        key: login,
        include_docs: true
      });

      if (results.rows.length > 0) {
        return results.rows[0].doc;
      }

      return null;
    });

    return function get(_x29) {
      return _ref18.apply(this, arguments);
    };
  }();

  var create =
  /*#__PURE__*/
  function () {
    var _ref19 = _asyncToGenerator(function* (form, req) {
      req = req || {};
      var finalUserModel = userModel;
      var newUserModel = config.get().userModel;

      if (typeof newUserModel === 'object') {
        var whitelist = [];

        if (newUserModel.whitelist) {
          whitelist = _util["default"].arrayUnion(userModel.whitelist, newUserModel.whitelist);
        }

        finalUserModel = (0, _lodash["default"])({}, userModel, config.get().userModel);
        finalUserModel.whitelist = whitelist && whitelist.length > 0 ? whitelist : finalUserModel.whitelist;
      }

      var UserModel = new _sofaModel["default"](finalUserModel);
      var u = new UserModel(form);
      var newUser;

      try {
        newUser = yield u.process();

        if (emailUsername) {
          newUser._id = newUser.email;
        }

        if (config.get().local.sendConfirmEmail) {
          newUser.unverifiedEmail = {
            email: newUser.email,
            token: _util["default"].URLSafeUUID()
          };
          delete newUser.email;
        }

        var defaultRoles = config.get().security.defaultRoles; // Append/add default roles

        if (newUser.roles && Array.isArray(newUser.roles)) {
          newUser.roles.concat(defaultRoles);
        } else {
          newUser.roles = defaultRoles;
        } // Store password hash


        var hash = yield _util["default"].hashPassword(newUser.password);
        newUser.local = hash;
        delete newUser.password;
        delete newUser.confirmPassword;
        newUser.signUp = {
          provider: 'local',
          timestamp: new Date().toISOString(),
          ip: req.ip
        };
        newUser = yield addUserDBs(newUser);
        newUser = yield logActivity(newUser._id, 'signup', 'local', req, newUser);
        newUser = yield processTransformations(onCreateActions, newUser, 'local');
        var result = yield userDB.upsert(newUser._id, function (oldUser) {
          return (0, _lodash["default"])({}, oldUser, newUser);
        });
        newUser._rev = result.rev;

        if (config.get().local.sendConfirmEmail) {
          mailer.sendEmail('confirmEmail', newUser.unverifiedEmail.email, {
            req: req,
            user: newUser
          });
        }

        emitter.emit('signup', newUser, 'local');
        return Promise.resolve(newUser);
      } catch (error) {
        console.error('create user failed', error);
        return Promise.reject({
          error: 'Validation failed',
          validationErrors: error,
          status: 400
        });
      }
    });

    return function create(_x30, _x31) {
      return _ref19.apply(this, arguments);
    };
  }();

  var socialAuth =
  /*#__PURE__*/
  function () {
    var _ref20 = _asyncToGenerator(function* (provider, auth, profile, req) {
      var userDoc;
      var newAccount = false;
      var action;
      var baseUsername;
      var finalUsername = '';
      req = req || {};
      var _req = req,
          ip = _req.ip;

      try {
        var results = yield userDB.query("auth/" + provider, {
          key: profile.id,
          include_docs: true
        });

        if (results.rows.length > 0) {
          userDoc = results.rows[0].doc;
        } else {
          var _userDoc;

          newAccount = true; // tslint:disable-next-line:no-any

          userDoc = (_userDoc = {}, _userDoc[provider] = {}, _userDoc);

          if (profile.emails) {
            userDoc.email = profile.emails[0].value;
          }

          userDoc.providers = [provider];
          userDoc.type = 'user';
          userDoc.roles = config.get().security.defaultRoles;
          userDoc.signUp = {
            provider: provider,
            timestamp: new Date().toISOString(),
            ip: ip
          };

          var emailFail =
          /*#__PURE__*/
          function () {
            var _ref21 = _asyncToGenerator(function* () {
              return Promise.reject({
                error: 'Email already in use',
                message: 'Your email is already in use. Try signing in first and then linking this account.',
                status: 409
              });
            });

            return function emailFail() {
              return _ref21.apply(this, arguments);
            };
          }(); // Now we need to generate a username


          if (emailUsername) {
            if (!userDoc.email) {
              return Promise.reject({
                error: 'No email provided',
                message: "An email is required for registration, but " + provider + " didn't supply one.",
                status: 400
              });
            }

            var err = yield validateEmailUsername(userDoc.email);

            if (err) {
              return emailFail();
            }

            finalUsername = userDoc.email.toLowerCase();
          } else {
            if (profile.username) {
              baseUsername = profile.username.toLowerCase(); // If a username isn't specified we'll take it from the email
            } else if (userDoc.email) {
              var parseEmail = userDoc.email.split('@');
              baseUsername = parseEmail[0].toLowerCase();
            } else if (profile.displayName) {
              baseUsername = profile.displayName.replace(/\s/g, '').toLowerCase();
            } else {
              baseUsername = profile.id.toLowerCase();
            }

            var _err = yield validateEmail(userDoc.email);

            if (_err) {
              return emailFail();
            }

            finalUsername = yield generateUsername(baseUsername);
          }
        }

        if (finalUsername) {
          userDoc._id = finalUsername;
        }

        userDoc[provider].auth = auth;
        userDoc[provider].profile = profile;

        if (!userDoc.name) {
          userDoc.name = profile.displayName;
        }

        delete userDoc[provider].profile._raw;

        if (newAccount) {
          yield addUserDBs(userDoc);
        }

        action = newAccount ? 'signup' : 'login';
        userDoc = yield logActivity(userDoc._id, action, provider, req, userDoc);
        var finalUser = yield processTransformations(newAccount ? onCreateActions : onLinkActions, userDoc, provider);
        yield userDB.upsert(finalUser._id, function (oldUser) {
          return (0, _lodash["default"])({}, oldUser, finalUser);
        });

        if (action === 'signup') {
          emitter.emit('signup', finalUser, provider);
        }

        return finalUser;
      } catch (error) {
        console.error('social auth failed!', error);
        return undefined;
      }
    });

    return function socialAuth(_x32, _x33, _x34, _x35) {
      return _ref20.apply(this, arguments);
    };
  }();

  var linkSocial =
  /*#__PURE__*/
  function () {
    var _ref22 = _asyncToGenerator(function* (user_id, provider, auth, profile, req) {
      var _Object$assign;

      req = req || {};
      var linkUser;
      var results = yield userDB.query("auth/" + provider, {
        key: profile.id
      });

      if (results.rows.length > 0 && results.rows[0].id !== user_id) {
        return Promise.reject({
          error: 'Conflict',
          message: "This " + provider + " profile is already in use by another account.",
          status: 409
        });
      }

      var theUser = yield userDB.get(user_id);
      linkUser = theUser; // Check for conflicting provider

      if (linkUser[provider] && linkUser[provider].profile.id !== profile.id) {
        return Promise.reject({
          error: 'Conflict',
          message: "Your account is already linked with another " + provider + "profile.",
          status: 409
        });
      }

      var emailConflict; // Check email for conflict

      if (!profile.emails) {
        emailConflict = {
          rows: []
        };
      } else if (emailUsername) {
        emailConflict = yield userDB.query('auth/emailUsername', {
          key: profile.emails[0].value
        });
      } else {
        emailConflict = yield userDB.query('auth/email', {
          key: profile.emails[0].value
        });
      }

      var passed = true;

      if (emailConflict.rows.length > 0) {
        emailConflict.rows.forEach(function (row) {
          if (row.id !== user_id) {
            passed = false;
          }
        });
      }

      if (!passed) {
        return Promise.reject({
          error: 'Conflict',
          message: "The email " + profile.emails[0].value + " is already in use by another account.",
          status: 409
        });
      } // Insert provider info


      linkUser = Object.assign({}, linkUser, (_Object$assign = {}, _Object$assign[provider] = {
        auth: auth,
        profile: profile
      }, _Object$assign));

      if (!linkUser.providers) {
        linkUser.providers = [];
      }

      if (linkUser.providers.indexOf(provider) === -1) {
        linkUser.providers.push(provider);
      }

      if (!linkUser.name) {
        linkUser.name = profile.displayName;
      }

      delete linkUser[provider].profile._raw;
      var userDoc = yield logActivity(linkUser._id, 'link', provider, req, linkUser);
      var finalUser = yield processTransformations(onLinkActions, userDoc, provider);
      yield userDB.upsert(finalUser._id, function (oldUser) {
        return (0, _lodash["default"])({}, oldUser, finalUser);
      });
      return finalUser;
    });

    return function linkSocial(_x36, _x37, _x38, _x39, _x40) {
      return _ref22.apply(this, arguments);
    };
  }();

  var unlink =
  /*#__PURE__*/
  function () {
    var _ref23 = _asyncToGenerator(function* (user_id, provider) {
      // We cannot unlink local
      if (provider === 'local') {
        return Promise.reject({
          error: 'Unlink failed',
          message: "You can't unlink local.",
          status: 400
        });
      }

      try {
        var unLinkUser = yield userDB.get(user_id);

        if (!provider) {
          return Promise.reject({
            error: 'Unlink failed',
            message: 'You must specify a provider to unlink.',
            status: 400
          });
        } // We can only unlink if there are at least two providers


        if (!unLinkUser.providers || !Array.isArray(unLinkUser.providers) || unLinkUser.providers.length < 2) {
          console.error('unlink failed', unLinkUser);
          return Promise.reject({
            error: 'Unlink failed',
            message: "You can't unlink your only provider!",
            status: 400
          });
        } // Check that the provider exists


        if (!unLinkUser[provider] || typeof unLinkUser[provider] !== 'object') {
          return Promise.reject({
            error: 'Unlink failed',
            message: "Provider: " + _util["default"].capitalizeFirstLetter(provider) + " not found.",
            status: 404
          });
        }

        yield userDB.upsert(unLinkUser._id, function (oldUser) {
          var deleted = oldUser[provider],
              newUser = _objectWithoutPropertiesLoose(oldUser, [provider].map(_toPropertyKey));

          if (newUser.providers) {
            // Remove the unlinked provider from the list of providers
            newUser.providers.splice(unLinkUser.providers.indexOf(provider), 1);
          }

          unLinkUser = newUser;
          return newUser;
        });
        return unLinkUser;
      } catch (error) {
        console.error('error unlinking user', error);
        return undefined;
      }
    });

    return function unlink(_x41, _x42) {
      return _ref23.apply(this, arguments);
    };
  }();

  var createSession =
  /*#__PURE__*/
  function () {
    var _ref24 = _asyncToGenerator(function* (user_id, provider, req) {
      var createSessionUser;
      var newToken;
      var newSession;
      var password;
      req = req || {};
      var _req2 = req,
          ip = _req2.ip;

      try {
        createSessionUser = yield userDB.get(user_id);
        var token = yield generateSession(createSessionUser._id, createSessionUser.roles);
        password = token.password;
        newToken = token;
        newToken.provider = provider;
        yield session.storeToken(newToken);
        yield dbAuth.storeKey(user_id, newToken.key, password, newToken.expires, createSessionUser.roles); // Refresh the session user just in case new dbs are created by this point

        createSessionUser = yield userDB.get(user_id); // authorize the new session across all dbs

        if (!!createSessionUser.personalDBs) {
          yield dbAuth.authorizeUserSessions(user_id, createSessionUser.personalDBs, newToken.key, createSessionUser.roles);
        }

        if (!createSessionUser.session) {
          createSessionUser.session = {};
        }

        newSession = {
          issued: newToken.issued,
          expires: newToken.expires,
          provider: provider,
          ip: ip
        };
        createSessionUser.session[newToken.key] = newSession; // Clear any failed login attempts

        if (provider === 'local') {
          if (!createSessionUser.local) {
            createSessionUser.local = {};
          }

          createSessionUser.local.failedLoginAttempts = 0;
          delete createSessionUser.local.lockedUntil;
        }

        var _userDoc2 = yield logActivity(createSessionUser._id, 'login', provider, req, createSessionUser);

        var finalUser = yield logoutUserSessions(_userDoc2, 'expired');
        createSessionUser = finalUser;
        yield userDB.upsert(finalUser._id, function (rawDoc) {
          var oldDoc = rawDoc;

          if (oldDoc.local) {
            delete oldDoc.local.lockedUntil;
          }

          return (0, _lodash["default"])({}, oldDoc, finalUser);
        });
        newSession.token = newToken.key;
        newSession.password = password;
        newSession.user_id = createSessionUser._id;
        newSession.roles = createSessionUser.roles; // Inject the list of userDBs

        if (typeof createSessionUser.personalDBs === 'object') {
          var userDBs = {};
          var publicURL;
          var configPublicURL = config.get().dbServer.publicURL;

          if (configPublicURL) {
            var dbObj = _url["default"].parse(configPublicURL);

            dbObj.auth = newSession.token + ":" + newSession.password;
            publicURL = _url["default"].format(dbObj);
          } else {
            publicURL = "" + config.get().dbServer.protocol + newSession.token + ":" + newSession.password + "@" + config.get().dbServer.host + "/";
          }

          Object.keys(createSessionUser.personalDBs).forEach(function (finalDBName) {
            userDBs[createSessionUser.personalDBs[finalDBName].name] = "" + publicURL + finalDBName;
          });
          newSession.userDBs = userDBs;
        }

        if (createSessionUser.profile) {
          newSession.profile = createSessionUser.profile;
        }

        emitter.emit('login', newSession, provider);
        return newSession;
      } catch (error) {
        console.error('failed creating a user session', error);
        return undefined;
      }
    });

    return function createSession(_x43, _x44, _x45) {
      return _ref24.apply(this, arguments);
    };
  }();

  var handleFailedLogin =
  /*#__PURE__*/
  function () {
    var _ref25 = _asyncToGenerator(function* (loginUser, req) {
      req = req || {};
      var maxFailedLogins = config.get().security.maxFailedLogins;

      if (!maxFailedLogins) {
        return Promise.resolve();
      }

      if (!loginUser.local) {
        loginUser.local = {};
      }

      if (!loginUser.local.failedLoginAttempts) {
        loginUser.local.failedLoginAttempts = 0;
      }

      loginUser.local.failedLoginAttempts += 1;

      if (loginUser.local.failedLoginAttempts > maxFailedLogins) {
        loginUser.local.failedLoginAttempts = 0;
        loginUser.local.lockedUntil = Date.now() + config.get().security.lockoutTime * 1000;
      }

      var finalUser = yield logActivity(loginUser._id, 'failed login', 'local', req, loginUser);
      yield userDB.upsert(finalUser._id, function (oldUser) {
        return (0, _lodash["default"])({}, oldUser, finalUser);
      });
      return !!loginUser.local.lockedUntil;
    });

    return function handleFailedLogin(_x46, _x47) {
      return _ref25.apply(this, arguments);
    };
  }();

  var refreshSession =
  /*#__PURE__*/
  function () {
    var _ref26 = _asyncToGenerator(function* (key, pass) {
      var newSession;

      try {
        var oldToken = yield session.fetchToken(key);
        newSession = oldToken;
        newSession.expires = Date.now() + sessionLife * 1000;
        var results = yield Promise.all([yield userDB.get(newSession._id), yield session.storeToken(newSession)]);
        var _userDoc3 = results[0];
        _userDoc3.session[key] = Object.assign({}, _userDoc3.session[key], {
          expires: newSession.expires // Clean out expired sessions on refresh

        });
        var finalUser = yield logoutUserSessions(_userDoc3, 'expired');
        yield userDB.upsert(finalUser._id, function (oldUser) {
          return (0, _lodash["default"])({}, oldUser, finalUser);
        });
        delete newSession.password;
        newSession.token = newSession.key;
        delete newSession.key;
        newSession.user_id = newSession._id;
        delete newSession._id;
        delete newSession.salt;
        delete newSession.derived_key;
        emitter.emit('refresh', newSession);
        return newSession;
      } catch (error) {
        console.error('error refreshing session', error);
        return undefined;
      }
    });

    return function refreshSession(_x48, _x49) {
      return _ref26.apply(this, arguments);
    };
  }();

  var resetPassword = function resetPassword(form, req) {
    req = req || {};
    var ResetPasswordModel = new _sofaModel["default"](resetPasswordModel);
    var passwordResetForm = new ResetPasswordModel(form);
    var resetUser;
    return passwordResetForm.validate().then(
    /*#__PURE__*/
    _asyncToGenerator(function* () {
      var tokenHash = _util["default"].hashToken(form.token);

      return userDB.query('auth/passwordReset', {
        key: tokenHash,
        include_docs: true
      });
    }),
    /*#__PURE__*/
    function () {
      var _ref28 = _asyncToGenerator(function* (err) {
        return Promise.reject({
          error: 'Validation failed',
          validationErrors: err,
          status: 400
        });
      });

      return function (_x50) {
        return _ref28.apply(this, arguments);
      };
    }()).then(
    /*#__PURE__*/
    function () {
      var _ref29 = _asyncToGenerator(function* (results) {
        if (!results.rows.length) {
          return Promise.reject({
            status: 400,
            error: 'Invalid token'
          });
        }

        resetUser = results.rows[0].doc;

        if (resetUser.forgotPassword.expires < Date.now()) {
          return Promise.reject({
            status: 400,
            error: 'Token expired'
          });
        }

        return _util["default"].hashPassword(form.password);
      });

      return function (_x51) {
        return _ref29.apply(this, arguments);
      };
    }()).then(
    /*#__PURE__*/
    function () {
      var _ref30 = _asyncToGenerator(function* (hash) {
        if (!resetUser.local) {
          resetUser.local = {};
        }

        resetUser.local.salt = hash.salt;
        resetUser.local.derived_key = hash.derived_key;

        if (!resetUser.providers) {
          resetUser.providers = ['local'];
        } else if (resetUser.providers.indexOf('local') === -1) {
          resetUser.providers = [].concat(resetUser.providers, ['local']);
        } // logout user completely


        return logoutUserSessions(resetUser, 'all');
      });

      return function (_x52) {
        return _ref30.apply(this, arguments);
      };
    }()).then(
    /*#__PURE__*/
    function () {
      var _ref31 = _asyncToGenerator(function* (userDoc) {
        resetUser = userDoc;
        delete resetUser.forgotPassword;
        return logActivity(resetUser._id, 'reset password', 'local', req, resetUser);
      });

      return function (_x53) {
        return _ref31.apply(this, arguments);
      };
    }()).then(
    /*#__PURE__*/
    function () {
      var _ref32 = _asyncToGenerator(function* (finalUser) {
        return userDB.upsert(finalUser._id, function (rawUser) {
          var oldUser = rawUser;
          delete oldUser.forgotPassword;
          return (0, _lodash["default"])({}, oldUser, finalUser);
        });
      });

      return function (_x54) {
        return _ref32.apply(this, arguments);
      };
    }()).then(
    /*#__PURE__*/
    _asyncToGenerator(function* () {
      emitter.emit('password-reset', resetUser);
      return Promise.resolve(resetUser);
    }));
  };

  var changePasswordSecure =
  /*#__PURE__*/
  function () {
    var _ref34 = _asyncToGenerator(function* (user_id, form, req) {
      req = req || {};
      var ChangePasswordModel = new _sofaModel["default"](changePasswordModel);
      var changePasswordForm = new ChangePasswordModel(form);
      var changePwUser;
      return changePasswordForm.validate().then(
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        return userDB.get(user_id);
      }),
      /*#__PURE__*/
      function () {
        var _ref36 = _asyncToGenerator(function* (err) {
          return Promise.reject({
            error: 'Validation failed',
            validationErrors: err,
            status: 400
          });
        });

        return function (_x58) {
          return _ref36.apply(this, arguments);
        };
      }()).then(
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        return userDB.get(user_id);
      })).then(
      /*#__PURE__*/
      function () {
        var _ref38 = _asyncToGenerator(function* (userDoc) {
          changePwUser = userDoc;

          if (changePwUser.local && changePwUser.local.salt && changePwUser.local.derived_key) {
            // Password is required
            if (!form.currentPassword) {
              return Promise.reject({
                error: 'Password change failed',
                message: 'You must supply your current password in order to change it.',
                status: 400
              });
            }

            return _util["default"].verifyPassword(changePwUser.local, form.currentPassword);
          }

          return Promise.resolve();
        });

        return function (_x59) {
          return _ref38.apply(this, arguments);
        };
      }()).then(
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        return changePassword(changePwUser._id, form.newPassword, changePwUser, req);
      }),
      /*#__PURE__*/
      function () {
        var _ref40 = _asyncToGenerator(function* (err) {
          return Promise.reject(err || {
            error: 'Password change failed',
            message: 'The current password you supplied is incorrect.',
            status: 400
          });
        });

        return function (_x60) {
          return _ref40.apply(this, arguments);
        };
      }()).then(
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        if (req.user && req.user.key) {
          return logoutOthers(req.user.key);
        }

        return Promise.resolve();
      }));
    });

    return function changePasswordSecure(_x55, _x56, _x57) {
      return _ref34.apply(this, arguments);
    };
  }();

  var forgotPassword =
  /*#__PURE__*/
  function () {
    var _ref42 = _asyncToGenerator(function* (email, req) {
      req = req || {};
      var forgotPwUser;
      var token;
      var tokenHash;

      try {
        var result = yield userDB.query('auth/email', {
          key: email,
          include_docs: true
        });

        if (!result.rows.length) {
          return Promise.reject({
            error: 'User not found',
            status: 404
          });
        }

        forgotPwUser = result.rows[0].doc;
        token = _util["default"].URLSafeUUID();
        tokenHash = _util["default"].hashToken(token);
        forgotPwUser.forgotPassword = {
          token: tokenHash,
          // Store secure hashed token
          issued: Date.now(),
          expires: Date.now() + tokenLife * 1000
        };
        var finalUser = yield logActivity(forgotPwUser._id, 'forgot password', 'local', req, forgotPwUser);
        yield userDB.upsert(finalUser._id, function (oldUser) {
          return (0, _lodash["default"])({}, oldUser, finalUser);
        });
        mailer.sendEmail('forgotPassword', forgotPwUser.email || forgotPwUser.unverifiedEmail.email, {
          user: forgotPwUser,
          req: req,
          token: token
        }); // Send user the unhashed token

        emitter.emit('forgot-password', forgotPwUser);
        return forgotPwUser.forgotPassword;
      } catch (error) {
        console.error('error in forgot password', error);
        return undefined;
      }
    });

    return function forgotPassword(_x61, _x62) {
      return _ref42.apply(this, arguments);
    };
  }();

  var verifyEmail =
  /*#__PURE__*/
  function () {
    var _ref43 = _asyncToGenerator(function* (token, req) {
      req = req || {};
      var verifyEmailUser;
      var result = yield userDB.query('auth/verifyEmail', {
        key: token,
        include_docs: true
      });

      if (!result.rows.length) {
        return Promise.reject({
          error: 'Invalid token',
          status: 400
        });
      }

      verifyEmailUser = result.rows[0].doc;
      verifyEmailUser.email = verifyEmailUser.unverifiedEmail.email;
      delete verifyEmailUser.unverifiedEmail;
      emitter.emit('email-verified', verifyEmailUser);
      var finalUser = yield logActivity(verifyEmailUser._id, 'verified email', 'local', req, verifyEmailUser);
      return userDB.upsert(finalUser._id, function (rawUser) {
        var oldUser = rawUser;
        delete oldUser.unverifiedEmail;
        return (0, _lodash["default"])({}, oldUser, finalUser);
      });
    });

    return function verifyEmail(_x63, _x64) {
      return _ref43.apply(this, arguments);
    };
  }();

  var changeEmail =
  /*#__PURE__*/
  function () {
    var _ref44 = _asyncToGenerator(function* (user_id, newEmail, req) {
      req = req || {};
      var changeEmailUser;

      if (!req.user) {
        req.user = {
          provider: 'local'
        };
      }

      try {
        var err = yield validateEmail(newEmail);

        if (err) {
          return Promise.reject(err);
        }

        changeEmailUser = yield userDB.get(user_id);

        if (config.get().local.sendConfirmEmail) {
          changeEmailUser.unverifiedEmail = {
            email: newEmail,
            token: _util["default"].URLSafeUUID()
          };
          mailer.sendEmail('confirmEmail', changeEmailUser.unverifiedEmail.email, {
            req: req,
            user: changeEmailUser
          });
        } else {
          changeEmailUser.email = newEmail;
        }

        emitter.emit('email-changed', changeEmailUser);
        var finalUser = yield logActivity(changeEmailUser._id, 'changed email', req.user.provider, req, changeEmailUser);
        yield userDB.upsert(finalUser._id, function (oldUser) {
          return (0, _lodash["default"])({}, oldUser, finalUser);
        });
        return finalUser;
      } catch (error) {
        console.error('error changing email', error);
        return;
      }
    });

    return function changeEmail(_x65, _x66, _x67) {
      return _ref44.apply(this, arguments);
    };
  }();

  var addUserDB =
  /*#__PURE__*/
  function () {
    var _ref45 = _asyncToGenerator(function* (user_id, dbName, type, designDocs, permissions) {
      try {
        var dbConfig = dbAuth.getDBConfig(dbName, type || 'private');
        dbConfig.designDocs = designDocs || dbConfig.designDocs || '';
        dbConfig.permissions = permissions || dbConfig.permissions;

        var _userDoc4 = yield userDB.get(user_id);

        var finalDBName = yield dbAuth.addUserDB(_userDoc4, dbName, dbConfig.designDocs, dbConfig.type, dbConfig.permissions, dbConfig.adminRoles, dbConfig.memberRoles);

        if (!_userDoc4.personalDBs) {
          _userDoc4.personalDBs = {};
        }

        delete dbConfig.designDocs; // If permissions is specified explicitly it will be saved, otherwise will be taken from defaults every session

        if (!permissions) {
          delete dbConfig.permissions;
        }

        delete dbConfig.adminRoles;
        delete dbConfig.memberRoles;
        _userDoc4.personalDBs[finalDBName] = dbConfig;
        emitter.emit('user-db-added', user_id, dbName);
        yield userDB.upsert(_userDoc4._id, function (oldUser) {
          return (0, _lodash["default"])({}, oldUser, _userDoc4);
        });
        return _userDoc4;
      } catch (error) {
        console.error('error adding user db', error);
        return undefined;
      }
    });

    return function addUserDB(_x68, _x69, _x70, _x71, _x72) {
      return _ref45.apply(this, arguments);
    };
  }();

  var removeUserDB =
  /*#__PURE__*/
  function () {
    var _ref46 = _asyncToGenerator(function* (user_id, dbName, deletePrivate, deleteShared) {
      var removeUser;
      var update = false;
      var dbID;

      try {
        var _userDoc5 = yield userDB.get(user_id);

        removeUser = _userDoc5;

        if (removeUser.personalDBs && typeof removeUser.personalDBs === 'object') {
          yield Promise.all(Object.keys(removeUser.personalDBs).map(
          /*#__PURE__*/
          function () {
            var _ref47 = _asyncToGenerator(function* (db) {
              if (removeUser.personalDBs[db].name === dbName) {
                dbID = db;
                var type = removeUser.personalDBs[db].type;
                delete removeUser.personalDBs[db];
                update = true;

                try {
                  if (type === 'private' && deletePrivate) {
                    yield dbAuth.removeDB(db);
                    return Promise.resolve();
                  }

                  if (type === 'shared' && deleteShared) {
                    yield dbAuth.removeDB(db);
                    return Promise.resolve();
                  }
                } catch (error) {
                  console.error('error removing user db', db, dbName, error);
                }
              }

              return Promise.resolve();
            });

            return function (_x77) {
              return _ref47.apply(this, arguments);
            };
          }()));
        }

        if (update) {
          emitter.emit('user-db-removed', user_id, dbName);
          return userDB.upsert(removeUser._id, function (rawUser) {
            var oldUser = rawUser;

            if (oldUser.personalDBs[dbID]) {
              delete oldUser.personalDBs[dbID];
            }

            return (0, _lodash["default"])({}, oldUser, removeUser);
          });
        }

        return Promise.resolve();
      } catch (error) {
        console.error('error removing user db', error);
        return Promise.resolve();
      }
    });

    return function removeUserDB(_x73, _x74, _x75, _x76) {
      return _ref46.apply(this, arguments);
    };
  }();

  var logoutUser =
  /*#__PURE__*/
  function () {
    var _ref48 = _asyncToGenerator(function* (user_id, session_id) {
      var logoutUserDoc;

      if (user_id) {
        logoutUserDoc = yield userDB.get(user_id);
      } else {
        if (!session_id) {
          return Promise.reject({
            error: 'unauthorized',
            message: 'Either user_id or session_id must be specified',
            status: 401
          });
        }

        var results = yield userDB.query('auth/session', {
          key: session_id,
          include_docs: true
        });

        if (!results.rows.length) {
          return Promise.reject({
            error: 'unauthorized',
            status: 401
          });
        }

        logoutUserDoc = results.rows[0].doc;
      }

      user_id = logoutUserDoc._id;
      yield logoutUserSessions(logoutUserDoc, 'all');
      emitter.emit('logout', user_id);
      emitter.emit('logout-all', user_id);
      return userDB.upsert(logoutUserDoc._id, function (rawUser) {
        var oldUser = rawUser;
        delete oldUser.session;
        return (0, _lodash["default"])({}, oldUser, logoutUserDoc);
      });
    });

    return function logoutUser(_x78, _x79) {
      return _ref48.apply(this, arguments);
    };
  }();

  var logoutSession =
  /*#__PURE__*/
  function () {
    var _ref49 = _asyncToGenerator(function* (session_id) {
      var logoutUserDoc;
      var startSessions = 0;
      var endSessions = 0;

      try {
        var results = yield userDB.query('auth/session', {
          key: session_id,
          include_docs: true
        });

        if (!results.rows.length) {
          return Promise.reject({
            error: 'unauthorized',
            status: 401
          });
        }

        logoutUserDoc = results.rows[0].doc;

        if (logoutUserDoc.session) {
          startSessions = Object.keys(logoutUserDoc.session).length;

          if (logoutUserDoc.session[session_id]) {
            delete logoutUserDoc.session[session_id];
          }
        }

        yield Promise.all([yield session.deleteTokens(session_id), yield dbAuth.removeKeys(session_id), logoutUserDoc ? yield dbAuth.deauthorizeUser(logoutUserDoc, session_id) : yield Promise.resolve()]);
        var finalUser = yield logoutUserSessions(logoutUserDoc, 'expired');
        logoutUserDoc = finalUser;

        if (logoutUserDoc.session) {
          endSessions = Object.keys(logoutUserDoc.session).length;
        }

        emitter.emit('logout', logoutUserDoc._id);

        if (startSessions !== endSessions) {
          return userDB.upsert(logoutUserDoc._id, function (rawUser) {
            var oldUser = rawUser;
            delete oldUser.session;
            return (0, _lodash["default"])({}, oldUser, logoutUserDoc);
          });
        }

        return false;
      } catch (error) {
        console.error('error logging out session', error);
        return false;
      }
    });

    return function logoutSession(_x80) {
      return _ref49.apply(this, arguments);
    };
  }();

  var remove =
  /*#__PURE__*/
  function () {
    var _ref50 = _asyncToGenerator(function* (user_id, destroyDBs) {
      var removeUser;

      try {
        var _userDoc6 = yield userDB.get(user_id);

        yield logoutUserSessions(_userDoc6, 'all');
        removeUser = _userDoc6;

        if (destroyDBs !== true || !removeUser.personalDBs) {
          return Promise.resolve();
        }

        yield Promise.all(Object.keys(removeUser.personalDBs).map(
        /*#__PURE__*/
        function () {
          var _ref51 = _asyncToGenerator(function* (userdb) {
            if (removeUser.personalDBs[userdb].type === 'private') {
              yield dbAuth.removeDB(userdb);
            }

            return Promise.resolve();
          });

          return function (_x83) {
            return _ref51.apply(this, arguments);
          };
        }()));
        return userDB.remove(removeUser);
      } catch (error) {
        console.error('error removing user!', error);
        return Promise.resolve();
      }
    });

    return function remove(_x81, _x82) {
      return _ref50.apply(this, arguments);
    };
  }();

  var confirmSession =
  /*#__PURE__*/
  function () {
    var _ref52 = _asyncToGenerator(function* (key, password) {
      return session.confirmToken(key, password);
    });

    return function confirmSession(_x84, _x85) {
      return _ref52.apply(this, arguments);
    };
  }();

  var quitRedis = session.quit;
  return {
    dbAuth: dbAuth,
    session: session,
    onCreateActions: onCreateActions,
    onLinkActions: onLinkActions,
    // Token valid for 24 hours by default
    // Forget password token life
    tokenLife: tokenLife,
    // Session token life
    sessionLife: sessionLife,
    emailUsername: emailUsername,
    addUserDBs: addUserDBs,
    generateSession: generateSession,
    // ------> FIXME <------
    // Adds numbers to a base name until it finds a unique database key
    generateUsername: generateUsername,
    validateUsername: validateUsername,
    validateEmail: validateEmail,
    validateEmailUsername: validateEmailUsername,
    // Validation function for ensuring that two fields match
    matches: matches,
    passwordConstraints: passwordConstraints,
    userModel: userModel,
    resetPasswordModel: resetPasswordModel,
    changePasswordModel: changePasswordModel,
    onCreate: onCreate,
    onLink: onLink,
    processTransformations: processTransformations,
    get: get,
    create: create,
    socialAuth: socialAuth,
    linkSocial: linkSocial,
    unlink: unlink,
    createSession: createSession,
    handleFailedLogin: handleFailedLogin,
    refreshSession: refreshSession,
    resetPassword: resetPassword,
    changePasswordSecure: changePasswordSecure,
    changePassword: changePassword,
    forgotPassword: forgotPassword,
    verifyEmail: verifyEmail,
    changeEmail: changeEmail,
    addUserDB: addUserDB,
    removeUserDB: removeUserDB,
    logoutUser: logoutUser,
    logoutSession: logoutSession,
    logoutOthers: logoutOthers,
    logoutUserSessions: logoutUserSessions,
    remove: remove,
    removeExpiredKeys: dbAuth.removeExpiredKeys,
    confirmSession: confirmSession,
    quitRedis: quitRedis
  };
};

var _default = user;
exports["default"] = _default;