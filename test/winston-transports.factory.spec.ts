import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createDefaultTransports } from '../lib/modules/logger/winston/winston-transports.factory'

describe('createDefaultTransports', () => {
	it('does not register an explicit OpenTelemetry transport', () => {
		const directory = mkdtempSync(join(tmpdir(), 'nest-observability-'))

		try {
			const configured = createDefaultTransports({
				logLevel: 'info',
				logsDir: directory,
				http: {
					enabled: true,
					includeBody: false,
					includeHeaders: false
				}
			})

			expect(configured).toHaveLength(3)
			expect(
				configured.map(transport => transport.constructor.name)
			).not.toContain('OpenTelemetryTransportV3')
		} finally {
			rmSync(directory, {
				recursive: true,
				force: true
			})
		}
	})
})
