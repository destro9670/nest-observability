const SENSITIVE_KEYS = new Set([
	'authorization',
	'cookie',
	'setcookie',
	'password',
	'pass',
	'secret',
	'token',
	'accesstoken',
	'refreshtoken',
	'apikey'
])

const MAX_DEPTH = 10
const MAX_ITEMS = 100
const MAX_STRING_LENGTH = 4_096

function normalizeKey(key: string): string {
	return key
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
}

export function isSensitiveLogKey(key: string): boolean {
	const normalizedKey = normalizeKey(key)

	return (
		SENSITIVE_KEYS.has(normalizedKey) ||
		normalizedKey === 'code' ||
		normalizedKey === 'credential' ||
		normalizedKey === 'jwt' ||
		normalizedKey.endsWith('password') ||
		normalizedKey.endsWith('secret') ||
		normalizedKey.endsWith('token') ||
		normalizedKey.endsWith('apikey') ||
		normalizedKey.endsWith('signature')
	)
}

export function sanitizeUrlForLogging(url: string): string {
	try {
		const parsedUrl = new URL(url || '/', 'http://localhost')

		for (const key of new Set(parsedUrl.searchParams.keys())) {
			if (isSensitiveLogKey(key)) {
				parsedUrl.searchParams.set(key, '[REDACTED]')
			}
		}

		const query = parsedUrl.searchParams
			.toString()
			.replaceAll('%5BREDACTED%5D', '[REDACTED]')

		return `${parsedUrl.pathname}${query ? `?${query}` : ''}`
	} catch {
		return url.split(/[?#]/, 1)[0]
	}
}

export function sanitizeForLogging(
	value: unknown,
	seen = new WeakSet<object>(),
	depth = 0
): unknown {
	if (typeof value === 'string') {
		return value.length > MAX_STRING_LENGTH
			? `${value.slice(0, MAX_STRING_LENGTH)}[TRUNCATED]`
			: value
	}

	if (typeof value === 'bigint') {
		return value.toString()
	}

	if (typeof value === 'symbol' || typeof value === 'function') {
		return String(value)
	}

	if (value === null || value === undefined || typeof value !== 'object') {
		return value
	}

	if (depth >= MAX_DEPTH) {
		return '[MAX_DEPTH]'
	}

	if (value instanceof Date) {
		return value.toISOString()
	}

	if (seen.has(value)) {
		return '[Circular]'
	}

	seen.add(value)

	if (Array.isArray(value)) {
		const sanitized = value
			.slice(0, MAX_ITEMS)
			.map(item => sanitizeForLogging(item, seen, depth + 1))

		if (value.length > MAX_ITEMS) {
			sanitized.push(`[${value.length - MAX_ITEMS} ITEMS TRUNCATED]`)
		}

		return sanitized
	}

	const entries = Object.entries(value)
	const sanitizedEntries: Array<[string, unknown]> = entries
		.slice(0, MAX_ITEMS)
		.map(([key, nestedValue]) => [
			key,
			isSensitiveLogKey(key)
				? '[REDACTED]'
				: sanitizeForLogging(nestedValue, seen, depth + 1)
		])

	if (entries.length > MAX_ITEMS) {
		sanitizedEntries.push([
			'[TRUNCATED]',
			`${entries.length - MAX_ITEMS} ITEMS TRUNCATED`
		])
	}

	return Object.fromEntries(sanitizedEntries)
}
