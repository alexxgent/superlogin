import { PassportStatic } from 'passport';
import { Superlogin } from './types';
declare const local: <Profile extends Superlogin.IProfile = Superlogin.IProfile>(config: IConfigure, passport: PassportStatic, user: any) => void;
export default local;
declare global {
    type Local = typeof local;
}
