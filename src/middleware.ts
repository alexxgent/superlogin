import { RequestHandler } from 'express'
import { PassportStatic } from 'passport'

// Contains middleware useful for securing your routes
const middleware = (passport: PassportStatic) => {
  const forbiddenError = {
    error: 'Forbidden',
    message: 'You do not have permission to access this resource.',
    status: 403
  }

  const superloginError = {
    error: 'superlogin',
    message: 'requireAuth must be used before checking roles',
    status: 500
  }

  // Requires that the user be authenticated with a bearer token
  const requireAuth: RequestHandler = (req, res, next) => {
    passport.authenticate('bearer', { session: false })(req, res, next)
  }

  // Requires that the user have the specified role
  const requireRole = (requiredRole: string): RequestHandler => (req, res, next) => {
    if (!req.user) {
      return next(superloginError)
    }
    const { roles } = req.user
    if (!roles || !roles.length || roles.indexOf(requiredRole) === -1) {
      res.status(forbiddenError.status)
      res.json(forbiddenError)
    } else {
      next()
    }
    return undefined
  }

  // Requires that the user have at least one of the specified roles
  const requireAnyRole = (possibleRoles: string[]): RequestHandler => (req, res, next) => {
    if (!req.user) {
      return next(superloginError)
    }
    const { roles }: { roles?: string[] } = req.user
    if (Array.isArray(roles)) {
      const hasRole = possibleRoles.findIndex(role => roles.includes(role)) > -1
      if (hasRole) {
        return next()
      }
    }
    return res.status(forbiddenError.status).json(forbiddenError)
  }

  const requireAllRoles = (requiredRoles: string[]): RequestHandler => (req, res, next) => {
    if (!req.user) {
      return next(superloginError)
    }
    const { roles }: { roles?: string[] } = req.user
    if (Array.isArray(roles)) {
      const missingRole = requiredRoles.findIndex(role => !roles.includes(role)) > -1
      if (!missingRole) {
        return next()
      }
    }
    return res.status(forbiddenError.status).json(forbiddenError)
  }

  return {
    requireAuth,
    requireRole,
    requireAnyRole,
    requireAllRoles
  }
}

export default middleware

declare global {
  export type Middleware = typeof middleware
}
