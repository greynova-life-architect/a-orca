/**
 * SQLite database for Project Map.
 * Projects, features, tasks, prompt audit.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.resolve(__dirname);
const DB_PATH = path.join(DB_DIR, 'project-map.db');

let db = null;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
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
}

module.exports = {
  getDb,
  DB_PATH,
};
