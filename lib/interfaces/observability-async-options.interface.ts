import { LoggerAsyncOptions } from '../modules/logger'
import { OpenTelemetryRuntime } from '../modules/opentelemetry'

export interface ObservabilityAsyncOptions extends LoggerAsyncOptions {
	runtime?: OpenTelemetryRuntime
}
