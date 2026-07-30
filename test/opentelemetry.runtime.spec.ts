import { OpenTelemetryRuntime } from '../lib'

const sdkStart = jest.fn()
const sdkShutdown = jest.fn().mockResolvedValue(undefined)
const nodeSdkConstructor = jest.fn()
const winstonInstrumentationConstructor = jest.fn()
const autoInstrumentationsConstructor = jest.fn()

jest.mock('@opentelemetry/sdk-node', () => ({
	NodeSDK: jest.fn().mockImplementation(configuration => {
		nodeSdkConstructor(configuration)
		return {
			start: sdkStart,
			shutdown: sdkShutdown
		}
	})
}))

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
	getNodeAutoInstrumentations: jest.fn().mockImplementation(options => {
		autoInstrumentationsConstructor(options)
		return []
	})
}))

jest.mock('@opentelemetry/instrumentation-winston', () => ({
	WinstonInstrumentation: jest.fn().mockImplementation(options => {
		winstonInstrumentationConstructor(options)
		return {}
	})
}))

describe('OpenTelemetryRuntime', () => {
	it('configures all enabled signal pipelines', () => {
		new OpenTelemetryRuntime({ serviceName: 'service' })

		const configuration = nodeSdkConstructor.mock.calls[0][0]

		expect(configuration.logRecordProcessors).toHaveLength(1)
		expect(configuration.metricReaders).toHaveLength(1)
		expect(configuration.spanProcessors).toHaveLength(1)
		expect(winstonInstrumentationConstructor).toHaveBeenCalledWith({
			disableLogSending: false,
			disableLogCorrelation: false
		})
		expect(autoInstrumentationsConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				'@opentelemetry/instrumentation-host-metrics': {
					enabled: true
				}
			})
		)
	})

	it('uses empty processor arrays to disable SDK env fallbacks', () => {
		new OpenTelemetryRuntime({
			serviceName: 'service',
			logs: { enabled: false },
			metrics: { enabled: false },
			traces: { enabled: false }
		})

		const configuration = nodeSdkConstructor.mock.calls[0][0]

		expect(configuration.logRecordProcessors).toEqual([])
		expect(configuration.metricReaders).toEqual([])
		expect(configuration.spanProcessors).toEqual([])
		expect(winstonInstrumentationConstructor).toHaveBeenCalledWith({
			disableLogSending: true,
			disableLogCorrelation: false
		})
		expect(autoInstrumentationsConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				'@opentelemetry/instrumentation-host-metrics': {
					enabled: false
				}
			})
		)
	})

	it('starts SDK only once', () => {
		const runtime = new OpenTelemetryRuntime({
			serviceName: 'service'
		})

		runtime.start()
		runtime.start()

		expect(sdkStart).toHaveBeenCalledTimes(1)
	})

	it('shuts down only once and cannot restart', async () => {
		const runtime = new OpenTelemetryRuntime({
			serviceName: 'service'
		})

		runtime.start()
		await runtime.shutdown()
		await runtime.shutdown()

		expect(sdkShutdown).toHaveBeenCalledTimes(1)
		expect(() => runtime.start()).toThrow('cannot restart')
	})
})
