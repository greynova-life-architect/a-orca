/**
 * Project, feature, task CRUD and prompt audit.
 * @module db/projects
 */

const { getDb } = require('./index');

/** @returns {string} */
function uuid() {
  return (
    'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

/** @returns {string} */
function milestoneId() {
  return (
    'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function now() {
  return new Date().toISOString();
}

// --- Projects ---

/** @returns {Array} */
function listProjects() {
  const db = getDb();
  return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
}

/** @param {string} id - Project ID. @returns {{ project: object, features: array, milestones: array, tasks: array }|null} */
function getProject(id) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return null;
  const features = db
    .prepare('SELECT * FROM features WHERE project_id = ?')
    .all(id);
  let milestones = [];
  try {
    milestones = db
      .prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
      .all(id);
  } catch (_) {}
  const tasks = db
    .prepare(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC'
    )
    .all(id);
  const dependencies = db
    .prepare(
      `SELECT td.task_id, td.depends_on_task_id
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       WHERE t.project_id = ?`
    )
    .all(id);
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
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description || null,
      sort_order: m.sort_order ?? 0,
      due_date: m.due_date || null,
      created_at: m.created_at || null,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      milestone_id: t.milestone_id || null,
      feature_id: t.feature_id || '_none',
      status: t.status || 'todo',
      sort_order: t.sort_order ?? 0,
      priority: t.priority || null,
      prompt: t.prompt,
      agent_id: t.agent_id,
      assignee_id: t.assignee_id,
      created_at: t.created_at || null,
      updated_at: t.updated_at || null,
    })),
    dependencies: dependencies.map((d) => ({
      task_id: d.task_id,
      depends_on_task_id: d.depends_on_task_id,
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
  if (data.root_path !== undefined) {
    cols.push('root_path = ?');
    vals.push(data.root_path);
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
  vals.push(ts);
  vals.push(id);
  db.prepare(`UPDATE projects SET ${cols.join(', ')} WHERE id = ?`).run(
    ...vals
  );
}

function deleteProject(id) {
  const db = getDb();
  db.prepare(
    `DELETE FROM task_dependencies WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)
     OR depends_on_task_id IN (SELECT id FROM tasks WHERE project_id = ?)`
  ).run(id, id);
  db.prepare('DELETE FROM tasks WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM features WHERE project_id = ?').run(id);
  try {
    db.prepare('DELETE FROM milestones WHERE project_id = ?').run(id);
  } catch (_) {}
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

// --- Milestones ---
function listMilestones(projectId) {
  const db = getDb();
  try {
    return db
      .prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
      .all(projectId);
  } catch (_) {
    return [];
  }
}

function addMilestone(projectId, data) {
  const db = getDb();
  const id = data.id || milestoneId();
  const ts = now();
  db.prepare(
    `INSERT INTO milestones (id, project_id, name, description, sort_order, due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    projectId,
    data.name || 'New milestone',
    data.description || null,
    data.sort_order ?? 0,
    data.due_date || null,
    ts
  );
  return id;
}

function updateMilestone(projectId, milestoneId, data) {
  const db = getDb();
  const cols = [];
  const vals = [];
  if (data.name !== undefined) {
    cols.push('name = ?');
    vals.push(data.name);
  }
  if (data.description !== undefined) {
    cols.push('description = ?');
    vals.push(data.description);
  }
  if (data.sort_order !== undefined) {
    cols.push('sort_order = ?');
    vals.push(data.sort_order);
  }
  if (data.due_date !== undefined) {
    cols.push('due_date = ?');
    vals.push(data.due_date);
  }
  if (cols.length === 0) return;
  vals.push(projectId, milestoneId);
  db.prepare(
    `UPDATE milestones SET ${cols.join(', ')} WHERE project_id = ? AND id = ?`
  ).run(...vals);
}

function deleteMilestone(projectId, milestoneId) {
  const db = getDb();
  db.prepare('UPDATE tasks SET milestone_id = NULL WHERE project_id = ? AND milestone_id = ?').run(projectId, milestoneId);
  db.prepare('DELETE FROM milestones WHERE project_id = ? AND id = ?').run(projectId, milestoneId);
}

// --- Tasks ---
function upsertTasks(projectId, nodes) {
  const db = getDb();
  db.prepare(
    `DELETE FROM task_dependencies WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)
     OR depends_on_task_id IN (SELECT id FROM tasks WHERE project_id = ?)`
  ).run(projectId, projectId);
  const del = db.prepare('DELETE FROM tasks WHERE project_id = ?');
  const ins = db.prepare(
    `INSERT INTO tasks (id, project_id, milestone_id, feature_id, title, description, status, sort_order, priority, prompt, agent_id, assignee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  del.run(projectId);
  const ts = now();
  let ord = 0;
  for (const n of nodes || []) {
    ins.run(
      n.id,
      projectId,
      n.milestone_id || null,
      n.feature_id || '_none',
      n.title || '',
      n.description || '',
      n.status || 'todo',
      n.sort_order ?? ord++,
      n.priority || null,
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
    `INSERT INTO tasks (id, project_id, milestone_id, feature_id, title, description, status, sort_order, priority, prompt, agent_id, assignee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    task.id,
    projectId,
    task.milestone_id || null,
    task.feature_id || '_none',
    task.title || '',
    task.description || '',
    task.status || 'todo',
    task.sort_order ?? 0,
    task.priority || null,
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
  db.prepare(
    'DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_task_id = ?'
  ).run(taskId, taskId);
  db.prepare('DELETE FROM tasks WHERE project_id = ? AND id = ?').run(
    projectId,
    taskId
  );
  syncFeaturesFromTasks(projectId);
}

/** Set task order by array of task ids (index = sort_order). */
function updateTaskOrder(projectId, orderedTaskIds) {
  const db = getDb();
  for (let i = 0; i < orderedTaskIds.length; i++) {
    db.prepare(
      'UPDATE tasks SET sort_order = ? WHERE project_id = ? AND id = ?'
    ).run(i, projectId, orderedTaskIds[i]);
  }
}

function updateTask(projectId, taskId, data) {
  const db = getDb();
  const ts = now();
  const cols = [];
  const vals = [];
  if (data.title !== undefined) {
    cols.push('title = ?');
    vals.push(data.title);
  }
  if (data.description !== undefined) {
    cols.push('description = ?');
    vals.push(data.description);
  }
  if (data.status !== undefined) {
    cols.push('status = ?');
    vals.push(data.status);
  }
  if (data.feature_id !== undefined) {
    cols.push('feature_id = ?');
    vals.push(data.feature_id || '_none');
  }
  if (data.milestone_id !== undefined) {
    cols.push('milestone_id = ?');
    vals.push(data.milestone_id || null);
  }
  if (data.assignee_id !== undefined) {
    cols.push('assignee_id = ?');
    vals.push(data.assignee_id);
  }
  if (data.sort_order !== undefined) {
    cols.push('sort_order = ?');
    vals.push(data.sort_order);
  }
  if (data.priority !== undefined) {
    cols.push('priority = ?');
    vals.push(data.priority);
  }
  if (data.prompt !== undefined) {
    cols.push('prompt = ?');
    vals.push(data.prompt);
  }
  if (data.agent_id !== undefined) {
    cols.push('agent_id = ?');
    vals.push(data.agent_id);
  }
  if (cols.length === 0) return;
  cols.push('updated_at = ?');
  vals.push(ts);
  vals.push(projectId);
  vals.push(taskId);
  db.prepare(
    `UPDATE tasks SET ${cols.join(', ')} WHERE project_id = ? AND id = ?`
  ).run(...vals);
}

// --- Task dependencies ---

/**
 * BFS from `startId` following the "depends on" direction (upstream).
 * Returns true if `targetId` is reachable, meaning adding an edge
 * targetId -> startId would create a cycle.
 */
function wouldCreateCycle(startId, targetId) {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?'
  );
  const visited = new Set();
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift();
    if (current === targetId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const rows = stmt.all(current);
    for (const r of rows) queue.push(r.depends_on_task_id);
  }
  return false;
}

function addTaskDependency(taskId, dependsOnTaskId) {
  if (taskId === dependsOnTaskId) {
    throw new Error('A task cannot depend on itself');
  }
  if (wouldCreateCycle(dependsOnTaskId, taskId)) {
    throw new Error(
      `Adding dependency ${taskId} -> ${dependsOnTaskId} would create a circular dependency`
    );
  }
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, created_at) VALUES (?, ?, ?)'
  ).run(taskId, dependsOnTaskId, now());
}

function removeTaskDependency(taskId, dependsOnTaskId) {
  const db = getDb();
  db.prepare(
    'DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?'
  ).run(taskId, dependsOnTaskId);
}

/** Returns the tasks that `taskId` depends on (upstream). */
function getTaskDependencies(taskId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT t.id, t.title, t.status, t.feature_id, td.created_at AS dep_created_at
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = ?`
    )
    .all(taskId);
}

/** Returns the tasks that depend on `taskId` (downstream). */
function getTaskDependents(taskId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT t.id, t.title, t.status, t.feature_id, td.created_at AS dep_created_at
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       WHERE td.depends_on_task_id = ?`
    )
    .all(taskId);
}

/** True when every upstream dependency of `taskId` has status 'done'. */
function areTaskDependenciesSatisfied(taskId) {
  const db = getDb();
  const unsatisfied = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = ? AND t.status != 'done'`
    )
    .get(taskId);
  return (unsatisfied?.cnt || 0) === 0;
}

/** Returns all dependency edges for tasks within a project. */
function getProjectTaskDependencies(projectId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT td.task_id, td.depends_on_task_id
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       WHERE t.project_id = ?`
    )
    .all(projectId);
}

// --- Prompt audit ---
function logPromptAudit(projectId, phase, promptText, responseText, planJson = null) {
  const db = getDb();
  if (planJson != null) {
    try {
      db.prepare(
        `INSERT INTO prompt_audit (project_id, phase, prompt_text, response_text, plan_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(projectId || null, phase || null, promptText || '', responseText || '', JSON.stringify(planJson), now());
      return;
    } catch (_) {
      /* plan_json column may not exist in older DBs */
    }
  }
  db.prepare(
    `INSERT INTO prompt_audit (project_id, phase, prompt_text, response_text, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(projectId || null, phase || null, promptText || '', responseText || '', now());
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
      plan_json: r.plan_json,
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
  listMilestones,
  addMilestone,
  updateMilestone,
  deleteMilestone,
  addFeature,
  removeFeature,
  updateFeature,
  upsertFeatures,
  upsertTasks,
  addTask,
  removeTask,
  updateTask,
  updateTaskOrder,
  addTaskDependency,
  removeTaskDependency,
  getTaskDependencies,
  getTaskDependents,
  areTaskDependenciesSatisfied,
  getProjectTaskDependencies,
  logPromptAudit,
  getPromptAudit,
  uuid,
};
