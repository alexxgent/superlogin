import { Router } from 'express';
import { Passport } from 'passport';
declare const routes: (config: IConfigure, router: Router, passport: Passport, user: any) => void;
export default routes;
declare global {
    type Routes = typeof routes;
}
