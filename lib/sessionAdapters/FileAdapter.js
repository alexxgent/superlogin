"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _debug = _interopRequireDefault(require("debug"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _path = _interopRequireDefault(require("path"));

var _utilPromisifyall = _interopRequireDefault(require("util-promisifyall"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var debug = (0, _debug["default"])('superlogin');
var fs = (0, _utilPromisifyall["default"])(_fsExtra["default"]);

var FileAdapter = function FileAdapter(config) {
  var fileConfig = config.get().session.file;
  var sessionsRoot = fileConfig ? fileConfig.sessionsRoot : undefined;

  var _sessionFolder = sessionsRoot ? _path["default"].join(process.env.PWD, sessionsRoot) : undefined;

  debug('File Adapter loaded');

  var _getFilepath = function _getFilepath(key) {
    return _path["default"].format({
      dir: _sessionFolder,
      base: key + ".json"
    });
  };

  var storeKey = function storeKey(key, life, data) {
    return fs.outputJsonAsync(_getFilepath(key), {
      data: data,
      expire: Date.now() + life
    });
  };

  var getKey = function getKey(key) {
    var now = Date.now();
    return fs.readJsonAsync(_getFilepath(key)).then(function (session) {
      if (session.expire > now) {
        return session.data;
      }

      return false;
    })["catch"](function () {
      return false;
    });
  };

  var deleteKeys =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (keys) {
      if (!(keys instanceof Array)) {
        keys = [keys];
      }

      var done = yield Promise.all(keys.map(
      /*#__PURE__*/
      function () {
        var _ref2 = _asyncToGenerator(function* (key) {
          return fs.removeAsync(_getFilepath(key));
        });

        return function (_x2) {
          return _ref2.apply(this, arguments);
        };
      }()));
      return done.length;
    });

    return function deleteKeys(_x) {
      return _ref.apply(this, arguments);
    };
  }();

  var quit =
  /*#__PURE__*/
  function () {
    var _ref3 = _asyncToGenerator(function* () {
      return Promise.resolve();
    });

    return function quit() {
      return _ref3.apply(this, arguments);
    };
  }();

  var _removeExpired = function _removeExpired() {// open all files and check session expire date
  };

  return {
    _getFilepath: _getFilepath,
    storeKey: storeKey,
    getKey: getKey,
    deleteKeys: deleteKeys,
    quit: quit,
    _removeExpired: _removeExpired
  };
};

var _default = FileAdapter;
exports["default"] = _default;