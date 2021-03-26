import FileAdapter from './sessionAdapters/FileAdapter'
import MemoryAdapter from './sessionAdapters/MemoryAdapter'
import RedisAdapter from './sessionAdapters/RedisAdapter'
import { Superlogin } from './types'
import util from './util'

const tokenPrefix = 'token'

const secureToken = (token: Superlogin.ISession) => {
  const { salt, derived_key, ...finalToken } = token
  return finalToken
}

const Session = (config: IConfigure) => {
  const sessionAdapter = config.get().session.adapter
  const adapter =
    sessionAdapter === 'redis'
      ? RedisAdapter(config)
      : sessionAdapter === 'file'
      ? FileAdapter(config)
      : MemoryAdapter()

  return {
    confirmToken: async (key: string, password: string) => {
      try {
        const result = await adapter.getKey(`${tokenPrefix}:${key}`)
        if (!result) {
          return Promise.reject('invalid token')
        }
        const token: Superlogin.ISession = JSON.parse(result)
        await util.verifyPassword(token, password)
        return secureToken(token)
      } catch (error) {
        console.error('confirm token error', error)
        return Promise.reject('invalid token')
      }
    },
    deleteTokens: async (keys: string | string[]) => {
      if (!Array.isArray(keys)) {
        keys = [keys]
      }
      return adapter.deleteKeys(keys.map(key => `${tokenPrefix}:${key}`))
    },
    fetchToken: async (key: string) => {
      try {
        return adapter.getKey(`${tokenPrefix}:${key}`).then(result => JSON.parse(result))
      } catch (error) {
        console.error('fetchToken error!', error)
        return undefined
      }
    },
    storeToken: async (token: Superlogin.ISession) => {
      const { password, salt, derived_key, key, expires } = token
      try {
        if (!password && salt && derived_key) {
          await adapter.storeKey(
            `${tokenPrefix}:${key}`,
            expires - Date.now(),
            JSON.stringify(token)
          )
          return secureToken(token)
        }
        const hash = await util.hashPassword(password)
        const finalToken = {
          ...token,
          salt: hash.salt,
          derived_key: hash.derived_key,
          password: undefined as string
        }

        await adapter.storeKey(
          `${tokenPrefix}:${finalToken.key}`,
          finalToken.expires - Date.now(),
          JSON.stringify(finalToken)
        )

        delete finalToken.salt
        delete finalToken.derived_key
        return secureToken(token)
      } catch (error) {
        console.error('error storing token', error)
        return undefined
      }
    },
    quit: async () => adapter.quit()
  }
}

export default Session
