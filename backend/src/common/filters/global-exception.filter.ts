import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatErrorCode, ChatErrorResponse } from '@orqland/contracts';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // If GraphQL context, let GraphQL handle or rethrow
    if ((host.getType() as string) === 'graphql') {
      return exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (!response || typeof response.status !== 'function') {
      return exception;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = ChatErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message || exception.message;
        if (obj.errorCode) {
          errorCode = obj.errorCode;
        } else {
          switch (status) {
            case HttpStatus.UNAUTHORIZED:
              errorCode = ChatErrorCode.UNAUTHORIZED;
              break;
            case HttpStatus.FORBIDDEN:
              errorCode = ChatErrorCode.FORBIDDEN;
              break;
            case HttpStatus.NOT_FOUND:
              errorCode = ChatErrorCode.CONVERSATION_NOT_FOUND;
              break;
            case HttpStatus.TOO_MANY_REQUESTS:
              errorCode = ChatErrorCode.RATE_LIMIT_EXCEEDED;
              break;
            default:
              errorCode = ChatErrorCode.INTERNAL_ERROR;
          }
        }
        if (obj.details) {
          details = obj.details;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled Exception at ${request.url}:`, exception.stack);
    }

    const payload: ChatErrorResponse = {
      statusCode: status,
      error: HttpStatus[status] || 'Error',
      errorCode,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(payload);
  }
}
