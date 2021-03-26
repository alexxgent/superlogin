declare const _default: {
    getAPIKey: (db: PouchDB.Database<{}>) => Promise<{
        key: string;
        password: string;
        ok: boolean;
    }>;
    getSecurityCloudant: (db: PouchDB.Database<{}>) => Promise<any>;
    putSecurityCloudant: (db: PouchDB.Database<{}>, doc: {}) => Promise<any>;
    storeKey: () => Promise<void>;
    removeKeys: () => Promise<boolean>;
    initSecurity: (db: PouchDB.Database<{}>, adminRoles: string[], memberRoles: string[]) => Promise<any>;
    authorizeKeys: (user_id: string, db: PouchDB.Database<{}>, keys: string[], permissions: string[], roles: string[]) => Promise<any>;
    deauthorizeKeys: (db: PouchDB.Database<{}>, keys: string[]) => Promise<any>;
};
export default _default;
declare global {
    interface IDBAdapter {
        getAPIKey?(db: PouchDB.Database): Promise<{
            key: string;
            password: string;
            ok: boolean;
        } | undefined>;
        getSecurityCloudant?(db: PouchDB.Database): Promise<string>;
        putSecurityCloudant?(db: PouchDB.Database, doc: {}): Promise<string>;
    }
}
