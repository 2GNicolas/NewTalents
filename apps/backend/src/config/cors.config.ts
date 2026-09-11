import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

import type { BackendRuntimeConfiguration } from './environment.schema.js';

export function buildCorsOptions(configuration: BackendRuntimeConfiguration): CorsOptions {
  return { origin: [...configuration.allowedOrigins], credentials: false };
}
