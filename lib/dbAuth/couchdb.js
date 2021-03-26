"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _lodash = _interopRequireDefault(require("lodash.merge"));

var _util = _interopRequireDefault(require("../util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var couchdb = function couchdb(couchAuthDB) {
  var storeKey = /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(function* (username, key, password, expires, roles) {
      var newKey = {
        _id: "org.couchdb.user:" + key,
        type: 'user',
        name: key,
        user_id: username,
        password: password,
        expires: expires,
        roles: ["user:" + username].concat(roles)
      };
      yield couchAuthDB.upsert(newKey._id, function (oldKey) {
        return (0, _lodash["default"])({}, oldKey, newKey);
      });
      return Object.assign({}, newKey, {
        _id: key
      });
    });

    return function storeKey(_x, _x2, _x3, _x4, _x5) {
      return _ref.apply(this, arguments);
    };
  }();

  var removeKeys = /*#__PURE__*/function () {
    var _ref2 = _asyncToGenerator(function* (keys) {
      keys = _util["default"].toArray(keys); // Transform the list to contain the CouchDB _user ids

      var keylist = keys.filter(function (k) {
        return k;
      }).map(function (key) {
        return "org.couchdb.user:" + key;
      });

      try {
        var keyDocs = yield couchAuthDB.allDocs({
          keys: keylist
        });

        if (keyDocs.rows && keyDocs.rows.length > 0) {
          var toDelete = keyDocs.rows.reduce(function (r, row) {
            return !row.value || row.value.deleted ? r : [].concat(r, [{
              _id: row.id,
              _rev: row.value.rev,
              _deleted: true
            }]);
          }, []);

          if (toDelete.length > 0) {
            return couchAuthDB.bulkDocs(toDelete);
          }
        }

        return false;
      } catch (error) {
        console.error('error removing keys!', error);
        return false;
      }
    });

    return function removeKeys(_x6) {
      return _ref2.apply(this, arguments);
    };
  }();

  var initSecurity = /*#__PURE__*/function () {
    var _ref3 = _asyncToGenerator(function* (db, adminRoles, memberRoles) {
      try {
        var security = db.security();
        yield security.fetch();
        security.members.roles.add(memberRoles);
        security.admins.roles.add(adminRoles);
        return yield security.save();
      } catch (error) {
        console.error('error initializing security', error);
        return false;
      }
    });

    return function initSecurity(_x7, _x8, _x9) {
      return _ref3.apply(this, arguments);
    };
  }();

  var authorizeKeys = /*#__PURE__*/function () {
    var _ref4 = _asyncToGenerator(function* (user_id, db, keys) {
      try {
        var security = db.security();
        yield security.fetch();
        security.members.names.add(keys);
        return yield security.save();
      } catch (error) {
        console.error('error authorizing keys', error);
        return false;
      }
    });

    return function authorizeKeys(_x10, _x11, _x12) {
      return _ref4.apply(this, arguments);
    };
  }();

  var deauthorizeKeys = /*#__PURE__*/function () {
    var _ref5 = _asyncToGenerator(function* (db, keys) {
      keys = _util["default"].toArray(keys);

      try {
        var security = db.security();
        yield security.fetch();
        security.members.names.remove(keys);
        return yield security.save();
      } catch (error) {
        console.error('error deauthorizing keys!', error);
        return false;
      }
    });

    return function deauthorizeKeys(_x13, _x14) {
      return _ref5.apply(this, arguments);
    };
  }();

  return {
    initSecurity: initSecurity,
    authorizeKeys: authorizeKeys,
    deauthorizeKeys: deauthorizeKeys,
    removeKeys: removeKeys,
    storeKey: storeKey
  };
};

var _default = couchdb;
exports["default"] = _default;