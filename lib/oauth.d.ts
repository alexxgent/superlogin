import { Router } from 'express';
import { Passport, Strategy as StrategyType } from 'passport';
declare const oauth: (router: Router, passport: Passport, user: any, config: IConfigure) => {
    registerProvider: (provider: string, configFunction: (credentials: any, passport: any, authHandler: any) => void) => void;
    registerOAuth2: (providerName: string, Strategy: StrategyType) => void;
    registerTokenProvider: (providerName: string, Strategy: StrategyType) => void;
};
export default oauth;
declare global {
    type Oauth = typeof oauth;
}
