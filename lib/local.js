"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _passportHttpBearerSl = _interopRequireDefault(require("passport-http-bearer-sl"));

var _passportLocal = _interopRequireDefault(require("passport-local"));

var _util = _interopRequireDefault(require("./util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var BearerStrategy = _passportHttpBearerSl["default"].Strategy;

var local = function local(config, passport, user) {
  var _config$get$local = config.get().local,
      usernameField = _config$get$local.usernameField,
      passwordField = _config$get$local.passwordField,
      requireEmailConfirm = _config$get$local.requireEmailConfirm;

  var handleFailedLogin =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (userDoc, req, done) {
      try {
        var locked = yield user.handleFailedLogin(userDoc, req);
        var message = locked ? "Maximum failed login attempts exceeded. Your account has been locked for " + Math.round(config.get().security.lockoutTime / 60) + " minutes." : 'Invalid username or password';
        return done(null, false, {
          error: 'Unauthorized',
          message: message
        });
      } catch (error) {
        console.error('handleFailedLogin error', handleFailedLogin);
        return done(null, false, {
          error: 'Unauthorized',
          message: error
        });
      }
    });

    return function handleFailedLogin(_x, _x2, _x3) {
      return _ref.apply(this, arguments);
    };
  }(); // API token strategy


  passport.use(new BearerStrategy(
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(function* (tokenPass, done) {
      var parse = tokenPass.split(':');

      if (parse.length < 2) {
        return done(null, false, {
          message: "invalid token - length too short: " + parse.length
        });
      }

      var token = parse[0];
      var password = parse[1];

      try {
        var thisUser = yield user.confirmSession(token, password);
        return done(null, thisUser);
      } catch (error) {
        console.error('error in local bearer strategy', error, token, password);
        return done(null, false, {
          message: error
        });
      }
    });

    return function (_x4, _x5) {
      return _ref2.apply(this, arguments);
    };
  }())); // Use local strategy

  passport.use(new _passportLocal["default"]({
    usernameField: usernameField,
    passwordField: passwordField,
    session: false,
    passReqToCallback: true
  },
  /*#__PURE__*/
  function () {
    var _ref3 = _asyncToGenerator(function* (req, username, password, done) {
      try {
        var thisUser = yield user.get(username);

        if (thisUser) {
          var thisLocal = thisUser.local,
              email = thisUser.email; // Check if the account is locked

          if (thisLocal && thisLocal.lockedUntil && thisLocal.lockedUntil > Date.now()) {
            return done(null, false, {
              error: 'Unauthorized',
              message: 'Your account is currently locked. Please wait a few minutes and try again.'
            });
          }

          if (!thisLocal || !thisLocal.derived_key) {
            return done(null, false, {
              error: 'Unauthorized',
              message: 'Invalid username or password'
            });
          }

          try {
            yield _util["default"].verifyPassword(thisLocal, password); // Check if the email has been confirmed if it is required

            if (requireEmailConfirm && !email) {
              return done(null, false, {
                error: 'Unauthorized',
                message: 'You must confirm your email address.'
              });
            } // Success!!!


            return done(null, thisUser);
          } catch (error) {
            return error ? done(error) : handleFailedLogin(thisUser, req, done);
          }
        } else {
          // user not found
          return done(null, false, {
            error: 'Unauthorized',
            message: 'Invalid username or password'
          });
        }
      } catch (error) {
        console.error('error in local strategy', error);
        return done(error);
      }
    });

    return function (_x6, _x7, _x8, _x9) {
      return _ref3.apply(this, arguments);
    };
  }()));
};

var _default = local;
exports["default"] = _default;