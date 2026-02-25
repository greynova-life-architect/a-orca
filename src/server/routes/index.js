/**
 * Registers all API routes on the router.
 * @param {import('../router').Router} router
 * @param {object} ctx - Context with jsonResponse, sendSSE, logger, config, db*, fileService, etc.
 */
const { registerAgentsRoutes } = require('./agents');
const { registerSettingsRoutes } = require('./settings');
const { registerBrowseRoutes } = require('./browse');

function registerRoutes(router, ctx) {
  registerAgentsRoutes(router, ctx);
  registerSettingsRoutes(router, ctx);
  registerBrowseRoutes(router, ctx);
}

module.exports = { registerRoutes };
