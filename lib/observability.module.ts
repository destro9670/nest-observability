import { DynamicModule, Global, Module } from '@nestjs/common'

import { ObservabilityAsyncOptions, ObservabilityOptions } from './interfaces'
import { LoggerModule } from './modules/logger'
import { OpenTelemetryModule } from './modules/opentelemetry'
import { ObservabilityService } from './observability.service'

@Global()
@Module({})
export class ObservabilityModule {
	static forRoot(options: ObservabilityOptions = {}): DynamicModule {
		const { runtime, ...loggerOptions } = options

		return {
			module: ObservabilityModule,
			providers: [ObservabilityService],
			imports: [
				LoggerModule.forRoot(loggerOptions),
				...(runtime ? [OpenTelemetryModule.forRuntime(runtime)] : [])
			],
			exports: [LoggerModule, ObservabilityService]
		}
	}

	static forRootAsync(options: ObservabilityAsyncOptions): DynamicModule {
		const { runtime, ...loggerOptions } = options

		return {
			module: ObservabilityModule,
			imports: [
				LoggerModule.forRootAsync(loggerOptions),
				...(runtime ? [OpenTelemetryModule.forRuntime(runtime)] : [])
			],
			providers: [ObservabilityService],
			exports: [LoggerModule, ObservabilityService]
		}
	}
}
