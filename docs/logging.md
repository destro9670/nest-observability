# Logging guide

This guide covers structured application logs, custom transports, HTTP request
logging, correlation IDs, sanitization, and how metadata is represented in
OpenTelemetry backends.

## Register the logger

`ObservabilityModule` registers `LoggerModule` globally:

```ts
ObservabilityModule.forRoot({
	logLevel: 'debug',
	logsDir: 'logs',
	http: {
		enabled: true,
		includeBody: false,
		includeHeaders: false
	}
})
```

For asynchronous configuration:

```ts
ObservabilityModule.forRootAsync({
	imports: [ConfigModule],
	inject: [ConfigService],
	useFactory: (config: ConfigService) => ({
		logLevel: config.get<LoggerLogLevel>('LOG_LEVEL') ?? 'info',
		logsDir: config.get<string>('LOGS_DIR') ?? 'logs'
	})
})
```

Pass `runtime` at the top level when OpenTelemetry lifecycle management is also
required.

## Log levels

- `debug`: technical diagnostics and operation starts;
- `log`: successful business events;
- `warn`: recoverable failures, retries, and fallbacks;
- `error`: failed operations;
- `fatal`: a critical component cannot continue;
- `verbose`: high-volume diagnostic details.

`logLevel` controls both normal Winston transports and the automatically added
OpenTelemetry transport.

## Structured application logs

Use one metadata object instead of interpolating values into the message:

```ts
logger.debug(
	'External request completed',
	{
		target: 'external-api',
		requestId: 'request-42',
		durationMs: 87,
		statusCode: 200
	},
	'ExternalClient'
)
```

For compatibility with the Nest logger convention, non-error methods also
accept `message, context, metadata`, but `message, metadata, context` is the
recommended order. Only one context string and one metadata object are
resolved.

The error method uses a fixed positional contract:

```ts
logger.error(message, stack?, context?, metadata?)
```

Normalize unknown errors before logging:

```ts
const exception = error instanceof Error ? error : new Error(String(error))

logger.error('External request failed', exception.stack, 'ExternalClient', {
	target: 'external-api',
	errorName: exception.name,
	errorMessage: exception.message
})
```

## OpenTelemetry field mapping

| Logger value             | OpenTelemetry field           |
| ------------------------ | ----------------------------- |
| Message                  | `log.body`                    |
| Context                  | `attribute.context`           |
| Each metadata property   | `attribute.<property>`        |
| Service identity         | `resource.service.name`       |
| Correlation and sequence | Log attributes                |
| Active trace and span    | Log record trace/span context |

Do not wrap searchable fields in a nested `metadata` property:

```ts
// Avoid: metadata may be stored as one serialized JSON string.
logger.debug('Request completed', {
	metadata: {
		requestMethod: 'GET',
		durationMs: 42
	}
})

// Prefer: each value becomes its own attribute.
logger.debug('Request completed', {
	requestMethod: 'GET',
	durationMs: 42
})
```

Use scalar values and scalar arrays for fields that must be searchable.
Flatten nested objects or retain them as an explicit JSON string:

```ts
logger.debug('Request completed', {
	requestName: requestBody.name,
	requestSearchId: requestBody.searchId,
	requestBodyJson: JSON.stringify(requestBody)
})
```

Avoid metadata names that collide with log-record fields: `body`, `message`,
`level`, and `severityText`. A metadata property named `body` appears as
`attribute.body` next to the distinct `log.body`.

## Default transports

The default logger creates:

- a colorized console transport;
- `application.log`, up to 20 files of 10 MiB;
- `error.log`, up to 20 files of 10 MiB;
- `exceptions.log`;
- `rejections.log`.

The process must have write permission to `logsDir`. For read-only containers
or console-only deployments, override transports and handlers:

```ts
import { transports } from 'winston'

ObservabilityModule.forRoot({
	transports: [new transports.Console()],
	exceptionHandlers: [],
	rejectionHandlers: []
})
```

Do not add `OpenTelemetryTransportV3` manually while OpenTelemetry log sending
is enabled. Winston instrumentation adds the transport automatically, and a
second instance exports duplicate records.

## HTTP logging and correlation IDs

HTTP requests are logged after completion:

| Status    | Level   | Message                  |
| --------- | ------- | ------------------------ |
| `< 400`   | `debug` | `HTTP request completed` |
| `400–499` | `warn`  | `HTTP client error`      |
| `>= 500`  | `error` | `HTTP request failed`    |

The Express and Fastify adapters are supported. An incoming
`x-correlation-id` is accepted when it is 1–128 characters, starts with a
letter or digit, and contains only supported identifier characters. Otherwise,
a UUID is generated. The selected ID is returned in the response header and
added to logs with a per-request sequence number.

## Redaction and limits

Header, body, logger metadata, and URL query keys are sanitized. Known secrets
include authorization values, cookies, passwords, access and refresh tokens,
API keys, JWTs, credentials, authorization codes, and signatures.

Values are limited to:

- 4,096 characters per string;
- 100 items per object or array;
- 10 levels of nesting.

URL path segments are not redacted. Do not put secrets or personal data in
route paths.
