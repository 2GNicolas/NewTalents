import { Controller, Get, Header } from '@nestjs/common';

@Controller('health')
export class LivenessController {
  @Get('live')
  @Header('Cache-Control', 'no-store')
  getLiveness(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
