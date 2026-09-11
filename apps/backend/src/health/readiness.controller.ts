import { Controller, Get, Header, Res } from '@nestjs/common';

import { ReadinessService } from './readiness.service.js';

type StatusResponse = { status(code: number): StatusResponse };

@Controller('health')
export class ReadinessController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async getReadiness(@Res({ passthrough: true }) response: StatusResponse): Promise<{ status: 'ready' | 'unavailable' }> {
    const result = await this.readiness.check();
    response.status(result.status === 'ready' ? 200 : 503);
    return result;
  }
}
