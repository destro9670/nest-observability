import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston'
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base'
import {
	defaultResource,
	envDetector,
	hostDetector,
	osDetector,
	processDetector,
	ResourceDetector,
	resourceFromAttributes,
	serviceInstanceIdDetector
} from '@opentelemetry/resources'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import {
	api,
	core,
	NodeSDK,
	NodeSDKConfiguration
} from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace'
import {
	ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION
} from '@opentelemetry/semantic-conventions'

import { OpenTelemetryOptions } from './interfaces/opentelemetry-options.interface'
import { normalizeOpenTelemetryOptions } from './opentelemetry-options.factory'

type SdkLifecycle = Pick<NodeSDK, 'start' | 'shutdown'>

interface OpenTelemetryRuntimeComponents {
	sdk: SdkLifecycle
}

function getSdkResourceDetectors(): ResourceDetector[] {
	const names = core.getStringListFromEnv('OTEL_NODE_RESOURCE_DETECTORS')
	if (!names) {
		return [envDetector, processDetector, hostDetector]
	}

	// Match NodeSDK's built-in detectors and ordering when adding an override.
	const detectors = new Map<string, ResourceDetector>([
		['host', hostDetector],
		['os', osDetector],
		['serviceinstance', serviceInstanceIdDetector],
		['process', processDetector],
		['env', envDetector]
	])
	if (names.includes('all')) {
		return [...detectors.values()]
	}
	if (names.includes('none')) {
		return []
	}

	return names.flatMap(name => {
		const detector = detectors.get(name)
		if (!detector) {
			api.diag.warn(
				`Invalid resource detector "${name}" specified in the environment variable OTEL_NODE_RESOURCE_DETECTORS`
			)
		}
		return detector ?? []
	})
}

function optionalUrl(endpoint: string): { url?: string } {
	return endpoint ? { url: endpoint } : {}
}

function getRequestPath(url: string | undefined): string {
	try {
		return new URL(url ?? '/', 'http://localhost').pathname
	} catch {
		return url ?? ''
	}
}

export function createOpenTelemetryComponents(
	options: OpenTelemetryOptions
): OpenTelemetryRuntimeComponents {
	const normalized = normalizeOpenTelemetryOptions(options)
	const logRecordProcessors = normalized.logs.enabled
		? [
				new BatchLogRecordProcessor({
					exporter: new OTLPLogExporter({
						...optionalUrl(normalized.logs.endpoint),
						compression: CompressionAlgorithm.GZIP,
						keepAlive: true,
						httpAgentOptions: {
							keepAlive: true,
							maxSockets: 10
						},
						userAgent: `${normalized.serviceName}-otel-logs`
					})
				})
			]
		: []
	const metricReaders = normalized.metrics.enabled
		? [
				new PeriodicExportingMetricReader({
					exporter: new OTLPMetricExporter({
						...optionalUrl(normalized.metrics.endpoint),
						compression: CompressionAlgorithm.GZIP
					}),
					exportIntervalMillis: normalized.metrics.exportIntervalMs
				})
			]
		: []
	const spanProcessors = normalized.traces.enabled
		? [
				new BatchSpanProcessor({
					exporter: new OTLPTraceExporter({
						...optionalUrl(normalized.traces.endpoint),
						compression: CompressionAlgorithm.GZIP
					})
				})
			]
		: []

	const configuration: Partial<NodeSDKConfiguration> = {
		resource: defaultResource().merge(
			resourceFromAttributes({
				[ATTR_SERVICE_NAME]: normalized.serviceName,
				[ATTR_SERVICE_VERSION]: normalized.serviceVersion,
				[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: normalized.environment
			})
		),
		logRecordProcessors,
		metricReaders,
		spanProcessors,
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-host-metrics': {
					enabled:
						normalized.metrics.enabled &&
						normalized.metrics.hostMetrics
				},
				'@opentelemetry/instrumentation-winston': {
					enabled: false
				},
				'@opentelemetry/instrumentation-http': {
					ignoreIncomingRequestHook: request =>
						normalized.ignoredIncomingPaths.includes(
							getRequestPath(request.url)
						)
				}
			}),
			new WinstonInstrumentation({
				disableLogSending: !normalized.logs.enabled,
				disableLogCorrelation: false
			})
		]
	}

	const { hostName } = normalized
	if (hostName !== undefined) {
		configuration.resourceDetectors = [
			...getSdkResourceDetectors(),
			{ detect: () => ({ attributes: { 'host.name': hostName } }) }
		]
	}

	return {
		sdk: new NodeSDK(configuration)
	}
}

