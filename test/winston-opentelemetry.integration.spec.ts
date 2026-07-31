import { spawnSync } from 'node:child_process'

describe('Winston OpenTelemetry integration', () => {
	it('exports one correlated OTel record per Winston log', () => {
		const script = String.raw`
const { trace } = require('@opentelemetry/api')
const { WinstonInstrumentation } = require('@opentelemetry/instrumentation-winston')
const { InMemoryLogRecordExporter, SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs')
const { NodeSDK } = require('@opentelemetry/sdk-node')
const { InMemorySpanExporter, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace')

const logExporter = new InMemoryLogRecordExporter()
const logProcessor = new SimpleLogRecordProcessor({ exporter: logExporter })
const spanExporter = new InMemorySpanExporter()
const spanProcessor = new SimpleSpanProcessor({ exporter: spanExporter })

const sdk = new NodeSDK({
  logRecordProcessors: [logProcessor],
  spanProcessors: [spanProcessor],
  metricReaders: [],
  instrumentations: [
    new WinstonInstrumentation({
      disableLogSending: false,
      disableLogCorrelation: false
    })
  ]
})

sdk.start()

// Winston must load only after instrumentation has started.
const winston = require('winston')
const logger = winston.createLogger({
  level: 'debug',
  transports: [new winston.transports.Console({ silent: true })]
})

trace.getTracer('integration-test').startActiveSpan('test-span', span => {
  logger.debug('single-record')
  span.end()
})

setTimeout(async () => {
  await logProcessor.forceFlush()
  await spanProcessor.forceFlush()

  const records = logExporter.getFinishedLogRecords()
  const spans = spanExporter.getFinishedSpans()
  const valid =
    records.length === 1 &&
    spans.length === 1 &&
		records[0]?.severityText === 'debug' &&
    records[0]?.spanContext?.traceId === spans[0]?.spanContext().traceId

  await sdk.shutdown()

  if (!valid) {
    process.exitCode = 1
  }
}, 50)
`

		const result = spawnSync(process.execPath, ['-e', script], {
			cwd: process.cwd(),
			encoding: 'utf8',
			timeout: 10_000
		})

		expect(result.stderr).toBe('')
		expect(result.status).toBe(0)
	})
})
