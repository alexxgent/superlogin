/// <reference types="pouchdb-core" />
/// <reference types="pouchdb-node" />
import { Superlogin } from '../types';
declare const dbAuth: (config: IConfigure, userDB: PouchDB.Database<{}>, couchAuthDB: PouchDB.Database<{}>) => {
    removeDB: (dbName: string) => Promise<void>;
    createDB: (dbName: string) => Promise<PouchDB.Core.DatabaseInfo>;
    getDBConfig: (dbName: string, type?: string | undefined) => {
        name: string;
        permissions: string[] | undefined;
        designDocs: string[];
        type: string;
        adminRoles: string[];
        memberRoles: string[];
    };
    getDesignDoc: (docName: string) => any;
    removeExpiredKeys: () => Promise<string[] | undefined>;
    addUserDB: (userDoc: Superlogin.IUserDoc, dbName: string, designDocs?: string[] | undefined, type?: string | undefined, permissions?: string[] | undefined, aRoles?: string[] | undefined, mRoles?: string[] | undefined) => Promise<string>;
    authorizeUserSessions: (user_id: string, personalDBs: {}, keys: string | string[], roles: string[]) => Promise<(boolean | void)[] | undefined>;
    authorizeKeys: (user_id: string, db: PouchDB.Database<{}>, keys: string[], permissions?: string[] | undefined, roles?: string[] | undefined) => Promise<boolean | void>;
    deauthorizeKeys: (db: PouchDB.Database<{}>, keys: string | string[]) => Promise<boolean | void>;
    deauthorizeUser: (userDoc: Superlogin.IUserDoc, keys: string | string[]) => Promise<false | (boolean | void)[]>;
    removeKeys: (keys: string | string[]) => Promise<boolean | PouchDB.Core.Response[] | PouchDB.Core.Error[]>;
    storeKey: (username: string, key: string, password: string, expires?: number | undefined, roles?: string[] | undefined) => Promise<void | {
        _id: string;
        type: string;
        name: string;
        user_id: string;
        password: string;
        expires: number;
        roles: string[];
    }>;
};
export default dbAuth;
