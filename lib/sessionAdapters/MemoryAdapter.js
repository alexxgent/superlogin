"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var debug = (0, _debug["default"])('superlogin');

var MemoryAdapter = function MemoryAdapter() {
  var _keys = {};
  var _expires = {};
  debug('Memory Adapter loaded');

  var _removeExpired = function _removeExpired() {
    var now = Date.now();
    Object.keys(_expires).forEach(function (key) {
      if (_expires[key] < now) {
        delete _keys[key];
        delete _expires[key];
      }
    });
  };

  var storeKey = /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(function* (key, life, data) {
      var now = Date.now();
      _keys[key] = data;
      _expires[key] = now + life;

      _removeExpired();

      return Promise.resolve('OK');
    });

    return function storeKey(_x, _x2, _x3) {
      return _ref.apply(this, arguments);
    };
  }();

  var getKey = /*#__PURE__*/function () {
    var _ref2 = _asyncToGenerator(function* (key) {
      var now = Date.now();

      if (_keys[key] && _expires[key] > now) {
        return Promise.resolve(_keys[key]);
      }

      return false;
    });

    return function getKey(_x4) {
      return _ref2.apply(this, arguments);
    };
  }();

  var deleteKeys = /*#__PURE__*/function () {
    var _ref3 = _asyncToGenerator(function* (keys) {
      if (!Array.isArray(keys)) {
        keys = [keys];
      }

      keys.forEach(function (key) {
        delete _keys[key];
        delete _expires[key];
      });

      _removeExpired();

      return Promise.resolve(keys.length);
    });

    return function deleteKeys(_x5) {
      return _ref3.apply(this, arguments);
    };
  }();

  var quit = /*#__PURE__*/function () {
    var _ref4 = _asyncToGenerator(function* () {
      return Promise.resolve('OK');
    });

    return function quit() {
      return _ref4.apply(this, arguments);
    };
  }();

  return {
    storeKey: storeKey,
    getKey: getKey,
    deleteKeys: deleteKeys,
    quit: quit,
    _removeExpired: _removeExpired
  };
};

var _default = MemoryAdapter;
exports["default"] = _default;