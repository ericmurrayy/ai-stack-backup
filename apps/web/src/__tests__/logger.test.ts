/**
 * Structured Logger Tests
 * =======================
 * Verifies JSON output format, correlation ID propagation, and child loggers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from '../lib/logger'

describe('createLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs valid JSON on info()', () => {
    const log = createLogger('test:scope')
    log.info('hello world')

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
    expect(output).toMatchObject({
      level: 'info',
      scope: 'test:scope',
      msg: 'hello world',
    })
    expect(output.ts).toBeDefined()
    expect(output.correlationId).toBeDefined()
  })

  it('includes extra fields in output', () => {
    const log = createLogger('test:extra')
    log.info('with extras', { call_id: '123', provider: 'beside' })

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
    expect(output.call_id).toBe('123')
    expect(output.provider).toBe('beside')
  })

  it('extracts correlation ID from x-request-id header', () => {
    const mockReq = {
      headers: {
        get: (name: string) => (name === 'x-request-id' ? 'req-abc-123' : null),
      },
    }
    const log = createLogger('test:header', mockReq)
    expect(log.correlationId).toBe('req-abc-123')

    log.info('traced')
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
    expect(output.correlationId).toBe('req-abc-123')
  })

  it('extracts correlation ID from x-correlation-id header', () => {
    const mockReq = {
      headers: {
        get: (name: string) => (name === 'x-correlation-id' ? 'corr-456' : null),
      },
    }
    const log = createLogger('test:corr', mockReq)
    expect(log.correlationId).toBe('corr-456')
  })

  it('generates UUID when no request headers', () => {
    const log = createLogger('test:no-req')
    expect(log.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('routes error() to console.error', () => {
    const errorSpy = vi.spyOn(console, 'error')
    const log = createLogger('test:error')
    log.error('something broke', { code: 'ENOENT' })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(errorSpy.mock.calls[0][0] as string)
    expect(output.level).toBe('error')
    expect(output.msg).toBe('something broke')
    expect(output.code).toBe('ENOENT')
  })

  it('routes warn() to console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const log = createLogger('test:warn')
    log.warn('heads up')

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(warnSpy.mock.calls[0][0] as string)
    expect(output.level).toBe('warn')
  })

  it('child logger inherits correlationId and default extra', () => {
    const log = createLogger('test:parent')
    const child = log.child({ request_type: 'call' })

    expect(child.correlationId).toBe(log.correlationId)

    child.info('child log', { extra_field: 'yes' })
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
    expect(output.correlationId).toBe(log.correlationId)
    expect(output.request_type).toBe('call')
    expect(output.extra_field).toBe('yes')
  })

  it('child extra does not mutate parent', () => {
    const log = createLogger('test:parent2')
    log.child({ child_only: true })

    log.info('parent log')
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
    expect(output.child_only).toBeUndefined()
  })
})
