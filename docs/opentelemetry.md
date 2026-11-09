# OpenTelemetry guide

The runtime configures OpenTelemetry resources, Node.js auto-instrumentation,
OTLP/HTTP exporters for logs, traces, and metrics, and optional host metrics.

## Start before application imports

Instrumentation must start before NestJS, Winston, HTTP clients, database
drivers, or other instrumented modules are loaded.

Create and start the runtime in an isolated configuration module:

```ts
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

Import this module for its side effect as the first import in `main.ts`:

<!-- prettier-ignore -->
```ts
// This import must remain first.
import './config/otel.config'

import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
```

Do not move the side-effect import below NestJS, Winston, HTTP client, or
database imports. The configuration must create and start the SDK before those
modules load.

For applications where import ordering cannot be guaranteed, use a preload-only
module and Node's CommonJS `--require` or ESM `--import` option:

```json
{
	"scripts": {
		"start:cjs": "node --require ./dist/preload.js ./dist/main.js",
		"start:esm": "node --import ./dist/preload.js ./dist/main.js"
	}
}
```

## Options

| Option                     | Default       | Description                                              |
| -------------------------- | ------------- | -------------------------------------------------------- |
| `serviceName`              | Required      | Non-empty `service.name` resource attribute.             |
| `hostName`                 | SDK detection | Overrides the `host.name` resource attribute.            |
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

Set `hostName: 'orders-prod-01'` in `createOpenTelemetryRuntime()` to apply
that value to OTLP logs, metrics, and traces. It takes precedence over host
names detected by the SDK, including `host.name` in `OTEL_RESOURCE_ATTRIBUTES`.
Omit `hostName` to use the SDK's configured resource detectors. The value is
trimmed, and an explicitly blank value causes a startup error.

Default ignored paths:

```text
/health
/health/live
/health/ready
```

Paths are matched exactly after the query string is removed. Supply an empty
array to trace the default health-check paths.

## Exporter endpoints

When an endpoint is omitted, exporters use standard environment variables:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

The signal-agnostic endpoint automatically receives `/v1/logs`, `/v1/traces`,
or `/v1/metrics`. Explicit signal endpoints must include their suffix:

```ts
createOpenTelemetryRuntime({
	serviceName: 'example-service',
	logs: { endpoint: 'http://collector:4318/v1/logs' },
	traces: { endpoint: 'http://collector:4318/v1/traces' },
	metrics: { endpoint: 'http://collector:4318/v1/metrics' }
})
```

Disable signals that the process does not produce:

```ts
createOpenTelemetryRuntime({
	serviceName: 'worker',
	logs: { enabled: true },
	traces: { enabled: false },
	metrics: { enabled: false }
})
```

## Lifecycle

`createOpenTelemetryRuntime()` validates and normalizes options but does not
start the SDK. Call `start()` explicitly.

- `start()` is idempotent;
- `shutdown()` flushes and stops batched telemetry;
- a runtime cannot restart after shutdown;
- `isStarted()` reports whether the runtime is active.

Successful creation and start emit safe debug messages containing only the
normalized service name:

```text
[OpenTelemetry] runtime created { serviceName: 'example-service' }
[OpenTelemetry] runtime started { serviceName: 'example-service' }
```
