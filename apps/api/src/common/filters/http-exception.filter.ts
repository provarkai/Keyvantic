import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import type { ApiErrorShape } from "@keyvantic/types";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttp ? exception.getResponse() : undefined;
    const message =
      typeof body === "string"
        ? body
        : (body as { message?: string | string[] })?.message ??
          (exception instanceof Error ? exception.message : "Internal server error");

    const payload: ApiErrorShape = {
      statusCode,
      error: HttpStatus[statusCode] ?? "ERROR",
      message: Array.isArray(message) ? message.join(", ") : message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      this.logger.error(payload.message, exception instanceof Error ? exception.stack : undefined);
    }

    response.status(statusCode).json(payload);
  }
}
