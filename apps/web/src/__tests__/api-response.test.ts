/**
 * Tests: API Response Helpers
 * ===========================
 * Validates the standardized response format for /api/v1 endpoints:
 * 1. Error responses have { code, message, details?, requestId }
 * 2. Success responses have { data, meta?, requestId }
 * 3. Convenience helpers return correct HTTP status codes
 * 4. Zod validation errors are flattened correctly
 * 5. Request IDs are generated and propagated
 * 6. Pagination meta is computed correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apiError,
  apiSuccess,
  apiValidationError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  generateRequestId,
  paginationMeta,
  ErrorCode,
} from '../lib/api-response'
import { z } from 'zod'

// Helper to extract JSON body from NextResponse
async function getBody(response: any): Promise<any> {
  const blob = await response.json()
  return blob
}

describe('API Response Helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('generateRequestId', () => {
    it('generates unique IDs', () => {
      const id1 = generateRequestId()
      const id2 = generateRequestId()
      expect(id1).not.toBe(id2)
    })

    it('starts with req_ prefix', () => {
      expect(generateRequestId()).toMatch(/^req_/)
    })
  })

  describe('apiError', () => {
    it('returns correct HTTP status and body shape', async () => {
      const res = apiError(400, 'VALIDATION_ERROR', 'Bad input', { field: 'name' }, 'req_test')
      expect(res.status).toBe(400)
      const body = await getBody(res)
      expect(body).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Bad input',
        details: { field: 'name' },
        requestId: 'req_test',
      })
    })

    it('omits details when not provided', async () => {
      const res = apiError(401, 'UNAUTHORIZED', 'No token')
      const body = await getBody(res)
      expect(body.details).toBeUndefined()
      expect(body.code).toBe('UNAUTHORIZED')
      expect(body.message).toBe('No token')
      expect(body.requestId).toMatch(/^req_/)
    })
  })

  describe('apiSuccess', () => {
    it('returns 200 with data and requestId', async () => {
      const res = apiSuccess({ jobs: [] }, undefined, 200, 'req_test')
      expect(res.status).toBe(200)
      const body = await getBody(res)
      expect(body).toEqual({
        data: { jobs: [] },
        requestId: 'req_test',
      })
    })

    it('includes meta when provided', async () => {
      const res = apiSuccess({ items: [1] }, { total: 100, limit: 10, offset: 0 })
      const body = await getBody(res)
      expect(body.meta).toEqual({ total: 100, limit: 10, offset: 0 })
    })

    it('supports custom status codes', async () => {
      const res = apiSuccess({ id: 'new-uuid' }, undefined, 201)
      expect(res.status).toBe(201)
    })
  })

  describe('apiValidationError', () => {
    it('returns 400 with flattened Zod errors', async () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      })
      const result = schema.safeParse({ name: '', email: 'not-email' })
      expect(result.success).toBe(false)
      if (result.success) return

      const res = apiValidationError(result.error, 'req_val')
      expect(res.status).toBe(400)
      const body = await getBody(res)
      expect(body.code).toBe('VALIDATION_ERROR')
      expect(body.message).toBe('Validation failed')
      expect(body.details).toHaveProperty('fieldErrors')
      expect(body.requestId).toBe('req_val')
    })
  })

  describe('convenience helpers', () => {
    it('apiUnauthorized returns 401', async () => {
      const res = apiUnauthorized('Bad token', 'req_u')
      expect(res.status).toBe(401)
      const body = await getBody(res)
      expect(body.code).toBe('UNAUTHORIZED')
      expect(body.message).toBe('Bad token')
    })

    it('apiForbidden returns 403', async () => {
      const res = apiForbidden('No access', 'req_f')
      expect(res.status).toBe(403)
      const body = await getBody(res)
      expect(body.code).toBe('FORBIDDEN')
    })

    it('apiNotFound returns 404', async () => {
      const res = apiNotFound('Job not found', 'req_n')
      expect(res.status).toBe(404)
      const body = await getBody(res)
      expect(body.code).toBe('NOT_FOUND')
    })

    it('apiInternalError returns 500 and logs', async () => {
      const res = apiInternalError(new Error('db timeout'), 'TestCtx', 'req_i')
      expect(res.status).toBe(500)
      const body = await getBody(res)
      expect(body.code).toBe('INTERNAL_ERROR')
      expect(body.message).toBe('Internal server error')
      expect(console.error).toHaveBeenCalledWith('[TestCtx]', expect.any(Error))
    })
  })

  describe('paginationMeta', () => {
    it('computes hasMore correctly when more data exists', () => {
      const meta = paginationMeta(100, 50, 0)
      expect(meta).toEqual({ total: 100, limit: 50, offset: 0, hasMore: true })
    })

    it('computes hasMore=false when at end', () => {
      const meta = paginationMeta(100, 50, 50)
      expect(meta).toEqual({ total: 100, limit: 50, offset: 50, hasMore: false })
    })

    it('handles null total', () => {
      const meta = paginationMeta(null, 50, 0)
      expect(meta).toEqual({ total: null, limit: 50, offset: 0, hasMore: false })
    })

    it('handles exact boundary', () => {
      const meta = paginationMeta(50, 50, 0)
      expect(meta).toEqual({ total: 50, limit: 50, offset: 0, hasMore: false })
    })
  })

  describe('ErrorCode constants', () => {
    it('has all expected codes', () => {
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED')
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN')
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND')
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
      expect(ErrorCode.CONFLICT).toBe('CONFLICT')
      expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED')
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
    })
  })
})
