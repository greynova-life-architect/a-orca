/**
 * File system operations: browse roots, folder tree scan.
 * @module services/fileService
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const EXCLUDE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
]);
const MAX_DEPTH = 4;
const MAX_NODES = 500;

function createFileService(config) {
  function getBrowseRoots() {
    const configRoots = config.BROWSE_ROOTS?.length
      ? config.BROWSE_ROOTS
      : config.PROJECT_ROOTS;
    if (configRoots?.length) {
      return configRoots.filter(
        (p) => fs.existsSync(p) && fs.statSync(p).isDirectory()
      );
    }
    const home = os.homedir();
    const homeRoot = path.parse(home).root;
    const roots = [homeRoot];
    if (home !== homeRoot) roots.push(home);
    roots.push(config.WORKING_DIR);
    return roots.filter(
      (p) => fs.existsSync(p) && fs.statSync(p).isDirectory()
    );
  }

  function scanDir(dirPath, rootPath, depth = 0, nodeCount = { n: 0 }) {
    if (depth > MAX_DEPTH || nodeCount.n >= MAX_NODES) return undefined;
    const name = path.basename(dirPath);
    if (EXCLUDE.has(name) || name.startsWith('.')) return undefined;
    try {
      const stat = fs.statSync(dirPath);
      const rel = path.relative(rootPath, dirPath) || '.';
      const node = {
        name,
        path: rel,
        type: stat.isDirectory() ? 'dir' : 'file',
      };
      if (stat.isDirectory()) {
        nodeCount.n++;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const children = [];
        for (const e of entries) {
          if (nodeCount.n >= MAX_NODES) break;
          if (EXCLUDE.has(e.name) || e.name.startsWith('.')) continue;
          const full = path.join(dirPath, e.name);
          const child = e.isDirectory()
            ? scanDir(full, rootPath, depth + 1, nodeCount)
            : {
                name: e.name,
                path: path.relative(rootPath, full),
                type: 'file',
              };
          if (child) {
            nodeCount.n++;
            children.push(child);
          }
        }
        if (children.length) {
          node.children = children.sort((a, b) =>
            a.type === b.type
              ? a.name.localeCompare(b.name)
              : a.type === 'dir'
                ? -1
                : 1
          );
        } else {
          node.children = [];
        }
      }
      return node;
    } catch (_) {
      return undefined;
    }
  }

  function buildFolderTree(rootPath) {
    const resolved = path.resolve(rootPath);
    const tree = scanDir(resolved, resolved) || {
      name: path.basename(resolved),
      path: '.',
      type: 'dir',
      children: [],
    };
    return tree;
  }

  function listDirectory(targetPath, basePaths) {
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
      return null;
    }
    const allowed =
      !basePaths?.length ||
      basePaths.some(
        (bp) => targetPath === bp || targetPath.startsWith(bp + path.sep)
      );
    if (!allowed) return null;
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => {
        const full = path.join(targetPath, e.name);
        return {
          name: e.name,
          path: full,
          type: e.isDirectory() ? 'dir' : 'file',
        };
      })
      .sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === 'dir'
            ? -1
            : 1
      );
  }

  function resolveBrowsePath(requestedPath) {
    const roots = getBrowseRoots();
    if (!requestedPath) return roots[0];
    const base = path.resolve(requestedPath);
    for (const r of roots) {
      const resolved = path.resolve(r);
      if (base === resolved || base.startsWith(resolved + path.sep)) {
        return base;
      }
    }
    return roots[0];
  }

  return {
    getBrowseRoots,
    buildFolderTree,
    listDirectory,
    resolveBrowsePath,
  };
}

module.exports = { createFileService };
