declare const defaultConfig: {
    security: {
        defaultRoles: string[];
        maxFailedLogins: number;
        lockoutTime: number;
        sessionLife: number;
        tokenLife: number;
        loginOnRegistration: boolean;
        loginOnPasswordReset: boolean;
    };
    local: {
        usernameField: string;
        passwordField: string;
    };
    session: {
        adapter: string;
        file: {
            sessionsRoot: string;
        };
    };
    dbServer: {
        protocol: string;
        host: string;
        designDocDir: string;
        userDB: string;
        couchAuthDB: string;
    };
    emails: {
        confirmEmail: {
            subject: string;
            template: string;
            format: string;
        };
        forgotPassword: {
            subject: string;
            template: string;
            format: string;
        };
    };
    mailer: {
        logger: boolean;
    };
};
export default defaultConfig;
declare global {
    type IDefaultConfig = typeof defaultConfig;
}
