import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';

type ErrorResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ErrorResponse;
  json(body: object): void;
};

@Catch()
export class HealthExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<{ url?: string }>();
    const response = host.switchToHttp().getResponse<ErrorResponse>();
    if (request.url !== '/health/ready') {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      response.status(status).json({ statusCode: status });
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.status(503).json({ status: 'unavailable' });
  }
}
