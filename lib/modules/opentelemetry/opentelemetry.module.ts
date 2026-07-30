import { DynamicModule, Global, Module } from '@nestjs/common'

import { OpenTelemetryRuntime } from './opentelemetry.runtime'
import { OpenTelemetryService } from './opentelemetry.service'
import { OPENTELEMETRY_RUNTIME } from './opentelemetry.tokens'

@Global()
@Module({})
export class OpenTelemetryModule {
	static forRuntime(runtime: OpenTelemetryRuntime): DynamicModule {
		return {
			module: OpenTelemetryModule,
			providers: [
				{
					provide: OPENTELEMETRY_RUNTIME,
					useValue: runtime
				},
				OpenTelemetryService
			],
			exports: [OpenTelemetryService]
		}
	}
}
