"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _lodash = _interopRequireDefault(require("lodash.merge"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var configure = function configure(data, defaults) {
  var finalConfig = (0, _lodash["default"])({}, defaults, data);
  return {
    get: function get() {
      return finalConfig;
    },
    set: function set(setFunc) {
      return finalConfig = setFunc(finalConfig);
    }
  };
};

var _default = configure;
exports["default"] = _default;