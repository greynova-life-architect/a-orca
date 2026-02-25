# a-orca API

Base URL: `/api` (relative to app origin). All JSON request/response unless noted.

## Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects. Response: `{ projects: [] }` |
| POST | `/api/projects` | Create project. Body: `{ name?, type?, root_path? }`. Response: `{ id }` |
| GET | `/api/projects/:id` | Get project with features, milestones, tasks. Response: `{ project, features, milestones, tasks }` |
| PATCH | `/api/projects/:id` | Update project. Body: `{ name?, type?, summary?, assessment?, root_path? }` |
| DELETE | `/api/projects/:id` | Delete project and related data |
| GET | `/api/projects/:id/folder` | Get folder tree for project root. Response: tree object |
| GET | `/api/projects/:id/file-diff?path=...` | Get file diff (current vs git HEAD). Response: `{ oldText, newText }` |
| GET | `/api/projects/:id/audit?phase=...` | Get prompt audit entries. Response: `{ audit: [] }` |
| GET | `/api/projects/:id/assess/stream` | SSE stream for project assessment |
| POST | `/api/projects/:id/chat` | Project chat. Body: `{ message, selectedTaskIds?, selectedFeatureIds? }`. Response: `{ reply?, orderedTaskIds? }` |
| POST | `/api/projects/:id/reorder` | Reorder tasks. Body: `{ taskIds: [] }` |

## Project sub-resources

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/projects/:id/milestones` | Add milestone. Body: `{ name, description?, sort_order? }`. Response: `{ id }` |
| PATCH | `/api/projects/:id/milestones/:mid` | Update milestone |
| DELETE | `/api/projects/:id/milestones/:mid` | Delete milestone |
| POST | `/api/projects/:id/features` | Add feature. Body: `{ name, description? }`. Response: `{ id }` |
| PATCH | `/api/projects/:id/features/:fid` | Update feature |
| DELETE | `/api/projects/:id/features/:fid` | Remove feature |
| PATCH | `/api/projects/:id/tasks/:tid` | Update task (status, assignee_id, etc.) |
| GET | `/api/projects/:id/tasks/:tid/dependencies` | Get task dependencies. Response: `{ dependencies, dependents, satisfied }` |
| POST | `/api/projects/:id/tasks/:tid/dependencies` | Add dependency. Body: `{ depends_on_task_id }` |
| DELETE | `/api/projects/:id/tasks/:tid/dependencies/:depId` | Remove dependency |

## Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List agents. Response: `{ agents: [] }` |
| POST | `/api/agents` | Create agent. Body: `{ name, system_prompt? }`. Response: `{ id }` |
| GET | `/api/agents/:id` | Get agent. Response: `{ agent }` |
| PATCH | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |

## Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get settings. Response: `{ defaultProjectId?, cursorAgentModel? }` |
| PATCH | `/api/settings` | Update settings. Body: `{ defaultProjectId?, cursorAgentModel? }` |

## Browse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/browse?path=...` | List directory. Empty path returns roots. Response: `{ path, parentPath?, items: [] }` |

## Cursor (agent flows)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cursor/start` | Start cursor session. Body: `{ project_id?, phase?, projectType?, prompt?, questionAnswers?, ... }`. Response: `{ ok?, error? }` |
| GET | `/api/cursor/stream?phase=...&project_id=...&taskId=...` | SSE stream for plan/questions/task/milestone/prioritize |
| POST | `/api/cursor/confirm` | Confirm plan and create tasks. Body: `{ project_id, agentAssignments, milestone_id? }`. Response: `{ ok?, tasks?, error? }` |
| POST | `/api/cursor/confirm-milestones` | Create milestones. Body: `{ project_id, milestones: [] }`. Response: `{ ok?, milestones? }` |

## Errors

Non-2xx responses return JSON `{ error: string }` (and optionally `code`). The client throws `ApiError` with `message`, `status`, and `code`.
