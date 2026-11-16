import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { HTTP_STATUS_BY_CODE, type ApiError, type ErrorCode } from '../../shared/protocol';

export interface ApiErrorBody {
  error: ApiError;
}

/** Typed domain error carried through services, HTTP routes and socket handlers. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toApiError(error: AppError): ApiError {
  return {
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
    requestId: randomUUID(),
  };
}

export function internalApiError(): ApiError {
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    requestId: randomUUID(),
  };
}

export function sendError(
  response: Response,
  status: number | null,
  code: ErrorCode | string,
  message: string,
  details?: Record<string, unknown>,
): void {
  const known = code in HTTP_STATUS_BY_CODE ? HTTP_STATUS_BY_CODE[code as ErrorCode] : 500;
  const body: ApiErrorBody = {
    error: {
      code: code as ErrorCode,
      message,
      ...(details === undefined ? {} : { details }),
      requestId: randomUUID(),
    },
  };
  response.status(status ?? known).json(body);
}

export function sendAppError(response: Response, error: AppError): void {
  sendError(response, null, error.code, error.message, error.details);
}
