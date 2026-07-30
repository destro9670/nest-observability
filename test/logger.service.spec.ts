import { CorrelationContextService } from '../lib'
import { LoggerService } from '../lib'

describe('LoggerService', () => {
	it('does not allow caller metadata to overwrite correlation metadata', () => {
		const winstonLogger = {
			log: jest.fn()
		}
		const correlationContext = new CorrelationContextService()
		const logger = new LoggerService(
			winstonLogger as never,
			correlationContext
		)

		correlationContext.run(
			{
				correlationId: 'trusted-id',
				sequence: 1
			},
			() =>
				logger.log(
					'message',
					{
						correlationId: 'spoofed-id',
						sequence: 999,
						custom: true
					},
					'TestContext'
				)
		)

		expect(winstonLogger.log).toHaveBeenCalledWith('info', {
			message: 'message',
			context: 'TestContext',
			custom: true,
			correlationId: 'trusted-id',
			sequence: 1
		})
	})

	it('sanitizes cyclic, BigInt, and sensitive metadata before logging', () => {
		const winstonLogger = {
			log: jest.fn()
		}
		const correlationContext = new CorrelationContextService()
		const logger = new LoggerService(
			winstonLogger as never,
			correlationContext
		)
		const cyclic: Record<string, unknown> = {
			value: 42n,
			clientSecret: 'secret'
		}
		cyclic.self = cyclic

		expect(() => logger.log('message', cyclic, 'TestContext')).not.toThrow()
		expect(winstonLogger.log).toHaveBeenCalledWith('info', {
			message: 'message',
			context: 'TestContext',
			value: '42',
			clientSecret: '[REDACTED]',
			self: '[Circular]'
		})
	})

	it('uses a safe fallback when metadata cannot be inspected', () => {
		const winstonLogger = {
			log: jest.fn()
		}
		const logger = new LoggerService(
			winstonLogger as never,
			new CorrelationContextService()
		)
		const metadata = Object.defineProperty({}, 'broken', {
			enumerable: true,
			get: () => {
				throw new Error('cannot read metadata')
			}
		})

		expect(() =>
			logger.log('message', metadata, 'TestContext')
		).not.toThrow()
		expect(winstonLogger.log).toHaveBeenCalledWith('info', {
			message: 'message',
			context: 'TestContext',
			metadata: '[UNSERIALIZABLE]'
		})
	})
})
