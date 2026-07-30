import {
	InjectionToken,
	ModuleMetadata,
	OptionalFactoryDependency
} from '@nestjs/common'

import { LoggerOptions } from './logger-options.interface'

export interface LoggerAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	inject?: Array<InjectionToken | OptionalFactoryDependency>

	useFactory: (
		...dependencies: any[]
	) => LoggerOptions | Promise<LoggerOptions>
}
