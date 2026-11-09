import {
	NormalizedOpenTelemetryOptions,
	OpenTelemetryOptions
} from './interfaces/opentelemetry-options.interface'

const DEFAULT_IGNORED_PATHS = ['/health', '/health/live', '/health/ready']

function validateEndpoint(name: string, endpoint: string | undefined): string {
	if (!endpoint) {
		return ''
	}

	let url: URL

	try {
		url = new URL(endpoint)
	} catch {
		throw new Error(`[OpenTelemetry] ${name} must be a valid HTTP(S) URL`)
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`[OpenTelemetry] ${name} must use HTTP or HTTPS`)
	}

	return endpoint
}

export function normalizeOpenTelemetryOptions(
	options: OpenTelemetryOptions
): NormalizedOpenTelemetryOptions {
	const serviceName = options.serviceName?.trim()

	if (!serviceName) {
		throw new Error(
			'[OpenTelemetry] serviceName must be a non-empty string'
		)
	}

	const hostName =
		typeof options.hostName === 'string'
			? options.hostName.trim()
			: undefined

	if (options.hostName !== undefined && !hostName) {
		throw new Error('[OpenTelemetry] hostName must be a non-empty string')
	}

	const exportIntervalMs = options.metrics?.exportIntervalMs ?? 60_000

	if (!Number.isInteger(exportIntervalMs) || exportIntervalMs <= 0) {
		throw new Error(
			'[OpenTelemetry] metrics.exportIntervalMs must be a positive integer'
		)
	}

	return {
		serviceName,
		hostName,
		serviceVersion: options.serviceVersion?.trim() || 'unknown',
		environment: options.environment?.trim() || 'development',
		logs: {
			enabled: options.logs?.enabled ?? true,
			endpoint: validateEndpoint('logs.endpoint', options.logs?.endpoint)
		},
		traces: {
			enabled: options.traces?.enabled ?? true,
			endpoint: validateEndpoint(
				'traces.endpoint',
				options.traces?.endpoint
			)
		},
		metrics: {
			enabled: options.metrics?.enabled ?? true,
			endpoint: validateEndpoint(
				'metrics.endpoint',
				options.metrics?.endpoint
			),
			hostMetrics: options.metrics?.hostMetrics ?? true,
			exportIntervalMs
		},
		ignoredIncomingPaths:
			options.ignoredIncomingPaths ?? DEFAULT_IGNORED_PATHS
	}
}
