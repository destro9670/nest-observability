import {
	sanitizeForLogging,
	sanitizeUrlForLogging
} from '../lib/modules/logger/http/log-sanitizer'

describe('sanitizeForLogging', () => {
	it('redacts sensitive values recursively and handles cycles', () => {
		const input: Record<string, unknown> = {
			authorization: 'Bearer secret',
			profile: {
				password: 'secret',
				name: 'User'
			}
		}
		input.self = input

		expect(sanitizeForLogging(input)).toEqual({
			authorization: '[REDACTED]',
			profile: {
				password: '[REDACTED]',
				name: 'User'
			},
			self: '[Circular]'
		})
	})

	it('limits strings, arrays, objects, and nesting depth', () => {
		let nested: Record<string, unknown> = {}
		const root = nested

		for (let depth = 0; depth < 11; depth += 1) {
			nested.next = {}
			nested = nested.next as Record<string, unknown>
		}

		const result = sanitizeForLogging({
			long: 'x'.repeat(5_000),
			array: Array.from({ length: 101 }, (_, index) => index),
			object: Object.fromEntries(
				Array.from({ length: 101 }, (_, index) => [
					`key${index}`,
					index
				])
			),
			nested: root
		}) as Record<string, unknown>

		expect(result.long).toBe(`${'x'.repeat(4_096)}[TRUNCATED]`)
		expect(result.array).toHaveLength(101)
		expect(result.object).toMatchObject({
			'[TRUNCATED]': '1 ITEMS TRUNCATED'
		})
		expect(JSON.stringify(result.nested)).toContain('[MAX_DEPTH]')
	})

	it('converts BigInt values into serializable strings', () => {
		expect(
			sanitizeForLogging({
				value: 123n
			})
		).toEqual({
			value: '123'
		})
	})

	it('redacts sensitive URL query parameters and drops fragments', () => {
		expect(
			sanitizeUrlForLogging(
				'/callback?code=secret&client_secret=hidden&state=public#fragment'
			)
		).toBe(
			'/callback?code=[REDACTED]&client_secret=[REDACTED]&state=public'
		)
	})

	it('removes the query from malformed URLs', () => {
		expect(sanitizeUrlForLogging('http://[invalid?token=secret')).toBe(
			'http://[invalid'
		)
	})
})
