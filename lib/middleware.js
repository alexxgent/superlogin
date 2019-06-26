"use strict";

exports.__esModule = true;
exports["default"] = void 0;

// Contains middleware useful for securing your routes
var middleware = function middleware(passport) {
  var forbiddenError = {
    error: 'Forbidden',
    message: 'You do not have permission to access this resource.',
    status: 403
  };
  var superloginError = {
    error: 'superlogin',
    message: 'requireAuth must be used before checking roles',
    status: 500 // Requires that the user be authenticated with a bearer token

  };

  var requireAuth = function requireAuth(req, res, next) {
    passport.authenticate('bearer', {
      session: false
    })(req, res, next);
  }; // Requires that the user have the specified role


  var requireRole = function requireRole(requiredRole) {
    return function (req, res, next) {
      if (!req.user) {
        return next(superloginError);
      }

      var roles = req.user.roles;

      if (!roles || !roles.length || roles.indexOf(requiredRole) === -1) {
        res.status(forbiddenError.status);
        res.json(forbiddenError);
      } else {
        next();
      }

      return undefined;
    };
  }; // Requires that the user have at least one of the specified roles


  var requireAnyRole = function requireAnyRole(possibleRoles) {
    return function (req, res, next) {
      if (!req.user) {
        return next(superloginError);
      }

      var roles = req.user.roles;

      if (Array.isArray(roles)) {
        var hasRole = possibleRoles.findIndex(function (role) {
          return roles.includes(role);
        }) > -1;

        if (hasRole) {
          return next();
        }
      }

      return res.status(forbiddenError.status).json(forbiddenError);
    };
  };

  var requireAllRoles = function requireAllRoles(requiredRoles) {
    return function (req, res, next) {
      if (!req.user) {
        return next(superloginError);
      }

      var roles = req.user.roles;

      if (Array.isArray(roles)) {
        var missingRole = requiredRoles.findIndex(function (role) {
          return !roles.includes(role);
        }) > -1;

        if (!missingRole) {
          return next();
        }
      }

      return res.status(forbiddenError.status).json(forbiddenError);
    };
  };

  return {
    requireAuth: requireAuth,
    requireRole: requireRole,
    requireAnyRole: requireAnyRole,
    requireAllRoles: requireAllRoles
  };
};

var _default = middleware;
exports["default"] = _default;