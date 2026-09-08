import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    const rawMessage = record.message ?? (typeof payload === 'string' ? payload : 'An unexpected error occurred.');
    const message = Array.isArray(rawMessage) ? 'Request validation failed.' : typeof rawMessage === 'string' ? rawMessage : 'Request failed.';
    const code = typeof record.code === 'string' ? record.code : status === 429 ? 'RATE_LIMITED' : `HTTP_${status}`;
    if (status >= 500) this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    response.status(status).json({ success: false, error: { code, message, ...(Array.isArray(rawMessage) ? { details: rawMessage } : {}) } });
  }
}
