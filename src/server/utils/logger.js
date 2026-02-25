/**
 * Logger utility for Project Map server.
 * Supports log levels configurable via LOG_LEVEL env (debug, info, warn, error).
 */
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel =
  LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

function log(level, tag, ...args) {
  if (LEVELS[level] < currentLevel) return;
  const prefix = `[${timestamp()}] [${tag}]`;
  const fn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : console.log;
  fn(prefix, ...args);
}

module.exports = {
  debug: (tag, ...args) => log('debug', tag, ...args),
  info: (tag, ...args) => log('info', tag, ...args),
  warn: (tag, ...args) => log('warn', tag, ...args),
  error: (tag, ...args) => log('error', tag, ...args),
  /** Legacy LOG(tag, ...args) style - maps to info */
  log: (tag, ...args) => log('info', tag, ...args),
};
