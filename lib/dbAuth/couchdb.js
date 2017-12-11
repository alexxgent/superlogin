"use strict";

exports.__esModule = true;
exports.default = void 0;

var _util = _interopRequireDefault(require("../util"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

Function.prototype.$asyncbind = function $asyncbind(self, catcher) {
  "use strict";

  if (!Function.prototype.$asyncbind) {
    Object.defineProperty(Function.prototype, "$asyncbind", {
      value: $asyncbind,
      enumerable: false,
      configurable: true,
      writable: true
    });
  }

  if (!$asyncbind.trampoline) {
    $asyncbind.trampoline = function trampoline(t, x, s, e, u) {
      return function b(q) {
        while (q) {
          if (q.then) {
            q = q.then(b, e);
            return u ? undefined : q;
          }

          try {
            if (q.pop) {
              if (q.length) return q.pop() ? x.call(t) : q;
              q = s;
            } else q = q.call(t);
          } catch (r) {
            return e(r);
          }
        }
      };
    };
  }

  if (!$asyncbind.LazyThenable) {
    $asyncbind.LazyThenable = function () {
      function isThenable(obj) {
        return obj && obj instanceof Object && typeof obj.then === "function";
      }

      function resolution(p, r, how) {
        try {
          var x = how ? how(r) : r;
          if (p === x) return p.reject(new TypeError("Promise resolution loop"));

          if (isThenable(x)) {
            x.then(function (y) {
              resolution(p, y);
            }, function (e) {
              p.reject(e);
            });
          } else {
            p.resolve(x);
          }
        } catch (ex) {
          p.reject(ex);
        }
      }

      function Chained() {}

      ;
      Chained.prototype = {
        resolve: _unchained,
        reject: _unchained,
        then: thenChain
      };

      function _unchained(v) {}

      function thenChain(res, rej) {
        this.resolve = res;
        this.reject = rej;
      }

      function then(res, rej) {
        var chain = new Chained();

        try {
          this._resolver(function (value) {
            return isThenable(value) ? value.then(res, rej) : resolution(chain, value, res);
          }, function (ex) {
            resolution(chain, ex, rej);
          });
        } catch (ex) {
          resolution(chain, ex, rej);
        }

        return chain;
      }

      function Thenable(resolver) {
        this._resolver = resolver;
        this.then = then;
      }

      ;

      Thenable.resolve = function (v) {
        return Thenable.isThenable(v) ? v : {
          then: function then(resolve) {
            return resolve(v);
          }
        };
      };

      Thenable.isThenable = isThenable;
      return Thenable;
    }();

    $asyncbind.EagerThenable = $asyncbind.Thenable = ($asyncbind.EagerThenableFactory = function (tick) {
      tick = tick || typeof process === "object" && process.nextTick || typeof setImmediate === "function" && setImmediate || function (f) {
        setTimeout(f, 0);
      };

      var soon = function () {
        var fq = [],
            fqStart = 0,
            bufferSize = 1024;

        function callQueue() {
          while (fq.length - fqStart) {
            try {
              fq[fqStart]();
            } catch (ex) {}

            fq[fqStart++] = undefined;

            if (fqStart === bufferSize) {
              fq.splice(0, bufferSize);
              fqStart = 0;
            }
          }
        }

        return function (fn) {
          fq.push(fn);
          if (fq.length - fqStart === 1) tick(callQueue);
        };
      }();

      function Zousan(func) {
        if (func) {
          var me = this;
          func(function (arg) {
            me.resolve(arg);
          }, function (arg) {
            me.reject(arg);
          });
        }
      }

      Zousan.prototype = {
        resolve: function resolve(value) {
          if (this.state !== undefined) return;
          if (value === this) return this.reject(new TypeError("Attempt to resolve promise with self"));
          var me = this;

          if (value && (typeof value === "function" || typeof value === "object")) {
            try {
              var first = 0;
              var then = value.then;

              if (typeof then === "function") {
                then.call(value, function (ra) {
                  if (!first++) {
                    me.resolve(ra);
                  }
                }, function (rr) {
                  if (!first++) {
                    me.reject(rr);
                  }
                });
                return;
              }
            } catch (e) {
              if (!first) this.reject(e);
              return;
            }
          }

          this.state = STATE_FULFILLED;
          this.v = value;
          if (me.c) soon(function () {
            for (var n = 0, l = me.c.length; n < l; n++) {
              STATE_FULFILLED(me.c[n], value);
            }
          });
        },
        reject: function reject(reason) {
          if (this.state !== undefined) return;
          this.state = STATE_REJECTED;
          this.v = reason;
          var clients = this.c;
          if (clients) soon(function () {
            for (var n = 0, l = clients.length; n < l; n++) {
              STATE_REJECTED(clients[n], reason);
            }
          });
        },
        then: function then(onF, onR) {
          var p = new Zousan();
          var client = {
            y: onF,
            n: onR,
            p: p
          };

          if (this.state === undefined) {
            if (this.c) this.c.push(client);else this.c = [client];
          } else {
            var s = this.state,
                a = this.v;
            soon(function () {
              s(client, a);
            });
          }

          return p;
        }
      };

      function STATE_FULFILLED(c, arg) {
        if (typeof c.y === "function") {
          try {
            var yret = c.y.call(undefined, arg);
            c.p.resolve(yret);
          } catch (err) {
            c.p.reject(err);
          }
        } else c.p.resolve(arg);
      }

      function STATE_REJECTED(c, reason) {
        if (typeof c.n === "function") {
          try {
            var yret = c.n.call(undefined, reason);
            c.p.resolve(yret);
          } catch (err) {
            c.p.reject(err);
          }
        } else c.p.reject(reason);
      }

      Zousan.resolve = function (val) {
        if (val && val instanceof Zousan) return val;
        var z = new Zousan();
        z.resolve(val);
        return z;
      };

      Zousan.reject = function (err) {
        if (err && err instanceof Zousan) return err;
        var z = new Zousan();
        z.reject(err);
        return z;
      };

      Zousan.version = "2.3.3-nodent";
      return Zousan;
    })();
  }

  var resolver = this;

  switch (catcher) {
    case true:
      return new $asyncbind.Thenable(boundThen);

    case 0:
      return new $asyncbind.LazyThenable(boundThen);

    case undefined:
      boundThen.then = boundThen;
      return boundThen;

    default:
      return function () {
        try {
          return resolver.apply(self, arguments);
        } catch (ex) {
          return catcher(ex);
        }
      };
  }

  function boundThen() {
    return resolver.apply(self, arguments);
  }
};

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

var couchdb = function couchdb(couchAuthDB) {
  // tslint:disable-next-line:no-any
  var putSecurityCouch = function putSecurityCouch(db, doc) {
    return db.request({
      method: 'PUT',
      url: '_security',
      body: doc
    });
  };

  var storeKey =
  /*#__PURE__*/
  function () {
    var _ref = _asyncToGenerator(function* (username, key, password, expires, roles) {
      if (roles instanceof Array) {
        // Clone roles to not overwrite original
        roles = roles.slice(0);
      } else {
        roles = [];
      }

      roles.unshift("user:" + username);
      var newKey = {
        _id: "org.couchdb.user:" + key,
        type: 'user',
        name: key,
        user_id: username,
        password: password,
        expires: expires,
        roles: roles
      };
      yield couchAuthDB.upsert(newKey._id, function () {
        return newKey;
      });
      newKey._id = key;
      return newKey;
    });

    return function storeKey(_x, _x2, _x3, _x4, _x5) {
      return _ref.apply(this, arguments);
    };
  }();

  var removeKeys =
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(function* (keys) {
      keys = _util.default.toArray(keys);
      var keylist = []; // Transform the list to contain the CouchDB _user ids

      keys.forEach(function (key) {
        keylist.push("org.couchdb.user:" + key);
      });
      var toDelete = [];

      try {
        var keyDocs = yield couchAuthDB.allDocs({
          keys: keylist
        });
        keyDocs.rows.forEach(function (row) {
          if (!row.value.deleted) {
            var deletion = {
              _id: row.id,
              _rev: row.value.rev,
              _deleted: true
            };
            toDelete.push(deletion);
          }
        });

        if (toDelete.length) {
          return couchAuthDB.bulkDocs(toDelete);
        }

        return Promise.resolve(false);
      } catch (error) {
        console.log('error removing keys!', error);
        return Promise.resolve(false);
      }
    });

    return function removeKeys(_x6) {
      return _ref2.apply(this, arguments);
    };
  }();

  var initSecurity =
  /*#__PURE__*/
  function () {
    var _ref3 = _asyncToGenerator(function* (db, adminRoles, memberRoles) {
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
        return putSecurityCouch(db, secDoc);
      }

      return Promise.resolve(false);
    });

    return function initSecurity(_x7, _x8, _x9) {
      return _ref3.apply(this, arguments);
    };
  }();

  var authorizeKeys =
  /*#__PURE__*/
  function () {
    var _ref4 = _asyncToGenerator(function* (user_id, db, keys) {
      var secDoc; // Check if keys is an object and convert it to an array

      if (typeof keys === 'object' && !Array.isArray(keys)) {
        var keysArr = [];
        Object.keys(keys).forEach(function (theKey) {
          keysArr.push(theKey);
        });
        keys = keysArr;
      }

      if (!Array.isArray(keys)) {
        // Convert keys to an array if it is just a string
        keys = _util.default.toArray(keys);
      }

      var doc = yield db.get('_security');
      secDoc = doc;

      if (!secDoc.members) {
        secDoc.members = {
          names: [],
          roles: []
        };
      }

      if (!secDoc.members.names) {
        secDoc.members.names = [];
      }

      var changes = false;
      keys.forEach(function (key) {
        var index = secDoc.members.names.indexOf(key);

        if (index === -1) {
          secDoc.members.names.push(key);
          changes = true;
        }
      });

      if (changes) {
        return putSecurityCouch(db, secDoc);
      }

      return Promise.resolve(false);
    });

    return function authorizeKeys(_x10, _x11, _x12) {
      return _ref4.apply(this, arguments);
    };
  }();

  var deauthorizeKeys =
  /*#__PURE__*/
  function () {
    var _ref5 = _asyncToGenerator(function* (db, keys) {
      var secDoc;
      keys = _util.default.toArray(keys);

      try {
        var doc = yield db.get('_security');
        secDoc = doc;

        if (!secDoc.members || !secDoc.members.names) {
          return Promise.resolve(false);
        }

        var changes = false;
        keys.forEach(function (key) {
          var index = secDoc.members.names.indexOf(key);

          if (index > -1) {
            secDoc.members.names.splice(index, 1);
            changes = true;
          }
        });

        if (changes) {
          return yield putSecurityCouch(db, secDoc);
        }

        return Promise.resolve(false);
      } catch (error) {
        console.log('error deauthorizing keys!', error);
        return Promise.resolve(false);
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
exports.default = _default;