import { Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import 'reflect-metadata'
import { transports } from 'winston'

import { LoggerModule } from '../lib'
import { LoggerService } from '../lib'

const TEST_LOGGER_OPTIONS = Symbol('TEST_LOGGER_OPTIONS')

@Module({
	providers: [
		{
			provide: TEST_LOGGER_OPTIONS,
			useValue: {
				logLevel: 'debug' as const
			}
		}
	],
	exports: [TEST_LOGGER_OPTIONS]
})
class TestConfigModule {}

function silentTransports() {
	return [new transports.Console({ silent: true })]
}

describe('LoggerModule', () => {
	it('registers synchronously', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				LoggerModule.forRoot({
					transports: silentTransports(),
					exceptionHandlers: [],
					rejectionHandlers: [],
					http: { enabled: false }
				})
			]
		}).compile()

		expect(moduleRef.get(LoggerService)).toBeInstanceOf(LoggerService)

		await moduleRef.close()
	})

	it('resolves asynchronous options through Nest injection', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				LoggerModule.forRootAsync({
					imports: [TestConfigModule],
					inject: [TEST_LOGGER_OPTIONS],
					useFactory: config => ({
						...config,
						transports: silentTransports(),
						exceptionHandlers: [],
						rejectionHandlers: [],
						http: { enabled: false }
					})
				})
			]
		}).compile()

		expect(moduleRef.get(LoggerService)).toBeInstanceOf(LoggerService)

		await moduleRef.close()
	})
})
