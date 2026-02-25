/**
 * API routes for /api/settings.
 */
const { readBody } = require('./helpers');

function registerSettingsRoutes(router, ctx) {
  const { jsonResponse, logger } = ctx;
  const { settings } = ctx;

  router.register('GET', /^\/api\/settings\/?$/, (req, res, params, query) => {
    try {
      const data = settings.getSettings();
      jsonResponse(res, 200, data);
    } catch (e) {
      logger.error('api', e);
      jsonResponse(res, 500, { error: e.message });
    }
  });

  router.register('PATCH', /^\/api\/settings\/?$/, async (req, res, params, query) => {
    try {
      const data = await readBody(req);
      const updated = settings.updateSettings(data);
      jsonResponse(res, 200, updated);
    } catch (e) {
      logger.error('api', e);
      jsonResponse(res, 500, { error: e.message });
    }
  }, []);
}

module.exports = { registerSettingsRoutes };
