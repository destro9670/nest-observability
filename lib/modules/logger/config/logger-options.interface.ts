import { WinstonModuleOptions } from 'nest-winston'

export type LoggerLogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose'

export interface HttpLoggingOptions {
	enabled?: boolean
	includeBody?: boolean
	includeHeaders?: boolean
}

export interface LoggerOptions {
	logLevel?: LoggerLogLevel
	logsDir?: string
	http?: HttpLoggingOptions

	transports?: WinstonModuleOptions['transports']
	exceptionHandlers?: WinstonModuleOptions['exceptionHandlers']
	rejectionHandlers?: WinstonModuleOptions['rejectionHandlers']
}

export interface NormalizedLoggerOptions {
	logLevel: LoggerLogLevel
	logsDir: string

	http: {
		enabled: boolean
		includeBody: boolean
		includeHeaders: boolean
	}

	transports?: WinstonModuleOptions['transports']
	exceptionHandlers?: WinstonModuleOptions['exceptionHandlers']
	rejectionHandlers?: WinstonModuleOptions['rejectionHandlers']
}
