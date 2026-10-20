import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { AnalystMatchUploadAccessError } from '../application/analyst-match-upload-access.js';
import { ConfirmAnalystMatchUploadError } from '../application/confirm-analyst-match-upload.js';
import { ConfirmUploadValidationError } from '../domain/confirm-upload-validation.js';

@Catch()
export class AnalystMatchUploadExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (value: number) => { header: (name: string, value: string) => { json: (body: object) => void } };
    }>();
    const status = error instanceof HttpException && error.getStatus() === HttpStatus.FORBIDDEN ? HttpStatus.UNAUTHORIZED
      : error instanceof HttpException && error.getStatus() === HttpStatus.BAD_REQUEST ? HttpStatus.BAD_REQUEST
      : error instanceof ConfirmUploadValidationError ? HttpStatus.UNPROCESSABLE_ENTITY
      : error instanceof ConfirmAnalystMatchUploadError && error.kind === 'CONFLICT' ? HttpStatus.CONFLICT
      : (error instanceof AnalystMatchUploadAccessError || error instanceof ConfirmAnalystMatchUploadError) && error.kind === 'FORBIDDEN' ? HttpStatus.FORBIDDEN
      : (error instanceof AnalystMatchUploadAccessError || error instanceof ConfirmAnalystMatchUploadError) && error.kind === 'NOT_FOUND' ? HttpStatus.NOT_FOUND
      : HttpStatus.SERVICE_UNAVAILABLE;
    const code = status === 400 ? 'invalid_request' : status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden'
      : status === 404 ? 'not_found' : status === 409 ? 'conflict' : status === 422 ? 'validation_failed' : 'unavailable';
    response.status(status).header('Cache-Control', 'no-store').json({ code });
  }
}
