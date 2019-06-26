declare module 'util-promisifyall' {
  const promisifyAll: <T extends object>(target: T) => T
  export default promisifyAll
}
