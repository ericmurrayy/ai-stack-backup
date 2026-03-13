// Murray's FSM - API Error Handling
// ===================================
// Standardized error responses and error handling for API routes.

import { NextResponse } from 'next/server';
import { logger } from './logger';
import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

// ---------------------------------------------------------------------------
// Error response builder
// ---------------------------------------------------------------------------

interface ErrorResponseBody {
  error: string;
  code?: string;
  details?: unknown;
}

export function errorResponse(
  statusCode: number,
  message: string,
  code?: string,
  details?: unknown,
): NextResponse<ErrorResponseBody> {
  const body: ErrorResponseBody = { error: message };
  if (code) body.code = code;
  if (details) body.details = details;
  return NextResponse.json(body, { status: statusCode });
}

// ---------------------------------------------------------------------------
// Catch-all handler for route try/catch blocks
// ---------------------------------------------------------------------------

export function handleRouteError(err: unknown, context?: string): NextResponse {
  // Known API errors
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error(`API error: ${err.message}`, { context, code: err.code }, err);
    }
    return errorResponse(
      err.statusCode,
      err.message,
      err.code,
      err instanceof ValidationError ? err.details : undefined,
    );
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', err.errors);
  }

  // Supabase errors (have a `code` and `message` field)
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    'message' in err &&
    typeof (err as { code: unknown }).code === 'string'
  ) {
    const supaErr = err as { code: string; message: string };
    logger.error('Supabase error', { context, code: supaErr.code }, err);

    // RLS violations
    if (supaErr.code === '42501') {
      return errorResponse(403, 'Access denied', 'FORBIDDEN');
    }
    // Unique constraint violations
    if (supaErr.code === '23505') {
      return errorResponse(409, 'Resource already exists', 'CONFLICT');
    }
    // FK violations
    if (supaErr.code === '23503') {
      return errorResponse(400, 'Referenced resource not found', 'FK_VIOLATION');
    }

    return errorResponse(500, 'Database error', 'DB_ERROR');
  }

  // Unknown errors
  logger.error('Unhandled error', { context }, err);
  return errorResponse(500, 'Internal server error', 'INTERNAL_ERROR');
}
