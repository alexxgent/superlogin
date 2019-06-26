import merge from 'lodash.merge'
import util from '../util'

const couchdb = (couchAuthDB: PouchDB.Database): IDBAdapter => {
  const storeKey = async (
    username: string,
    key: string,
    password: string,
    expires: number,
    roles: string[]
  ) => {
    const newKey = {
      _id: `org.couchdb.user:${key}`,
      type: 'user',
      name: key,
      user_id: username,
      password,
      expires,
      roles: [`user:${username}`, ...roles]
    }
    await couchAuthDB.upsert(newKey._id, oldKey => merge({}, oldKey, newKey))
    return {
      ...newKey,
      _id: key
    }
  }

  const removeKeys = async (keys: string | string[]) => {
    keys = util.toArray(keys)
    // Transform the list to contain the CouchDB _user ids
    const keylist = keys.filter(k => k).map(key => `org.couchdb.user:${key}`)
    try {
      const keyDocs = await couchAuthDB.allDocs({ keys: keylist })
      if (keyDocs.rows && keyDocs.rows.length > 0) {
        const toDelete = keyDocs.rows.reduce(
          (r: Array<{}>, row) =>
            !row.value || row.value.deleted
              ? r
              : [
                  ...r,
                  {
                    _id: row.id,
                    _rev: row.value.rev,
                    _deleted: true
                  }
                ],
          []
        )
        if (toDelete.length > 0) {
          return couchAuthDB.bulkDocs(toDelete)
        }
      }
      return false
    } catch (error) {
      console.error('error removing keys!', error)
      return false
    }
  }

  const initSecurity = async (
    db: PouchDB.Database,
    adminRoles: string[],
    memberRoles: string[]
  ) => {
    try {
      const security = db.security()
      await security.fetch()

      security.members.roles.add(memberRoles)
      security.admins.roles.add(adminRoles)
      return await security.save()
    } catch (error) {
      console.error('error initializing security', error)
      return false
    }
  }

  const authorizeKeys = async (user_id: string, db: PouchDB.Database, keys: string[]) => {
    try {
      const security = db.security()
      await security.fetch()

      security.members.names.add(keys)
      return await security.save()
    } catch (error) {
      console.error('error authorizing keys', error)
      return false
    }
  }

  const deauthorizeKeys = async (db: PouchDB.Database, keys: string[] | string) => {
    keys = util.toArray(keys)
    try {
      const security = db.security()
      await security.fetch()

      security.members.names.remove(keys)
      return await security.save()
    } catch (error) {
      console.error('error deauthorizing keys!', error)
      return false
    }
  }

  return {
    initSecurity,
    authorizeKeys,
    deauthorizeKeys,
    removeKeys,
    storeKey
  }
}

declare global {
  interface IDBAdapter {
    initSecurity(db: {}, adminRoles: string[], memberRoles: string[]): Promise<void | boolean>
    authorizeKeys(
      user_id: string,
      db: PouchDB.Database,
      keys: string[] | string,
      permissions?: string[],
      roles?: string[]
    ): Promise<void | boolean>
    deauthorizeKeys(db: PouchDB.Database, keys: string[] | string): Promise<void | boolean>
    removeKeys(
      keys: string[] | string
    ): Promise<boolean | PouchDB.Core.Response[] | PouchDB.Core.Error[]>
    storeKey(
      username: string,
      key: string,
      password: string,
      expires?: number,
      roles?: string[]
    ): Promise<{
      _id: string
      type: string
      name: string
      user_id: string
      password: string
      expires: number
      roles: string[]
    } | void>
  }
}

export default couchdb
