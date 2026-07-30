import { CallHandler, ExecutionContext } from '@nestjs/common'
import { lastValueFrom, of } from 'rxjs'

import { HttpLoggingInterceptor } from '../lib/modules/logger/http/http-logging.interceptor'

describe('HttpLoggingInterceptor', () => {
	it('writes sanitized HTTP metadata after a successful request', async () => {
		const logger = {
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn()
		}
		const interceptor = new HttpLoggingInterceptor(logger as never, {
			logLevel: 'info',
			logsDir: 'logs',
			http: {
				enabled: true,
				includeBody: true,
				includeHeaders: true
			}
		})
		const context = {
			getType: () => 'http',
			switchToHttp: () => ({
				getRequest: () => ({
					method: 'POST',
					url: '/users?access_token=secret&view=summary',
					ip: '127.0.0.1',
					headers: {
						authorization: 'Bearer secret',
						'x-real-ip': '203.0.113.10'
					},
					body: {
						email: 'user@example.com',
						password: 'secret'
					}
				}),
				getResponse: () => ({
					statusCode: 201
				})
			})
		} as ExecutionContext
		const next: CallHandler = {
			handle: () => of({ id: 1 })
		}

		await lastValueFrom(interceptor.intercept(context, next))

		expect(logger.debug).toHaveBeenCalledWith(
			'HTTP request completed',
			'HTTP',
			{
				method: 'POST',
				url: '/users?access_token=[REDACTED]&view=summary',
				statusCode: 201,
				durationMs: expect.any(Number),
				sourceIp: '203.0.113.10',
				headers: {
					authorization: '[REDACTED]',
					'x-real-ip': '203.0.113.10'
				},
				body: {
					email: 'user@example.com',
					password: '[REDACTED]'
				}
			}
		)
	})
})
