import { DynamicModule, Module, Provider } from '@nestjs/common'

import { LoggerAsyncOptions } from './logger-async-options.interface'
import { normalizeLoggerOptions } from './logger-options.factory'
import { LoggerOptions } from './logger-options.interface'
import { LOGGER_OPTIONS } from './logger.tokens'

@Module({})
export class LoggerOptionsModule {
	static forRoot(options: LoggerOptions = {}): DynamicModule {
		const optionsProvider: Provider = {
			provide: LOGGER_OPTIONS,
			useValue: Object.freeze(normalizeLoggerOptions(options))
		}

		return {
			module: LoggerOptionsModule,
			providers: [optionsProvider],
			exports: [LOGGER_OPTIONS]
		}
	}

	static forRootAsync(options: LoggerAsyncOptions): DynamicModule {
		const optionsProvider: Provider = {
			provide: LOGGER_OPTIONS,
			inject: options.inject ?? [],

			useFactory: async (...dependencies: any[]) => {
				const resolvedOptions = await options.useFactory(
					...dependencies
				)

				if (!resolvedOptions) {
					throw new Error(
						'[LoggerModule] useFactory must return LoggerOptions'
					)
				}

				return Object.freeze(normalizeLoggerOptions(resolvedOptions))
			}
		}

		return {
			module: LoggerOptionsModule,
			imports: options.imports ?? [],
			providers: [optionsProvider],
			exports: [LOGGER_OPTIONS]
		}
	}
}
