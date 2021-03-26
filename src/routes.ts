import { Router } from 'express'
import { Passport } from 'passport'

import { Superlogin } from './types'
import util from './util'

const routes = <Profile extends Superlogin.IProfile = Superlogin.IProfile>(
  config: IConfigure,
  router: Router,
  passport: Passport,
  user: User
) => {
  router.post(
    '/login',
    (req, res, next) => {
      passport.authenticate('local', (error, passportUser, info) => {
        if (error) {
          return res.status(500).json({ error })
        }
        if (!passportUser) {
          // Authentication failed
          return res.status(401).json(info)
        }
        // Success
        req.logIn(passportUser, { session: false }, loginErr =>
          loginErr ? next(loginErr) : undefined
        )
        return next()
      })(req, res, next)
    },
    (req, res, next) =>
      // Success handler
      user
        .createSession(req.user._id, 'local', req)
        .then((mySession: {}) => res.status(200).json(mySession), next)
  )

  router.post('/refresh', passport.authenticate('bearer', { session: false }), (req, res, next) =>
    user.refreshSession(req.user.key).then((mySession: {}) => res.status(200).json(mySession), next)
  )

  router.post('/logout', (req, res, next) => {
    const sessionToken = util.getSessionToken(req)
    if (!sessionToken) {
      return next({
        error: 'unauthorized',
        status: 401
      })
    }
    return user.logoutSession(sessionToken).then(
      () => res.status(200).json({ ok: true, success: 'Logged out' }),
      (err: string) => {
        console.error('Logout failed', err)
        return next(err)
      }
    )
  })

  router.post(
    '/logout-others',
    passport.authenticate('bearer', { session: false }),
    (req, res, next) => {
      user.logoutOthers(req.user.key).then(
        () => {
          res.status(200).json({ success: 'Other sessions logged out' })
        },
        (err: string) => {
          console.error('Logout failed', err)
          return next(err)
        }
      )
    }
  )

  router.post('/logout-all', (req, res, next) => {
    const sessionToken = util.getSessionToken(req)
    if (!sessionToken) {
      return next({
        error: 'unauthorized',
        status: 401
      })
    }
    return user.logoutUser(null, sessionToken).then(
      () => res.status(200).json({ success: 'Logged out' }),
      (err: string) => {
        console.error('Logout-all failed', err)
        return next(err)
      }
    )
  })

  // Setting up the auth api
  router.post('/register', (req, res, next) => {
    user.create(req.body, req).then((newUser: Superlogin.IUserDoc<Profile>) => {
      if (config.get().security.loginOnRegistration) {
        return user
          .createSession(newUser._id, 'local', req.ip)
          .then((mySession: {}) => res.status(200).json(mySession), next)
      }
      return res.status(201).json({ success: 'User created.' })
    }, next)
  })

  router.post('/forgot-password', (req, res, next) =>
    user
      .forgotPassword(req.body.email, req)
      .then(() => res.status(200).json({ success: 'Password recovery email sent.' }), next)
  )

  router.post('/password-reset', (req, res, next) => {
    user.resetPassword(req.body, req).then((currentUser: Superlogin.IUserDoc<Profile>) => {
      if (config.get().security.loginOnPasswordReset) {
        return user
          .createSession(currentUser._id, 'local', req.ip)
          .then((mySession: {}) => res.status(200).json(mySession), next)
      }
      return res.status(200).json({ success: 'Password successfully reset.' })
    }, next)
  })

  router.post(
    '/password-change',
    passport.authenticate('bearer', { session: false }),
    (req, res, next) => {
      user.changePasswordSecure(req.user._id, req.body, req).then(() => {
        res.status(200).json({ success: 'password changed' })
      }, next)
    }
  )

  router.post(
    '/unlink/:provider',
    passport.authenticate('bearer', { session: false }),
    (req, res, next) => {
      const { provider } = req.params
      user
        .unlink(req.user._id, provider)
        .then(
          () =>
            res.status(200).json({ success: `${util.capitalizeFirstLetter(provider)} unlinked` }),
          next
        )
    }
  )

  router.get('/confirm-email/:token', (req, res, next) => {
    const redirectURL = config.get().local.confirmEmailRedirectURL
    if (!req.params.token) {
      const err = { error: 'Email verification token required' }
      if (redirectURL) {
        return res.status(201).redirect(`${redirectURL}?error=${encodeURIComponent(err.error)}`)
      }
      return res.status(400).send(err)
    }
    return user.verifyEmail(req.params.token, req).then(
      () =>
        redirectURL
          ? res.status(201).redirect(`${redirectURL}?success=true`)
          : res.status(200).send({ ok: true, success: 'Email verified' }),
      (err: { message: string; error: string }) => {
        if (redirectURL) {
          let query = `?error=${encodeURIComponent(err.error)}`
          if (err.message) {
            query += `&message=${encodeURIComponent(err.message)}`
          }
          return res.status(201).redirect(redirectURL + query)
        }
        return next(err)
      }
    )
  })

  router.get('/validate-username/:username', (req, res, next) => {
    if (!req.params.username) {
      return next({ error: 'Username required', status: 400 })
    }
    return user
      .validateUsername(req.params.username)
      .then(
        (err: string) =>
          err
            ? res.status(409).json({ error: 'Username already in use' })
            : res.status(200).json({ ok: true }),
        next
      )
  })

  router.get('/validate-email/:email', (req, res, next) => {
    let promise
    if (!req.params.email) {
      return next({ error: 'Email required', status: 400 })
    }
    if (config.get().local.emailUsername) {
      promise = user.validateEmailUsername(req.params.email)
    } else {
      promise = user.validateEmail(req.params.email)
    }
    return promise.then(
      (err: string) =>
        err
          ? res.status(409).json({ error: 'Email already in use' })
          : res.status(200).json({ ok: true }),
      next
    )
  })

  router.post(
    '/change-email',
    passport.authenticate('bearer', { session: false }),
    (req, res, next) => {
      user.changeEmail(req.user._id, req.body.newEmail, req).then(() => {
        res.status(200).json({ ok: true, success: 'Email changed' })
      }, next)
    }
  )

  // route to test token authentication
  router.get('/session', passport.authenticate('bearer', { session: false }), (req, res) => {
    const { user: sessionUser } = req
    if (!sessionUser) {
      console.error('session auth error - no user provided')
      return res.status(401).json({ error: 'no user provided' })
    }
    const { _id: user_id, key, ...finalUser } = sessionUser
    res.status(200).json({ ...finalUser, user_id })
  })
}

export default routes

declare global {
  export type Routes = typeof routes
}
