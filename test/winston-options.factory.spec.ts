import { normalizeLoggerOptions } from '../lib/modules/logger/config/logger-options.factory'
import { createWinstonOptions } from '../lib/modules/logger/winston/winston-options.factory'

describe('createWinstonOptions', () => {
	it('sets the logger level for automatically added transports', () => {
		const options = createWinstonOptions(
			normalizeLoggerOptions({
				logLevel: 'debug',
				transports: [],
				exceptionHandlers: [],
				rejectionHandlers: []
			})
		)

		expect(options.level).toBe('debug')
	})
})
