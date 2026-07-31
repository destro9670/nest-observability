# @varent/nest-observability

Observability for NestJS applications with structured Winston logging,
correlation IDs, HTTP request logs, OpenTelemetry auto-instrumentation, and
OTLP export for logs, traces, metrics, and host metrics.

## Features

- Nest-compatible structured logger backed by Winston;
- automatic correlation IDs and request sequence numbers;
- bounded, redacted HTTP request logging;
- OpenTelemetry logs, traces, metrics, and host metrics;
- CommonJS and native ESM support;
- NestJS 10 and 11 support.

## Requirements

- Node.js 20 or newer
- NestJS 10 or 11

## Installation

```bash
npm install @varent/nest-observability
```

The package exposes three public entry points:

```ts
import { ObservabilityModule } from '@varent/nest-observability'
import { LoggerModule, LoggerService } from '@varent/nest-observability/logger'
import { createOpenTelemetryRuntime } from '@varent/nest-observability/opentelemetry'
```

Use the dedicated `/opentelemetry` entry point in instrumentation code so
NestJS and Winston are not loaded before OpenTelemetry starts.

## Quick start

### 1. Configure the OpenTelemetry runtime

```ts
// src/config/otel.config.ts
import { createOpenTelemetryRuntime } from '@varent/nest-observability/opentelemetry'
import 'dotenv/config'

const serviceName = process.env.OTEL_SERVICE_NAME

if (!serviceName) {
	throw new Error('OTEL_SERVICE_NAME is required')
}

export const openTelemetryRuntime = createOpenTelemetryRuntime({
	serviceName,
	serviceVersion: process.env.OTEL_SERVICE_VERSION,
	environment: process.env.NODE_ENV,
	logs: { enabled: true },
	traces: { enabled: true },
	metrics: {
		enabled: true,
		hostMetrics: true,
		exportIntervalMs: 60_000
	},
	ignoredIncomingPaths: ['/health', '/health/live', '/health/ready']
})

openTelemetryRuntime.start()
```

When signal endpoints are omitted, the standard OpenTelemetry exporter
environment variables are used:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

### 2. Import instrumentation first in `main.ts`

```ts
// src/main.ts
// This side-effect import must remain the first import in this file.
import { NestFactory } from '@nestjs/core'
import { LoggerService } from '@varent/nest-observability'

import { AppModule } from './app.module'
import '~/config/otel.config'

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, {
		bufferLogs: true
	})

	app.useLogger(app.get(LoggerService))
	app.enableShutdownHooks()

	await app.listen(3000)
}

void bootstrap()
```

If deployment injects environment variables directly, `dotenv/config` can be
omitted. Otherwise, install `dotenv` as a runtime dependency.

The side-effect import must execute before any import that can load NestJS,
Winston, HTTP clients, database drivers, or other instrumented libraries.

### 3. Register the Nest module

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { ObservabilityModule } from '@varent/nest-observability'

import { openTelemetryRuntime } from './config/otel.config'

@Module({
	imports: [
		ObservabilityModule.forRoot({
			runtime: openTelemetryRuntime,
			logLevel: 'info',
			logsDir: 'logs',
			http: {
				enabled: true,
				includeBody: false,
				includeHeaders: false
			}
		})
	]
})
export class AppModule {}
```

Shutdown hooks allow batched telemetry to flush through
`OpenTelemetryRuntime.shutdown()`.

## Application logging

Inject `LoggerService` and pass searchable values as one metadata object:

```ts
import { Injectable } from '@nestjs/common'
import { LoggerService } from '@varent/nest-observability'

@Injectable()
export class ExampleService {
	private readonly context = ExampleService.name

	constructor(private readonly logger: LoggerService) {}

	create(entityId: string): void {
		this.logger.log(
			'Entity created',
			{ entityId, status: 'created' },
			this.context
		)
	}
}
```

Recommended signatures:

```ts
logger.log(message, metadata?, context?)
logger.debug(message, metadata?, context?)
logger.warn(message, metadata?, context?)
logger.verbose(message, metadata?, context?)
logger.fatal(message, metadata?, context?)
logger.error(message, stack?, context?, metadata?)
```

For errors, pass `error.stack` separately and keep searchable fields in
metadata:

```ts
logger.error('Operation failed', error.stack, 'ExampleService', {
	entityId,
	errorName: error.name,
	errorMessage: error.message
})
```

Avoid metadata keys that collide with log fields, including `body`, `message`,
`level`, and `severityText`. Prefer names such as `requestBody`, `errorMessage`,
and `durationMs`.

## Configuration summary

### Logger

| Option                | Default                | Description                                     |
| --------------------- | ---------------------- | ----------------------------------------------- |
| `logLevel`            | `info`                 | Minimum Winston and OTLP log level.             |
| `logsDir`             | `logs`                 | Directory for default file transports.          |
| `http.enabled`        | `true`                 | Enables HTTP request logging.                   |
| `http.includeBody`    | `false`                | Includes a bounded and redacted request body.   |
| `http.includeHeaders` | `false`                | Includes bounded and redacted request headers.  |
| `transports`          | Console plus two files | Overrides normal Winston transports.            |
| `exceptionHandlers`   | `exceptions.log`       | Overrides Winston exception handlers.           |
| `rejectionHandlers`   | `rejections.log`       | Overrides Winston unhandled rejection handlers. |

### OpenTelemetry

| Option                     | Default       | Description                                      |
| -------------------------- | ------------- | ------------------------------------------------ |
| `serviceName`              | Required      | Non-empty `service.name` resource attribute.     |
| `serviceVersion`           | `unknown`     | `service.version` resource attribute.            |
| `environment`              | `development` | Deployment environment resource attribute.       |
| `logs.enabled`             | `true`        | Enables OTLP log export.                         |
| `traces.enabled`           | `true`        | Enables OTLP trace export.                       |
| `metrics.enabled`          | `true`        | Enables OTLP metric export.                      |
| `metrics.hostMetrics`      | `true`        | Enables host metrics.                            |
| `metrics.exportIntervalMs` | `60000`       | Metric export interval in milliseconds.          |
| `ignoredIncomingPaths`     | Health paths  | Exact incoming paths excluded from HTTP tracing. |

## Guides

- [Structured logging and HTTP correlation](docs/logging.md)
- [OpenTelemetry configuration and lifecycle](docs/opentelemetry.md)

## License

ISC
