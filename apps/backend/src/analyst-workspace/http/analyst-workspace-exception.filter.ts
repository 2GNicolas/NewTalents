import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { AnalystWorkspaceAccessError } from '../application/analyst-workspace-access.js';
import { AnalystWorkspaceQueryError } from './analyst-workspace-query.error.js';

@Catch()
export class AnalystWorkspaceExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (value: number) => { header: (name: string, value: string) => { json: (body: object) => void } };
    }>();
    const forbidden = error instanceof AnalystWorkspaceAccessError && error.kind === 'FORBIDDEN';
    const missing = error instanceof AnalystWorkspaceAccessError && error.kind === 'NOT_FOUND';
    const unauthenticated = error instanceof HttpException && error.getStatus() === HttpStatus.FORBIDDEN;
    const invalid = error instanceof AnalystWorkspaceQueryError;
    const status = unauthenticated ? HttpStatus.UNAUTHORIZED : forbidden ? HttpStatus.FORBIDDEN : missing ? HttpStatus.NOT_FOUND
      : invalid ? HttpStatus.BAD_REQUEST : HttpStatus.SERVICE_UNAVAILABLE;
    const code = unauthenticated ? 'unauthenticated' : forbidden ? 'forbidden' : missing ? 'not_found'
      : invalid ? 'invalid_query' : 'unavailable';
    response.status(status).header('Cache-Control', 'no-store').json({ code });
  }
}
