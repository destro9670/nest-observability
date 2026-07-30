import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Observable } from 'rxjs'

import {
	HttpHeaderResponseLike,
	HttpRequestLike,
	setHttpResponseHeader
} from '../http/http-adapter'

import { CorrelationContextService } from './correlation-context.service'

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
	constructor(
		private readonly correlationContext: CorrelationContextService
	) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler
	): Observable<unknown> {
		if (context.getType() !== 'http') {
			return next.handle()
		}

		const request = context.switchToHttp().getRequest<HttpRequestLike>()
		const response = context
			.switchToHttp()
			.getResponse<HttpHeaderResponseLike>()

		const requestedCorrelationId = request.headers?.['x-correlation-id']

		const correlationId =
			typeof requestedCorrelationId === 'string' &&
			CORRELATION_ID_PATTERN.test(requestedCorrelationId)
				? requestedCorrelationId
				: randomUUID()

		setHttpResponseHeader(response, 'x-correlation-id', correlationId)

		return new Observable(subscriber =>
			this.correlationContext.run(
				{
					correlationId,
					sequence: 1
				},
				() => {
					const subscription = next.handle().subscribe(subscriber)

					return () => subscription.unsubscribe()
				}
			)
		)
	}
}
