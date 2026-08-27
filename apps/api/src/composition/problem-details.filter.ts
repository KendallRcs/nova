import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;
    const details = typeof exceptionResponse === 'object' ? exceptionResponse : {};
    const isUnexpected = !isHttpException;

    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'https://nova.example/problems/unexpected-error',
        title: isUnexpected ? 'Ocurrió un error inesperado' : 'No se pudo procesar la solicitud',
        status,
        detail: isUnexpected
          ? 'Inténtalo nuevamente o contacta al administrador.'
          : typeof exceptionResponse === 'string'
            ? exceptionResponse
            : 'La solicitud no pudo procesarse.',
        code: isUnexpected ? 'UNEXPECTED_ERROR' : 'HTTP_ERROR',
        ...details,
        instance: request.originalUrl,
      });
  }
}
