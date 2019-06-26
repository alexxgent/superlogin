"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _ejs = require("ejs");

var _events = _interopRequireDefault(require("events"));

var _express = _interopRequireDefault(require("express"));

var _passport = _interopRequireWildcard(require("passport"));

var _pouchdbNode = _interopRequireDefault(require("pouchdb-node"));

var _pouchdbSecurityHelper = _interopRequireDefault(require("pouchdb-security-helper"));

var _pouchdbSeedDesign = _interopRequireDefault(require("pouchdb-seed-design"));

var _pouchdbUpsert = _interopRequireDefault(require("pouchdb-upsert"));

var _default2 = _interopRequireDefault(require("./config/default.config"));

var _configure = _interopRequireDefault(require("./configure"));

var _local = _interopRequireDefault(require("./local"));

var _mailer = _interopRequireDefault(require("./mailer"));

var _middleware = _interopRequireDefault(require("./middleware"));

var _oauth = _interopRequireDefault(require("./oauth"));

var _routes = _interopRequireDefault(require("./routes"));

var _user = _interopRequireDefault(require("./user"));

var _util = _interopRequireDefault(require("./util"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj["default"] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

// tslint:disable-next-line:no-var-requires
var userDesign = require("../designDocs/user-design");

_pouchdbNode["default"].plugin(_pouchdbSecurityHelper["default"]).plugin(_pouchdbUpsert["default"]);

var init =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(function* (configData, passport, userDB, couchAuthDB) {
    var config = (0, _configure["default"])(configData, _default2["default"]);

    var router = _express["default"].Router();

    var emitter = new _events["default"].EventEmitter();
    var finalPassport = passport || _passport["default"];
    var middleware = (0, _middleware["default"])(finalPassport); // Some extra default settings if no config object is specified

    if (!configData) {
      config.set(function (o) {
        return Object.assign({}, o, {
          testMode: {
            noEmail: true,
            debugEmail: true
          }
        });
      });
    } // Create the DBs if they weren't passed in


    if (!userDB) {
      userDB = new _pouchdbNode["default"](_util["default"].getFullDBURL(config.get().dbServer, config.get().dbServer.userDB));
    }

    if (!couchAuthDB && !config.get().dbServer.cloudant) {
      couchAuthDB = new _pouchdbNode["default"](_util["default"].getFullDBURL(config.get().dbServer, config.get().dbServer.couchAuthDB));
    }

    if (!userDB) {
      throw new Error('userDB must be passed in as the third argument or specified in the config file under dbServer.userDB');
    }

    var mailer = (0, _mailer["default"])(config);
    var user = (0, _user["default"])(config, userDB, couchAuthDB, mailer, emitter);
    var oauth = (0, _oauth["default"])(router, finalPassport, user, config); // Seed design docs for the user database

    var designWithProviders = _util["default"].addProvidersToDesignDoc(config, userDesign);

    try {
      yield (0, _pouchdbSeedDesign["default"])(userDB, designWithProviders);
    } catch (error) {
      console.error('failed seeding design docs!', error);
    } // Configure Passport local login and api keys


    (0, _local["default"])(config, finalPassport, user); // Load the routes

    (0, _routes["default"])(config, router, finalPassport, user);
    var superlogin = {
      config: config,
      router: router,
      mailer: mailer,
      passport: finalPassport,
      userDB: userDB,
      couchAuthDB: couchAuthDB,
      registerProvider: oauth.registerProvider,
      registerOAuth2: oauth.registerOAuth2,
      registerTokenProvider: oauth.registerTokenProvider,
      validateUsername: user.validateUsername,
      validateEmail: user.validateEmail,
      validateEmailUsername: user.validateEmailUsername,
      getUser: user.get,
      createUser: user.create,
      onCreate: user.onCreate,
      onLink: user.onLink,
      socialAuth: user.socialAuth,
      hashPassword: _util["default"].hashPassword,
      verifyPassword: _util["default"].verifyPassword,
      createSession: user.createSession,
      changePassword: user.changePassword,
      changeEmail: user.changeEmail,
      resetPassword: user.resetPassword,
      forgotPassword: user.forgotPassword,
      verifyEmail: user.verifyEmail,
      addUserDB: user.addUserDB,
      removeUserDB: user.removeUserDB,
      logoutUser: user.logoutUser,
      logoutSession: user.logoutSession,
      logoutOthers: user.logoutOthers,
      removeUser: user.remove,
      confirmSession: user.confirmSession,
      removeExpiredKeys: user.removeExpiredKeys,
      sendEmail: mailer.sendEmail,
      quitRedis: user.quitRedis,
      // authentication middleware
      requireAuth: middleware.requireAuth,
      requireRole: middleware.requireRole,
      requireAnyRole: middleware.requireAnyRole,
      requireAllRoles: middleware.requireAllRoles // tslint:disable-next-line

    };

    for (var key in emitter) {
      superlogin[key] = emitter[key];
    }

    return superlogin;
  });

  return function init(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
}();

var _default = init;
exports["default"] = _default;