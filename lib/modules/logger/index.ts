export { LoggerModule } from './logger.module'
export { LoggerService, type LogMetadata } from './logger.service'

export { CorrelationContextService } from './correlation/correlation-context.service'
export { CorrelationInterceptor } from './correlation/correlation.interceptor'
export { HttpLoggingInterceptor } from './http/http-logging.interceptor'
export type { LoggerAsyncOptions } from './config/logger-async-options.interface'

export type {
	HttpLoggingOptions,
	LoggerLogLevel,
	LoggerOptions
} from './config/logger-options.interface'

export type {
	CorrelationMetadata,
	CorrelationStore
} from './correlation/correlation.types'
