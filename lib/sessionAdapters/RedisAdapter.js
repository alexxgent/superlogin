"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _debug = _interopRequireDefault(require("debug"));

var _redis = _interopRequireDefault(require("redis"));

var _utilPromisifyall = _interopRequireDefault(require("util-promisifyall"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var debug = (0, _debug["default"])('superlogin');

var RedisAdapter = function RedisAdapter(config) {
  var redisConfig = config.get().session.redis;
  var finalRedisConfig = redisConfig || {
    host: '127.0.0.1',
    port: 6379
  };
  var unix_socket = finalRedisConfig.unix_socket,
      url = finalRedisConfig.url,
      port = finalRedisConfig.port,
      host = finalRedisConfig.host,
      options = finalRedisConfig.options,
      password = finalRedisConfig.password;
  var redisClient = (0, _utilPromisifyall["default"])(unix_socket ? _redis["default"].createClient(unix_socket, options) : url ? _redis["default"].createClient(url, options) : _redis["default"].createClient(port || 6379, host || '127.0.0.1', options)); // Authenticate with Redis if necessary

  if (password) {
    redisClient.authAsync(password)["catch"](function (err) {
      throw new Error(err);
    });
  }

  redisClient.on('error', function (err) {
    return console.error("Redis error: " + err);
  });
  redisClient.on('connect', function () {
    return debug('Redis is ready');
  });

  var storeKey =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (key, life, data) {
      return redisClient.psetexAsync(key, life, data);
    });

    return function storeKey(_x, _x2, _x3) {
      return _ref.apply(this, arguments);
    };
  }();

  var deleteKeys =
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(function* (keys) {
      return redisClient.delAsync(keys);
    });

    return function deleteKeys(_x4) {
      return _ref2.apply(this, arguments);
    };
  }();

  var getKey =
  /*#__PURE__*/
  function () {
    var _ref3 = _asyncToGenerator(function* (key) {
      return redisClient.getAsync(key);
    });

    return function getKey(_x5) {
      return _ref3.apply(this, arguments);
    };
  }();

  var quit = function quit() {
    return redisClient.quit();
  };

  return {
    storeKey: storeKey,
    deleteKeys: deleteKeys,
    getKey: getKey,
    quit: quit
  };
};

var _default = RedisAdapter;
exports["default"] = _default;