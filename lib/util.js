"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _crypto = _interopRequireDefault(require("crypto"));

var _lodash = _interopRequireDefault(require("lodash.merge"));

var _urlsafeBase = _interopRequireDefault(require("urlsafe-base64"));

var _uuid = _interopRequireDefault(require("uuid"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var KEY_LEN = 20;
var KEY_SIZE = 16;
var KEY_ITERATIONS = 10;
var KEY_ENCODING = 'hex';
var KEY_DIGEST = 'SHA1';

var URLSafeUUID = function URLSafeUUID() {
  return _urlsafeBase["default"].encode(_uuid["default"].v4(null, new Buffer(16)));
};

var hashToken = function hashToken(token) {
  return _crypto["default"].createHash('sha256').update(token).digest('hex');
};

var hashPassword = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(function* (password) {
    return new Promise(function (resolve, reject) {
      return _crypto["default"].randomBytes(KEY_SIZE, function (err1, baseSalt) {
        if (err1) {
          return reject(err1);
        }

        var salt = baseSalt.toString('hex');

        _crypto["default"].pbkdf2(password, salt, KEY_ITERATIONS, KEY_LEN, KEY_DIGEST, function (err2, hash) {
          if (err2) {
            return reject(err2);
          }

          var derived_key = hash.toString(KEY_ENCODING);
          return resolve({
            salt: salt,
            derived_key: derived_key
          });
        });
      });
    });
  });

  return function hashPassword(_x) {
    return _ref.apply(this, arguments);
  };
}();

var verifyPassword = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(function* (hashObj, password) {
    var iterations = hashObj.iterations,
        salt = hashObj.salt,
        derived_key = hashObj.derived_key;

    if (!salt || !derived_key) {
      return Promise.reject(false);
    }

    return new Promise(function (resolve, reject) {
      return _crypto["default"].pbkdf2(password, salt, iterations || 10, KEY_LEN, KEY_DIGEST, function (err, hash) {
        if (err) {
          return reject(false);
        }

        if (hash.toString(KEY_ENCODING) === derived_key) {
          return resolve(true);
        } else {
          return reject(false);
        }
      });
    });
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