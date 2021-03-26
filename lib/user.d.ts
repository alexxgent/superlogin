/// <reference types="node" />
/// <reference types="pouchdb-core" />
/// <reference types="pouchdb-node" />
/// <reference types="pouchdb-upsert" />
import { EventEmitter } from 'events';
import { Superlogin } from './types';
declare const user: <Profile extends Superlogin.IProfile = Superlogin.IProfile>(config: IConfigure, userDB: PouchDB.Database<Superlogin.IUserDoc<Profile>>, couchAuthDB: PouchDB.Database<{}>, mailer: Superlogin.IMailer, emitter: EventEmitter) => {
    dbAuth: {
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
        addUserDB: (userDoc: Superlogin.IUserDoc<Superlogin.IProfile>, dbName: string, designDocs?: string[], type?: string, permissions?: string[], aRoles?: string[], mRoles?: string[]) => Promise<string>;
        authorizeUserSessions: (user_id: string, personalDBs: {}, keys: string | string[], roles: string[]) => Promise<(boolean | void)[]>;
        authorizeKeys: (user_id: string, db: PouchDB.Database<{}>, keys: string[], permissions?: string[], roles?: string[]) => Promise<boolean | void>;
        deauthorizeKeys: (db: PouchDB.Database<{}>, keys: string | string[]) => Promise<boolean | void>;
        deauthorizeUser: (userDoc: Superlogin.IUserDoc<Superlogin.IProfile>, keys: string | string[]) => Promise<false | (boolean | void)[]>;
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
    session: {
        confirmToken: (key: string, password: string) => Promise<{
            _id: string;
            expires: number;
            ip?: string;
            issued: number;
            key: string;
            password: string;
            provider?: string;
            roles: string[];
            token?: string;
            userDBs?: Record<string, string>;
            user_id?: string;
            profile?: Superlogin.IProfile;
        }>;
        deleteTokens: (keys: string | string[]) => Promise<number>;
        fetchToken: (key: string) => Promise<any>;
        storeToken: (token: Superlogin.ISession) => Promise<{
            _id: string;
            expires: number;
            ip?: string;
            issued: number;
            key: string;
            password: string;
            provider?: string;
            roles: string[];
            token?: string;
            userDBs?: Record<string, string>;
            user_id?: string;
            profile?: Superlogin.IProfile;
        }>;
        quit: () => Promise<string>;
    };
    onCreateActions: ((userDoc: Superlogin.IUserDoc<Profile>, provider: string) => Promise<Superlogin.IUserDoc<Profile>>)[];
    onLinkActions: ((userDoc: Superlogin.IUserDoc<Profile>, provider: string) => Promise<Superlogin.IUserDoc<Profile>>)[];
    tokenLife: number;
    sessionLife: number;
    emailUsername: boolean;
    addUserDBs: (newUser: Superlogin.IUserDoc<Profile>) => Promise<Superlogin.IUserDoc<Profile>>;
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
    onCreate: (fn: (userDoc: Superlogin.IUserDoc<Profile>, provider: string) => Promise<Superlogin.IUserDoc<Profile>>) => void;
    onLink: (fn: (userDoc: Superlogin.IUserDoc<Profile>, provider: string) => Promise<Superlogin.IUserDoc<Profile>>) => void;
    processTransformations: (fnArray: ((userDoc: Superlogin.IUserDoc<Profile>, provider: string) => Promise<Superlogin.IUserDoc<Profile>>)[], userDoc: Superlogin.IUserDoc<Profile>, provider: string) => Promise<Superlogin.IUserDoc<Profile>>;
    get: (login: string) => Promise<PouchDB.Core.ExistingDocument<Superlogin.IUserDoc<Profile> & PouchDB.Core.AllDocsMeta>>;
    create: (form: {}, req: {
        ip?: string;
    }) => Promise<Superlogin.IUserDoc<Profile>>;
    socialAuth: (provider: string, auth: string, profile: Profile, req: {
        ip?: string;
    }) => Promise<Superlogin.IUserDoc<Profile>>;
    linkSocial: (user_id: string, provider: string, auth: string, profile: Profile, req: {
        ip?: string;
    }) => Promise<Superlogin.IUserDoc<Profile>>;
    unlink: (user_id: string, provider: "local" | "apple" | "google") => Promise<Superlogin.IUserDoc<Profile> & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta>;
    createSession: (user_id: string, provider: string, req: {
        ip?: string;
    }) => Promise<Partial<Superlogin.ISession>>;
    handleFailedLogin: (loginUser: Superlogin.IUserDoc<Profile>, req: {
        ip?: string;
    }) => Promise<boolean | void>;
    refreshSession: (key: string, pass: string) => Promise<Superlogin.ISession>;
    resetPassword: (form: {
        token: string;
        password: string;
    }, req: {
        ip?: string;
    }) => any;
    changePasswordSecure: (user_id: string, form: {
        newPassword: string;
        currentPassword: string;
    }, req: {
        ip?: string;
        user?: {
            key: string;
        };
    }) => Promise<any>;
    changePassword: (user_id: string, newPassword: string, userDoc: Superlogin.IUserDoc<Profile>, req: {
        ip?: string;
    }) => Promise<boolean>;
    forgotPassword: (email: string, req: {
        ip?: string;
    }) => Promise<{
        expires: number;
        token: string;
        issued: number;
    }>;
    verifyEmail: (token: string, req: {
        ip?: string;
    }) => Promise<PouchDB.UpsertResponse>;
    changeEmail: (user_id: string, newEmail: string, req: {
        user?: {
            provider: string;
        };
        ip?: string;
    }) => Promise<Superlogin.IUserDoc<Profile>>;
    addUserDB: (user_id: string, dbName: string, type: string, designDocs: string[], permissions: string[]) => Promise<Superlogin.IUserDoc<Profile> & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta>;
    removeUserDB: (user_id: string, dbName: string, deletePrivate: boolean, deleteShared: boolean) => Promise<void | PouchDB.UpsertResponse>;
    logoutUser: (user_id: string, session_id: string) => Promise<PouchDB.UpsertResponse>;
    logoutSession: (session_id: string) => Promise<false | PouchDB.UpsertResponse>;
    logoutOthers: (session_id: string) => Promise<false | PouchDB.UpsertResponse>;
    logoutUserSessions: (userDoc: Superlogin.IUserDoc<Profile>, op: string, currentSession?: string) => Promise<Superlogin.IUserDoc<Profile>>;
    remove: (user_id: string, destroyDBs: boolean) => Promise<void | PouchDB.Core.Response>;
    removeExpiredKeys: () => Promise<string[]>;
    confirmSession: (key: string, password: string) => Promise<{
        _id: string;
        expires: number;
        ip?: string;
        issued: number;
        key: string;
        password: string;
        provider?: string;
        roles: string[];
        token?: string;
        userDBs?: Record<string, string>;
        user_id?: string;
        profile?: Superlogin.IProfile;
    }>;
    quitRedis: () => Promise<string>;
};
declare global {
    type User = any;
}
export default user;
