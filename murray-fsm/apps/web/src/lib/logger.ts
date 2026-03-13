// Murray's FSM - Structured Logger
// ==================================
// Provides consistent, structured logging across the application.
// In production, this can be swapped for a real logging service
// (Datadog, Sentry, LogTail, etc.) by changing the transport.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    digest?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (parseable by log aggregators)
    return JSON.stringify(entry);
  }
  // Human-readable for development
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  const err = entry.error ? ` | ${entry.error.name}: ${entry.error.message}` : '';
  return `[${entry.level.toUpperCase()}] ${entry.message}${ctx}${err}`;
}

function log(level: LogLevel, message: string, context?: LogContext, err?: unknown) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  if (err instanceof Error) {
    entry.error = {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      digest: (err as Error & { digest?: string }).digest,
    };
  }

  const formatted = formatEntry(entry);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext, err?: unknown) => log('warn', message, context, err),
  error: (message: string, context?: LogContext, err?: unknown) => log('error', message, context, err),
};
