import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'

import { CorrelationMetadata, CorrelationStore } from './correlation.types'

@Injectable()
export class CorrelationContextService {
	private readonly storage = new AsyncLocalStorage<CorrelationStore>()

	run<T>(store: CorrelationStore, callback: () => T): T {
		return this.storage.run(store, callback)
	}

	getCorrelationId(): string | undefined {
		return this.storage.getStore()?.correlationId
	}

	getMetadata(): CorrelationMetadata | undefined {
		const store = this.storage.getStore()

		if (!store) {
			return undefined
		}

		const metadata: CorrelationMetadata = {
			correlationId: store.correlationId,
			sequence: store.sequence
		}

		store.sequence += 1

		return metadata
	}
}
