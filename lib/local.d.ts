import { PassportStatic } from 'passport';
declare const local: (config: IConfigure, passport: PassportStatic, user: any) => void;
export default local;
declare global {
    type Local = typeof local;
}
