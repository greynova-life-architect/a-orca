-- projects: root_path is the folder path for attached projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  root_path TEXT,
  summary TEXT,
  assessment TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- milestones: created before tasks; tasks can belong to a milestone
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  due_date TEXT,
  created_at TEXT
);

-- features: refreshed when tasks added/removed (agent or manual)
CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT
);

-- agents: first-class entity for cursor-agent instances
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system_prompt TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- tasks: map nodes (sort_order: lower = higher priority); optionally under a milestone
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  milestone_id TEXT REFERENCES milestones(id),
  feature_id TEXT REFERENCES features(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  sort_order INTEGER DEFAULT 0,
  priority TEXT,
  prompt TEXT,
  agent_id TEXT REFERENCES agents(id),
  assignee_id TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- task_dependencies: DAG edges for sequential execution ordering
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id),
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id),
  created_at TEXT,
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

-- prompt_audit: every prompt sent + full response
-- plan_json: extracted plan object (JSON) for 'plan' phase, enables SQL queries and retry
CREATE TABLE IF NOT EXISTS prompt_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(id),
  phase TEXT,
  prompt_text TEXT NOT NULL,
  response_text TEXT,
  plan_json TEXT,
  created_at TEXT
);
