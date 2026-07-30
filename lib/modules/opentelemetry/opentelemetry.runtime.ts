import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston'
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base'
import {
	defaultResource,
	resourceFromAttributes
} from '@opentelemetry/resources'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node'
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

	return {
		sdk: new NodeSDK(configuration)
	}
}

export class OpenTelemetryRuntime {
	private readonly components: OpenTelemetryRuntimeComponents
	private started = false
	private stopped = false

	constructor(options: OpenTelemetryOptions) {
		this.components = createOpenTelemetryComponents(options)
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

export function createOpenTelemetryRuntime(
	options: OpenTelemetryOptions
): OpenTelemetryRuntime {
	return new OpenTelemetryRuntime(options)
}
