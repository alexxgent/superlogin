"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _FileAdapter = _interopRequireDefault(require("./sessionAdapters/FileAdapter"));

var _MemoryAdapter = _interopRequireDefault(require("./sessionAdapters/MemoryAdapter"));

var _RedisAdapter = _interopRequireDefault(require("./sessionAdapters/RedisAdapter"));

var _util = _interopRequireDefault(require("./util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

var tokenPrefix = 'token';

var secureToken = function secureToken(token) {
  var salt = token.salt,
      derived_key = token.derived_key,
      finalToken = _objectWithoutPropertiesLoose(token, ["salt", "derived_key"]);

  return finalToken;
};

var Session = function Session(config) {
  var sessionAdapter = config.get().session.adapter;
  var adapter = sessionAdapter === 'redis' ? (0, _RedisAdapter["default"])(config) : sessionAdapter === 'file' ? (0, _FileAdapter["default"])(config) : (0, _MemoryAdapter["default"])();
  return {
    confirmToken: function () {
      var _confirmToken = _asyncToGenerator(function* (key, password) {
        try {
          var result = yield adapter.getKey(tokenPrefix + ":" + key);

          if (!result) {
            return Promise.reject('invalid token');
          }

          var token = JSON.parse(result);
          yield _util["default"].verifyPassword(token, password);
          return secureToken(token);
        } catch (error) {
          console.error('confirm token error', error);
          return Promise.reject('invalid token');
        }
      });

      function confirmToken(_x, _x2) {
        return _confirmToken.apply(this, arguments);
      }

      return confirmToken;
    }(),
    deleteTokens: function () {
      var _deleteTokens = _asyncToGenerator(function* (keys) {
        if (!Array.isArray(keys)) {
          keys = [keys];
        }

        return adapter.deleteKeys(keys.map(function (key) {
          return tokenPrefix + ":" + key;
        }));
      });

      function deleteTokens(_x3) {
        return _deleteTokens.apply(this, arguments);
      }

      return deleteTokens;
    }(),
    fetchToken: function () {
      var _fetchToken = _asyncToGenerator(function* (key) {
        try {
          return adapter.getKey(tokenPrefix + ":" + key).then(function (result) {
            return JSON.parse(result);
          });
        } catch (error) {
          console.error('fetchToken error!', error);
          return undefined;
        }
      });

      function fetchToken(_x4) {
        return _fetchToken.apply(this, arguments);
      }

      return fetchToken;
    }(),
    storeToken: function () {
      var _storeToken = _asyncToGenerator(function* (token) {
        var password = token.password,
            salt = token.salt,
            derived_key = token.derived_key,
            key = token.key,
            expires = token.expires;

        try {
          if (!password && salt && derived_key) {
            yield adapter.storeKey(tokenPrefix + ":" + key, expires - Date.now(), JSON.stringify(token));
            return secureToken(token);
          }

          var hash = yield _util["default"].hashPassword(password);
          var finalToken = Object.assign({}, token, {
            salt: hash.salt,
            derived_key: hash.derived_key,
            password: undefined
          });
          yield adapter.storeKey(tokenPrefix + ":" + finalToken.key, finalToken.expires - Date.now(), JSON.stringify(finalToken));
          delete finalToken.salt;
          delete finalToken.derived_key;
          return secureToken(token);
        } catch (error) {
          console.error('error storing token', error);
          return undefined;
        }
      });

      function storeToken(_x5) {
        return _storeToken.apply(this, arguments);
      }

      return storeToken;
    }(),
    quit: function () {
      var _quit = _asyncToGenerator(function* () {
        return adapter.quit();
      });

      function quit() {
        return _quit.apply(this, arguments);
      }

      return quit;
    }()
  };
};

var _default = Session;
exports["default"] = _default;