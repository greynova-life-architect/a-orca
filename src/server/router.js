/**
 * Minimal method + pathname router for the HTTP server.
 * Registers routes with (method, pattern, handler, paramNames).
 * pattern is a RegExp; paramNames are names for capture groups.
 */
class Router {
  constructor() {
    this.routes = [];
  }

  /**
   * @param {string} method - GET, POST, PATCH, DELETE, etc.
   * @param {RegExp} pattern - Regex to match pathname (capture groups for params).
   * @param {(req, res, params, ctx) => void} handler
   * @param {string[]} [paramNames] - Names for capture groups (e.g. ['id'] for first group).
   */
  register(method, pattern, handler, paramNames = []) {
    this.routes.push({ method, pattern, paramNames, handler });
  }

  /**
   * @param {string} method
   * @param {string} pathname
   * @returns {{ handler: Function, params: Record<string, string> } | null}
   */
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = pathname.match(r.pattern);
      if (!m) continue;
      const params = {};
      r.paramNames.forEach((name, i) => {
        params[name] = m[i + 1] ? decodeURIComponent(m[i + 1]) : '';
      });
      return { handler: r.handler, params };
    }
    return null;
  }
}

module.exports = { Router };
