import { Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { transports } from 'winston'

import { LOGGER_OPTIONS } from '../lib/modules/logger/config/logger.tokens'
import { LoggerService } from '../lib'
import { OpenTelemetryRuntime } from '../lib'
import { ObservabilityModule } from '../lib'
import { ObservabilityService } from '../lib/observability.service'

const TEST_CONFIG = Symbol('TEST_CONFIG')

@Module({
	providers: [
		{
			provide: TEST_CONFIG,
			useValue: {
				logLevel: 'debug'
			}
		}
	],
	exports: [TEST_CONFIG]
})
class TestConfigModule {}

describe('ObservabilityModule', () => {
	it('registers logger services and shuts down the supplied runtime', async () => {
		const runtime = {
			isStarted: jest.fn().mockReturnValue(true),
			shutdown: jest.fn().mockResolvedValue(undefined)
		} as unknown as OpenTelemetryRuntime
		const moduleRef = await Test.createTestingModule({
			imports: [
				ObservabilityModule.forRoot({
					runtime,
					transports: [
						new transports.Console({
							silent: true
						})
					],
					exceptionHandlers: [],
					rejectionHandlers: [],
					http: {
						enabled: false
					}
				})
			]
		}).compile()

		expect(moduleRef.get(LoggerService)).toBeInstanceOf(LoggerService)
		expect(moduleRef.get(ObservabilityService)).toBeInstanceOf(
			ObservabilityService
		)

		await moduleRef.close()

		expect(runtime.shutdown).toHaveBeenCalledTimes(1)
	})

	it('resolves logger options through the flat async contract', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				ObservabilityModule.forRootAsync({
					imports: [TestConfigModule],
					inject: [TEST_CONFIG],
					useFactory: (config: { logLevel: 'debug' }) => ({
						logLevel: config.logLevel,
						transports: [
							new transports.Console({
								silent: true
							})
						],
						exceptionHandlers: [],
						rejectionHandlers: [],
						http: {
							enabled: false
						}
					})
				})
			]
		}).compile()

		expect(moduleRef.get(LOGGER_OPTIONS)).toMatchObject({
			logLevel: 'debug',
			http: {
				enabled: false
			}
		})

		await moduleRef.close()
	})
})
