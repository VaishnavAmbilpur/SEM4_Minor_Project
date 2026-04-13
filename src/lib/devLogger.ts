const isDev = process.env.NODE_ENV === 'development';

type LogLevel = 'log' | 'warn' | 'error';

function write(level: LogLevel, scope: string, message: string, payload?: unknown) {
  if (!isDev) return;

  const prefix = `[dev][${scope}] ${message}`;
  if (payload === undefined) {
    console[level](prefix);
    return;
  }

  console[level](prefix, payload);
}

export const devLogger = {
  log(scope: string, message: string, payload?: unknown) {
    write('log', scope, message, payload);
  },
  warn(scope: string, message: string, payload?: unknown) {
    write('warn', scope, message, payload);
  },
  error(scope: string, message: string, payload?: unknown) {
    write('error', scope, message, payload);
  },
};
