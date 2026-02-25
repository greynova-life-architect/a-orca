# Agent directory access and permissions

The cursor-agent runs with its working directory set to the **project root** (when available) for task, plan, and questions phases. Paths outside that root are reported as "Blocked" in the activity stream and are not shown as normal file activity.

## Runtime scope (default)

- **cwd:** The server uses the project's `root_path` as the process working directory when starting the agent for task/plan/questions. This scopes the agent to the project folder without relying on prompt instructions.
- **CURSOR_WORKSPACE_ROOT:** Set in the agent's environment to the same path so the CLI uses it as the workspace root.
- **Path validation:** File activity (read, edit, grep, glob, list) is validated against the allowed root. Operations outside that root are emitted as "blocked" so they are visible but not treated as successful activity.

## Strict permission-based restriction

To ensure the agent **cannot** access other directories at the OS level (e.g. outside the project), the process must run with restricted permissions:

- **Option A – Run the server as a restricted user:** Run the Node server (or a dedicated worker that spawns the agent) as an OS user that has read/write access only to the project directory. On Linux, use a dedicated user and set file ownership or ACLs so that user can only access the project path. On Windows, use a limited account or job objects if available.
- **Option B – Container:** Run the agent (or the whole app) inside a container (e.g. Docker) with only the project directory mounted and no access to the host filesystem. The agent process then cannot reach paths outside the mount.

Implementation is environment-specific (Windows vs Linux, Docker vs bare metal). No application code change is required beyond the existing cwd and path validation; use your platform’s user/container setup to enforce strict permissions.
