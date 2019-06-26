import { Request } from 'express';
import { Superlogin } from './types';
declare const _default: {
    URLSafeUUID: () => string;
    hashToken: (token: string) => string;
    hashPassword: (password: string) => Promise<{
        salt: string;
        derived_key: string;
    }>;
    verifyPassword: (hashObj: {
        iterations?: string | undefined;
        salt?: string | undefined;
        derived_key?: string | undefined;
    }, password: string) => Promise<boolean>;
    getDBURL: ({ user, protocol, host, password }: {
        designDocDir: string;
        protocol: string;
        host: string;
        user: string;
        password: string;
        publicURL?: string | undefined;
        cloudant?: boolean | undefined;
        userDB: string;
        couchAuthDB: string;
    }) => string;
    getFullDBURL: (dbServer: {
        designDocDir: string;
        protocol: string;
        host: string;
        user: string;
        password: string;
        publicURL?: string | undefined;
        cloudant?: boolean | undefined;
        userDB: string;
        couchAuthDB: string;
    }, dbName: string) => string;
    getSessions: ({ session }: Superlogin.IUserDoc) => string[];
    getExpiredSessions: ({ session }: Superlogin.IUserDoc, now: number) => string[];
    getSessionToken: (req: Request) => string | undefined;
    addProvidersToDesignDoc: (config: IConfigure, ddoc: {
        auth: {
            views: {};
        };
    }) => {
        auth: {
            views: {};
        };
    };
    capitalizeFirstLetter: (value: string) => string;
    arrayUnion: (a: any[], b: any[]) => any[];
    toArray: <T>(obj: T | T[]) => T[];
};
export default _default;
