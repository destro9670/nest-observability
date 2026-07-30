# @varent/nest-observability

NestJS observability library with Winston logging, HTTP request logs,
correlation IDs, OpenTelemetry auto-instrumentation, and OTLP export for logs,
traces, metrics, and host metrics.

## Requirements

- Node.js 20 or newer
- NestJS 10 or 11
- CommonJS and native ESM consumers are supported

## Installation

```bash
npm install @varent/nest-observability
```

The package exposes three entry points:

```ts
import { ObservabilityModule } from '@varent/nest-observability'
import { LoggerModule, LoggerService } from '@varent/nest-observability/logger'
import { createOpenTelemetryRuntime } from '@varent/nest-observability/opentelemetry'
```

Use the dedicated `/opentelemetry` entry point in preload code. Importing the
package root also loads the logger module and may load instrumented libraries
too early.

## Quick start

### 1. Start OpenTelemetry before the application

Instrumentation must start before NestJS, Winston, HTTP clients, database
drivers, or other instrumented modules are loaded.

```ts
// src/instrumentation.ts
import { createOpenTelemetryRuntime } from '@varent/nest-observability/opentelemetry'

export const openTelemetryRuntime = createOpenTelemetryRuntime({
	serviceName: 'orders-service',
	serviceVersion: '1.0.0',
	environment: process.env.NODE_ENV,
	logs: {
		endpoint: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
	},
	traces: {
		endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
	},
	metrics: {
		endpoint: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
		hostMetrics: true,
		exportIntervalMs: 60_000
	}
})

openTelemetryRuntime.start()
```

For a CommonJS production build:

```json
{
	"scripts": {
		"start:prod": "node --require ./dist/instrumentation.js ./dist/main.js"
	}
}
```

For an ESM production build, use Node's `--import` preload option:

```json
{
	"scripts": {
		"start:prod": "node --import ./dist/instrumentation.js ./dist/main.js"
	}
}
```

### 2. Register the Nest module

Pass the same started runtime to `ObservabilityModule`. The runtime is optional;
when omitted, the module provides logging without OpenTelemetry lifecycle
management.

```ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import {
	type LoggerLogLevel,
	ObservabilityModule
} from '@varent/nest-observability'

import { openTelemetryRuntime } from './instrumentation'

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true
		}),
		ObservabilityModule.forRootAsync({
			runtime: openTelemetryRuntime,
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				logLevel: config.get<LoggerLogLevel>('LOG_LEVEL') ?? 'info',
				logsDir: config.get<string>('LOGS_DIR') ?? 'logs',
				http: {
					enabled: true,
					includeBody: false,
					includeHeaders: false
				}
			})
		})
	]
})
export class AppModule {}
```

`ObservabilityModule` registers `LoggerModule` internally. The asynchronous
contract keeps `runtime`, `imports`, `inject`, and `useFactory` at the top
level; the factory returns `LoggerOptions` directly.

`ObservabilityModule.forRoot()` accepts the synchronous logger options at the
top level together with `runtime?: OpenTelemetryRuntime`.

### 3. Use the logger and enable shutdown hooks

```ts
import { NestFactory } from '@nestjs/core'
import { LoggerService } from '@varent/nest-observability'

import { AppModule } from './app.module'

const app = await NestFactory.create(AppModule)

app.useLogger(app.get(LoggerService))
app.enableShutdownHooks()

await app.listen(3000)
```

Shutdown hooks are required when a runtime is registered so batched telemetry
can be flushed through `OpenTelemetryRuntime.shutdown()`.

## Logger configuration

| Option                | Default                | Description                                                           |
| --------------------- | ---------------------- | --------------------------------------------------------------------- |
| `logLevel`            | `info`                 | `error`, `warn`, `info`, `debug`, or `verbose`.                       |
| `logsDir`             | `logs`                 | Directory for default file transports, resolved from `process.cwd()`. |
| `http.enabled`        | `true`                 | Registers HTTP request logging.                                       |
| `http.includeBody`    | `false`                | Adds a bounded and redacted request body.                             |
| `http.includeHeaders` | `false`                | Adds bounded and redacted request headers.                            |
| `transports`          | Console plus two files | Overrides normal Winston transports.                                  |
| `exceptionHandlers`   | `exceptions.log`       | Overrides Winston exception handlers.                                 |
| `rejectionHandlers`   | `rejections.log`       | Overrides Winston rejection handlers.                                 |

The default logger creates:

- `application.log`, up to 20 files of 10 MiB;
- `error.log`, up to 20 files of 10 MiB;
- `exceptions.log`;
- `rejections.log`;
- a colorized console transport.

