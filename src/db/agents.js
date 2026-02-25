/**
 * Agent CRUD operations.
 * @module db/agents
 */

const { getDb } = require('./index');

function uid() {
  return (
    'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function now() {
  return new Date().toISOString();
}

function listAgents() {
  const db = getDb();
  return db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
}

function getAgent(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) || null;
}

function createAgent(data) {
  if (!data.name || !data.name.trim()) {
    throw new Error('Agent name is required');
  }
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM agents WHERE name = ?')
    .get(data.name.trim());
  if (existing) {
    throw new Error(`Agent name "${data.name.trim()}" is already in use`);
  }
  const id = data.id || uid();
  const ts = now();
  db.prepare(
    'INSERT INTO agents (id, name, system_prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, data.name.trim(), data.system_prompt || null, ts, ts);
  return id;
}

function updateAgent(id, data) {
  const db = getDb();
  const ts = now();
  const cols = [];
  const vals = [];
  if (data.name !== undefined) {
    if (!data.name || !data.name.trim()) {
      throw new Error('Agent name is required');
    }
    const dup = db
      .prepare('SELECT id FROM agents WHERE name = ? AND id != ?')
      .get(data.name.trim(), id);
    if (dup) {
      throw new Error(`Agent name "${data.name.trim()}" is already in use`);
    }
    cols.push('name = ?');
    vals.push(data.name.trim());
  }
  if (data.system_prompt !== undefined) {
    cols.push('system_prompt = ?');
    vals.push(data.system_prompt);
  }
  if (cols.length === 0) return;
  cols.push('updated_at = ?');
  vals.push(ts);
  vals.push(id);
  db.prepare(`UPDATE agents SET ${cols.join(', ')} WHERE id = ?`).run(...vals);
}

function deleteAgent(id) {
  const db = getDb();
  db.prepare('UPDATE tasks SET agent_id = NULL WHERE agent_id = ?').run(id);
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
}

module.exports = {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
};
