import { Superlogin } from './types';
declare const Session: (config: IConfigure) => {
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
export default Session;
