/// <reference types="node" />
/// <reference types="pouchdb-core" />
/// <reference types="pouchdb-node" />
/// <reference types="pouchdb-upsert" />
import { EventEmitter } from 'events';
import { Superlogin } from './types';
declare const user: (config: IConfigure, userDB: PouchDB.Database<Superlogin.IUserDoc>, couchAuthDB: PouchDB.Database<{}>, mailer: IMailer, emitter: EventEmitter) => {
    dbAuth: {
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
    session: {
        confirmToken: (key: string, password: string) => Promise<{
            _id: string;
            expires: number;
            ip?: string | undefined;
            issued: number;
            key: string;
            password: string;
            provider?: string | undefined;
            roles: string[];
            token?: string | undefined;
            userDBs?: {
                [name: string]: string;
            } | undefined;
            user_id?: string | undefined;
        }>;
        deleteTokens: (keys: string | string[]) => Promise<number>;
        fetchToken: (key: string) => Promise<any>;
        storeToken: (token: Superlogin.ISession) => Promise<{
            _id: string;
            expires: number;
            ip?: string | undefined;
            issued: number;
            key: string;
            password: string;
            provider?: string | undefined;
            roles: string[];
            token?: string | undefined;
            userDBs?: {
                [name: string]: string;
            } | undefined;
            user_id?: string | undefined;
        } | undefined>;
        quit: () => Promise<string>;
    };
    onCreateActions: ((userDoc: Superlogin.IUserDoc, provider: string) => Promise<Superlogin.IUserDoc>)[];
    onLinkActions: ((userDoc: Superlogin.IUserDoc, provider: string) => Promise<Superlogin.IUserDoc>)[];
    tokenLife: number;
    sessionLife: number;
    emailUsername: boolean | undefined;
    addUserDBs: (newUser: Superlogin.IUserDoc) => Promise<Superlogin.IUserDoc>;
    generateSession: (username: string, roles: string[]) => Promise<{
        _id: string;
        key: string;
        password: string;
        issued: number;
        expires: number;
        roles: string[];
    }>;
    generateUsername: (base: string) => Promise<string>;
    validateUsername: (username: string) => Promise<string | void>;
    validateEmail: (email: string) => Promise<string | void>;
    validateEmailUsername: (email: string) => Promise<string | void>;
    matches: (value: string, option: string, key: string, attributes: {}) => string;
    passwordConstraints: {
        presence: boolean;
        length: {
            minimum: number;
            message: string;
        };
        matches: string;
    };
    userModel: any;
    resetPasswordModel: {
        async: boolean;
        customValidators: {
            matches: (value: string, option: string, key: string, attributes: {}) => string;
        };
        validate: {
            token: {
                presence: boolean;
            };
            password: {
                presence: boolean;
                length: {
                    minimum: number;
                    message: string;
                };
                matches: string;
            };
            confirmPassword: {
                presence: boolean;
            };
        };
    };
    changePasswordModel: {
        async: boolean;
        customValidators: {
            matches: (value: string, option: string, key: string, attributes: {}) => string;
        };
        validate: {
            newPassword: {
                presence: boolean;
                length: {
                    minimum: number;
                    message: string;
                };
                matches: string;
            };
            confirmPassword: {
                presence: boolean;
            };
        };
    };
    onCreate: (fn: (userDoc: Superlogin.IUserDoc, provider: string) => Promise<Superlogin.IUserDoc>) => void;
    onLink: (fn: (userDoc: Superlogin.IUserDoc, provider: string) => Promise<Superlogin.IUserDoc>) => void;
    processTransformations: (fnArray: ((userDoc: Superlogin.IUserDoc, provider: string) => Promise<Superlogin.IUserDoc>)[], userDoc: Superlogin.IUserDoc, provider: string) => Promise<Superlogin.IUserDoc>;
    get: (login: string) => Promise<PouchDB.Core.ExistingDocument<Superlogin.IUserDoc & PouchDB.Core.AllDocsMeta> | null | undefined>;
    create: (form: {}, req: {
        ip: string;
    }) => Promise<Superlogin.IUserDoc>;
    socialAuth: (provider: string, auth: string, profile: Superlogin.IProfile, req: {
        ip: string;
    }) => Promise<Superlogin.IUserDoc | undefined>;
    linkSocial: (user_id: string, provider: string, auth: string, profile: Superlogin.IProfile, req: {
        ip: string;
    }) => Promise<Superlogin.IUserDoc>;
    unlink: (user_id: string, provider: "local" | "apple" | "google") => Promise<(Superlogin.IUserDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta) | undefined>;
    createSession: (user_id: string, provider: string, req: {
        ip: string;
    }) => Promise<Partial<Superlogin.IUserDoc> | undefined>;
    handleFailedLogin: (loginUser: Superlogin.IUserDoc, req: {
        ip: string;
    }) => Promise<boolean | void>;
    refreshSession: (key: string, pass: string) => Promise<Superlogin.ISession | undefined>;
    resetPassword: (form: {
        token: string;
        password: string;
    }, req: {
        ip: string;
    }) => any;
    changePasswordSecure: (user_id: string, form: {
        newPassword: string;
        currentPassword: string;
    }, req: {
        ip: string;
        user: {
            key: string;
        };
    }) => Promise<any>;
    changePassword: (user_id: string, newPassword: string, userDoc: Superlogin.IUserDoc, req: {
        ip: string;
    }) => Promise<boolean>;
    forgotPassword: (email: string, req: {
        ip: string;
    }) => Promise<{
        expires: number;
        token: string;
        issued: number;
    } | undefined>;
    verifyEmail: (token: string, req: {
        ip: string;
    }) => Promise<PouchDB.UpsertResponse>;
    changeEmail: (user_id: string, newEmail: string, req: {
        user: {
            provider: string;
        };
        ip: string;
    }) => Promise<Superlogin.IUserDoc | undefined>;
    addUserDB: (user_id: string, dbName: string, type: string, designDocs: string[], permissions: string[]) => Promise<(Superlogin.IUserDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta) | undefined>;
    removeUserDB: (user_id: string, dbName: string, deletePrivate: boolean, deleteShared: boolean) => Promise<void | PouchDB.UpsertResponse>;
    logoutUser: (user_id: string, session_id: string) => Promise<PouchDB.UpsertResponse>;
    logoutSession: (session_id: string) => Promise<false | PouchDB.UpsertResponse>;
    logoutOthers: (session_id: string) => Promise<false | PouchDB.UpsertResponse>;
    logoutUserSessions: (userDoc: Superlogin.IUserDoc, op: string, currentSession?: string | undefined) => Promise<Superlogin.IUserDoc>;
    remove: (user_id: string, destroyDBs: boolean) => Promise<void | PouchDB.Core.Response>;
    removeExpiredKeys: () => Promise<string[] | undefined>;
    confirmSession: (key: string, password: string) => Promise<{
        _id: string;
        expires: number;
        ip?: string | undefined;
        issued: number;
        key: string;
        password: string;
        provider?: string | undefined;
        roles: string[];
        token?: string | undefined;
        userDBs?: {
            [name: string]: string;
        } | undefined;
        user_id?: string | undefined;
    }>;
    quitRedis: () => Promise<string>;
};
declare global {
    type User = any;
}
export default user;
