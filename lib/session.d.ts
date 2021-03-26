import { Superlogin } from './types';
declare const Session: (config: IConfigure) => {
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
export default Session;
