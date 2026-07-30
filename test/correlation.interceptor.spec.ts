import { CallHandler, ExecutionContext } from '@nestjs/common'
import { defer, lastValueFrom, of } from 'rxjs'

import { CorrelationContextService } from '../lib'
import { CorrelationInterceptor } from '../lib/modules/logger/correlation/correlation.interceptor'

function createHttpContext(
	correlationId: unknown,
	response: Record<string, unknown>
): ExecutionContext {
	return {
		getType: () => 'http',
		switchToHttp: () => ({
			getRequest: () => ({
				headers: {
					'x-correlation-id': correlationId
				}
			}),
			getResponse: () => response
		})
	} as ExecutionContext
}

describe('CorrelationInterceptor', () => {
	it('propagates a valid correlation ID through AsyncLocalStorage', async () => {
		const correlationContext = new CorrelationContextService()
		const interceptor = new CorrelationInterceptor(correlationContext)
		const setHeader = jest.fn()
		let activeCorrelationId: string | undefined
		const next: CallHandler = {
			handle: () =>
				defer(() => {
					activeCorrelationId = correlationContext.getCorrelationId()
					return of('ok')
				})
		}

		await lastValueFrom(
			interceptor.intercept(
				createHttpContext('request-123', { setHeader }),
				next
			)
		)

		expect(activeCorrelationId).toBe('request-123')
		expect(setHeader).toHaveBeenCalledWith(
			'x-correlation-id',
			'request-123'
		)
	})

	it.each(['', 'contains whitespace', 'line\nbreak', 'x'.repeat(129)])(
		'replaces an invalid correlation ID: %p',
		async invalidCorrelationId => {
			const correlationContext = new CorrelationContextService()
			const interceptor = new CorrelationInterceptor(correlationContext)
			const setHeader = jest.fn()

			await lastValueFrom(
				interceptor.intercept(
					createHttpContext(invalidCorrelationId, { setHeader }),
					{ handle: () => of('ok') }
				)
			)

			const generatedId = setHeader.mock.calls[0][1]
			expect(generatedId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
			)
		}
	)

	it('sets the correlation header through the Fastify reply API', async () => {
		const correlationContext = new CorrelationContextService()
		const interceptor = new CorrelationInterceptor(correlationContext)
		const header = jest.fn()

		await lastValueFrom(
			interceptor.intercept(
				createHttpContext('fastify-request', { header }),
				{ handle: () => of('ok') }
			)
		)

		expect(header).toHaveBeenCalledWith(
			'x-correlation-id',
			'fastify-request'
		)
	})
})