The process must have write permission to `logsDir`. For read-only containers,
serverless deployments, or console-only logging, provide transports and
explicitly disable the default process handlers:

```ts
import { ObservabilityModule } from '@varent/nest-observability'
import { transports } from 'winston'

ObservabilityModule.forRoot({
	transports: [new transports.Console()],
	exceptionHandlers: [],
	rejectionHandlers: []
})
```

### Application logs

`LoggerService` implements the Nest logger contract and also accepts one
metadata object:

```ts
logger.log('Order created', { orderId: 'order-123' }, 'OrdersService')
logger.warn('Retry scheduled', { attempt: 2 }, 'OrdersService')
logger.error('Order processing failed', error.stack, 'OrdersService', {
	orderId: 'order-123'
})
```

Metadata is bounded and converted into a JSON-safe form. Cyclic references,
`BigInt` values, unreadable properties, and known sensitive keys do not cause
the logger to throw. Correlation metadata is authoritative and cannot be
overwritten by caller metadata.

## HTTP logging and correlation IDs

The standard NestJS Express and Fastify adapters are supported. The integration
uses the adapter-neutral request fields `method`, `headers`, `body`, `ip`, and
`originalUrl` or `url`. Response headers are written through:

- Express `setHeader()`;
- Fastify `header()`;
- native `raw.setHeader()` as a fallback.

An incoming `x-correlation-id` is accepted when it is 1–128 characters and
matches the supported identifier character set. Otherwise, a UUID is
generated. The first character must be a letter or digit; remaining characters
may also contain `.`, `_`, `:`, `/`, and `-`. The selected ID is returned in
the `x-correlation-id` response header and added to application logs with a
per-request sequence number.

HTTP requests are logged after completion:

| Status    | Log level | Message                  |
| --------- | --------- | ------------------------ |
| `< 400`   | `debug`   | `HTTP request completed` |
| `400–499` | `warn`    | `HTTP client error`      |
| `>= 500`  | `error`   | `HTTP request failed`    |

### Redaction and limits

Header, body, logger metadata, and URL query keys are compared
case-insensitively after punctuation is removed. The sanitizer recognizes keys
such as authorization, cookies, passwords, secrets, access/refresh tokens,
API keys, JWTs, `credential`, authorization codes, and keys ending in
`password`, `secret`, `token`, `apikey`, or `signature`.

Values are limited to:

- 4,096 characters per string;
- 100 items per object or array;
- 10 levels of nesting.

Redaction is defense in depth, not a substitute for safe API design. Unknown
custom key names may not be recognized. URL path segments are not redacted, so
passwords, tokens, signatures, and personal data must not be placed in route
paths.

## OpenTelemetry configuration

| Option                     | Default       | Description                                          |
| -------------------------- | ------------- | ---------------------------------------------------- |
| `serviceName`              | Required      | Non-empty OpenTelemetry service name.                |
| `serviceVersion`           | `unknown`     | Service version resource attribute.                  |
| `environment`              | `development` | Deployment environment resource attribute.           |
| `logs.enabled`             | `true`        | Enables OTLP log processing and Winston log sending. |
| `traces.enabled`           | `true`        | Enables OTLP trace processing.                       |
| `metrics.enabled`          | `true`        | Enables OTLP metric processing.                      |
| `metrics.hostMetrics`      | `true`        | Enables host metrics when metrics are enabled.       |
| `metrics.exportIntervalMs` | `60000`       | Positive integer metric export interval.             |
| `ignoredIncomingPaths`     | Health paths  | Incoming paths excluded from HTTP tracing.           |

The default ignored paths are:

```text
/health
/health/live
/health/ready
```

Ignored paths are matched exactly after the query string is removed.

All signals are enabled by default. Disable unused signals explicitly:

```ts
createOpenTelemetryRuntime({
	serviceName: 'worker',
	logs: {
		enabled: true
	},
	traces: {
		enabled: false
	},
	metrics: {
		enabled: false
	}
})
```

When an endpoint is omitted, the OTLP exporter uses its standard environment
variables and default endpoint. Explicit endpoints must be valid HTTP or HTTPS
URLs. If no collector is available, disable the signal or configure its
endpoint to avoid repeated export failures.

Winston log sending is owned by `WinstonInstrumentation`, which manages its
OpenTelemetry transport automatically. Do not add
`OpenTelemetryTransportV3` to application transports yourself, or each log
record may be exported twice.

`OpenTelemetryRuntime.start()` is idempotent. A runtime cannot be restarted
after shutdown has been requested.

## License

ISC
