import d from 'debug'
import redis from 'redis'
import { promisify } from 'util'
import { Superlogin } from '../types'

const debug = d('superlogin')

const RedisAdapter = (config: IConfigure): Superlogin.IAdapter => {
  const { redis: redisConfig } = config.get().session
  const finalRedisConfig = redisConfig || { host: '127.0.0.1', port: 6379 }

  const { unix_socket, url, port, host, options, password } = finalRedisConfig

  const redisClient = unix_socket
    ? redis.createClient(unix_socket, options)
    : url
    ? redis.createClient(url, options)
    : redis.createClient(port || 6379, host || '127.0.0.1', options)

  const authAsync = promisify(redisClient.auth).bind(redisClient)
  const psetexAsync = promisify(redisClient.psetex).bind(redisClient)
  const delAsync = promisify(redisClient.del as (
    keys: string[],
    cb: (e: Error | null, result: number) => void
  ) => void).bind(redisClient)
  const getAsync = promisify(redisClient.get).bind(redisClient)
  const quitAsync = promisify(redisClient.quit).bind(redisClient)

  // Authenticate with Redis if necessary
  if (password) {
    authAsync(password).catch((err: string) => {
      throw new Error(err)
    })
  }

  redisClient.on('error', (err: string) => console.error(`Redis error: ${err}`))

  redisClient.on('connect', () => debug('Redis is ready'))

  const storeKey = async (key: string, life: number, data: string) => psetexAsync(key, life, data)

  const deleteKeys = async (keys: string[]) => delAsync(keys)

  const getKey = async (key: string) => getAsync(key)

  const quit = async () => quitAsync()

  return {
    storeKey,
    deleteKeys,
    getKey,
    quit
  }
}

export default RedisAdapter
