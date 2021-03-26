import { Router } from 'express';
import { Passport } from 'passport';
import { Superlogin } from './types';
declare const routes: <Profile extends Superlogin.IProfile = Superlogin.IProfile>(config: IConfigure, router: Router, passport: Passport, user: any) => void;
export default routes;
declare global {
    type Routes = typeof routes;
}
