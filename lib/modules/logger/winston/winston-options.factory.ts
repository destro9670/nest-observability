import { WinstonModuleOptions } from 'nest-winston'

import { NormalizedLoggerOptions } from '../config/logger-options.interface'

import {
	createDefaultExceptionHandlers,
	createDefaultRejectionHandlers,
	createDefaultTransports
} from './winston-transports.factory'

export function createWinstonOptions(
	options: NormalizedLoggerOptions
): WinstonModuleOptions {
	return {
		level: options.logLevel,

		transports: options.transports ?? createDefaultTransports(options),

		exceptionHandlers:
			options.exceptionHandlers ??
			createDefaultExceptionHandlers(options.logsDir),

		rejectionHandlers:
			options.rejectionHandlers ??
			createDefaultRejectionHandlers(options.logsDir)
	}
}