export class OpenTelemetryRuntime {
	private readonly components: OpenTelemetryRuntimeComponents
	private readonly serviceName: string
	private started = false
	private stopped = false

	constructor(options: OpenTelemetryOptions) {
		this.components = createOpenTelemetryComponents(options)
		this.serviceName = options.serviceName.trim()

		console.debug('[OpenTelemetry] runtime created', {
			serviceName: this.serviceName
		})
	}

	start(): void {
		if (this.stopped) {
			throw new Error(
				'[OpenTelemetry] runtime cannot restart after shutdown'
			)
		}

		if (this.started) {
			return
		}

		this.components.sdk.start()
		this.started = true

		console.debug('[OpenTelemetry] runtime started', {
			serviceName: this.serviceName
		})
	}

	async shutdown(): Promise<void> {
		if (!this.started || this.stopped) {
			return
		}

		this.stopped = true
		await this.components.sdk.shutdown()
	}

	isStarted(): boolean {
		return this.started && !this.stopped
	}
}

/**
 * Creates an OpenTelemetry runtime configured for logs, traces, metrics, and
 * automatic Node.js instrumentation.
 *
 * Creating the runtime validates and normalizes the supplied options, but does
 * not start the underlying OpenTelemetry SDK. Call {@link OpenTelemetryRuntime.start}
 * explicitly. The runtime should be created and started from a preload module
 * before NestJS, Winston, HTTP clients, database drivers, or other instrumented
 * libraries are imported.
 *
 * Import this function from the dedicated `/opentelemetry` entry point. The
 * package root also exports it, but importing the root may load instrumented
 * libraries before the SDK is started.
 *
 * @param options - Service identity, OTLP signal exporters, metric collection,
 * and incoming HTTP tracing configuration.
 * @returns A lifecycle controller that starts the SDK, flushes and shuts it
 * down, and reports whether it is running.
 *
 * @throws {Error} When `serviceName` is empty, an exporter endpoint is not a
 * valid HTTP(S) URL, or `metrics.exportIntervalMs` is not a positive integer.
 *
 * @example Start telemetry from a preload module
 * ```ts
 * // src/instrumentation.ts
 * import { createOpenTelemetryRuntime } from '@varent/nest-observability/opentelemetry'
 *
 * export const openTelemetryRuntime = createOpenTelemetryRuntime({
 * 	serviceName: 'orders-service',
 * 	serviceVersion: '1.4.0',
 * 	environment: process.env.NODE_ENV,
 * 	traces: {
 * 		endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
 * 	},
 * 	metrics: {
 * 		endpoint: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
 * 		exportIntervalMs: 30_000
 * 	}
 * })
 *
 * openTelemetryRuntime.start()
 * ```
 *
 * @example Disable signals that the process does not produce
 * ```ts
 * const openTelemetryRuntime = createOpenTelemetryRuntime({
 * 	serviceName: 'background-worker',
 * 	logs: { enabled: true },
 * 	traces: { enabled: false },
 * 	metrics: { enabled: false }
 * })
 *
 * openTelemetryRuntime.start()
 * ```
 */
export function createOpenTelemetryRuntime(
	options: OpenTelemetryOptions
): OpenTelemetryRuntime {
	return new OpenTelemetryRuntime(options)
}
