import BPromise from 'bluebird'
import URLSafeBase64 from 'urlsafe-base64'
import uuid from 'uuid'
import pwd from 'couch-pwd'
import crypto from 'crypto'
import { Request } from 'express'

export const URLSafeUUID = () => URLSafeBase64.encode(uuid.v4(null, new Buffer(16)))

export const hashToken = (token: string) =>
	crypto
		.createHash('sha256')
		.update(token)
		.digest('hex')

export const hashPassword = (password: string) =>
	new Promise<{ salt: string; derived_key: string }>((resolve, reject) => {
		pwd.hash(password, (err: string, salt: string, hash: string) => {
			if (err) {
				return reject(err)
			}
			return resolve({
				salt,
				derived_key: hash
			})
		})
	})

export const verifyPassword = (
	hashObj: { iterations?: string; salt?: string; derived_key?: string },
	password: string
) => {
	// tslint:disable-next-line:no-any
	const getHash: any = BPromise.promisify(pwd.hash, { context: pwd })
	const { iterations, salt, derived_key } = hashObj
	if (iterations) {
		pwd.iterations(iterations)
	}
	if (!salt || !derived_key) {
		return Promise.reject(false)
	}
	return getHash(password, salt).then((hash: string) => {
		if (hash === derived_key) {
			return Promise.resolve(true)
		}
		return Promise.reject(false)
	})
}

export const getDBURL = (db: {
	protocol: string
	user: string
	password: string
	host: string
}) => {
	let url
	if (db.user) {
		url = `${db.protocol + encodeURIComponent(db.user)}:${encodeURIComponent(db.password)}@${
			db.host
		}`
	} else {
		url = db.protocol + db.host
	}
	return url
}

export const getFullDBURL = (
	dbConfig: { protocol: string; user: string; password: string; host: string },
	dbName: string
) => `${getDBURL(dbConfig)}/${dbName}`

// tslint:disable-next-line:no-any
export const toArray = <T>(obj: T | T[]): T[] => {
	if (!(obj instanceof Array)) {
		obj = [obj]
	}
	return obj
}

export const getSessions = (userDoc: IUserDoc) => {
	const sessions: string[] = []
	if (userDoc.session) {
		Object.keys(userDoc.session).forEach(mySession => {
			sessions.push(mySession)
		})
	}
	return sessions
}

export const getExpiredSessions = (userDoc: { session: {} }, now: number) => {
	const sessions: string[] = []
	if (userDoc.session) {
		Object.keys(userDoc.session).forEach(mySession => {
			if (userDoc.session[mySession].expires <= now) {
				sessions.push(mySession)
			}
		})
	}
	return sessions
}

// Takes a req object and returns the bearer token, or undefined if it is not found
export const getSessionToken = (req: Request) => {
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
export const addProvidersToDesignDoc = (config: IConfigure, ddoc: { auth: { views: {} } }) => {
	const providers = config.getItem('providers')
	if (!providers) {
		return ddoc
	}
	const ddocTemplate =
		'function(doc) => {\n' +
		'  if(doc.%PROVIDER% && doc.%PROVIDER%.profile) => {\n' +
		'    emit(doc.%PROVIDER%.profile.id, null);\n' +
		'  }\n' +
		'}'
	Object.keys(providers).forEach(provider => {
		ddoc.auth.views[provider] = ddocTemplate.replace(new RegExp('%PROVIDER%', 'g'), provider)
	})
	return ddoc
}

// Capitalizes the first letter of a string
export const capitalizeFirstLetter = (string: string) =>
	string.charAt(0).toUpperCase() + string.slice(1)

/**
 * Access nested JavaScript objects with string key
 * http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
 *
 * @param {object} obj The base object you want to get a reference to
 * @param {string} str The string addressing the part of the object you want
 * @return {object|undefined} a reference to the requested key or undefined if not found
 */

export const getObjectRef = (obj: {}, str: string) => {
	str = str.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
	str = str.replace(/^\./, '') // strip a leading dot
	const pList = str.split('.')
	while (pList.length) {
		const n = pList.shift()
		if (n && n in obj) {
			obj = obj[n]
		} else {
			return undefined
		}
	}
	return obj
}

/**
 * Dynamically set property of nested object
 * http://stackoverflow.com/questions/18936915/dynamically-set-property-of-nested-object
 *
 * @param {object} obj The base object you want to set the property in
 * @param {string} str The string addressing the part of the object you want
 * @param {*} val The value you want to set the property to
 * @return {*} the value the reference was set to
 */

export const setObjectRef = (obj: {}, str: string, val: string | boolean) => {
	str = str.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
	str = str.replace(/^\./, '') // strip a leading dot
	const pList = str.split('.')
	const len = pList.length
	for (let i = 0; i < len - 1; i += 1) {
		const elem = pList[i]
		if (!obj[elem]) {
			obj[elem] = {}
		}
		obj = obj[elem]
	}
	obj[pList[len - 1]] = val
	return val
}

/**
 * Dynamically delete property of nested object
 *
 * @param {object} obj The base object you want to set the property in
 * @param {string} str The string addressing the part of the object you want
 * @return {boolean} true if successful
 */

export const delObjectRef = (obj: {}, str: string) => {
	str = str.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
	str = str.replace(/^\./, '') // strip a leading dot
	const pList = str.split('.')
	const len = pList.length
	pList.forEach(elem => {
		if (obj[elem]) {
			obj = obj[elem]
		}
	})
	delete obj[pList[len - 1]]
	return true
}

/**
 * Concatenates two arrays and removes duplicate elements
 *
 * @param {array} a First array
 * @param {array} b Second array
 * @return {array} resulting array
 */

export const arrayUnion = (a: any[], b: string) => {
	const result = a.concat(b)
	for (let i = 0; i < result.length; i += 1) {
		for (let j = i + 1; j < result.length; j += 1) {
			if (result[i] === result[j]) result.splice((j -= 1), 1)
		}
	}
	return result
}
