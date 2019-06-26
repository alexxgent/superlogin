import d from 'debug'
import fsBase from 'fs-extra'
import path from 'path'
import promisifyAll from 'util-promisifyall'
import { Superlogin } from '../types'

const debug = d('superlogin')

const fs = promisifyAll(fsBase)

const FileAdapter = (config: IConfigure): Superlogin.IAdapter => {
  const fileConfig = config.get().session.file
  const sessionsRoot = fileConfig ? fileConfig.sessionsRoot : undefined
  const _sessionFolder = sessionsRoot
    ? path.join(process.env.PWD as string, sessionsRoot)
    : undefined
  debug('File Adapter loaded')

  const _getFilepath = (key: string) =>
    path.format({
      dir: _sessionFolder,
      base: `${key}.json`
    })

  const storeKey = (key: string, life: number, data: {}) =>
    fs.outputJsonAsync(_getFilepath(key), {
      data,
      expire: Date.now() + life
    })

  const getKey = (key: string) => {
    const now = Date.now()
    return fs
      .readJsonAsync(_getFilepath(key))
      .then((session: { expire: number; data: {} }) => {
        if (session.expire > now) {
          return session.data
        }
        return false
      })
      .catch(() => false)
  }

  const deleteKeys = async (keys: string[]) => {
    if (!(keys instanceof Array)) {
      keys = [keys]
    }
    const done = await Promise.all(keys.map(async key => fs.removeAsync(_getFilepath(key))))
    return done.length
  }

  const quit = async () => Promise.resolve()

  const _removeExpired = () => {
    // open all files and check session expire date
  }

  return {
    _getFilepath,
    storeKey,
    getKey,
    deleteKeys,
    quit,
    _removeExpired
  }
}

export default FileAdapter
