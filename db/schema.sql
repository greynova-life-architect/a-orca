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

-- features: refreshed when tasks added/removed (agent or manual)
CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT
);

-- tasks: map nodes
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  feature_id TEXT REFERENCES features(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  prompt TEXT,
  agent_id TEXT,
  assignee_id TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- prompt_audit: every prompt sent + full response
CREATE TABLE IF NOT EXISTS prompt_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(id),
  phase TEXT,
  prompt_text TEXT NOT NULL,
  response_text TEXT,
  created_at TEXT
);
