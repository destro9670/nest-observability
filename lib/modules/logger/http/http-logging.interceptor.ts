import {
	CallHandler,
	ExecutionContext,
	HttpException,
	Inject,
	Injectable,
	NestInterceptor
} from '@nestjs/common'
import { finalize, Observable, tap } from 'rxjs'

import { NormalizedLoggerOptions } from '../config/logger-options.interface'
import { LOGGER_OPTIONS } from '../config/logger.tokens'
import { LoggerService } from '../logger.service'

import { HttpRequestLike, HttpResponseLike } from './http-adapter'
import { HttpLogMetadata } from './http-log.types'
import { sanitizeForLogging, sanitizeUrlForLogging } from './log-sanitizer'

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
	constructor(
		private readonly logger: LoggerService,

		@Inject(LOGGER_OPTIONS)
		private readonly options: NormalizedLoggerOptions
	) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler
	): Observable<unknown> {
		if (context.getType() !== 'http' || !this.options.http.enabled) {
			return next.handle()
		}

		const http = context.switchToHttp()
		const request = http.getRequest<HttpRequestLike>()
		const response = http.getResponse<HttpResponseLike>()

		const startedAt = process.hrtime.bigint()
		let requestError: unknown

		return next.handle().pipe(
			tap({
				error: error => {
					requestError = error
				}
			}),

			finalize(() => {
				const durationNanoseconds = process.hrtime.bigint() - startedAt

				const durationMs = Number(durationNanoseconds) / 1_000_000

				const statusCode = this.resolveStatusCode(
					response,
					requestError
				)

				const metadata: HttpLogMetadata = {
					method: request.method,
					url: sanitizeUrlForLogging(
						request.originalUrl ?? request.url ?? ''
					),
					statusCode,
					durationMs: Math.round(durationMs * 100) / 100,
					sourceIp: this.resolveSourceIp(request)
				}

				if (this.options.http.includeHeaders) {
					metadata.headers = sanitizeForLogging(request.headers)
				}

				if (this.options.http.includeBody) {
					metadata.body = sanitizeForLogging(request.body)
				}

				this.writeLog(statusCode, requestError, metadata)
			})
		)
	}

	private resolveStatusCode(
		response: HttpResponseLike,
		error: unknown
	): number {
		if (error instanceof HttpException) {
			return error.getStatus()
		}

		if (error) {
			return 500
		}

		return response.statusCode
	}

	private resolveSourceIp(request: HttpRequestLike): string | undefined {
		const realIp = request.headers['x-real-ip']

		if (typeof realIp === 'string') {
			return realIp
		}

		return request.ip
	}

	private writeLog(
		statusCode: number,
		error: unknown,
		metadata: HttpLogMetadata
	): void {
		if (statusCode >= 500) {
			this.logger.error(
				'HTTP request failed',
				error instanceof Error ? error.stack : undefined,
				'HTTP',
				metadata
			)

			return
		}

		if (statusCode >= 400) {
			this.logger.warn('HTTP client error', 'HTTP', metadata)

			return
		}

		this.logger.debug('HTTP request completed', 'HTTP', metadata)
	}
}
