import {
	LoggerOptions,
	NormalizedLoggerOptions
} from './logger-options.interface'

export function normalizeLoggerOptions(
	options: LoggerOptions = {}
): NormalizedLoggerOptions {
	const logsDir = options.logsDir?.trim()

	return {
		logLevel: options.logLevel ?? 'info',
		logsDir: logsDir || 'logs',
		http: {
			enabled: options.http?.enabled ?? true,
			includeBody: options.http?.includeBody ?? false,
			includeHeaders: options.http?.includeHeaders ?? false
		},

		transports: options.transports,
		exceptionHandlers: options.exceptionHandlers,
		rejectionHandlers: options.rejectionHandlers
	}
}
