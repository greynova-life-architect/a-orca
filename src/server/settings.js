/**
 * App settings (e.g. cursor agent model) stored in a JSON file.
 * Fallback: env CURSOR_AGENT_MODEL, then default "Auto".
 */
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SETTINGS_DIR = path.join(PROJECT_ROOT, 'data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

const DEFAULT_CURSOR_AGENT_MODEL = 'Auto';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadRaw() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    // invalid JSON or read error
  }
  return {};
}

/**
 * Returns the effective cursor agent model: file → env → "Auto".
 */
function getCursorAgentModel() {
  const fromFile = loadRaw().cursorAgentModel;
  if (fromFile != null && String(fromFile).trim() !== '') {
    return String(fromFile).trim();
  }
  const fromEnv = process.env.CURSOR_AGENT_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_CURSOR_AGENT_MODEL;
}

/**
 * Updates settings (merge with existing). Writes to data/settings.json.
 */
function updateSettings(patch) {
  const current = loadRaw();
  const next = { ...current, ...patch };
  ensureDir(SETTINGS_DIR);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/**
 * Returns full settings object for API (e.g. GET /api/settings).
 */
function getSettings() {
  const raw = loadRaw();
  return {
    cursorAgentModel: getCursorAgentModel(),
    defaultProjectId: raw.defaultProjectId ?? '',
    ...raw,
  };
}

module.exports = {
  getCursorAgentModel,
  getSettings,
  updateSettings,
  SETTINGS_FILE,
};
