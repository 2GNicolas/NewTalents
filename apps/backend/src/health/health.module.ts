import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { DatabaseModule } from '../database/database.module.js';
import { HealthExceptionFilter } from './health-exception.filter.js';
import { HealthResponseInterceptor } from './health-response.interceptor.js';
import { LivenessController } from './liveness.controller.js';
import { ReadinessController } from './readiness.controller.js';
import { ReadinessService } from './readiness.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [LivenessController, ReadinessController],
  providers: [
    ReadinessService,
    { provide: APP_INTERCEPTOR, useClass: HealthResponseInterceptor },
    { provide: APP_FILTER, useClass: HealthExceptionFilter },
  ],
})
export class HealthModule {}
