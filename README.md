# a-orca

AI-assisted project management with Cursor CLI integration. Break codebases into features and tasks, run assessments via Cursor agent, and track progress in a simple UI.

## Screenshots

Add `docs/screenshot.png` and include `![a-orca](docs/screenshot.png)` to showcase the UI.

## Features

- Project and feature management with hierarchical tasks
- AI-assisted project assessment via Cursor agent
- Real-time streaming updates (SSE)
- Folder tree browsing for project roots
- SQLite-backed persistence
- REST API for programmatic access

## Tech Stack

- **Backend:** Node.js, better-sqlite3, HTTP with SSE
- **Frontend:** React, Vite, Zustand
- **Integration:** cursor-agent CLI (local), Cursor API (optional)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React UI   │────▶│  Node Server │────▶│ cursor-agent    │
│  (Vite)     │     │  (Express)   │     │ (CLI / API)     │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   SQLite DB  │
                   └──────────────┘
```

## Project Structure

```
a-orca/
├── server.js           # Entry point
├── src/
│   ├── server/         # Backend
│   │   ├── index.js    # HTTP server, routing, SSE
│   │   ├── config/     # Env, constants
│   │   ├── routes/     # Route registry (optional)
│   │   ├── services/   # cursorAgent, extractors, fileService, handoff, prompts
│   │   └── utils/      # logger
│   └── db/             # SQLite (projects, features, tasks, prompt_audit)
├── public/             # Static: index.html, css/, js/
├── db/                 # SQLite DB file
└── tests/              # Unit & integration tests
```

## Prerequisites

- Node.js 16+
- [cursor-agent](https://cursor.com) (for CLI integration) or Cursor API key

## Setup

```bash
npm install
```

Copy `.env.example` to `.env`:

```bash
# Unix / Git Bash
cp .env.example .env

# Windows (PowerShell)
copy .env.example .env
```

Edit `.env` with your `CURSOR_CLI_PATH` (if needed), then:

```bash
npm start
```

Server runs at `http://localhost:3457` (or `PORT` from `.env`).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `3457` |
| `CURSOR_CLI_PATH` | Path to cursor-agent executable or PowerShell wrapper | (auto-detect) |
| `CURSOR_API_KEY` | API key for Cursor agent | (optional) |
| `BROWSE_ROOTS` | Allowed roots for browse/folder picker (path-delimited) | home, workspace |
| `PROJECT_ROOTS` | Same as BROWSE_ROOTS if not set | - |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` |

See `.env.example` for full documentation.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project with features & tasks |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/folder` | Folder tree for project root |
| GET | `/api/projects/:id/assess/stream` | SSE: project assessment |
| POST | `/api/projects/:id/assess` | Trigger assessment (body: phase) |
| GET | `/api/projects/:id/audit` | Prompt audit log |
| POST | `/api/projects/:id/features` | Add feature |
| PATCH | `/api/projects/:id/features/:fid` | Update feature |
| DELETE | `/api/projects/:id/features/:fid` | Remove feature |
| PATCH | `/api/projects/:id/tasks/:taskId` | Update task (status, assignee, etc.) |
| GET | `/api/browse` | Browse roots or directory (query: `path`) |
| POST | `/api/cursor/start` | Start cursor-agent flow |
| GET | `/api/cursor/stream` | SSE: cursor-agent output |
| POST | `/api/cursor/confirm` | Confirm plan / continue flow |

## Scripts

- `npm start` – Start server
- `npm test` – Run tests
- `npm run lint` – ESLint
- `npm run format` – Prettier

## License

MIT License. See [LICENSE](LICENSE) for details.
