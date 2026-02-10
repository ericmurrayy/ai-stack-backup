/**
 * Structured Logger
 * =================
 * JSON-based structured logging with correlation IDs.
 *
 * Every log line is a single JSON object with:
 * - ts: ISO timestamp
 * - level: 'debug' | 'info' | 'warn' | 'error'
 * - msg: human-readable message
 * - correlationId: request-scoped trace ID
 * - ...extra: arbitrary key-value pairs
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger'
 *
 *   // In an API route:
 *   const log = createLogger('webhook:call-received', req)
 *   log.info('Call stored', { call_id: '123', provider: 'beside' })
 *
 *   // Standalone (no request context):
 *   const log = createLogger('cron:cleanup')
 *   log.warn('Stale records found', { count: 42 })
 */

import crypto from 'crypto'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  ts: string
  level: LogLevel
  scope: string
  msg: string
  correlationId: string
  [key: string]: unknown
}

interface Logger {
  debug: (msg: string, extra?: Record<string, unknown>) => void
  info: (msg: string, extra?: Record<string, unknown>) => void
  warn: (msg: string, extra?: Record<string, unknown>) => void
  error: (msg: string, extra?: Record<string, unknown>) => void
  /** The correlation ID for this logger instance */
  correlationId: string
  /** Create a child logger with additional default context */
  child: (extra: Record<string, unknown>) => Logger
}

/**
 * Extract or generate a correlation ID from a request.
 * Checks common trace headers in priority order.
 */
function getCorrelationId(req?: { headers: { get: (name: string) => string | null } }): string {
  if (req) {
    const id =
      req.headers.get('x-request-id') ||
      req.headers.get('x-correlation-id') ||
      req.headers.get('x-trace-id')
    if (id) return id
  }
  return crypto.randomUUID()
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry)
  switch (entry.level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    case 'debug':
      console.debug(line)
      break
    default:
      console.log(line)
  }
}

function makeLogger(
  scope: string,
  correlationId: string,
  defaultExtra: Record<string, unknown> = {}
): Logger {
  function log(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
    emit({
      ts: new Date().toISOString(),
      level,
      scope,
      msg,
      correlationId,
      ...defaultExtra,
      ...extra,
    })
  }

  return {
    debug: (msg, extra) => log('debug', msg, extra),
    info: (msg, extra) => log('info', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    error: (msg, extra) => log('error', msg, extra),
    correlationId,
    child: (extra) => makeLogger(scope, correlationId, { ...defaultExtra, ...extra }),
  }
}

/**
 * Create a structured logger.
 *
 * @param scope - Logger scope, e.g. 'webhook:call-received' or 'cron:cleanup'
 * @param req   - Optional NextRequest to extract correlation ID from headers
 */
export function createLogger(
  scope: string,
  req?: { headers: { get: (name: string) => string | null } }
): Logger {
  return makeLogger(scope, getCorrelationId(req))
}

export type { Logger, LogEntry, LogLevel }
