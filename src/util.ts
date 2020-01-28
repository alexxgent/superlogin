import crypto from 'crypto'
import { Request } from 'express'
import merge from 'lodash.merge'
import URLSafeBase64 from 'urlsafe-base64'
import uuid from 'uuid'
import { Superlogin } from './types'

const KEY_LEN = 20
const KEY_SIZE = 16
const KEY_ITERATIONS = 10
const KEY_ENCODING = 'hex'
const KEY_DIGEST = 'SHA1'

const URLSafeUUID = () => URLSafeBase64.encode(uuid.v4(null, new Buffer(16)))

const hashToken = (token: string) =>
  crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')

const hashPassword = async (password: string) =>
  new Promise<{ salt: string; derived_key: string }>((resolve, reject) =>
    crypto.randomBytes(KEY_SIZE, (err1, baseSalt) => {
      if (err1) {
        return reject(err1)
      }
      const salt = baseSalt.toString('hex')
      crypto.pbkdf2(password, salt, KEY_ITERATIONS, KEY_LEN, KEY_DIGEST, (err2, hash) => {
        if (err2) {
          return reject(err2)
        }
        const derived_key = hash.toString(KEY_ENCODING)
        return resolve({ salt, derived_key })
      })
    })
  )

const verifyPassword = async (
  hashObj: { iterations?: number; salt?: string; derived_key?: string },
  password: string
) => {
  const { iterations, salt, derived_key } = hashObj
  if (!salt || !derived_key) {
    return Promise.reject(false)
  }
  return new Promise<boolean>((resolve, reject) =>
    crypto.pbkdf2(password, salt, iterations || 10, KEY_LEN, KEY_DIGEST, (err, hash) => {
      if (err) {
        return reject(false)
      }

      if (hash.toString(KEY_ENCODING) === derived_key) {
        return resolve(true)
      } else {
        return reject(false)
      }
    })
  )
}

const getDBURL = ({ user, protocol, host, password }: Superlogin.IConfiguration['dbServer']) =>
  user
    ? `${protocol + encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}`
    : `${protocol}${host}`

const getFullDBURL = (dbServer: Superlogin.IConfiguration['dbServer'], dbName: string) =>
  `${getDBURL(dbServer)}/${dbName}`

// tslint:disable-next-line:no-any
const toArray = <T>(obj: T | T[]): T[] => (Array.isArray(obj) ? obj : [obj])

const getSessions = ({ session }: Superlogin.IUserDoc) => (session ? Object.keys(session) : [])

const getExpiredSessions = ({ session }: Superlogin.IUserDoc, now: number) =>
  session
    ? Object.keys(session).filter(k => {
        const thisSession = session[k]
        return !thisSession.expires || thisSession.expires <= now
      })
    : []

// Takes a req object and returns the bearer token, or undefined if it is not found
const getSessionToken = (req: Request) => {
  if (req.headers && req.headers.authorization) {
    const auth = req.headers.authorization as string
    const parts = auth.split(' ')
    if (parts.length === 2) {
      const scheme = parts[0]
      const credentials = parts[1]
      if (/^Bearer$/i.test(scheme)) {
        const parse = credentials.split(':')
        if (parse.length < 2) {
          return undefined
        }
        return parse[0]
      }
    }
  }
  return undefined
}

// Generates views for each registered provider in the user design doc
const addProvidersToDesignDoc = (config: IConfigure, ddoc: { auth: { views: {} } }) => {
  const providers = config.get().providers
  if (!providers) {
    return ddoc
  }
  const ddocTemplate = (provider: string) =>
    `function(doc){ if(doc.${provider} && doc.${provider}.profile) { emit(doc.${provider}.profile.id,null); } }`
  return merge({}, ddoc, {
    auth: {
      views: Object.keys(providers).reduce(
        (r, provider) => ({ ...r, [provider]: { map: ddocTemplate(provider) } }),
        {}
      )
    }
  })
}

// Capitalizes the first letter of a string
const capitalizeFirstLetter = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

// tslint:disable-next-line:no-any
const arrayUnion = (a: any[], b: any[]): any[] => {
  const result = a.concat(b)
  for (let i = 0; i < result.length; i += 1) {
    for (let j = i + 1; j < result.length; j += 1) {
      if (result[i] === result[j]) {
        result.splice((j -= 1), 1)
      }
    }
  }
  return result
}

export default {
  URLSafeUUID,
  hashToken,
  hashPassword,
  verifyPassword,
  getDBURL,
  getFullDBURL,
  getSessions,
  getExpiredSessions,
  getSessionToken,
  addProvidersToDesignDoc,
  capitalizeFirstLetter,
  arrayUnion,
  toArray
}
