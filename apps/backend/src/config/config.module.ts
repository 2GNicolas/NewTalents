import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { parseBackendEnvironment, type BackendRuntimeConfiguration } from './environment.schema.js';

export const BACKEND_RUNTIME_CONFIGURATION = Symbol('BACKEND_RUNTIME_CONFIGURATION');

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [{
    provide: BACKEND_RUNTIME_CONFIGURATION,
    useFactory: (): BackendRuntimeConfiguration => parseBackendEnvironment(process.env),
  }],
  exports: [BACKEND_RUNTIME_CONFIGURATION],
})
export class RuntimeConfigModule {}
