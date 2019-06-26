"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _couchPwd = _interopRequireDefault(require("couch-pwd"));

var _crypto = _interopRequireDefault(require("crypto"));

var _lodash = _interopRequireDefault(require("lodash.merge"));

var _urlsafeBase = _interopRequireDefault(require("urlsafe-base64"));

var _util = require("util");

var _uuid = _interopRequireDefault(require("uuid"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var URLSafeUUID = function URLSafeUUID() {
  return _urlsafeBase["default"].encode(_uuid["default"].v4(null, new Buffer(16)));
};

var hashToken = function hashToken(token) {
  return _crypto["default"].createHash('sha256').update(token).digest('hex');
};

var hashPassword =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(function* (password) {
    return new Promise(function (resolve, reject) {
      _couchPwd["default"].hash(password, function (err, salt, hash) {
        if (err) {
          return reject(err);
        }

        return resolve({
          salt: salt,
          derived_key: hash
        });
      });
    });
  });

  return function hashPassword(_x) {
    return _ref.apply(this, arguments);
  };
}();

var verifyPassword =
/*#__PURE__*/
function () {
  var _ref2 = _asyncToGenerator(function* (hashObj, password) {
    // tslint:disable-next-line:no-any
    var getHash = (0, _util.promisify)(_couchPwd["default"].hash);
    var iterations = hashObj.iterations,
        salt = hashObj.salt,
        derived_key = hashObj.derived_key;

    if (iterations) {
      _couchPwd["default"].iterations(iterations);
    }

    if (!salt || !derived_key) {
      return Promise.reject(false);
    }

    var hash = yield getHash(password, salt);

    if (hash.length !== derived_key.length || // Protect against timing attacks
    hash.split('').findIndex(function (_char, idx) {
      return _char !== derived_key[idx];
    }) > -1) {
      return Promise.reject(false);
    }

    return true;
  });

  return function verifyPassword(_x2, _x3) {
    return _ref2.apply(this, arguments);
  };
}();

var getDBURL = function getDBURL(_ref3) {
  var user = _ref3.user,
      protocol = _ref3.protocol,
      host = _ref3.host,
      password = _ref3.password;
  return user ? protocol + encodeURIComponent(user) + ":" + encodeURIComponent(password) + "@" + host : "" + protocol + host;
};

var getFullDBURL = function getFullDBURL(dbServer, dbName) {
  return getDBURL(dbServer) + "/" + dbName;
}; // tslint:disable-next-line:no-any


var toArray = function toArray(obj) {
  return Array.isArray(obj) ? obj : [obj];
};

var getSessions = function getSessions(_ref4) {
  var session = _ref4.session;
  return session ? Object.keys(session) : [];
};

var getExpiredSessions = function getExpiredSessions(_ref5, now) {
  var session = _ref5.session;
  return session ? Object.keys(session).filter(function (k) {
    var thisSession = session[k];
    return !thisSession.expires || thisSession.expires <= now;
  }) : [];
}; // Takes a req object and returns the bearer token, or undefined if it is not found


var getSessionToken = function getSessionToken(req) {
  if (req.headers && req.headers.authorization) {
    var auth = req.headers.authorization;
    var parts = auth.split(' ');

    if (parts.length === 2) {
      var scheme = parts[0];
      var credentials = parts[1];

      if (/^Bearer$/i.test(scheme)) {
        var parse = credentials.split(':');

        if (parse.length < 2) {
          return undefined;
        }

        return parse[0];
      }
    }
  }

  return undefined;
}; // Generates views for each registered provider in the user design doc


var addProvidersToDesignDoc = function addProvidersToDesignDoc(config, ddoc) {
  var providers = config.get().providers;

  if (!providers) {
    return ddoc;
  }

  var ddocTemplate = function ddocTemplate(provider) {
    return "function(doc){ if(doc." + provider + " && doc." + provider + ".profile) { emit(doc." + provider + ".profile.id,null); } }";
  };

  return (0, _lodash["default"])({}, ddoc, {
    auth: {
      views: Object.keys(providers).reduce(function (r, provider) {
        var _Object$assign;

        return Object.assign({}, r, (_Object$assign = {}, _Object$assign[provider] = {
          map: ddocTemplate(provider)
        }, _Object$assign));
      }, {})
    }
  });
}; // Capitalizes the first letter of a string


var capitalizeFirstLetter = function capitalizeFirstLetter(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}; // tslint:disable-next-line:no-any


var arrayUnion = function arrayUnion(a, b) {
  var result = a.concat(b);

  for (var i = 0; i < result.length; i += 1) {
    for (var j = i + 1; j < result.length; j += 1) {
      if (result[i] === result[j]) {
        result.splice(j -= 1, 1);
      }
    }
  }

  return result;
};

var _default = {
  URLSafeUUID: URLSafeUUID,
  hashToken: hashToken,
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  getDBURL: getDBURL,
  getFullDBURL: getFullDBURL,
  getSessions: getSessions,
  getExpiredSessions: getExpiredSessions,
  getSessionToken: getSessionToken,
  addProvidersToDesignDoc: addProvidersToDesignDoc,
  capitalizeFirstLetter: capitalizeFirstLetter,
  arrayUnion: arrayUnion,
  toArray: toArray
};
exports["default"] = _default;