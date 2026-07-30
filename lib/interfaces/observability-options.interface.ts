import { LoggerOptions } from '../modules/logger'
import { OpenTelemetryRuntime } from '../modules/opentelemetry'

export interface ObservabilityOptions extends LoggerOptions {
	runtime?: OpenTelemetryRuntime
}
