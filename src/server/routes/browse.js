/**
 * API routes for /api/browse.
 */
const path = require('path');
const fs = require('fs');

function registerBrowseRoutes(router, ctx) {
  const { jsonResponse, logger } = ctx;
  const { fileService } = ctx;

  router.register('GET', /^\/api\/browse\/?$/, (req, res, params, query) => {
    const requestedPath = (query.path || '').trim();
    try {
      if (!requestedPath) {
        const rootsFiltered = fileService.getBrowseRoots();
        const items = rootsFiltered.map((p) => ({
          name: path.basename(p) || p,
          path: p,
          type: 'dir',
        }));
        jsonResponse(res, 200, {
          path: null,
          parentPath: null,
          items,
          roots: true,
        });
        return;
      }
      const dir = fileService.resolveBrowsePath(requestedPath);
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        jsonResponse(res, 200, {
          items: [],
          path: dir,
          parentPath: null,
          error: 'Invalid path',
        });
        return;
      }
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const items = entries
        .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map((e) => ({
          name: e.name,
          path: path.join(dir, e.name),
          type: e.isDirectory() ? 'dir' : 'file',
        }));
      const parentPath = path.dirname(dir);
      const roots = fileService.getBrowseRoots();
      const isRoot = roots.some((r) => path.resolve(r) === path.resolve(dir));
      jsonResponse(res, 200, {
        items: items.sort((a, b) =>
          a.type === b.type
            ? a.name.localeCompare(b.name)
            : a.type === 'dir'
              ? -1
              : 1
        ),
        path: dir,
        parentPath: isRoot ? null : parentPath,
      });
    } catch (e) {
      logger.error('api', e);
      jsonResponse(res, 500, { error: e.message });
    }
  }, []);
}

module.exports = { registerBrowseRoutes };
