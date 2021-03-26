/// <reference types="pouchdb-core" />
/// <reference types="pouchdb-node" />
import { Superlogin } from '../types';
declare const dbAuth: <Profile extends Superlogin.IProfile = Superlogin.IProfile>(config: IConfigure, userDB: PouchDB.Database<{}>, couchAuthDB: PouchDB.Database<{}>) => {
    removeDB: (dbName: string) => Promise<void>;
    createDB: (dbName: string) => Promise<PouchDB.Core.DatabaseInfo>;
    getDBConfig: (dbName: string, type?: string) => {
        name: string;
        permissions: string[];
        designDocs: string[];
        type: string;
        adminRoles: string[];
        memberRoles: string[];
    };
    getDesignDoc: (docName: string) => any;
    removeExpiredKeys: () => Promise<string[]>;
    addUserDB: (userDoc: Superlogin.IUserDoc<Profile>, dbName: string, designDocs?: string[], type?: string, permissions?: string[], aRoles?: string[], mRoles?: string[]) => Promise<string>;
    authorizeUserSessions: (user_id: string, personalDBs: {}, keys: string | string[], roles: string[]) => Promise<(boolean | void)[]>;
    authorizeKeys: (user_id: string, db: PouchDB.Database<{}>, keys: string[], permissions?: string[], roles?: string[]) => Promise<boolean | void>;
    deauthorizeKeys: (db: PouchDB.Database<{}>, keys: string | string[]) => Promise<boolean | void>;
    deauthorizeUser: (userDoc: Superlogin.IUserDoc<Profile>, keys: string | string[]) => Promise<false | (boolean | void)[]>;
    removeKeys: (keys: string | string[]) => Promise<boolean | PouchDB.Core.Response[] | PouchDB.Core.Error[]>;
    storeKey: (username: string, key: string, password: string, expires?: number, roles?: string[]) => Promise<void | {
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
