import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { format, transports } from 'winston'
import Transport from 'winston-transport'

import { NormalizedLoggerOptions } from '../config/logger-options.interface'

function createConsoleFormat() {
	return format.combine(
		format.timestamp(),
		format.colorize(),
		format.printf(({ timestamp, level, message, context, ...metadata }) => {
			const serializedMetadata =
				Object.keys(metadata).length > 0
					? ` ${JSON.stringify(metadata)}`
					: ''

			return [
				`[${timestamp}]`,
				`[${level}]`,
				`[${context ?? 'Application'}]`,
				String(message),
				serializedMetadata
			].join(' ')
		})
	)
}

function createFileFormat() {
	return format.combine(
		format.timestamp(),
		format.errors({ stack: true }),
		format.json()
	)
}

export function createDefaultTransports(
	options: NormalizedLoggerOptions
): Transport[] {
	const logsDirectory = resolve(process.cwd(), options.logsDir)

	mkdirSync(logsDirectory, {
		recursive: true
	})

	return [
		new transports.Console({
			level: options.logLevel,
			format: createConsoleFormat()
		}),

		new transports.File({
			level: options.logLevel,
			filename: resolve(logsDirectory, 'application.log'),
			format: createFileFormat(),
			maxsize: 10 * 1024 * 1024,
			maxFiles: 20
		}),

		new transports.File({
			level: 'error',
			filename: resolve(logsDirectory, 'error.log'),
			format: createFileFormat(),
			maxsize: 10 * 1024 * 1024,
			maxFiles: 20
		})
	]
}

export function createDefaultExceptionHandlers(logsDir: string): Transport[] {
	const logsDirectory = resolve(process.cwd(), logsDir)

	mkdirSync(logsDirectory, {
		recursive: true
	})

	return [
		new transports.File({
			filename: resolve(logsDirectory, 'exceptions.log'),
			format: createFileFormat()
		})
	]
}

export function createDefaultRejectionHandlers(logsDir: string): Transport[] {
	const logsDirectory = resolve(process.cwd(), logsDir)

	mkdirSync(logsDirectory, {
		recursive: true
	})

	return [
		new transports.File({
			filename: resolve(logsDirectory, 'rejections.log'),
			format: createFileFormat()
		})
	]
}
