/**
 * Application Error Normalization & Response System
 * INKs & Walls - Micro Phase 01.05
 * Provides structured error hierarchy and safe API error responses.
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";

export type ErrorCode =
  | "INTERNAL_ERROR"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EXTERNAL_SERVICE_ERROR"
  | "BAD_REQUEST";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, code: ErrorCode = "INTERNAL_ERROR", statusCode: number = 500, isOperational: boolean = true, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, true, details);
  }
}

export class AuthError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, "UNAUTHENTICATED", 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, "FORBIDDEN", 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Requested resource not found") {
    super(message, "NOT_FOUND", 404, true);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = "External service unavailable", details?: unknown) {
    super(message, "EXTERNAL_SERVICE_ERROR", 502, true, details);
  }
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    correlationId?: string;
  };
}

/**
 * Normalizes any caught error into a safe, consistent API response structure.
 * Captures non-operational / unexpected errors in Sentry and writes to logger.
 */
export function createErrorResponse(
  error: unknown,
  correlationId?: string,
  component: string = "API"
): NextResponse<ApiErrorResponse> {
  const isDev = process.env.NODE_ENV === "development";

  if (error instanceof AppError) {
    logger.warn(`Application error [${error.code}]: ${error.message}`, {
      component,
      correlationId,
      code: error.code,
      statusCode: error.statusCode,
    }, error);

    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(correlationId ? { correlationId } : {}),
        },
      },
      { status: error.statusCode }
    );
  }

  // Unexpected internal errors
  const errObj = error instanceof Error ? error : new Error(String(error));
  
  // Send unexpected errors to Sentry
  try {
    Sentry.captureException(errObj, {
      extra: { correlationId, component },
    });
  } catch {
    // Gracefully handle if Sentry isn't fully configured
  }

  logger.error(`Unexpected server error in ${component}: ${errObj.message}`, {
    component,
    correlationId,
  }, errObj);

  const safeMessage = isDev
    ? errObj.message
    : "An unexpected error occurred. Please try again later.";

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: safeMessage,
        ...(correlationId ? { correlationId } : {}),
      },
    },
    { status: 500 }
  );
}
