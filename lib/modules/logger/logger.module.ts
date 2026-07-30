import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { WinstonModule } from 'nest-winston'

import { LoggerAsyncOptions } from './config/logger-async-options.interface'
import { LoggerOptions } from './config/logger-options.interface'
import { LoggerOptionsModule } from './config/logger-options.module'
import { LOGGER_OPTIONS } from './config/logger.tokens'
import { CorrelationContextService } from './correlation/correlation-context.service'
import { CorrelationInterceptor } from './correlation/correlation.interceptor'
import { HttpLoggingInterceptor } from './http/http-logging.interceptor'
import { LoggerService } from './logger.service'
import { createWinstonOptions } from './winston/winston-options.factory'

const LOGGER_PROVIDERS: Provider[] = [
	CorrelationContextService,
	LoggerService,

	{
		provide: APP_INTERCEPTOR,
		useClass: CorrelationInterceptor
	},

	{
		provide: APP_INTERCEPTOR,
		useClass: HttpLoggingInterceptor
	}
]

@Global()
@Module({})
export class LoggerModule {
	static forRoot(options: LoggerOptions = {}): DynamicModule {
		const loggerOptionsModule = LoggerOptionsModule.forRoot(options)

		return {
			module: LoggerModule,

			imports: [
				loggerOptionsModule,

				WinstonModule.forRootAsync({
					imports: [loggerOptionsModule],
					inject: [LOGGER_OPTIONS],
					useFactory: createWinstonOptions
				})
			],

			providers: LOGGER_PROVIDERS,

			exports: [LoggerService, CorrelationContextService]
		}
	}

	static forRootAsync(options: LoggerAsyncOptions): DynamicModule {
		const loggerOptionsModule = LoggerOptionsModule.forRootAsync(options)

		return {
			module: LoggerModule,

			imports: [
				loggerOptionsModule,

				WinstonModule.forRootAsync({
					imports: [loggerOptionsModule],
					inject: [LOGGER_OPTIONS],
					useFactory: createWinstonOptions
				})
			],

			providers: LOGGER_PROVIDERS,

			exports: [LoggerService, CorrelationContextService]
		}
	}
}
