export interface OpenTelemetrySignalOptions {
	enabled?: boolean
	endpoint?: string
}

export interface OpenTelemetryMetricsOptions extends OpenTelemetrySignalOptions {
	hostMetrics?: boolean
	exportIntervalMs?: number
}

export interface OpenTelemetryOptions {
	serviceName: string
	serviceVersion?: string
	environment?: string
	logs?: OpenTelemetrySignalOptions
	traces?: OpenTelemetrySignalOptions
	metrics?: OpenTelemetryMetricsOptions
	ignoredIncomingPaths?: string[]
}

export interface NormalizedOpenTelemetryOptions {
	serviceName: string
	serviceVersion: string
	environment: string
	logs: Required<OpenTelemetrySignalOptions>
	traces: Required<OpenTelemetrySignalOptions>
	metrics: Required<OpenTelemetryMetricsOptions>
	ignoredIncomingPaths: string[]
}
