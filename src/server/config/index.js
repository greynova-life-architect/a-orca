/**
 * Centralized configuration for Project Map server.
 * Loads env vars and exports validated config.
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const WORKING_DIR = path.resolve(PROJECT_ROOT, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PUBLIC_DIR_DEFAULT = path.join(PROJECT_ROOT, 'public');
const isDev = process.env.NODE_ENV !== 'production';

/** Prefer built React app (dist/) when it exists so Run button and React UI are visible at port 3457. Otherwise serve public/ (legacy Alpine app). For HMR use http://localhost:5173 */
const PUBLIC_DIR =
  fs.existsSync(DIST_DIR)
    ? DIST_DIR
    : PUBLIC_DIR_DEFAULT;

module.exports = {
  PORT: parseInt(process.env.PORT || '3457', 10),
  CURSOR_CLI_PATH: process.env.CURSOR_CLI_PATH?.trim() || null,
  CURSOR_API_KEY: process.env.CURSOR_API_KEY || null,
  BROWSE_ROOTS: (process.env.BROWSE_ROOTS || process.env.PROJECT_ROOTS || '')
    .split(path.delimiter)
    .map((p) => path.resolve(p.trim()))
    .filter(Boolean),
  PROJECT_ROOTS: (process.env.PROJECT_ROOTS || process.env.BROWSE_ROOTS || '')
    .split(path.delimiter)
    .map((p) => path.resolve(p.trim()))
    .filter(Boolean),
  WORKING_DIR,
  PROJECT_ROOT,
  /** Path to static assets: dist/ if built, else public/ */
  PUBLIC_DIR,
};
