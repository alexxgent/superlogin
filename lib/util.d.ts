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
        iterations?: number;
        salt?: string;
        derived_key?: string;
    }, password: string) => Promise<boolean>;
    getDBURL: ({ user, protocol, host, password }: {
        designDocDir: string;
        protocol: string;
        host: string;
        user: string;
        password: string;
        publicURL?: string;
        cloudant?: boolean;
        userDB: string;
        couchAuthDB: string;
    }) => string;
    getFullDBURL: (dbServer: {
        designDocDir: string;
        protocol: string;
        host: string;
        user: string;
        password: string;
        publicURL?: string;
        cloudant?: boolean;
        userDB: string;
        couchAuthDB: string;
    }, dbName: string) => string;
    getSessions: <Profile extends Superlogin.IProfile = Superlogin.IProfile>({ session }: Superlogin.IUserDoc<Profile>) => string[];
    getExpiredSessions: <Profile extends Superlogin.IProfile = Superlogin.IProfile>({ session }: Superlogin.IUserDoc<Profile>, now: number) => string[];
    getSessionToken: (req: Request) => string;
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
