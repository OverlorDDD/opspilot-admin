import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId =
      request.header("x-request-id")?.trim() || randomUUID();
    const startedAt = performance.now();

    response.setHeader("x-request-id", requestId);

    response.on("finish", () => {
      const durationMs = Math.round(
        (performance.now() - startedAt) * 10,
      ) / 10;

      this.logger.log(
        JSON.stringify({
          event: "http_request",
          requestId,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs,
        }),
      );
    });

    next();
  }
}
