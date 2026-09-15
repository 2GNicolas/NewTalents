import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'node:url';

import { parseBackendEnvironment, type BackendRuntimeConfiguration } from './environment.schema.js';

export const BACKEND_RUNTIME_CONFIGURATION = Symbol('BACKEND_RUNTIME_CONFIGURATION');
// This resolves to apps/backend/.env in both src and the compiled dist tree, so root npm scripts
// load the same reviewed local runtime configuration as direct backend commands.
const localEnvironmentFile = fileURLToPath(new URL('../../.env', import.meta.url));

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: localEnvironmentFile })],
  providers: [{
    provide: BACKEND_RUNTIME_CONFIGURATION,
    useFactory: (): BackendRuntimeConfiguration => parseBackendEnvironment(process.env),
  }],
  exports: [BACKEND_RUNTIME_CONFIGURATION],
})
export class RuntimeConfigModule {}
