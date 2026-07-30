export interface HttpLogMetadata {
	method: string
	url: string
	statusCode: number
	durationMs: number
	sourceIp?: string

	headers?: unknown
	body?: unknown
}
