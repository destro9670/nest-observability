/**
 * Shared configuration for an OpenTelemetry signal exporter.
 *
 * @example Enable a signal and send it to an explicit OTLP HTTP endpoint
 * ```ts
 * const traces: OpenTelemetrySignalOptions = {
 * 	enabled: true,
 * 	endpoint: 'http://localhost:4318/v1/traces'
 * }
 * ```
 *
 * @example Disable a signal completely
 * ```ts
 * const traces: OpenTelemetrySignalOptions = {
 * 	enabled: false
 * }
 * ```
 */
export interface OpenTelemetrySignalOptions {
	/**
	 * Whether the signal processor and exporter are enabled.
	 *
	 * @defaultValue `true`
	 */
	enabled?: boolean
	/**
	 * OTLP HTTP exporter endpoint for this signal. Must be a valid HTTP or HTTPS
	 * URL. When omitted, the exporter uses its standard environment variables
	 * and default endpoint.
	 *
	 * @example `'http://localhost:4318/v1/traces'`
	 */
	endpoint?: string
}

/**
 * Configuration for OTLP metric export and host-metric collection.
 *
 * @example Export application and host metrics every 30 seconds
 * ```ts
 * const metrics: OpenTelemetryMetricsOptions = {
 * 	enabled: true,
 * 	endpoint: 'http://localhost:4318/v1/metrics',
 * 	hostMetrics: true,
 * 	exportIntervalMs: 30_000
 * }
 * ```
 */
export interface OpenTelemetryMetricsOptions extends OpenTelemetrySignalOptions {
	/**
	 * Whether CPU, memory, network, and other host metrics are collected.
	 * This option has no effect when metric export is disabled.
	 *
	 * @defaultValue `true`
	 */
	hostMetrics?: boolean
	/**
	 * Interval between periodic metric exports, in milliseconds. The value must
	 * be a positive integer.
	 *
	 * @defaultValue `60_000`
	 * @example `30_000`
	 */
	exportIntervalMs?: number
}

/**
 * Configuration used to create and start the OpenTelemetry runtime.
 *
 * All telemetry signals are enabled by default. Disable signals that the
 * application does not use to avoid unnecessary export attempts.
 *
 * @example Minimal configuration using exporter environment variables
 * ```ts
 * import { createOpenTelemetryRuntime } from '@varent/nest-observability/opentelemetry'
 *
 * const runtime = createOpenTelemetryRuntime({
 * 	serviceName: 'orders-service'
 * })
 *
 * runtime.start()
 * ```
 *
 * @example Full configuration with explicit OTLP HTTP endpoints
 * ```ts
 * const runtime = createOpenTelemetryRuntime({
 * 	serviceName: 'orders-service',
 * 	hostName: 'orders-prod-01',
 * 	serviceVersion: '1.4.0',
 * 	environment: 'production',
 * 	logs: {
 * 		enabled: true,
 * 		endpoint: 'http://otel-collector:4318/v1/logs'
 * 	},
 * 	traces: {
 * 		enabled: true,
 * 		endpoint: 'http://otel-collector:4318/v1/traces'
 * 	},
 * 	metrics: {
 * 		enabled: true,
 * 		endpoint: 'http://otel-collector:4318/v1/metrics',
 * 		hostMetrics: true,
 * 		exportIntervalMs: 30_000
 * 	},
 * 	ignoredIncomingPaths: ['/health', '/ready']
 * })
 * ```
 */
export interface OpenTelemetryOptions {
	/**
	 * Non-empty service name reported as the OpenTelemetry `service.name`
	 * resource attribute. Leading and trailing whitespace is removed.
	 *
	 * @example `'orders-service'`
	 */
	serviceName: string
	/**
	 * Overrides the `host.name` resource attribute for logs, metrics, and traces.
	 * Leading and trailing whitespace is removed. When omitted, the SDK uses
	 * its configured resource detectors.
	 *
	 * @example `'orders-prod-01'`
	 */
	hostName?: string
	/**
	 * Service version reported as the `service.version` resource attribute.
	 * Leading and trailing whitespace is removed.
	 *
	 * @defaultValue `'unknown'`
	 * @example `'1.4.0'`
	 */
	serviceVersion?: string
	/**
	 * Deployment environment reported as the `deployment.environment.name`
	 * resource attribute. Leading and trailing whitespace is removed.
	 *
	 * @defaultValue `'development'`
	 * @example `'production'`
	 */
	environment?: string
	/**
	 * OTLP log export configuration. Enabling logs creates a log processor and
	 * allows Winston instrumentation to send log records. Log correlation stays
	 * active even when log sending is disabled.
	 *
	 * @defaultValue `{ enabled: true }`
	 */
	logs?: OpenTelemetrySignalOptions
	/**
	 * OTLP trace export configuration. Enabling traces creates a batch span
	 * processor and enables trace export.
	 *
	 * @defaultValue `{ enabled: true }`
	 */
	traces?: OpenTelemetrySignalOptions
	/**
	 * OTLP metric export and host-metric collection configuration. Enabling
	 * metrics creates a periodic metric reader.
	 *
	 * @defaultValue `{ enabled: true, hostMetrics: true, exportIntervalMs: 60_000 }`
	 */
	metrics?: OpenTelemetryMetricsOptions
	/**
	 * Exact incoming request paths excluded from HTTP tracing. Query strings
	 * are removed before matching. Supply an empty array to trace the default
	 * health-check paths as well.
	 *
	 * @defaultValue `['/health', '/health/live', '/health/ready']`
	 * @example `['/health', '/ready']`
	 */
	ignoredIncomingPaths?: string[]
}

/**
 * Fully resolved internal OpenTelemetry configuration produced by
 * `normalizeOpenTelemetryOptions` after defaults and validation are applied.
 */
export interface NormalizedOpenTelemetryOptions {
	/** Trimmed, non-empty OpenTelemetry service name. */
	serviceName: string
	/** Trimmed host name when explicitly configured. */
	hostName: string | undefined
	/** Trimmed service version or `'unknown'`. */
	serviceVersion: string
	/** Trimmed deployment environment or `'development'`. */
	environment: string
	/** Fully resolved OTLP log exporter configuration. */
	logs: Required<OpenTelemetrySignalOptions>
	/** Fully resolved OTLP trace exporter configuration. */
	traces: Required<OpenTelemetrySignalOptions>
	/** Fully resolved OTLP metric exporter configuration. */
	metrics: Required<OpenTelemetryMetricsOptions>
	/** Exact incoming request paths excluded from HTTP tracing. */
	ignoredIncomingPaths: string[]
}
