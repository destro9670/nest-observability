import { normalizeOpenTelemetryOptions } from '../lib/modules/opentelemetry/opentelemetry-options.factory'

describe('normalizeOpenTelemetryOptions', () => {
	it('applies safe defaults', () => {
		expect(
			normalizeOpenTelemetryOptions({
				serviceName: ' search-service '
			})
		).toEqual({
			serviceName: 'search-service',
			serviceVersion: 'unknown',
			environment: 'development',
			logs: { enabled: true, endpoint: '' },
			traces: { enabled: true, endpoint: '' },
			metrics: {
				enabled: true,
				endpoint: '',
				hostMetrics: true,
				exportIntervalMs: 60_000
			},
			ignoredIncomingPaths: ['/health', '/health/live', '/health/ready']
		})
	})

	it('rejects an empty service name', () => {
		expect(() =>
			normalizeOpenTelemetryOptions({ serviceName: ' ' })
		).toThrow('serviceName')
	})

	it.each(['ftp://collector', 'not-a-url'])(
		'rejects invalid endpoints: %s',
		endpoint => {
			expect(() =>
				normalizeOpenTelemetryOptions({
					serviceName: 'service',
					logs: { endpoint }
				})
			).toThrow('logs.endpoint')
		}
	)

	it.each([0, -1, 1.5])(
		'rejects invalid metric interval: %s',
		exportIntervalMs => {
			expect(() =>
				normalizeOpenTelemetryOptions({
					serviceName: 'service',
					metrics: { exportIntervalMs }
				})
			).toThrow('exportIntervalMs')
		}
	)
})
