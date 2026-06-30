// Minimal zero-dependency structured logger. Emits one JSON line per event so logs
// are greppable/queryable in any aggregator and captured from stdout/stderr on
// serverless. Level is controlled by LOG_LEVEL (debug|info|warn|error|silent). With
// no explicit level it logs in real app runtimes (NODE_ENV production/development) and
// stays silent elsewhere (e.g. the test runner), so the suite is quiet by default.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SILENT_RANK = 100;

function thresholdRank(env: NodeJS.ProcessEnv = process.env): number {
  const configured = env.LOG_LEVEL?.toLowerCase();

  if (configured === 'silent') {
    return SILENT_RANK;
  }

  if (configured && configured in LEVEL_RANK) {
    return LEVEL_RANK[configured as LogLevel];
  }

  if (env.NODE_ENV === 'production' || env.NODE_ENV === 'development') {
    return LEVEL_RANK.info;
  }

  return SILENT_RANK;
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  if (LEVEL_RANK[level] < thresholdRank()) {
    return;
  }

  const line = safeStringify({
    level,
    time: new Date().toISOString(),
    msg: message,
    ...fields,
  });

  // Warnings and errors to stderr; informational logs to stdout.
  if (level === 'warn' || level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

function safeStringify(entry: Record<string, unknown>): string {
  try {
    return JSON.stringify(entry);
  } catch {
    return JSON.stringify({ level: 'error', msg: 'log_serialization_failed' });
  }
}

// Normalizes an unknown thrown value into safe, structured fields. Stack traces are
// intentionally omitted (they can leak filesystem paths); name + message are enough to
// correlate a log line with the thrown error.
export function describeError(error: unknown): { errorName: string; errorMessage: string } {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }

  return { errorName: 'UnknownError', errorMessage: String(error) };
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};
