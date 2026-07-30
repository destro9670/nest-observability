export interface HttpRequestLike {
	method: string
	originalUrl?: string
	url?: string
	ip?: string
	headers: Record<string, unknown>
	body?: unknown
}

export interface HttpHeaderResponseLike {
	setHeader?(name: string, value: string): unknown
	header?(name: string, value: string): unknown
	raw?: {
		setHeader?(name: string, value: string): unknown
	}
}

export interface HttpResponseLike extends HttpHeaderResponseLike {
	statusCode: number
}

export function setHttpResponseHeader(
	response: HttpHeaderResponseLike,
	name: string,
	value: string
): void {
	if (typeof response.setHeader === 'function') {
		response.setHeader(name, value)
		return
	}

	if (typeof response.header === 'function') {
		response.header(name, value)
		return
	}

	if (typeof response.raw?.setHeader === 'function') {
		response.raw.setHeader(name, value)
		return
	}

	throw new Error(
		'[LoggerModule] HTTP adapter response must support setHeader(), header(), or raw.setHeader()'
	)
}
