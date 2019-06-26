import d from 'debug'
import { Superlogin } from '../types'

const debug = d('superlogin')

const MemoryAdapter = (): Superlogin.IAdapter => {
  const _keys = {}
  const _expires = {}
  debug('Memory Adapter loaded')

  const _removeExpired = () => {
    const now = Date.now()
    Object.keys(_expires).forEach(key => {
      if (_expires[key] < now) {
        delete _keys[key]
        delete _expires[key]
      }
    })
  }

  const storeKey = async (key: string, life: number, data: {}) => {
    const now = Date.now()
    _keys[key] = data
    _expires[key] = now + life
    _removeExpired()
    return Promise.resolve()
  }

  const getKey = async (key: string) => {
    const now = Date.now()
    if (_keys[key] && _expires[key] > now) {
      return Promise.resolve(_keys[key])
    }
    return false
  }

  const deleteKeys = async (keys: string[]) => {
    if (!Array.isArray(keys)) {
      keys = [keys]
    }
    keys.forEach(key => {
      delete _keys[key]
      delete _expires[key]
    })
    _removeExpired()
    return Promise.resolve(keys.length)
  }

  const quit = async () => {
    return Promise.resolve()
  }

  return {
    storeKey,
    getKey,
    deleteKeys,
    quit,
    _removeExpired
  }
}

export default MemoryAdapter
