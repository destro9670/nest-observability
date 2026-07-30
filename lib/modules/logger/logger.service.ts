import {
	Inject,
	Injectable,
	LoggerService as NestLoggerService
} from '@nestjs/common'
import { WINSTON_MODULE_PROVIDER } from 'nest-winston'
import { Logger } from 'winston'

import { CorrelationContextService } from './correlation/correlation-context.service'
import { sanitizeForLogging } from './http/log-sanitizer'

export interface LogMetadata {
	[key: string]: unknown
}

@Injectable()
export class LoggerService implements NestLoggerService {
	constructor(
		@Inject(WINSTON_MODULE_PROVIDER)
		private readonly logger: Logger,

		private readonly correlationContext: CorrelationContextService
	) {}

	log(message: unknown, ...optionalParameters: unknown[]): void {
		const { context, metadata } =
			this.resolveOptionalParameters(optionalParameters)

		this.write('info', message, context, metadata)
	}

	error(message: unknown, ...optionalParameters: unknown[]): void {
		const { trace, context, metadata } =
			this.resolveErrorParameters(optionalParameters)

		this.write('error', message, context, {
			...metadata,
			trace
		})
	}

	warn(message: unknown, ...optionalParameters: unknown[]): void {
		const { context, metadata } =
			this.resolveOptionalParameters(optionalParameters)

		this.write('warn', message, context, metadata)
	}

	debug(message: unknown, ...optionalParameters: unknown[]): void {
		const { context, metadata } =
			this.resolveOptionalParameters(optionalParameters)

		this.write('debug', message, context, metadata)
	}

	verbose(message: unknown, ...optionalParameters: unknown[]): void {
		const { context, metadata } =
			this.resolveOptionalParameters(optionalParameters)

		this.write('verbose', message, context, metadata)
	}

	fatal(message: unknown, ...optionalParameters: unknown[]): void {
		const { context, metadata } =
			this.resolveOptionalParameters(optionalParameters)

		this.write('error', message, context, {
			...metadata,
			severity: 'fatal'
		})
	}

	private write(
		level: string,
		message: unknown,
		context?: string,
		metadata: LogMetadata = {}
	): void {
		const sanitizedMetadata = this.sanitizeMetadata(metadata)

		this.logger.log(level, {
			message,
			context,
			...sanitizedMetadata,
			...this.correlationContext.getMetadata()
		})
	}

	private sanitizeMetadata(metadata: LogMetadata): LogMetadata {
		try {
			const sanitized = sanitizeForLogging(metadata)

			return sanitized !== null &&
				typeof sanitized === 'object' &&
				!Array.isArray(sanitized)
				? (sanitized as LogMetadata)
				: {
						metadata: sanitized
					}
		} catch {
			return {
				metadata: '[UNSERIALIZABLE]'
			}
		}
	}

	private resolveOptionalParameters(parameters: unknown[]): {
		context?: string
		metadata: LogMetadata
	} {
		const context = parameters.find(
			parameter => typeof parameter === 'string'
		) as string | undefined

		const metadata = parameters.find(
			parameter => parameter !== null && typeof parameter === 'object'
		) as LogMetadata | undefined

		return {
			context,
			metadata: metadata ?? {}
		}
	}

	private resolveErrorParameters(parameters: unknown[]): {
		trace?: string
		context?: string
		metadata: LogMetadata
	} {
		const [trace, context, metadata] = parameters

		return {
			trace: typeof trace === 'string' ? trace : undefined,

			context: typeof context === 'string' ? context : undefined,

			metadata:
				metadata !== null && typeof metadata === 'object'
					? (metadata as LogMetadata)
					: {}
		}
	}
}
