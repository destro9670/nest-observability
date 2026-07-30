import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'

import { OpenTelemetryRuntime } from './opentelemetry.runtime'
import { OPENTELEMETRY_RUNTIME } from './opentelemetry.tokens'

@Injectable()
export class OpenTelemetryService implements OnApplicationShutdown {
	constructor(
		@Inject(OPENTELEMETRY_RUNTIME)
		private readonly runtime: OpenTelemetryRuntime
	) {}

	isStarted(): boolean {
		return this.runtime.isStarted()
	}

	async onApplicationShutdown(): Promise<void> {
		await this.runtime.shutdown()
	}
}
