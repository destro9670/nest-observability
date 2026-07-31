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

The `logger` and `opentelemetry` subpath imports include legacy TypeScript
resolution fallbacks, so consumers do not need to change `module` or
`moduleResolution` to use them.

Use the dedicated `/opentelemetry` entry point in preload code. Importing the
package root also loads the logger module and may load instrumented libraries
too early.

## Quick start

### 1. Start OpenTelemetry before the application

Instrumentation must start before NestJS, Winston, HTTP clients, database
drivers, or other instrumented modules are loaded.

Create the runtime in a module that imports only the dedicated OpenTelemetry
entry point:

```ts
// src/config/otel.config.ts
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
```

Use a separate NestJS entry point to start instrumentation before importing
`main.ts`:

```ts
// src/instrumentation.ts
import 'dotenv/config'

import { openTelemetryRuntime } from './config/otel.config'

openTelemetryRuntime.start()

void import('./main')
```

Run the instrumentation entry point in development and production:

```json
{
	"scripts": {
		"start": "nest start --entryFile instrumentation",
		"start:dev": "cross-env NODE_ENV=development nest start --watch --entryFile instrumentation",
		"start:debug": "cross-env NODE_ENV=development nest start --debug --watch --entryFile instrumentation",
		"start:prod": "node dist/instrumentation.js"
	}
}
```

If deployment injects environment variables directly, `dotenv/config` can be
omitted. If the application reads a `.env` file in production, `dotenv` must be
a runtime dependency rather than a development-only dependency.

For a non-Nest CommonJS or ESM application, use a preload-only module that does
not import `main.ts` itself:

```ts
// src/preload.ts
import 'dotenv/config'

import { openTelemetryRuntime } from './config/otel.config'

openTelemetryRuntime.start()
```

Preload that module with Node:

```json
{
	"scripts": {
		"start:cjs": "node --require ./dist/preload.js ./dist/main.js",
		"start:esm": "node --import ./dist/preload.js ./dist/main.js"
	}
}
```

Do not call `openTelemetryRuntime.start()` near the end of a regular `main.ts`
that already imports `AppModule`, NestJS, or Winston. Static imports are loaded
before the call runs, so automatic instrumentation would start too late.

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

import { openTelemetryRuntime } from './config/otel.config'

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

| Option                | Default                | Description                                                                         |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `logLevel`            | `info`                 | Minimum Winston and OTLP log level: `error`, `warn`, `info`, `debug`, or `verbose`. |
| `logsDir`             | `logs`                 | Directory for default file transports, resolved from `process.cwd()`.               |
| `http.enabled`        | `true`                 | Registers HTTP request logging.                                                     |
| `http.includeBody`    | `false`                | Adds a bounded and redacted request body.                                           |
| `http.includeHeaders` | `false`                | Adds bounded and redacted request headers.                                          |
| `transports`          | Console plus two files | Overrides normal Winston transports.                                                |
| `exceptionHandlers`   | `exceptions.log`       | Overrides Winston exception handlers.                                               |
| `rejectionHandlers`   | `rejections.log`       | Overrides Winston rejection handlers.                                               |

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

| Option                     | Default       | Description                                              |
| -------------------------- | ------------- | -------------------------------------------------------- |
| `serviceName`              | Required      | Non-empty `service.name` resource attribute.             |
| `serviceVersion`           | `unknown`     | `service.version` resource attribute.                    |
| `environment`              | `development` | `deployment.environment.name` resource attribute.        |
| `logs.enabled`             | `true`        | Enables OTLP log processing and Winston log sending.     |
| `logs.endpoint`            | Exporter env  | Signal-specific OTLP/HTTP logs endpoint.                 |
| `traces.enabled`           | `true`        | Enables OTLP trace processing.                           |
| `traces.endpoint`          | Exporter env  | Signal-specific OTLP/HTTP traces endpoint.               |
| `metrics.enabled`          | `true`        | Enables periodic OTLP metric processing.                 |
| `metrics.endpoint`         | Exporter env  | Signal-specific OTLP/HTTP metrics endpoint.              |
| `metrics.hostMetrics`      | `true`        | Enables host metrics when metrics are enabled.           |
| `metrics.exportIntervalMs` | `60000`       | Positive integer metric export interval in milliseconds. |
| `ignoredIncomingPaths`     | Health paths  | Exact incoming paths excluded from HTTP tracing.         |

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
URLs. Signal-specific endpoints must include the corresponding `/v1/logs`,
`/v1/traces`, or `/v1/metrics` suffix. A signal-agnostic
`OTEL_EXPORTER_OTLP_ENDPOINT` is normally simpler because the exporters append
the appropriate path themselves. If no collector is available, disable the
signal or configure its endpoint to avoid repeated export failures.

Winston log sending is owned by `WinstonInstrumentation`, which manages its
OpenTelemetry transport automatically. Do not add
`OpenTelemetryTransportV3` to application transports yourself, or each log
record may be exported twice.

`OpenTelemetryRuntime.start()` is idempotent. A runtime cannot be restarted
after shutdown has been requested. Successful creation and start emit safe
lifecycle debug messages containing only the normalized service name:

```text
[OpenTelemetry] runtime created { serviceName: 'orders-service' }
[OpenTelemetry] runtime started { serviceName: 'orders-service' }
```

## SigNoz

The library uses OTLP/HTTP exporters. Prefer the signal-agnostic OpenTelemetry
environment variables and omit `endpoint` from `logs`, `traces`, and `metrics`.

### Self-hosted SigNoz

For an application running directly on the same host as SigNoz:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

For Docker Compose, use the collector service name on the shared network
instead of `localhost`:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

The exact hostname must match the collector service in the deployment. A
self-hosted SigNoz collector does not require an ingestion key. See the
[SigNoz self-hosted ingestion documentation](https://signoz.io/docs/ingestion/self-hosted/overview/).

### SigNoz Cloud

Use the exact regional ingestion endpoint and key shown by the SigNoz Cloud
environment:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.<region>.signoz.cloud:443
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=<your-ingestion-key>
```

Do not commit the ingestion key. The current runtime options intentionally do
not contain exporter headers; authentication is supplied through the standard
`OTEL_EXPORTER_OTLP_HEADERS` variable. See the
[SigNoz Cloud ingestion documentation](https://signoz.io/docs/ingestion/signoz-cloud/overview/).

The runtime configuration is the same for self-hosted and Cloud deployments:

```ts
export const openTelemetryRuntime = createOpenTelemetryRuntime({
	serviceName: 'serviceName',
	serviceVersion: process.env.APP_VERSION,
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
```

### Missing `service.name` on logs

`serviceName` is exported as the OpenTelemetry resource attribute
`service.name`, not as a regular log attribute. With correctly ordered Winston
instrumentation, OTLP log records inherit the same resource as traces and
metrics.

If SigNoz receives logs without `service.name`, verify all of the following:

- the instrumentation entry point starts before NestJS and Winston imports;
- the application does not add `OpenTelemetryTransportV3` manually;
- logs are arriving through the OTLP log exporter rather than only through
  container stdout/file collection;
- `serviceName` is a non-empty value after environment variables are loaded;
- the collector address is reachable from the application process or
  container.

Use `service.name = 'search-service'` in the SigNoz Logs Query Builder. In
field-context queries, explicitly select the resource field with
`resource.service.name = 'search-service'`; ClickHouse `SELECT` and `GROUP BY`
expressions use `resource.service.name::String`. See the
[SigNoz log query documentation](https://signoz.io/docs/logs-management/querying-logs/)
and [field-context troubleshooting](https://signoz.io/docs/userguide/search-troubleshooting/).

## License

ISC
