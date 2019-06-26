"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _superagent = _interopRequireDefault(require("superagent"));

var _url = _interopRequireDefault(require("url"));

var _util = _interopRequireDefault(require("./../util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var getSecurityUrl = function getSecurityUrl(db) {
  return _url["default"].format(_url["default"].parse(db.name).pathname + "/_security");
};

var getAPIKey =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(function* (db) {
    var finalUrl = _url["default"].format(_url["default"].parse(db.name).pathname + "/_api/v2/api_keys");

    try {
      var res = yield _superagent["default"].post(finalUrl);

      if (res) {
        var result = JSON.parse(res.text);

        if (result.key && result.password && result.ok === true) {
          return result;
        }

        return Promise.reject(result);
      }
    } catch (error) {
      console.error('error getting api key!', error);
      throw error;
    }
  });

  return function getAPIKey(_x) {
    return _ref.apply(this, arguments);
  };
}();

var getSecurityCloudant =
/*#__PURE__*/
function () {
  var _ref2 = _asyncToGenerator(function* (db) {
    var finalUrl = getSecurityUrl(db);
    var res = yield _superagent["default"].get(finalUrl);
    return Promise.resolve(JSON.parse(res.text));
  });

  return function getSecurityCloudant(_x2) {
    return _ref2.apply(this, arguments);
  };
}();

var putSecurityCloudant =
/*#__PURE__*/
function () {
  var _ref3 = _asyncToGenerator(function* (db, doc) {
    var finalUrl = getSecurityUrl(db);

    try {
      var res = yield _superagent["default"].put(finalUrl) //       .set(db.getHeaders())
      .send(doc);
      return JSON.parse(res.text);
    } catch (error) {
      throw error;
    }
  });

  return function putSecurityCloudant(_x3, _x4) {
    return _ref3.apply(this, arguments);
  };
}(); // This is not needed with Cloudant


var storeKey =
/*#__PURE__*/
function () {
  var _ref4 = _asyncToGenerator(function* () {
    return Promise.resolve();
  });

  return function storeKey() {
    return _ref4.apply(this, arguments);
  };
}(); // This is not needed with Cloudant


var removeKeys =
/*#__PURE__*/
function () {
  var _ref5 = _asyncToGenerator(function* () {
    return Promise.resolve(false);
  });

  return function removeKeys() {
    return _ref5.apply(this, arguments);
  };
}();

var initSecurity =
/*#__PURE__*/
function () {
  var _ref6 = _asyncToGenerator(function* (db, adminRoles, memberRoles) {
    var changes = false;
    var secDoc = yield db.get('_security');

    if (!secDoc.admins) {
      secDoc.admins = {
        names: [],
        roles: []
      };
    }

    if (!secDoc.admins.roles) {
      secDoc.admins.roles = [];
    }

    if (!secDoc.members) {
      secDoc.members = {
        names: [],
        roles: []
      };
    }

    if (!secDoc.members.roles) {
      secDoc.admins.roles = [];
    }

    adminRoles.forEach(function (role) {
      if (secDoc.admins.roles.indexOf(role) === -1) {
        changes = true;
        secDoc.admins.roles.push(role);
      }
    });
    memberRoles.forEach(function (role) {
      if (secDoc.members.roles.indexOf(role) === -1) {
        changes = true;
        secDoc.members.roles.push(role);
      }
    });

    if (changes) {
      return putSecurityCloudant(db, secDoc);
    }

    return false;
  });

  return function initSecurity(_x5, _x6, _x7) {
    return _ref6.apply(this, arguments);
  };
}();

var authorizeKeys =
/*#__PURE__*/
function () {
  var _ref7 = _asyncToGenerator(function* (user_id, db, keys, permissions, roles) {
    var keysObj = {};

    if (!permissions) {
      permissions = ['_reader', '_replicator'];
    }

    permissions = permissions.concat(roles || []);
    permissions.unshift("user:" + user_id); // If keys is a single value convert it to an Array

    keys = _util["default"].toArray(keys); // Check if keys is an array and convert it to an object

    if (keys instanceof Array) {
      keys.forEach(function (key) {
        keysObj[key] = permissions;
      });
    } else {
      keysObj = keys;
    } // Pull the current _security doc


    var secDoc = yield getSecurityCloudant(db);

    if (!secDoc._id) {
      secDoc._id = '_security';
    }

    if (!secDoc.cloudant) {
      secDoc.cloudant = {};
    }

    Object.keys(keysObj).forEach(function (key) {
      return secDoc.cloudant[key] = keysObj[key];
    });
    return putSecurityCloudant(db, secDoc);
  });

  return function authorizeKeys(_x8, _x9, _x10, _x11, _x12) {
    return _ref7.apply(this, arguments);
  };
}();

var deauthorizeKeys =
/*#__PURE__*/
function () {
  var _ref8 = _asyncToGenerator(function* (db, keys) {
    // cast keys to an Array
    keys = _util["default"].toArray(keys);
    var secDoc = yield getSecurityCloudant(db);
    var changes = false;

    if (!secDoc.cloudant) {
      return false;
    }

    keys.forEach(function (key) {
      if (secDoc.cloudant[key]) {
        changes = true;
        delete secDoc.cloudant[key];
      }
    });

    if (changes) {
      return putSecurityCloudant(db, secDoc);
    }

    return false;
  });

  return function deauthorizeKeys(_x13, _x14) {
    return _ref8.apply(this, arguments);
  };
}();

var _default = {
  getAPIKey: getAPIKey,
  getSecurityCloudant: getSecurityCloudant,
  putSecurityCloudant: putSecurityCloudant,
  storeKey: storeKey,
  removeKeys: removeKeys,
  initSecurity: initSecurity,
  authorizeKeys: authorizeKeys,
  deauthorizeKeys: deauthorizeKeys
};
exports["default"] = _default;