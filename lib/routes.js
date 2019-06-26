"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _util = _interopRequireDefault(require("./util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

var routes = function routes(config, router, passport, user) {
  router.post('/login', function (req, res, next) {
    passport.authenticate('local', function (error, passportUser, info) {
      if (error) {
        return res.status(500).json({
          error: error
        });
      }

      if (!passportUser) {
        // Authentication failed
        return res.status(401).json(info);
      } // Success


      req.logIn(passportUser, {
        session: false
      }, function (loginErr) {
        return loginErr ? next(loginErr) : undefined;
      });
      return next();
    })(req, res, next);
  }, function (req, res, next) {
    return (// Success handler
      user.createSession(req.user._id, 'local', req).then(function (mySession) {
        return res.status(200).json(mySession);
      }, next)
    );
  });
  router.post('/refresh', passport.authenticate('bearer', {
    session: false
  }), function (req, res, next) {
    return user.refreshSession(req.user.key).then(function (mySession) {
      return res.status(200).json(mySession);
    }, next);
  });
  router.post('/logout', function (req, res, next) {
    var sessionToken = _util["default"].getSessionToken(req);

    if (!sessionToken) {
      return next({
        error: 'unauthorized',
        status: 401
      });
    }

    return user.logoutSession(sessionToken).then(function () {
      return res.status(200).json({
        ok: true,
        success: 'Logged out'
      });
    }, function (err) {
      console.error('Logout failed', err);
      return next(err);
    });
  });
  router.post('/logout-others', passport.authenticate('bearer', {
    session: false
  }), function (req, res, next) {
    user.logoutOthers(req.user.key).then(function () {
      res.status(200).json({
        success: 'Other sessions logged out'
      });
    }, function (err) {
      console.error('Logout failed', err);
      return next(err);
    });
  });
  router.post('/logout-all', function (req, res, next) {
    var sessionToken = _util["default"].getSessionToken(req);

    if (!sessionToken) {
      return next({
        error: 'unauthorized',
        status: 401
      });
    }

    return user.logoutUser(null, sessionToken).then(function () {
      return res.status(200).json({
        success: 'Logged out'
      });
    }, function (err) {
      console.error('Logout-all failed', err);
      return next(err);
    });
  }); // Setting up the auth api

  router.post('/register', function (req, res, next) {
    user.create(req.body, req).then(function (newUser) {
      if (config.get().security.loginOnRegistration) {
        return user.createSession(newUser._id, 'local', req.ip).then(function (mySession) {
          return res.status(200).json(mySession);
        }, next);
      }

      return res.status(201).json({
        success: 'User created.'
      });
    }, next);
  });
  router.post('/forgot-password', function (req, res, next) {
    return user.forgotPassword(req.body.email, req).then(function () {
      return res.status(200).json({
        success: 'Password recovery email sent.'
      });
    }, next);
  });
  router.post('/password-reset', function (req, res, next) {
    user.resetPassword(req.body, req).then(function (currentUser) {
      if (config.get().security.loginOnPasswordReset) {
        return user.createSession(currentUser._id, 'local', req.ip).then(function (mySession) {
          return res.status(200).json(mySession);
        }, next);
      }

      return res.status(200).json({
        success: 'Password successfully reset.'
      });
    }, next);
  });
  router.post('/password-change', passport.authenticate('bearer', {
    session: false
  }), function (req, res, next) {
    user.changePasswordSecure(req.user._id, req.body, req).then(function () {
      res.status(200).json({
        success: 'password changed'
      });
    }, next);
  });
  router.post('/unlink/:provider', passport.authenticate('bearer', {
    session: false
  }), function (req, res, next) {
    var provider = req.params.provider;
    user.unlink(req.user._id, provider).then(function () {
      return res.status(200).json({
        success: _util["default"].capitalizeFirstLetter(provider) + " unlinked"
      });
    }, next);
  });
  router.get('/confirm-email/:token', function (req, res, next) {
    var redirectURL = config.get().local.confirmEmailRedirectURL;

    if (!req.params.token) {
      var err = {
        error: 'Email verification token required'
      };

      if (redirectURL) {
        return res.status(201).redirect(redirectURL + "?error=" + encodeURIComponent(err.error));
      }

      return res.status(400).send(err);
    }

    return user.verifyEmail(req.params.token, req).then(function () {
      return redirectURL ? res.status(201).redirect(redirectURL + "?success=true") : res.status(200).send({
        ok: true,
        success: 'Email verified'
      });
    }, function (err) {
      if (redirectURL) {
        var query = "?error=" + encodeURIComponent(err.error);

        if (err.message) {
          query += "&message=" + encodeURIComponent(err.message);
        }

        return res.status(201).redirect(redirectURL + query);
      }

      return next(err);
    });
  });
  router.get('/validate-username/:username', function (req, res, next) {
    if (!req.params.username) {
      return next({
        error: 'Username required',
        status: 400
      });
    }

    return user.validateUsername(req.params.username).then(function (err) {
      return err ? res.status(409).json({
        error: 'Username already in use'
      }) : res.status(200).json({
        ok: true
      });
    }, next);
  });
  router.get('/validate-email/:email', function (req, res, next) {
    var promise;

    if (!req.params.email) {
      return next({
        error: 'Email required',
        status: 400
      });
    }

    if (config.get().local.emailUsername) {
      promise = user.validateEmailUsername(req.params.email);
    } else {
      promise = user.validateEmail(req.params.email);
    }

    return promise.then(function (err) {
      return err ? res.status(409).json({
        error: 'Email already in use'
      }) : res.status(200).json({
        ok: true
      });
    }, next);
  });
  router.post('/change-email', passport.authenticate('bearer', {
    session: false
  }), function (req, res, next) {
    user.changeEmail(req.user._id, req.body.newEmail, req).then(function () {
      res.status(200).json({
        ok: true,
        success: 'Email changed'
      });
    }, next);
  }); // route to test token authentication

  router.get('/session', passport.authenticate('bearer', {
    session: false
  }), function (req, res) {
    var sessionUser = req.user;

    if (!sessionUser) {
      console.error('session auth error - no user provided');
      return res.status(401).json({
        error: 'no user provided'
      });
    }

    var user_id = sessionUser._id,
        key = sessionUser.key,
        finalUser = _objectWithoutPropertiesLoose(sessionUser, ["_id", "key"]);

    res.status(200).json(Object.assign({}, finalUser, {
      user_id: user_id
    }));
  });
};

var _default = routes;
exports["default"] = _default;