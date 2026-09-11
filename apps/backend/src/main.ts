import 'reflect-metadata';
import { pathToFileURL } from 'node:url';

import { type INestApplication, type NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { BACKEND_RUNTIME_CONFIGURATION } from './config/config.module.js';
import { buildCorsOptions } from './config/cors.config.js';
import type { BackendRuntimeConfiguration } from './config/environment.schema.js';
import { safeStartupDiagnostic } from './config/safe-diagnostic.js';

export async function createApplication(options: NestApplicationOptions = {}): Promise<INestApplication> {
  const application = await NestFactory.create(AppModule, { abortOnError: false, logger: ['error', 'warn'], ...options });
  const configuration = application.get<BackendRuntimeConfiguration>(BACKEND_RUNTIME_CONFIGURATION);
  application.enableCors(buildCorsOptions(configuration));
  application.enableShutdownHooks();
  return application;
}

export async function startApplication(): Promise<INestApplication> {
  const application = await createApplication();
  const configuration = application.get<BackendRuntimeConfiguration>(BACKEND_RUNTIME_CONFIGURATION);
  await application.listen(configuration.port);
  return application;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startApplication().catch((error: unknown) => {
    console.error(safeStartupDiagnostic(error));
    process.exitCode = 1;
  });
}
