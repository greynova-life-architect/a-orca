/**
 * API routes for /api/agents.
 */
const { readBody } = require('./helpers');

function registerAgentsRoutes(router, ctx) {
  const { jsonResponse, logger } = ctx;
  const { dbAgents } = ctx;

  router.register('GET', /^\/api\/agents\/?$/, async (req, res, params, query) => {
    try {
      const agents = dbAgents.listAgents();
      jsonResponse(res, 200, { agents });
    } catch (e) {
      logger.error('api', e);
      jsonResponse(res, 500, { error: e.message });
    }
  });

  router.register('POST', /^\/api\/agents\/?$/, async (req, res, params, query) => {
    try {
      const data = await readBody(req);
      const id = dbAgents.createAgent(data);
      jsonResponse(res, 201, { id });
    } catch (e) {
      logger.error('api', e);
      const status = e.message.includes('required') || e.message.includes('already in use') ? 400 : 500;
      jsonResponse(res, status, { error: e.message });
    }
  }, []);

  router.register('GET', /^\/api\/agents\/([^/]+)\/?$/, (req, res, params, query) => {
    const id = params.id;
    try {
      const agent = dbAgents.getAgent(id);
      if (!agent) {
        jsonResponse(res, 404, { error: 'Agent not found' });
        return;
      }
      jsonResponse(res, 200, { agent });
    } catch (e) {
      logger.error('api', e);
      jsonResponse(res, 500, { error: e.message });
    }
  }, ['id']);

  router.register('PATCH', /^\/api\/agents\/([^/]+)\/?$/, async (req, res, params, query) => {
    const id = params.id;
    try {
      const data = await readBody(req);
      dbAgents.updateAgent(id, data);
      jsonResponse(res, 200, { ok: true });
    } catch (e) {
      logger.error('api', e);
      const status = e.message.includes('required') || e.message.includes('already in use') ? 400 : 500;
      jsonResponse(res, status, { error: e.message });
    }
  }, ['id']);

  router.register('DELETE', /^\/api\/agents\/([^/]+)\/?$/, (req, res, params, query) => {
    const id = params.id;
    try {
      dbAgents.deleteAgent(id);
      jsonResponse(res, 200, { ok: true });
    } catch (e) {
      logger.error('api', e);
      jsonResponse(res, 500, { error: e.message });
    }
  }, ['id']);
}

module.exports = { registerAgentsRoutes };
