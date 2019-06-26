import request from 'superagent'
import url from 'url'
import { Superlogin } from '../types'
import util from './../util'

const getSecurityUrl = (db: PouchDB.Database) =>
  url.format(`${url.parse(db.name).pathname}/_security`)

const getAPIKey = async (db: PouchDB.Database) => {
  const finalUrl = url.format(`${url.parse(db.name).pathname}/_api/v2/api_keys`)
  try {
    const res = await request.post(finalUrl)
    if (res) {
      const result: { key: string; password: string; ok: boolean } = JSON.parse(res.text)
      if (result.key && result.password && result.ok === true) {
        return result
      }
      return Promise.reject(result)
    }
  } catch (error) {
    console.error('error getting api key!', error)
    throw error
  }
}

const getSecurityCloudant = async (db: PouchDB.Database) => {
  const finalUrl = getSecurityUrl(db)
  const res = await request.get(finalUrl)
  return Promise.resolve(JSON.parse(res.text))
}

const putSecurityCloudant = async (db: PouchDB.Database, doc: {}) => {
  const finalUrl = getSecurityUrl(db)
  try {
    const res = await request
      .put(finalUrl)
      //       .set(db.getHeaders())
      .send(doc)
    return JSON.parse(res.text)
  } catch (error) {
    throw error
  }
}

// This is not needed with Cloudant
const storeKey = async () => Promise.resolve()

// This is not needed with Cloudant
const removeKeys = async () => Promise.resolve(false)

const initSecurity = async (db: PouchDB.Database, adminRoles: string[], memberRoles: string[]) => {
  let changes = false
  const secDoc = await db.get<Superlogin.ISecurityDoc>('_security')

  if (!secDoc.admins) {
    secDoc.admins = { names: [], roles: [] }
  }
  if (!secDoc.admins.roles) {
    secDoc.admins.roles = []
  }
  if (!secDoc.members) {
    secDoc.members = { names: [], roles: [] }
  }
  if (!secDoc.members.roles) {
    secDoc.admins.roles = []
  }
  adminRoles.forEach((role: string) => {
    if (secDoc.admins.roles.indexOf(role) === -1) {
      changes = true
      secDoc.admins.roles.push(role)
    }
  })
  memberRoles.forEach((role: string) => {
    if (secDoc.members.roles.indexOf(role) === -1) {
      changes = true
      secDoc.members.roles.push(role)
    }
  })
  if (changes) {
    return putSecurityCloudant(db, secDoc)
  }
  return false
}

const authorizeKeys = async (
  user_id: string,
  db: PouchDB.Database,
  keys: string[],
  permissions: string[],
  roles: string[]
) => {
  let keysObj = {}
  if (!permissions) {
    permissions = ['_reader', '_replicator']
  }
  permissions = permissions.concat(roles || [])
  permissions.unshift(`user:${user_id}`)
  // If keys is a single value convert it to an Array
  keys = util.toArray(keys)
  // Check if keys is an array and convert it to an object
  if (keys instanceof Array) {
    keys.forEach(key => {
      keysObj[key] = permissions
    })
  } else {
    keysObj = keys
  }
  // Pull the current _security doc
  const secDoc = await getSecurityCloudant(db)
  if (!secDoc._id) {
    secDoc._id = '_security'
  }
  if (!secDoc.cloudant) {
    secDoc.cloudant = {}
  }
  Object.keys(keysObj).forEach(key => (secDoc.cloudant[key] = keysObj[key]))
  return putSecurityCloudant(db, secDoc)
}

const deauthorizeKeys = async (db: PouchDB.Database, keys: string[]) => {
  // cast keys to an Array
  keys = util.toArray(keys)
  const secDoc = await getSecurityCloudant(db)

  let changes = false
  if (!secDoc.cloudant) {
    return false
  }
  keys.forEach(key => {
    if (secDoc.cloudant[key]) {
      changes = true
      delete secDoc.cloudant[key]
    }
  })
  if (changes) {
    return putSecurityCloudant(db, secDoc)
  }
  return false
}

export default {
  getAPIKey,
  getSecurityCloudant,
  putSecurityCloudant,
  storeKey,
  removeKeys,
  initSecurity,
  authorizeKeys,
  deauthorizeKeys
}

declare global {
  export interface IDBAdapter {
    getAPIKey?(
      db: PouchDB.Database
    ): Promise<
      | {
          key: string
          password: string
          ok: boolean
        }
      | undefined
    >
    getSecurityCloudant?(db: PouchDB.Database): Promise<string>
    putSecurityCloudant?(db: PouchDB.Database, doc: {}): Promise<string>
  }
}
