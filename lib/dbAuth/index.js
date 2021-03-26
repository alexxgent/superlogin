"use strict";

exports.__esModule = true;
exports["default"] = void 0;

var _pouchdbNode = _interopRequireDefault(require("pouchdb-node"));

var _pouchdbSeedDesign = _interopRequireDefault(require("pouchdb-seed-design"));

var _util = _interopRequireDefault(require("./../util"));

var _cloudant = _interopRequireDefault(require("./cloudant"));

var _couchdb = _interopRequireDefault(require("./couchdb"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }

function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

// Escapes any characters that are illegal in a CouchDB database name using percent codes inside parenthesis
// Example: 'My.name@example.com' => 'my(2e)name(40)example(2e)com'
var getLegalDBName = function getLegalDBName(input) {
  return encodeURIComponent(input.toLowerCase()).replace(/\./g, '%2E').replace(/!/g, '%21').replace(/~/g, '%7E').replace(/\*/g, '%2A').replace(/!/g, '%21').replace(/~/g, '%7E').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/-/g, '%2D').toLowerCase().replace(/(%..)/g, function (esc) {
    return "(" + esc.substr(1) + ")";
  });
};

var dbAuth = function dbAuth(config, userDB, couchAuthDB) {
  var cloudant = config.get().dbServer.cloudant;
  var adapter = cloudant ? _cloudant["default"] : (0, _couchdb["default"])(couchAuthDB);

  var createDB = /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(function* (dbName) {
      var finalUrl = _util["default"].getDBURL(config.get().dbServer) + "/" + dbName;

      try {
        var db = new _pouchdbNode["default"](finalUrl);
        return db.info();
      } catch (error) {
        console.error('create DB error', error);
        throw error;
      }
    });

    return function createDB(_x) {
      return _ref.apply(this, arguments);
    };
  }();

  var getDesignDoc = function getDesignDoc(docName) {
    if (!docName) {
      return null;
    }

    var userDBs = config.get().userDBs;
    var designDocDir = userDBs ? userDBs.designDocDir : __dirname;

    try {
      // tslint:disable-next-line:non-literal-require
      return require(designDocDir + "/" + docName);
    } catch (err) {
      console.warn("Design doc: " + designDocDir + "/" + docName + " not found.");
      return undefined;
    }
  };

  var storeKey = /*#__PURE__*/function () {
    var _ref2 = _asyncToGenerator(function* (username, key, password, expires, roles) {
      return adapter.storeKey(username, key, password, expires, roles);
    });

    return function storeKey(_x2, _x3, _x4, _x5, _x6) {
      return _ref2.apply(this, arguments);
    };
  }();

  var removeKeys = /*#__PURE__*/function () {
    var _ref3 = _asyncToGenerator(function* (keys) {
      return adapter.removeKeys(keys);
    });

    return function removeKeys(_x7) {
      return _ref3.apply(this, arguments);
    };
  }();

  var authorizeKeys = /*#__PURE__*/function () {
    var _ref4 = _asyncToGenerator(function* (user_id, db, keys, permissions, roles) {
      return adapter.authorizeKeys(user_id, db, keys, permissions, roles);
    });

    return function authorizeKeys(_x8, _x9, _x10, _x11, _x12) {
      return _ref4.apply(this, arguments);
    };
  }();

  var deauthorizeKeys = /*#__PURE__*/function () {
    var _ref5 = _asyncToGenerator(function* (db, keys) {
      return adapter.deauthorizeKeys(db, keys);
    });

    return function deauthorizeKeys(_x13, _x14) {
      return _ref5.apply(this, arguments);
    };
  }();

  var deauthorizeUser = /*#__PURE__*/function () {
    var _ref6 = _asyncToGenerator(function* (userDoc, keys) {
      if (!userDoc) {
        console.error('deauthorizeUser error - no userdoc specified');
        return false;
      } // If keys is not specified we will deauthorize all of the users sessions


      var finalKeys = keys ? _util["default"].toArray(keys) : _util["default"].getSessions(userDoc);

      if (userDoc.personalDBs && typeof userDoc.personalDBs === 'object') {
        return Promise.all(Object.keys(userDoc.personalDBs).map( /*#__PURE__*/function () {
          var _ref7 = _asyncToGenerator(function* (personalDB) {
            try {
              var db = new _pouchdbNode["default"](_util["default"].getDBURL(config.get().dbServer) + "/" + personalDB, {
                skip_setup: true
              });
              return deauthorizeKeys(db, finalKeys);
            } catch (error) {
              console.error('error deauthorizing db!', error);
              return Promise.resolve();
            }
          });

          return function (_x17) {
            return _ref7.apply(this, arguments);
          };
        }()));
      }

      console.error('deauthorizeUser error - user has no personalDBs');
      return false;
    });

    return function deauthorizeUser(_x15, _x16) {
      return _ref6.apply(this, arguments);
    };
  }();

  var authorizeUserSessions = /*#__PURE__*/function () {
    var _ref8 = _asyncToGenerator(function* (user_id, personalDBs, keys, roles) {
      var _config$get = config.get(),
          userDBs = _config$get.userDBs;

      try {
        var sessionKeys = _util["default"].toArray(keys);

        return Promise.all(Object.keys(personalDBs).map( /*#__PURE__*/function () {
          var _ref9 = _asyncToGenerator(function* (personalDB) {
            var _personalDBs$personal = personalDBs[personalDB],
                permissions = _personalDBs$personal.permissions,
                name = _personalDBs$personal.name;
            var configModel = userDBs && userDBs.model;
            var finalPermissions = permissions || (configModel ? configModel[name] && configModel[name].permissions || configModel._default && configModel._default.permissions : undefined);
            var db = new _pouchdbNode["default"](_util["default"].getDBURL(config.get().dbServer) + "/" + personalDB, {
              skip_setup: true
            });
            return authorizeKeys(user_id, db, sessionKeys, finalPermissions, roles);
          });

          return function (_x22) {
            return _ref9.apply(this, arguments);
          };
        }()));
      } catch (error) {
        console.error('error authorizing user sessions', error);
        return undefined;
      }
    });

    return function authorizeUserSessions(_x18, _x19, _x20, _x21) {
      return _ref8.apply(this, arguments);
    };
  }();

  var addUserDB = /*#__PURE__*/function () {
    var _ref10 = _asyncToGenerator(function* (userDoc, dbName, designDocs, type, permissions, aRoles, mRoles) {
      var _config$get2 = config.get(),
          userDBs = _config$get2.userDBs;

      var adminRoles = aRoles || [];
      var memberRoles = mRoles || []; // Create and the database and seed it if a designDoc is specified

      var prefix = userDBs && userDBs.privatePrefix ? userDBs.privatePrefix + "_" : '';
      var username = getLegalDBName(userDoc._id); // Make sure we have a legal database name

      var finalDBName = type === 'shared' ? dbName : "" + prefix + dbName + "$" + username;

      try {
        var newDB = new _pouchdbNode["default"](_util["default"].getDBURL(config.get().dbServer) + "/" + finalDBName);
        yield adapter.initSecurity(newDB, adminRoles, memberRoles); // Seed the design docs

        if (designDocs && Array.isArray(designDocs)) {
          yield Promise.all(designDocs.map( /*#__PURE__*/function () {
            var _ref11 = _asyncToGenerator(function* (ddName) {
              var dDoc = getDesignDoc(ddName);

              if (dDoc) {
                yield (0, _pouchdbSeedDesign["default"])(newDB, dDoc);
                return Promise.resolve();
              } else {
                console.warn("Failed to locate design doc: " + ddName);
                return Promise.resolve();
              }
            });

            return function (_x30) {
              return _ref11.apply(this, arguments);
            };
          }()));
        }

        if (userDoc.session) {
          // Authorize the user's existing DB keys to access the new database
          var keysToAuthorize = Object.keys(userDoc.session).filter(function (k) {
            var expires = userDoc.session[k].expires;
            return expires && expires > Date.now();
          });

          if (keysToAuthorize.length > 0) {
            yield authorizeKeys(userDoc._id, newDB, keysToAuthorize, permissions, userDoc.roles);
          }
        }

        return finalDBName;
      } catch (error) {
        // tslint:disable-next-line:no-console
        console.error('create user db error', error);
        return finalDBName;
      }
    });

    return function addUserDB(_x23, _x24, _x25, _x26, _x27, _x28, _x29) {
      return _ref10.apply(this, arguments);
    };
  }();

  var removeExpiredKeys = /*#__PURE__*/function () {
    var _ref12 = _asyncToGenerator(function* () {
      try {
        // query a list of expired keys by user
        var results = yield userDB.query('auth/expiredKeys', {
          endkey: Date.now(),
          include_docs: true
        });

        var _results$rows$reduce = results.rows.reduce(function (r, row) {
          var _Object$assign;

          if (!row || !row.value) {
            return r;
          }

          var _ref13 = row.value,
              user = _ref13.user,
              key = _ref13.key; // Append expired keys

          var newExpiredKeys = [].concat(r.expiredKeys, [key]);
          var newKeysByUser = Object.assign({}, r.keysByUser, (_Object$assign = {}, _Object$assign[user] = key, _Object$assign));

          if (row.doc) {
            var _Object$assign2;

            var _row$doc = row.doc,
                session = _row$doc.session,
                userDoc = _objectWithoutPropertiesLoose(_row$doc, ["session"]);

            var deleted = session[key],
                finalSession = _objectWithoutPropertiesLoose(session, [key].map(_toPropertyKey));

            var newUserDocs = Object.assign({}, r.userDocs, (_Object$assign2 = {}, _Object$assign2[user] = Object.assign({}, userDoc, {
              session: finalSession
            }), _Object$assign2));
            return {
              expiredKeys: newExpiredKeys,
              userDocs: newUserDocs,
              keysByUser: newKeysByUser
            };
          }

          return Object.assign({}, r, {
            expiredKeys: newExpiredKeys,
            keysByUser: newKeysByUser
          });
        }, {
          expiredKeys: [''],
          userDocs: {},
          keysByUser: {}
        }),
            expiredKeys = _results$rows$reduce.expiredKeys,
            userDocs = _results$rows$reduce.userDocs,
            keysByUser = _results$rows$reduce.keysByUser;

        yield removeKeys(expiredKeys);
        yield Promise.all(Object.keys(keysByUser).map( /*#__PURE__*/function () {
          var _ref14 = _asyncToGenerator(function* (user) {
            return deauthorizeUser(userDocs[user], keysByUser[user]);
          });

          return function (_x31) {
            return _ref14.apply(this, arguments);
          };
        }())); // Bulk save user doc updates

        yield userDB.bulkDocs(Object.values(userDocs));
        return expiredKeys;
      } catch (error) {
        // tslint:disable-next-line:no-console
        console.error('error expiring keys', error);
        return undefined;
      }
    });

    return function removeExpiredKeys() {
      return _ref12.apply(this, arguments);
    };
  }();

  var getDBConfig = function getDBConfig(dbName, type) {
    var _config$get3 = config.get(),
        userDBs = _config$get3.userDBs;

    if (!userDBs) {
      return {
        name: dbName,
        type: type || 'private',
        designDocs: [],
        permissions: [],
        adminRoles: [],
        memberRoles: []
      };
    }

    var defaultSecurityRoles = userDBs.defaultSecurityRoles,
        model = userDBs.model;
    var adminRoles = defaultSecurityRoles && defaultSecurityRoles.admins || [];
    var memberRoles = defaultSecurityRoles && defaultSecurityRoles.members || [];
    var dbConfigRef = model && model[dbName];

    if (dbConfigRef) {
      var refAdminRoles = dbConfigRef.adminRoles || [];
      var refMemberRoles = dbConfigRef.memberRoles || [];
      return {
        name: dbName,
        permissions: dbConfigRef.permissions || [],
        designDocs: dbConfigRef.designDocs || [],
        type: type || dbConfigRef.type || 'private',
        adminRoles: [].concat(adminRoles.filter(function (r) {
          return !refAdminRoles.includes(r);
        }), refAdminRoles),
        memberRoles: [].concat(memberRoles.filter(function (r) {
          return !refMemberRoles.includes(r);
        }), refMemberRoles)
      };
    }

    var permissions = model && model._default ? model._default.permissions : [];
    var designDocs = model && model._default && (!type || type === 'private') ? model._default.designDocs || [] : [];
    return {
      name: dbName,
      permissions: permissions,
      designDocs: designDocs,
      type: type || 'private',
      adminRoles: adminRoles,
      memberRoles: memberRoles
    };
  };

  var removeDB = /*#__PURE__*/function () {
    var _ref15 = _asyncToGenerator(function* (dbName) {
      try {
        var db = new _pouchdbNode["default"](_util["default"].getDBURL(config.get().dbServer) + "/" + dbName, {
          skip_setup: true
        });
        return db.destroy();
      } catch (error) {
        throw error;
      }
    });

    return function removeDB(_x32) {
      return _ref15.apply(this, arguments);
    };
  }();

  return {
    removeDB: removeDB,
    createDB: createDB,
    getDBConfig: getDBConfig,
    getDesignDoc: getDesignDoc,
    removeExpiredKeys: removeExpiredKeys,
    addUserDB: addUserDB,
    authorizeUserSessions: authorizeUserSessions,
    authorizeKeys: authorizeKeys,
    deauthorizeKeys: deauthorizeKeys,
    deauthorizeUser: deauthorizeUser,
    removeKeys: removeKeys,
    storeKey: storeKey
  };
};

var _default = dbAuth;
exports["default"] = _default;