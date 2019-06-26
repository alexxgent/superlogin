import d from 'debug'
import redis, { RedisClient } from 'redis'
import promisifyAll from 'util-promisifyall'
import { Superlogin } from '../types'

const debug = d('superlogin')

interface IPromRedis extends RedisClient {
  authAsync(pwd: string): Promise<void>
  psetexAsync(key: string, life: {}, data: {}): Promise<void>
  delAsync(keys: string[]): Promise<number>
  getAsync(pwd: string): Promise<string>
  // tslint:disable-next-line:no-any
  quit(): any
}

const RedisAdapter = (config: IConfigure): Superlogin.IAdapter => {
  const { redis: redisConfig } = config.get().session
  const finalRedisConfig = redisConfig || { host: '127.0.0.1', port: 6379 }

  const { unix_socket, url, port, host, options, password } = finalRedisConfig

  const redisClient = promisifyAll(
    unix_socket
      ? (redis.createClient(unix_socket, options) as IPromRedis)
      : url
      ? (redis.createClient(url, options) as IPromRedis)
      : (redis.createClient(port || 6379, host || '127.0.0.1', options) as IPromRedis)
  )

  // Authenticate with Redis if necessary
  if (password) {
    redisClient.authAsync(password).catch((err: string) => {
      throw new Error(err)
    })
  }

  redisClient.on('error', (err: string) => console.error(`Redis error: ${err}`))

  redisClient.on('connect', () => debug('Redis is ready'))

  const storeKey = async (key: string, life: {}, data: {}) =>
    redisClient.psetexAsync(key, life, data)

  const deleteKeys = async (keys: string[]) => redisClient.delAsync(keys)

  const getKey = async (key: string) => redisClient.getAsync(key)

  const quit = () => redisClient.quit()

  return {
    storeKey,
    deleteKeys,
    getKey,
    quit
  }
}

export default RedisAdapter
