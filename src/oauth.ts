import d from 'debug'
import ejs from 'ejs'
import { Request, RequestHandler, Router } from 'express'
import fs from 'fs'
import { Passport, Strategy as StrategyType } from 'passport'
import path from 'path'
import asCallback from 'standard-as-callback'

import util from './util'

const debug = d('superlogin')

const stateRequiredProviders = ['apple', 'google', 'linkedin']

const oauth = (router: Router, passport: Passport, user: User, config: IConfigure) => {
  // Helpers
  const isStateRequired = (provider: string) => {
    const { providers } = config.get()
    if (!providers || !providers[provider]) {
      return stateRequiredProviders.indexOf(provider) > -1
    }
    return stateRequiredProviders.indexOf(provider) > -1 || providers[provider].stateRequired
  }

  // Gets the provider name from a callback path
  const getProvider = (pathname: string, token: boolean) => {
    const items = pathname.split('/')
    const index = items.indexOf(token ? 'token' : 'callback')
    if (index > 0) {
      return items[index - 1]
    }
    return undefined
  }

  const getLinkCallbackURLs = (
    provider: string,
    req: Request,
    operation: 'login' | 'link',
    accessToken?: string
  ) => {
    const encodedToken = accessToken ? encodeURIComponent(accessToken) : undefined
    const protocol = `${req.get('X-Forwarded-Proto') || req.protocol}://`
    const stateRequired = isStateRequired(provider)

    if (operation === 'login') {
      return `${protocol}${req.get('host')}${req.baseUrl}/${provider}/callback`
    }

    if (operation === 'link') {
      if (encodedToken && stateRequired) {
        return `${protocol}${req.get('host')}${req.baseUrl}/link/${provider}/callback`
      }
      return `${protocol +
        req.get('host') +
        req.baseUrl}/link/${provider}/callback?state=${encodedToken}`
    }
    return undefined
  }

  // Configures the passport.authenticate for the given provider, passing in options
  // Operation is 'login' or 'link'
  const passportCallback = (
    provider: string,
    options: { scope?: string[] },
    operation: 'login' | 'link'
  ): RequestHandler => (req, res, next) => {
    const stateRequired = isStateRequired(provider)
    const accessToken = req.query.bearer_token || req.query.state
    const callbackURL = getLinkCallbackURLs(provider, req, operation, accessToken)
    const finalOptions = {
      ...options,
      callbackURL,
      session: false,
      state: accessToken && stateRequired ? accessToken : undefined
    }
    return passport.authenticate(provider, finalOptions)(req, res, next)
  }

  // Configures the passport.authenticate for the given access_token provider, passing in options
  const passportTokenCallback = (
    provider: string,
    options: { scope?: string[] }
  ): RequestHandler => (req, res, next) =>
    passport.authenticate(`${provider}-token`, {
      ...options,
      session: false
    })(req, res, next)

  // This is called after a user has successfully authenticated with a provider
  // If a user is authenticated with a bearer token we will link an account, otherwise log in
  // auth is an object containing 'access_token' and optionally 'refresh_token'
  const authHandler = (
    req: Request,
    provider: string,
    auth: { accessToken: string; refreshToken: string },
    profile: {}
  ) =>
    req.user && req.user._id && req.user.key
      ? user.linkSocial(req.user._id, provider, auth, profile, req)
      : user.socialAuth(provider, auth, profile, req)

  // Function to initialize a session following authentication from a socialAuth provider
  const initSession: RequestHandler = async (req, res, next) => {
    const provider = getProvider(req.path, false)
    try {
      const session = await user.createSession(req.user._id, provider, req)
      const { testMode } = config.get()
      const templatePath = `../templates/oauth/auth-callback${
        testMode && testMode.oauthTest ? '-test' : ''
      }.ejs`
      const template = fs.readFileSync(path.join(__dirname, templatePath), 'utf8')
      const html = ejs.render(template, {
        error: null,
        session,
        link: null
      })
      return res.status(200).send(html)
    } catch (error) {
      console.error('initSession failed', error)
      return res.status(500).json({ error })
    }
  }

  // Function to initialize a session following authentication from a socialAuth provider
  const initTokenSession: RequestHandler = async (req, res, next) => {
    const provider = getProvider(req.path, true)
    try {
      const session = await user.createSession(req.user._id, provider, req)
      return res.status(200).json(session)
    } catch (error) {
      console.error('initTokenSession failed', error)
      return res.status(500).json({ error })
    }
  }

  // Called after an account has been succesfully linked
  const linkSuccess: RequestHandler = (req, res) => {
    const provider = getProvider(req.path, false)
    const { testMode } = config.get()
    const templatePath = `../templates/oauth/auth-callback${
      testMode && testMode.oauthTest ? '-test' : ''
    }.ejs`
    try {
      const template = fs.readFileSync(path.join(__dirname, templatePath), 'utf8')
      const html = ejs.render(template, {
        error: null,
        session: null,
        link: provider
      })
      res.status(200).send(html)
    } catch (error) {
      console.error('linkSuccess failed', error)
      return res.status(500).json({ error })
    }
  }

  // Called after an account has been succesfully linked using access_token provider
  const linkTokenSuccess: RequestHandler = (req, res) => {
    const provider = getProvider(req.path, true)
    if (!provider) {
      return res.status(500).json({ error: `${provider} provider not found` })
    }
    return res.status(200).json({
      ok: true,
      success: `${util.capitalizeFirstLetter(provider)} successfully linked`,
      provider
    })
  }

  // Framework to register OAuth providers with passport
  const registerProvider = (
    provider: string,
    configFunction: (
      // tslint:disable-next-line:no-any
      credentials: any,
      // tslint:disable-next-line:no-any
      passport: any,
      // tslint:disable-next-line:no-any
      authHandler: any
    ) => void
  ) => {
    const providersConfig = config.get().providers
    const providerConfig = providersConfig ? providersConfig[provider.toLowerCase()] : undefined
    if (!providerConfig) {
      console.error(`providerConfig not found for ${provider}`)
      throw new Error(`providerConfig not found for ${provider}`)
    }

    const { credentials, options } = providerConfig
    if (credentials) {
      const finalCreds = { ...credentials, passReqToCallback: true }
      configFunction(finalCreds, passport, authHandler)
      router.get(`/${provider}`, passportCallback(provider, options, 'login'))
      router.get(`/${provider}/callback`, passportCallback(provider, options, 'login'), initSession)
      if (!config.get().security.disableLinkAccounts) {
        router.get(
          `/link/${provider}`,
          passport.authenticate('bearer', { session: false }),
          passportCallback(provider, options, 'link')
        )
        router.get(
          `/link/${provider}/callback`,
          passport.authenticate('bearer', { session: false }),
          passportCallback(provider, options, 'link'),
          linkSuccess
        )
      }
      debug(`${provider} loaded.`)
    }
  }

  // A shortcut to register OAuth2 providers that follow the exact accessToken, refreshToken pattern.
  const registerOAuth2 = (providerName: string, Strategy: StrategyType) => {
    registerProvider(providerName, (credentials, providerPassport, providerAuthHandler) => {
      providerPassport.use(
        new Strategy(credentials, async (req, accessToken, refreshToken, profile, done) =>
          asCallback(
            providerAuthHandler(req, providerName, { accessToken, refreshToken }, profile),
            done
          )
        )
      )
    })
  }

  // Registers a provider that accepts an access_token directly from the client, skipping the popup window and callback
  // This is for supporting Cordova, native IOS and Android apps, as well as other devices
  const registerTokenProvider = (providerName: string, Strategy: StrategyType) => {
    const providersConfig = config.get().providers
    const providerConfig = providersConfig ? providersConfig[providerName.toLowerCase()] : undefined
    if (!providerConfig) {
      console.error(`providerConfig not found for ${providerName}`)
      throw new Error(`providerConfig not found for ${providerName}`)
    }

    const { credentials, options } = providerConfig
    if (credentials) {
      const finalCreds = { ...credentials, passReqToCallback: true }
      // Configure the Passport Strategy
      passport.use(
        `${providerName}-token`,
        new Strategy(finalCreds, async (req, accessToken, refreshToken, profile, done) =>
          asCallback(authHandler(req, providerName, { accessToken, refreshToken }, profile), done)
        )
      )
      router.post(
        `/${providerName}/token`,
        passportTokenCallback(providerName, options),
        initTokenSession
      )
      if (!config.get().security.disableLinkAccounts) {
        router.post(
          `/link/${providerName}/token`,
          passport.authenticate('bearer', { session: false }),
          passportTokenCallback(providerName, options),
          linkTokenSuccess
        )
      }
      debug(`${providerName}-token loaded.`)
    }
  }

  return {
    registerProvider,
    registerOAuth2,
    registerTokenProvider
  }
}

export default oauth

declare global {
  export type Oauth = typeof oauth
}
