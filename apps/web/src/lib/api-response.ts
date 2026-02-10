/**
 * Standardized API Response Helpers
 * ==================================
 * Consistent error + success format for all /api/v1 endpoints.
 *
 * Error shape: { code, message, details?, requestId }
 * Success shape: { data, meta? }
 *
 * Usage:
 *   return apiError(400, 'VALIDATION_ERROR', 'Invalid request', { issues })
 *   return apiSuccess({ jobs }, { total: 100, limit: 50, offset: 0 })
 *   return apiSuccess({ job }, undefined, 201)
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import crypto from 'crypto'

// ── Types ──────────────────────────────────────────────────────────

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
  requestId: string
}

export interface ApiSuccessBody<T = unknown> {
  data: T
  meta?: Record<string, unknown>
  requestId: string
}

// ── Error Codes ────────────────────────────────────────────────────

export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

// ── Request ID ─────────────────────────────────────────────────────

let requestIdCounter = 0

export function generateRequestId(): string {
  const ts = Date.now().toString(36)
  const seq = (requestIdCounter++).toString(36)
  const rand = crypto.randomBytes(3).toString('hex')
  return `req_${ts}_${seq}_${rand}`
}

// ── Response Builders ──────────────────────────────────────────────

/**
 * Standard error response. Use for all 4xx and 5xx responses.
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  requestId?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      requestId: requestId || generateRequestId(),
    },
    { status },
  )
}

/**
 * Standard success response. Use for all 2xx responses.
 */
export function apiSuccess<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200,
  requestId?: string,
): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json(
    {
      data,
      ...(meta ? { meta } : {}),
      requestId: requestId || generateRequestId(),
    },
    { status },
  )
}

/**
 * Convenience: return a 400 with Zod validation errors flattened.
 */
export function apiValidationError(
  zodError: ZodError,
  requestId?: string,
): NextResponse<ApiErrorBody> {
  return apiError(
    400,
    ErrorCode.VALIDATION_ERROR,
    'Validation failed',
    zodError.flatten(),
    requestId,
  )
}

/**
 * Convenience: return a 401.
 */
export function apiUnauthorized(
  message: string = 'Unauthorized',
  requestId?: string,
): NextResponse<ApiErrorBody> {
  return apiError(401, ErrorCode.UNAUTHORIZED, message, undefined, requestId)
}

/**
 * Convenience: return a 403.
 */
export function apiForbidden(
  message: string = 'Insufficient permissions',
  requestId?: string,
): NextResponse<ApiErrorBody> {
  return apiError(403, ErrorCode.FORBIDDEN, message, undefined, requestId)
}

/**
 * Convenience: return a 404.
 */
export function apiNotFound(
  message: string = 'Not found',
  requestId?: string,
): NextResponse<ApiErrorBody> {
  return apiError(404, ErrorCode.NOT_FOUND, message, undefined, requestId)
}

/**
 * Convenience: return a 500 (logs error internally).
 */
export function apiInternalError(
  err: unknown,
  context: string = 'API',
  requestId?: string,
): NextResponse<ApiErrorBody> {
  console.error(`[${context}]`, err)
  return apiError(500, ErrorCode.INTERNAL_ERROR, 'Internal server error', undefined, requestId)
}

// ── Pagination Helpers ─────────────────────────────────────────────

export interface PaginationMeta {
  [key: string]: unknown
  total: number | null
  limit: number
  offset: number
  hasMore: boolean
}

export function paginationMeta(total: number | null, limit: number, offset: number): PaginationMeta {
  return {
    total,
    limit,
    offset,
    hasMore: total != null ? offset + limit < total : false,
  }
}
