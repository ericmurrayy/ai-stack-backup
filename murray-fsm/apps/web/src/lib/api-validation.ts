// Murray's FSM - API Validation Helpers
// =======================================
// Shared Zod-based validation utilities for API routes

import { z, ZodError, ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

// ============================================================================
// Validation Response Helpers
// ============================================================================

/**
 * Format Zod errors into a clean API response structure
 */
function formatZodErrors(error: ZodError): { field: string; message: string }[] {
  return error.errors.map((err) => ({
    field: err.path.join('.') || '(root)',
    message: err.message,
  }));
}

/**
 * Validate a request body against a Zod schema.
 * Returns parsed data on success, or a 400 NextResponse on failure.
 */
export function validateBody<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  body: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: formatZodErrors(result.error),
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate URL query parameters against a Zod schema.
 * Converts URLSearchParams to a plain object first.
 * Returns parsed data on success, or a 400 NextResponse on failure.
 */
export function validateQuery<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  params: URLSearchParams
): { success: true; data: T } | { success: false; response: NextResponse } {
  // Convert URLSearchParams to plain object (all values are strings)
  const raw: Record<string, string> = {};
  params.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: formatZodErrors(result.error),
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate that a string is a valid UUID v4.
 * Returns the UUID on success, or a 400 NextResponse on failure.
 */
export function validateUUID(
  id: string,
  fieldName = 'id'
): { success: true; data: string } | { success: false; response: NextResponse } {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: `Invalid ${fieldName}: must be a valid UUID`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: id };
}

// ============================================================================
// Reusable Zod Primitives
// ============================================================================

/** Coerce a query-string value to a positive integer, with a default */
export const positiveIntString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .default(String(defaultValue))
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive({ message: 'Must be a positive integer' }));

/** Coerce a query-string value to a non-negative integer, with a default */
export const nonNegativeIntString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .default(String(defaultValue))
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().nonnegative({ message: 'Must be a non-negative integer' }));

/** Valid ISO 8601 datetime string */
export const isoDateString = z.string().refine(
  (val) => !isNaN(new Date(val).getTime()),
  { message: 'Must be a valid ISO 8601 date string' }
);

/** UUID string */
export const uuidString = z.string().uuid({ message: 'Must be a valid UUID' });
