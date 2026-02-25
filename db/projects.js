/**
 * Project, feature, task CRUD and prompt audit.
 */
const { getDb } = require('./index');

function uuid() {
  return (
    'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function now() {
  return new Date().toISOString();
}

// --- Projects ---
function listProjects() {
  const db = getDb();
  return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
}

function getProject(id) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return null;
  const features = db
    .prepare('SELECT * FROM features WHERE project_id = ?')
    .all(id);
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(id);
  return {
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      root_path: project.root_path,
      summary: project.summary,
      assessment: project.assessment,
    },
    features: features.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      feature_id: t.feature_id || '_none',
      status: t.status || 'todo',
      prompt: t.prompt,
      agent_id: t.agent_id,
      assignee_id: t.assignee_id,
    })),
  };
}

function createProject(data) {
  const db = getDb();
  const id = data.id || uuid();
  const ts = now();
  db.prepare(
    `INSERT INTO projects (id, name, type, root_path, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.name || 'Untitled',
    data.type || null,
    data.root_path || null,
    data.summary || null,
    ts,
    ts
  );
  return id;
}

function updateProject(id, data) {
  const db = getDb();
  const ts = now();
  const cols = [];
  const vals = [];
  if (data.name !== undefined) {
    cols.push('name = ?');
    vals.push(data.name);
  }
  if (data.type !== undefined) {
    cols.push('type = ?');
    vals.push(data.type);
  }
  if (data.summary !== undefined) {
    cols.push('summary = ?');
    vals.push(data.summary);
  }
  if (data.assessment !== undefined) {
    cols.push('assessment = ?');
    vals.push(data.assessment);
  }
  if (cols.length === 0) return;
  cols.push('updated_at = ?');
  vals.push(ts, id);
  db.prepare(`UPDATE projects SET ${cols.join(', ')} WHERE id = ?`).run(
    ...vals
  );
}

function deleteProject(id) {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM features WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM prompt_audit WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

// --- Features ---
function addFeature(projectId, feature) {
  const db = getDb();
  const id =
    feature.id ||
    'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ts = now();
  db.prepare(
    'INSERT INTO features (id, project_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(
    id,
    projectId,
    feature.name || 'New feature',
    feature.description || '',
    ts
  );
  return id;
}

function removeFeature(projectId, featureId) {
  const db = getDb();
  db.prepare(
    'UPDATE tasks SET feature_id = ? WHERE project_id = ? AND feature_id = ?'
  ).run('_none', projectId, featureId);
  db.prepare('DELETE FROM features WHERE project_id = ? AND id = ?').run(
    projectId,
    featureId
  );
}

function updateFeature(projectId, featureId, data) {
  const db = getDb();
  db.prepare(
    'UPDATE features SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE project_id = ? AND id = ?'
  ).run(data.name, data.description, projectId, featureId);
}

function upsertFeatures(projectId, features) {
  const db = getDb();
  const del = db.prepare('DELETE FROM features WHERE project_id = ?');
  const ins = db.prepare(
    'INSERT INTO features (id, project_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  del.run(projectId);
  const ts = now();
  for (const f of features || []) {
    ins.run(
      f.id || 'f_' + Date.now(),
      projectId,
      f.name || '',
      f.description || '',
      ts
    );
  }
}

// --- Tasks ---
function upsertTasks(projectId, nodes) {
  const db = getDb();
  const del = db.prepare('DELETE FROM tasks WHERE project_id = ?');
  const ins = db.prepare(
    `INSERT INTO tasks (id, project_id, feature_id, title, description, status, prompt, agent_id, assignee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  del.run(projectId);
  const ts = now();
  for (const n of nodes || []) {
    ins.run(
      n.id,
      projectId,
      n.feature_id || '_none',
      n.title || '',
      n.description || '',
      n.status || 'todo',
      n.prompt || null,
      n.agent_id || null,
      n.assignee_id || null,
      ts,
      ts
    );
  }
  syncFeaturesFromTasks(projectId);
}

function syncFeaturesFromTasks(projectId) {
  const db = getDb();
  const tasks = db
    .prepare('SELECT feature_id FROM tasks WHERE project_id = ?')
    .all(projectId);
  const featureIdsInTasks = [
    ...new Set(
      (tasks || [])
        .map((t) => t.feature_id)
        .filter((id) => id && id !== '_none')
    ),
  ];
  const existing = db
    .prepare('SELECT id FROM features WHERE project_id = ?')
    .all(projectId);
  const existingIds = new Set((existing || []).map((f) => f.id));
  const ts = now();
  const ins = db.prepare(
    'INSERT INTO features (id, project_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  for (const fid of featureIdsInTasks) {
    if (!existingIds.has(fid)) {
      ins.run(fid, projectId, fid.replace(/^f/, 'Feature '), '', ts);
      existingIds.add(fid);
    }
  }
  const usedIds = new Set(featureIdsInTasks);
  for (const f of existing || []) {
    if (!usedIds.has(f.id)) {
      db.prepare('DELETE FROM features WHERE project_id = ? AND id = ?').run(
        projectId,
        f.id
      );
    }
  }
}

function addTask(projectId, task) {
  const db = getDb();
  const ts = now();
  db.prepare(
    `INSERT INTO tasks (id, project_id, feature_id, title, description, status, prompt, agent_id, assignee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    task.id,
    projectId,
    task.feature_id || '_none',
    task.title || '',
    task.description || '',
    task.status || 'todo',
    task.prompt || null,
    task.agent_id || null,
    task.assignee_id || null,
    ts,
    ts
  );
  syncFeaturesFromTasks(projectId);
}

function removeTask(projectId, taskId) {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE project_id = ? AND id = ?').run(
    projectId,
    taskId
  );
  syncFeaturesFromTasks(projectId);
}

// --- Prompt audit ---
function logPromptAudit(projectId, phase, promptText, responseText) {
  const db = getDb();
  db.prepare(
    `INSERT INTO prompt_audit (project_id, phase, prompt_text, response_text, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(
    projectId || null,
    phase || null,
    promptText || '',
    responseText || '',
    now()
  );
}

function getPromptAudit(projectId, phase) {
  const db = getDb();
  const stmt = phase
    ? db.prepare(
        'SELECT * FROM prompt_audit WHERE project_id = ? AND phase = ? ORDER BY created_at DESC'
      )
    : db.prepare(
        'SELECT * FROM prompt_audit WHERE project_id = ? ORDER BY created_at DESC'
      );
  return (phase ? stmt.all(projectId, phase) : stmt.all(projectId)).map(
    (r) => ({
      id: r.id,
      phase: r.phase,
      prompt_text: r.prompt_text,
      response_text: r.response_text,
      created_at: r.created_at,
    })
  );
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addFeature,
  removeFeature,
  updateFeature,
  upsertFeatures,
  upsertTasks,
  addTask,
  removeTask,
  logPromptAudit,
  getPromptAudit,
  uuid,
};
