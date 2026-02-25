/**
 * SQLite database for Project Map.
 * Projects, features, tasks, prompt audit.
 * Uses one local file: DB_PATH from env or default under project root.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Load .env so DB_PATH is available before any server config
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'db', 'project-map.db');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : DEFAULT_DB_PATH;
const DB_DIR = path.dirname(DB_PATH);

let db = null;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  database.exec(schema);
  try {
    database.exec('ALTER TABLE projects ADD COLUMN assessment TEXT');
  } catch (_) {}
  try {
    database.exec('ALTER TABLE prompt_audit ADD COLUMN plan_json TEXT');
  } catch (_) {}
  try {
    database.exec('ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0');
  } catch (_) {}
  try {
    database.exec('ALTER TABLE tasks ADD COLUMN priority TEXT');
  } catch (_) {}
  // Ensure agents table exists for databases created before schema.sql included it
  try {
    database.exec(`CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT,
      created_at TEXT,
      updated_at TEXT
    )`);
  } catch (_) {}
  try {
    database.exec('ALTER TABLE tasks ADD COLUMN agent_id TEXT REFERENCES agents(id)');
  } catch (_) {}
  // Ensure task_dependencies table exists for databases created before schema.sql included it
  try {
    database.exec(`CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id TEXT NOT NULL REFERENCES tasks(id),
      depends_on_task_id TEXT NOT NULL REFERENCES tasks(id),
      created_at TEXT,
      PRIMARY KEY (task_id, depends_on_task_id),
      CHECK (task_id != depends_on_task_id)
    )`);
  } catch (_) {}
  try {
    database.exec(`CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      due_date TEXT,
      created_at TEXT
    )`);
  } catch (_) {}
  try {
    database.exec('ALTER TABLE tasks ADD COLUMN milestone_id TEXT REFERENCES milestones(id)');
  } catch (_) {}
}

/** For tests: reset and use in-memory DB. */
function initForTest() {
  if (db) {
    db.close();
    db = null;
  }
  db = new Database(':memory:');
  initSchema(db);
  return db;
}

module.exports = {
  getDb,
  DB_PATH,
  initForTest,
};
