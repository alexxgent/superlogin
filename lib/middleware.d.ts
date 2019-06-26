import { RequestHandler } from 'express';
import { PassportStatic } from 'passport';
declare const middleware: (passport: PassportStatic) => {
    requireAuth: RequestHandler;
    requireRole: (requiredRole: string) => RequestHandler;
    requireAnyRole: (possibleRoles: string[]) => RequestHandler;
    requireAllRoles: (requiredRoles: string[]) => RequestHandler;
};
export default middleware;
declare global {
    type Middleware = typeof middleware;
}
