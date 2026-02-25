/**
 * Project Map server - HTTP server with cursor-agent integration.
 * Exports createServer() returning http.Server.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const config = require('./config');
const settings = require('./settings');
const logger = require('./utils/logger');
const dbProjects = require('../db/projects');
const dbAgents = require('../db/agents');
const { createHandoff } = require('./services/handoff');
const { createPrompts, buildAssessmentContext } = require('./services/prompts');
const { createFileService } = require('./services/fileService');
const extractors = require('./services/extractors');
const { spawnCursorAgent } = require('./services/cursorAgent');

const handoff = createHandoff(config);
const prompts = createPrompts(handoff);
const fileService = createFileService(config);
const { Router } = require('./router');
const { registerRoutes } = require('./routes');

// --- Cursor CLI: sync check (uses config only for quick validation) ---
function checkCursorCliAvailableSync() {
  const envPath = config.CURSOR_CLI_PATH;
  return !!(envPath && fs.existsSync(path.resolve(envPath)));
}

// --- In-memory cursor session (project_id -> context for stream) ---
const cursorSessions = new Map();
const lastCursorSessionRef = { current: null };

// Prompts and extractors from services

// --- SSE helpers ---
function sendSSE(res, event, data) {
  try {
    if (res.writableEnded) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  } catch (e) {
    logger.warn('api', 'SSE write failed', event, e.message);
  }
}

// Browse and folder tree from fileService

// --- Parse URL and route ---
function parseUrl(url) {
  const [pathname, qs] = url.split('?');
  const query = {};
  if (qs) {
    for (const p of qs.split('&')) {
      const [k, v] = p.split('=');
      if (k && v) query[k] = decodeURIComponent(v);
    }
  }
  return { pathname: pathname || '/', query };
}

function jsonResponse(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const DEFAULT_MILESTONE_USER_PROMPT =
  'Describe how you want to break this project into phases, releases, or sprints — e.g. by quarter, by release version, by feature area, or by sprint. The assistant will ask a few questions, then propose milestones you can confirm.';

const DEFAULT_PLANNING_USER_PROMPT =
  'The user wants to plan and create tasks for this project. Proceed with clarifying questions or plan generation based on context.';

function normalizeMilestonePrompt(raw) {
  const s = (raw || '').trim();
  if (!s || s === '-' || s.length < 10) return DEFAULT_MILESTONE_USER_PROMPT;
  return s;
}

function normalizePlanningPrompt(raw) {
  const s = (raw || '').trim();
  if (!s || s === '-' || s.length < 10) return DEFAULT_PLANNING_USER_PROMPT;
  return s;
}

function createServer() {
  const router = new Router();
  const ctx = {
    jsonResponse,
    sendSSE,
    logger,
    config,
    settings, 
    dbProjects,
    dbAgents,
    fileService,
    handoff,
    prompts,
    buildAssessmentContext,
    extractors,
    path,
    fs,
    os,
    spawn,
    spawnSync,
    checkCursorCliAvailableSync,
    cursorSessions,
    lastCursorSessionRef,
  };
  registerRoutes(router, ctx);

  const server = http.createServer(async (req, res) => {
    const { pathname, query } = parseUrl(req.url || '/');

    // --- CORS ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, OPTIONS, DELETE'
    );
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    logger.info('http', req.method, req.url || pathname);

    // --- Router dispatch ---
    const match = router.match(req.method, pathname);
    if (match) {
      match.handler(req, res, match.params, query);
      return;
    }

    // --- API: projects ---
    if (pathname === '/api/projects' && req.method === 'GET') {
      try {
        const projects = dbProjects.listProjects();
        jsonResponse(res, 200, { projects });
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    if (pathname === '/api/projects' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const id = dbProjects.createProject(data);
          jsonResponse(res, 200, { id });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    const projMatch = pathname.match(/^\/api\/projects\/([^/]+)\/?$/);
    if (projMatch && req.method === 'GET') {
      const id = decodeURIComponent(projMatch[1]);
      try {
        const data = dbProjects.getProject(id);
        if (!data) {
          jsonResponse(res, 404, { error: 'Not found' });
          return;
        }
        jsonResponse(res, 200, data);
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    if (projMatch && req.method === 'PATCH') {
      const id = decodeURIComponent(projMatch[1]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          dbProjects.updateProject(id, data);
          jsonResponse(res, 200, { ok: true });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    if (projMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(projMatch[1]);
      try {
        dbProjects.deleteProject(id);
        cursorSessions.delete(id);
        jsonResponse(res, 200, { ok: true });
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    // --- API: project folder tree ---
    const folderMatch = pathname.match(/^\/api\/projects\/([^/]+)\/folder\/?$/);
    if (folderMatch && req.method === 'GET') {
      const id = decodeURIComponent(folderMatch[1]);
      try {
        const proj = dbProjects.getProject(id);
        if (!proj || !proj.project?.root_path) {
          jsonResponse(res, 200, { error: 'No root path' });
          return;
        }
        const rootPath = path.resolve(proj.project.root_path);
        const tree = fileService.buildFolderTree(rootPath) || {
          name: path.basename(rootPath),
          path: '.',
          type: 'dir',
          children: [],
        };
        jsonResponse(res, 200, tree);
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    // --- API: file diff (current file + optional git HEAD for "before") ---
    const fileDiffMatch = pathname.match(/^\/api\/projects\/([^/]+)\/file-diff\/?$/);
    if (fileDiffMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(fileDiffMatch[1]);
      const filePath = (query.path || '').trim();
      try {
        const proj = dbProjects.getProject(projectId);
        if (!proj || !proj.project?.root_path) {
          jsonResponse(res, 404, { error: 'Project or root path not found' });
          return;
        }
        const rootPath = path.resolve(proj.project.root_path);
        if (!filePath) {
          jsonResponse(res, 400, { error: 'path query is required' });
          return;
        }
        const resolved = path.resolve(rootPath, filePath);
        const rel = path.relative(rootPath, resolved);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          jsonResponse(res, 400, { error: 'Path must be inside project root' });
          return;
        }
        let newText = null;
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          newText = fs.readFileSync(resolved, 'utf8');
        }
        let oldText = null;
        const gitDir = path.join(rootPath, '.git');
        if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
          const gitPath = rel.replace(/\\/g, '/');
          const result = spawnSync('git', ['show', 'HEAD:' + gitPath], {
            cwd: rootPath,
            encoding: 'utf8',
            maxBuffer: 5 * 1024 * 1024,
          });
          if (result.status === 0 && result.stdout) oldText = result.stdout;
        }
        jsonResponse(res, 200, { oldText: oldText ?? '', newText: newText ?? '' });
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    // --- API: assess stream (SSE) ---
    const assessMatch = pathname.match(
      /^\/api\/projects\/([^/]+)\/assess\/stream\/?$/
    );
    if (assessMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(assessMatch[1]);
      const proj = dbProjects.getProject(projectId);
      if (!proj || !proj.project?.root_path) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        });
        sendSSE(res, 'done', { error: 'No project root path' });
        res.end();
        return;
      }
      const rootPath = proj.project.root_path;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      });
      sendSSE(res, 'folder', { rootPath });

      const ASSESS_EXCLUDE = new Set([
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        'coverage',
        '__pycache__',
        '.venv',
        'venv',
      ]);
      const KEY_FILES = new Set([
        'package.json',
        'package-lock.json',
        'tsconfig.json',
        'vite.config.js',
        'webpack.config.js',
        'requirements.txt',
        'Cargo.toml',
        'go.mod',
        'README.md',
        'server.js',
        'index.js',
        'main.js',
        'app.js',
      ]);
      const resolvedRoot = path.resolve(rootPath);

      sendSSE(res, 'step', {
        step: 1,
        total: 4,
        label: 'Discovering folders and files',
        message: 'Scanning project structure...',
      });

      const emitItem = (action, fullPath, depth) => {
        const rel = path.relative(resolvedRoot, fullPath) || path.basename(fullPath);
        sendSSE(res, 'fileActivity', {
          action,
          path: fullPath,
          label: rel,
          step: 1,
        });
      };

      const walkStructure = (dir, depth = 0) => {
        if (depth > 2) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
              if (!e.name.startsWith('.') && !ASSESS_EXCLUDE.has(e.name)) {
                emitItem('dir', full, depth);
                walkStructure(full, depth + 1);
              }
            } else if (depth <= 1 && KEY_FILES.has(e.name)) {
              emitItem('file', full, depth);
            }
          }
        } catch (_) {}
      };

      walkStructure(rootPath);

      sendSSE(res, 'step', {
        step: 2,
        total: 4,
        label: 'Structure mapped',
        message: 'Preparing prompt for cursor-agent...',
      });

      sendSSE(res, 'status', {
        message: 'Step 2/4: Structure mapped. Preparing agent...',
        rootPath,
      });

      // Ensure .cursorignore at root so cursor-agent excludes node_modules entirely (no read access)
      const cursorignorePath = path.join(resolvedRoot, '.cursorignore');
      const CURSORIGNORE_BLOCK = `
# Project Map: exclude from AI indexing and read (node_modules never read)
node_modules/
.git/
dist/
build/
.next/
coverage/
__pycache__/
.venv/
venv/
`.trim();
      try {
        if (fs.existsSync(cursorignorePath)) {
          const existing = fs.readFileSync(cursorignorePath, 'utf8');
          if (!existing.includes('node_modules')) {
            fs.appendFileSync(cursorignorePath, `\n\n${CURSORIGNORE_BLOCK}\n`);
          }
        } else {
          fs.writeFileSync(cursorignorePath, CURSORIGNORE_BLOCK + '\n', 'utf8');
        }
      } catch (_) {
        logger.warn('api', 'Could not ensure .cursorignore at ' + resolvedRoot);
      }

      if (checkCursorCliAvailableSync()) {
        const agentPath = config.CURSOR_CLI_PATH;
        const stamp = Date.now();
        const promptFile = path.resolve(os.tmpdir(), `pm-assess-${stamp}.txt`);
        const wrapperFile = path.resolve(
          os.tmpdir(),
          `pm-assess-run-${stamp}.ps1`
        );
        const prompt = prompts.buildAssessPrompt(rootPath);
        fs.writeFileSync(promptFile, prompt, 'utf8');
        sendSSE(res, 'step', {
          step: 3,
          total: 4,
          label: 'Sending prompt',
          message: 'Prompt sent. Starting cursor-agent...',
        });
        sendSSE(res, 'prompt', { prompt });
        const cursorModel = settings.getCursorAgentModel();
        const wrapperContent = `param([string]$PromptFile,[string]$AgentPath,[string]$Model)
$env:NO_OPEN_BROWSER = '1'
Get-Content -Raw -LiteralPath $PromptFile -Encoding UTF8 | & $AgentPath -p - -f --trust --mode ask --model $Model --output-format stream-json --stream-partial-output`;
        fs.writeFileSync(wrapperFile, wrapperContent, 'utf8');

        const child = spawn(
          'powershell',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            wrapperFile,
            '-PromptFile',
            promptFile,
            '-AgentPath',
            agentPath,
            '-Model',
            cursorModel,
          ],
          {
            cwd: config.WORKING_DIR,
            env: {
              ...process.env,
              NO_OPEN_BROWSER: '1',
              CURSOR_API_KEY: config.CURSOR_API_KEY || '',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );

        sendSSE(res, 'step', {
          step: 4,
          total: 4,
          label: 'Agent analyzing',
          message: 'cursor-agent is exploring structure and producing assessment...',
        });
        sendSSE(res, 'status', {
          message: 'Step 4/4: Agent analyzing. Watch the Thinking block below.',
          rootPath,
        });

        let fullOutput = '';
        child.stdout.on('data', (d) => {
          const s = d.toString();
          fullOutput += s;
          const lines = s.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              const text = obj.text || obj.content || '';
              if (text && (obj.type === 'thinking' || obj.type === 'text')) {
                sendSSE(res, 'output', { text, type: 'thinking' });
              }
              if (obj.type === 'assistant' && obj.message?.content) {
                for (const c of obj.message.content || []) {
                  if (c?.text) {
                    sendSSE(res, 'output', { text: c.text, type: 'thinking' });
                  }
                }
              }
              const tc = obj.tool_call || obj.toolCall;
              if (obj.type === 'tool_call' && obj.subtype === 'started' && tc) {
                let act = null;
                if (tc.readToolCall?.args) {
                  const p = tc.readToolCall.args.path || '';
                  const o = tc.readToolCall.args.offset;
                  const lim = tc.readToolCall.args.limit;
                  let lineInfo = '';
                  if (o != null && lim != null) {
                    lineInfo = ` (lines ${o + 1}-${o + lim})`;
                  } else if (o != null) {
                    lineInfo = ` (from line ${o + 1})`;
                  }
                  act = { action: 'read', path: p, lineInfo, label: `📄 Reading ${p}${lineInfo}` };
                } else if (tc.lsToolCall?.args) {
                  const p = tc.lsToolCall.args.path || '';
                  act = { action: 'list', path: p, label: `📁 Listing ${p || '.'}` };
                } else if (tc.grepToolCall?.args) {
                  const p = tc.grepToolCall.args.path || '';
                  const pat = tc.grepToolCall.args.pattern || '';
                  act = { action: 'grep', path: p, pattern: pat, label: `🔍 Grep in ${p || '.'}` };
                } else if (tc.globToolCall?.args) {
                  const dir = tc.globToolCall.args.targetDirectory || '';
                  const glob = tc.globToolCall.args.globPattern || '';
                  act = { action: 'glob', path: dir, pattern: glob, label: `📂 Glob ${glob} in ${dir || '.'}` };
                } else if (tc.editToolCall?.args) {
                  const p = tc.editToolCall.args.path || '';
                  act = { action: 'edit', path: p, label: `✏️ Editing ${p}` };
                }
                if (act) sendSSE(res, 'agentActivity', act);
              }
            } catch (_) {}
          }
        });
        child.stderr.on('data', (d) => {
          const t = d.toString().trim();
          if (t) sendSSE(res, 'output', { text: t, type: 'stderr' });
        });
        child.on('close', (code) => {
          try {
            fs.unlinkSync(promptFile);
          } catch (_) {}
          try {
            fs.unlinkSync(wrapperFile);
          } catch (_) {}
          const extracted = extractors.extractAssessmentFromOutput(
            fullOutput || ''
          );
          if (extracted.features?.length)
            dbProjects.upsertFeatures(projectId, extracted.features);
          const formattedAssessment = extractors.formatAssessmentForDisplay(
            extracted
          );
          dbProjects.updateProject(projectId, {
            summary: extracted.description,
            assessment:
              formattedAssessment || extracted.assessment || extracted.description,
          });
          sendSSE(
            res,
            'done',
            code !== 0 ? { error: `cursor-agent exit ${code}` } : {}
          );
          res.end();
        });
      } else {
        const defaultAssessment = `Project at ${rootPath}. Files scanned. cursor-agent not configured for full assessment.`;
        dbProjects.updateProject(projectId, { assessment: defaultAssessment });
        sendSSE(res, 'done', {});
        res.end();
      }
      return;
    }

    // --- API: audit ---
    const auditMatch = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/?$/);
    if (auditMatch && req.method === 'GET') {
      const id = decodeURIComponent(auditMatch[1]);
      const phase = query.phase;
      try {
        const audit = dbProjects.getPromptAudit(id, phase);
        jsonResponse(res, 200, { audit });
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    // --- API: milestones ---
    const milestonesListMatch = pathname.match(
      /^\/api\/projects\/([^/]+)\/milestones\/?$/
    );
    const milestoneIdMatch = pathname.match(
      /^\/api\/projects\/([^/]+)\/milestones\/([^/]+)\/?$/
    );
    if (milestonesListMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(milestonesListMatch[1]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const id = dbProjects.addMilestone(projectId, data);
          jsonResponse(res, 200, { id });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }
    if (milestoneIdMatch && req.method === 'PATCH') {
      const projectId = decodeURIComponent(milestoneIdMatch[1]);
      const milestoneId = decodeURIComponent(milestoneIdMatch[2]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          dbProjects.updateMilestone(projectId, milestoneId, data);
          jsonResponse(res, 200, { ok: true });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }
    if (milestoneIdMatch && req.method === 'DELETE') {
      const projectId = decodeURIComponent(milestoneIdMatch[1]);
      const milestoneId = decodeURIComponent(milestoneIdMatch[2]);
      try {
        dbProjects.deleteMilestone(projectId, milestoneId);
        jsonResponse(res, 200, { ok: true });
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    // --- API: features ---
    const featListMatch = pathname.match(
      /^\/api\/projects\/([^/]+)\/features\/?$/
    );
    if (featListMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(featListMatch[1]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const id = dbProjects.addFeature(projectId, data);
          jsonResponse(res, 200, { id });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    // --- API: PATCH task (status, assignee_id, etc.) ---
    const taskPatchMatch = pathname.match(
      /^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/?$/
    );
    if (taskPatchMatch && req.method === 'PATCH') {
      const projectId = decodeURIComponent(taskPatchMatch[1]);
      const taskId = decodeURIComponent(taskPatchMatch[2]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          dbProjects.updateTask(projectId, taskId, data);
          jsonResponse(res, 200, { ok: true });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    // --- API: task dependencies ---
    const taskDepsMatch = pathname.match(
      /^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/dependencies\/?$/
    );
    if (taskDepsMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(taskDepsMatch[1]);
      const taskId = decodeURIComponent(taskDepsMatch[2]);
      try {
        const deps = dbProjects.getTaskDependencies(taskId);
        const dependents = dbProjects.getTaskDependents(taskId);
        const satisfied = dbProjects.areTaskDependenciesSatisfied(taskId);
        jsonResponse(res, 200, { dependencies: deps, dependents, satisfied });
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    if (taskDepsMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(taskDepsMatch[1]);
      const taskId = decodeURIComponent(taskDepsMatch[2]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const dependsOn = data.depends_on_task_id;
          if (!dependsOn) {
            jsonResponse(res, 400, { error: 'depends_on_task_id required' });
            return;
          }
          dbProjects.addTaskDependency(taskId, dependsOn);
          jsonResponse(res, 200, { ok: true });
        } catch (e) {
          logger.error('api', e);
          const status = e.message.includes('circular') || e.message.includes('itself') ? 409 : 500;
          jsonResponse(res, status, { error: e.message });
        }
      });
      return;
    }

    if (taskDepsMatch && req.method === 'DELETE') {
      const projectId = decodeURIComponent(taskDepsMatch[1]);
      const taskId = decodeURIComponent(taskDepsMatch[2]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const dependsOn = data.depends_on_task_id;
          if (!dependsOn) {
            jsonResponse(res, 400, { error: 'depends_on_task_id required' });
            return;
          }
          dbProjects.removeTaskDependency(taskId, dependsOn);
          jsonResponse(res, 200, { ok: true });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    const taskDepItemMatch = pathname.match(
      /^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/dependencies\/([^/]+)\/?$/
    );
    if (taskDepItemMatch && req.method === 'DELETE') {
      const taskId = decodeURIComponent(taskDepItemMatch[2]);
      const dependsOn = decodeURIComponent(taskDepItemMatch[3]);
      try {
        dbProjects.removeTaskDependency(taskId, dependsOn);
        jsonResponse(res, 200, { ok: true });
      } catch (e) {
        logger.error('api', e);
        jsonResponse(res, 500, { error: e.message });
      }
      return;
    }

    const featMatch = pathname.match(
      /^\/api\/projects\/([^/]+)\/features\/([^/]+)\/?$/
    );
    if (featMatch) {
      const projectId = decodeURIComponent(featMatch[1]);
      const featureId = decodeURIComponent(featMatch[2]);
      if (req.method === 'PATCH') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            dbProjects.updateFeature(projectId, featureId, data);
            jsonResponse(res, 200, { ok: true });
          } catch (e) {
            logger.error('api', e);
            jsonResponse(res, 500, { error: e.message });
          }
        });
        return;
      }
      if (req.method === 'DELETE') {
        try {
          dbProjects.removeFeature(projectId, featureId);
          jsonResponse(res, 200, { ok: true });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
        return;
      }
    }

    // --- API: POST projects/:id/chat (project chat / prioritization) ---
    const chatMatch = pathname.match(/^\/api\/projects\/([^/]+)\/chat\/?$/);
    if (chatMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(chatMatch[1]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let data = {};
        try {
          data = body ? JSON.parse(body) : {};
        } catch (_) {
          jsonResponse(res, 400, { error: 'Invalid JSON body' });
          return;
        }
        try {
          const message = (data.message || '').trim();
          const selectedTaskIds = data.selectedTaskIds || [];
          const selectedFeatureIds = data.selectedFeatureIds || [];
          const proj = dbProjects.getProject(projectId);
          if (!proj) {
            jsonResponse(res, 404, { error: 'Project not found' });
            return;
          }
          const tasks = proj.tasks || [];
          const features = proj.features || [];
          const selectedTasks = tasks.filter((t) => selectedTaskIds.includes(t.id));
          const selectedFeatures = features.filter((f) => selectedFeatureIds.includes(f.id));
          const contextTasks = selectedTasks.length ? selectedTasks : tasks;
          const isPrioritizeRequest =
            /prioritiz|prioritis|order|reorder|suggest.*order|how.*priorit/i.test(message) ||
            /how should i prioritize/i.test(message);

          // Heuristic ordering: priority first (high > medium > low > null), then dependency-like, then status, then existing order
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const depKeywords = /\b(setup|schema|database|core|base|config|api|auth|infra|foundation)\b/i;
          const orderedTasks = [...contextTasks].sort((a, b) => {
            const aPri = priorityOrder[a.priority] ?? 3;
            const bPri = priorityOrder[b.priority] ?? 3;
            if (aPri !== bPri) return aPri - bPri;
            const aText = ((a.title || '') + ' ' + (a.description || '')).toLowerCase();
            const bText = ((b.title || '') + ' ' + (b.description || '')).toLowerCase();
            const aDep = depKeywords.test(aText) ? 0 : 1;
            const bDep = depKeywords.test(bText) ? 0 : 1;
            if (aDep !== bDep) return aDep - bDep;
            const statusOrder = { todo: 0, ready_for_agent: 1, in_progress: 2, in_review: 3, done: 4 };
            const aStatus = statusOrder[a.status] ?? 5;
            const bStatus = statusOrder[b.status] ?? 5;
            if (aStatus !== bStatus) return aStatus - bStatus;
            return (a.sort_order ?? 999) - (b.sort_order ?? 999);
          });
          const orderedTaskIds = orderedTasks.map((t) => t.id);

          const contextStr = orderedTasks
            .map(
              (t, i) =>
                `${i + 1}. [${t.id}] ${t.title}${t.description ? ': ' + t.description.slice(0, 80) : ''} (${t.status})`
            )
            .join('\n');
          const featureStr =
            (selectedFeatures.length ? selectedFeatures : features)
              .map((f) => `- ${f.name}: ${f.description || ''}`)
              .join('\n') || '(none)';

          let reply;
          if (isPrioritizeRequest && contextTasks.length > 0) {
            reply = `**Prioritized order for "${proj.project?.name || 'Project'}"** (${contextTasks.length} tasks)

**Suggested order (dependency-heavy and todo tasks first):**
${contextStr}

Click **Apply order** below to save this order. You can also ask to discuss specific tasks or adjust the sequence.`;
          } else {
            reply = `**Prioritization guidance for "${proj.project?.name || 'Project'}"**

**Tasks in scope (${contextTasks.length}):**
${contextStr}

**Features:** ${featureStr}

**Suggested approach:**
1. **Dependencies first** — Identify tasks that unblock others (e.g. schema, core APIs) and prioritize those.
2. **Business value** — Order by user impact and revenue/usage potential.
3. **Effort vs. value** — Quick wins (high value, low effort) are good early candidates.
4. **Risk mitigation** — Address uncertain or risky items earlier to reduce rework.

Ask follow-up questions to refine the order.`;
          }

          jsonResponse(res, 200, {
            reply,
            orderedTaskIds: isPrioritizeRequest && contextTasks.length > 0 ? orderedTaskIds : undefined,
          });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: String(e.message || e) });
        }
      });
      req.on('error', () => {
        try {
          jsonResponse(res, 500, { error: 'Request error' });
        } catch (_) {}
      });
      return;
    }

    // --- API: POST projects/:id/reorder (prioritize tasks) ---
    const reorderMatch = pathname.match(/^\/api\/projects\/([^/]+)\/reorder\/?$/);
    if (reorderMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(reorderMatch[1]);
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const taskIds = data.taskIds || data.task_ids || [];
          if (!Array.isArray(taskIds) || taskIds.length === 0) {
            jsonResponse(res, 400, { error: 'taskIds array required' });
            return;
          }
          dbProjects.updateTaskOrder(projectId, taskIds);
          jsonResponse(res, 200, { ok: true });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    // --- API: cursor/start ---
    if (pathname === '/api/cursor/start' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const projectId = data.project_id || 'default';
          if (!checkCursorCliAvailableSync()) {
            jsonResponse(res, 200, {
              error: 'cursor-agent not configured. Set CURSOR_CLI_PATH.',
            });
            return;
          }
          // Coerce to string (React/fetch can send primitives); avoid shell/format issues
          const rawPrompt = String(data.prompt != null ? data.prompt : '').trim();
          if (rawPrompt === '-' || rawPrompt.length < 10) {
            logger.warn('api', 'cursor/start received weak prompt', 'len=', rawPrompt.length, 'preview=', JSON.stringify(rawPrompt.slice(0, 80)));
          }
          const phase = data.phase || 'questions';
          const storedPrompt =
            !rawPrompt || rawPrompt === '-' || rawPrompt.length < 10
              ? (phase === 'milestone_questions' || phase === 'milestone_plan'
                  ? DEFAULT_MILESTONE_USER_PROMPT
                  : DEFAULT_PLANNING_USER_PROMPT)
              : rawPrompt;
          const session = {
            projectType: data.projectType || 'Web App',
            projectKind: data.projectKind || 'coding',
            actionType: data.actionType || '',
            planTarget: data.planTarget || '',
            prompt: storedPrompt,
            questionAnswers: data.questionAnswers || [],
            selectedTaskIds: data.selectedTaskIds || [],
            selectedFeatureIds: data.selectedFeatureIds || [],
            referencedFilePaths: data.referencedFilePaths || [],
            phase: data.phase || 'questions',
            plan: null,
          };
          cursorSessions.set(projectId, session);
          lastCursorSessionRef.current = session;
          jsonResponse(res, 200, { ok: true });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    // --- API: cursor/stream (SSE) ---
    if (pathname === '/api/cursor/stream' && req.method === 'GET') {
      const phase = query.phase || 'test';
      const taskId = query.taskId;
      const projectId = query.project_id || 'default';
      logger.info('http', 'SSE stream', phase, projectId, taskId || '');

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      });

      if (!checkCursorCliAvailableSync()) {
        sendSSE(res, 'done', { error: 'cursor-agent not configured' });
        res.end();
        return;
      }

      try {
      const session = cursorSessions.get(projectId) || lastCursorSessionRef.current || {};
      // Normalize session.prompt so we never pass "-" or weak value into build*Prompt
      const rawSessionPrompt = session.prompt != null ? String(session.prompt) : '';
      const trimmedSession = rawSessionPrompt.trim();
      const isWeak = !trimmedSession || trimmedSession === '-' || /^-+$/.test(trimmedSession) || trimmedSession.length < 10;
      const effectiveUserPrompt = isWeak
        ? (phase === 'milestone_questions' || phase === 'milestone_plan' ? DEFAULT_MILESTONE_USER_PROMPT : DEFAULT_PLANNING_USER_PROMPT)
        : trimmedSession;
      if (session.prompt !== undefined && isWeak) {
        session.prompt = effectiveUserPrompt;
      }
      let prompt = '';

      let assessmentContext = '';
      try {
        const proj = dbProjects.getProject(projectId);
        if (proj?.project) {
          const { project, features, tasks } = proj;
          assessmentContext = buildAssessmentContext(
            {
              summary: project.summary,
              assessment: project.assessment,
              features: features || [],
              tasks: tasks || [],
            },
            extractors.parseAssessmentToStructured
          );
        }
      } catch (_) {}

      let userFocusBlock = '';
      try {
        const projForFocus = dbProjects.getProject(projectId);
        const tasksForFocus = projForFocus?.tasks || [];
        const featuresForFocus = projForFocus?.features || [];
        const selTaskIds = session.selectedTaskIds || [];
        const selFeatureIds = session.selectedFeatureIds || [];
        const refPaths = session.referencedFilePaths || [];
        const taskLines = selTaskIds.length
          ? tasksForFocus
              .filter((t) => selTaskIds.includes(t.id))
              .map((t) => `- ${t.title}${t.description ? ': ' + (t.description || '').slice(0, 80) : ''}`)
          : [];
        const featureLines = selFeatureIds.length
          ? featuresForFocus
              .filter((f) => selFeatureIds.includes(f.id))
              .map((f) => `- ${f.name}${f.description ? ': ' + (f.description || '').slice(0, 80) : ''}`)
          : [];
        const pathLines = refPaths.length ? refPaths.map((p) => `- ${p}`).filter(Boolean) : [];
        const parts = [];
        if (taskLines.length) parts.push('User-selected tasks (focus on these):\n' + taskLines.join('\n'));
        if (featureLines.length) parts.push('User-selected features (focus on these):\n' + featureLines.join('\n'));
        if (pathLines.length) parts.push('Referenced files/paths:\n' + pathLines.join('\n'));
        if (parts.length) userFocusBlock = '\n\n---\nUSER FOCUS (consider these when planning):\n---\n' + parts.join('\n\n') + '\n---\n';
      } catch (_) {}

      if (phase === 'test') {
        prompt = 'Reply with exactly: Connection confirmed.';
      } else if (phase === 'questions') {
        let targetFeature = null;
        if (session.planTarget) {
          try {
            const proj = dbProjects.getProject(projectId);
            targetFeature = proj?.features?.find((f) => f.id === session.planTarget);
          } catch (_) {}
        }
        const planningUserPrompt = effectiveUserPrompt;
        prompt =
          prompts.buildQuestionsPrompt(
            session.projectType || 'Web App',
            planningUserPrompt,
            assessmentContext,
            session.actionType || '',
            targetFeature
          ) + userFocusBlock;
      } else if (phase === 'plan') {
        let targetFeature = null;
        if (session.planTarget) {
          try {
            const proj = dbProjects.getProject(projectId);
            targetFeature = proj?.features?.find((f) => f.id === session.planTarget);
          } catch (_) {}
        }
        const planningUserPrompt = effectiveUserPrompt;
        prompt =
          prompts.buildPhase1Prompt(
            session.projectType || 'Web App',
            session.questionAnswers || [],
            planningUserPrompt,
            assessmentContext,
            session.actionType || '',
            targetFeature
          ) + userFocusBlock;
      } else if (phase === 'task' && taskId) {
        const proj = dbProjects.getProject(projectId);
        const task = proj?.tasks?.find((t) => t.id === taskId);
        prompt = prompts.buildTaskExecutionPrompt(task || { title: taskId }, assessmentContext);
      } else if (phase === 'prioritize') {
        const proj = dbProjects.getProject(projectId);
        const tasks = proj?.tasks || [];
        const selectedIds = session.selectedTaskIds || [];
        const toPrioritize = selectedIds.length
          ? tasks.filter((t) => selectedIds.includes(t.id))
          : tasks;
        prompt = prompts.buildPrioritizePrompt(toPrioritize, assessmentContext);
      } else if (phase === 'milestone_questions') {
        const projectKind = session.projectKind || 'coding';
        const milestoneUserPrompt = effectiveUserPrompt;
        prompt =
          prompts.buildMilestoneQuestionsPrompt(
            projectKind,
            milestoneUserPrompt,
            assessmentContext
          ) + userFocusBlock;
      } else if (phase === 'milestone_plan') {
        const projectKind = session.projectKind || 'coding';
        const milestoneUserPrompt = effectiveUserPrompt;
        prompt =
          prompts.buildMilestonePlanPrompt(
            projectKind,
            session.questionAnswers || [],
            milestoneUserPrompt,
            assessmentContext
          ) + userFocusBlock;
      } else {
        prompt = 'Reply OK.';
      }

      const trimmedPrompt = (prompt || '').trim();
      if (!trimmedPrompt || trimmedPrompt === '-' || trimmedPrompt.length < 10) {
        logger.warn('api', 'cursor/stream: prompt empty or too short, using safe default');
        prompt = 'Reply OK.';
      } else {
        prompt = trimmedPrompt;
      }

      const cursorModel = settings.getCursorAgentModel();
      sendSSE(res, 'status', { message: 'Starting cursor-agent...' });

      let allowedRoot = config.WORKING_DIR;
      const phasesWithProject = ['task', 'plan', 'questions', 'milestone_questions', 'milestone_plan'];
      if (phasesWithProject.includes(phase)) {
        try {
          const projForCwd = dbProjects.getProject(projectId);
          if (projForCwd?.project?.root_path) {
            const resolved = path.resolve(projForCwd.project.root_path);
            if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
              allowedRoot = resolved;
            }
          }
        } catch (_) {}
      }
      const cwd = allowedRoot;

      let fullOutput = '';
      let doneSent = false;
      let streamOutputSent = false;
      function extractTextFromStreamLine(obj) {
        if (obj.text) return String(obj.text);
        if (obj.content) return String(obj.content);
        if (obj.result != null) return String(obj.result);
        if (obj.message?.content)
          return (obj.message.content || [])
            .map((c) => (c?.text != null ? String(c.text) : ''))
            .join('');
        return '';
      }
      function isPathWithinRoot(filePath, rootDir) {
        if (!filePath || typeof filePath !== 'string') return true;
        const resolved = path.resolve(rootDir, filePath);
        const rel = path.relative(rootDir, resolved);
        return !rel.startsWith('..') && !path.isAbsolute(rel);
      }
      function emitToolActivity(obj) {
        const tc = obj.tool_call || obj.toolCall;
        if (obj.type !== 'tool_call' || obj.subtype !== 'started' || !tc) return;
        let act = null;
        if (tc.readToolCall?.args) {
          const p = tc.readToolCall.args.path || '';
          const o = tc.readToolCall.args.offset;
          const lim = tc.readToolCall.args.limit;
          let lineInfo = '';
          if (o != null && lim != null) lineInfo = ` (lines ${o + 1}-${o + lim})`;
          else if (o != null) lineInfo = ` (from line ${o + 1})`;
          act = { action: 'read', path: p, lineInfo, label: `Reading ${p}${lineInfo}` };
        } else if (tc.lsToolCall?.args) {
          const p = tc.lsToolCall.args.path || '';
          act = { action: 'list', path: p, label: `Listing ${p || '.'}` };
        } else if (tc.grepToolCall?.args) {
          const p = tc.grepToolCall.args.path || '';
          act = { action: 'grep', path: p, label: `Grep in ${p || '.'}` };
        } else if (tc.globToolCall?.args) {
          const dir = tc.globToolCall.args.targetDirectory || '';
          const glob = tc.globToolCall.args.globPattern || '';
          act = { action: 'glob', path: dir, pattern: glob, label: `Glob ${glob} in ${dir || '.'}` };
        } else if (tc.editToolCall?.args) {
          const args = tc.editToolCall.args;
          const p = args.path || '';
          act = { action: 'edit', path: p, label: `Editing ${p}` };
          if (args.oldText !== undefined) act.oldText = args.oldText;
          if (args.newText !== undefined) act.newText = args.newText;
          if (args.patch !== undefined) act.patch = args.patch;
        }
        if (act && act.path !== undefined) {
          if (!isPathWithinRoot(act.path, allowedRoot)) {
            act = { action: 'blocked', path: act.path, label: `Blocked (outside workspace): ${act.path}` };
          }
        }
        if (act) sendSSE(res, 'agentActivity', act);
      }

      spawnCursorAgent(
        prompt,
        (s) => {
          fullOutput += s;
          const lines = s.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              emitToolActivity(obj);
              const text = extractTextFromStreamLine(obj);
              if (!text) return;
              const trimmed = text.trim();
              if (trimmed === '-' && !streamOutputSent) return;
              streamOutputSent = true;
              sendSSE(res, 'output', { text, type: obj.type || 'stdout' });
            } catch (_) {}
          }
        },
        (d) => {
          const t = d.toString().trim();
          if (t && t !== '-') sendSSE(res, 'output', { text: t, type: 'stderr' });
        },
        { outputFormat: 'stream-json', cwd, model: cursorModel },
        config,
        logger
      )
        .then(({ exitCode: code, stdout }) => {
          fullOutput = stdout;
          if (doneSent) return;

          if (phase === 'test') {
          sendSSE(res, 'done', {
            phase: 'test',
            success: code === 0,
            output: fullOutput.trim().slice(-200),
          });
        } else if (phase === 'questions') {
          let questionsData = null;
          const questionsPath = path.join(
            config.WORKING_DIR,
            'project-map',
            '.cursor-gen',
            'generated-questions.json'
          );
          if (fs.existsSync(questionsPath)) {
            try {
              const raw = fs.readFileSync(questionsPath, 'utf8');
              const parsed = JSON.parse(raw);
              if (parsed?.questions && Array.isArray(parsed.questions)) {
                questionsData = parsed;
              }
            } catch (_) {}
          }
          if (!questionsData) {
            const accumulatedText =
              extractors.extractResultFromStreamJson(fullOutput) || fullOutput;
            questionsData =
              extractors.extractQuestionsFromOutput(accumulatedText);
          }
          const questions = questionsData?.questions || [];
          dbProjects.logPromptAudit(projectId, 'questions', prompt, fullOutput);
          sendSSE(res, 'done', { phase: 'questions', questions });
        } else if (phase === 'milestone_questions') {
          if (code !== 0) {
            const errMsg = fullOutput.trim().slice(-500) || `Agent exited with code ${code}.`;
            sendSSE(res, 'done', { phase: 'milestone_questions', error: errMsg });
          } else {
            let questionsData = null;
            const milestoneQuestionsPath = handoff.getGeneratedMilestoneQuestionsPath();
            const altPaths = [
              path.join(config.WORKING_DIR, 'project-map', '.cursor-gen', 'generated-milestone-questions.json'),
              path.join(process.cwd(), 'project-map', '.cursor-gen', 'generated-milestone-questions.json'),
            ];
            for (const p of [milestoneQuestionsPath, ...altPaths]) {
              if (p && fs.existsSync(p)) {
                try {
                  const raw = fs.readFileSync(p, 'utf8');
                  const parsed = JSON.parse(raw);
                  if (parsed?.questions && Array.isArray(parsed.questions)) {
                    questionsData = parsed;
                    break;
                  }
                } catch (_) {}
              }
            }
            if (!questionsData) {
              const accumulatedText =
                extractors.extractResultFromStreamJson(fullOutput) || fullOutput;
              questionsData = extractors.extractQuestionsFromOutput(accumulatedText);
            }
            const questions = questionsData?.questions || [];
            dbProjects.logPromptAudit(projectId, 'milestone_questions', prompt, fullOutput);
            sendSSE(res, 'done', { phase: 'milestone_questions', questions });
          }
        } else if (phase === 'milestone_plan') {
          if (code !== 0) {
            const errMsg = fullOutput.trim().slice(-500) || `Agent exited with code ${code}.`;
            sendSSE(res, 'done', { phase: 'milestone_plan', error: errMsg });
          } else {
            let milestonesData = null;
            const milestonesPath = handoff.getGeneratedMilestonesPath();
            const altPaths = [
              path.join(config.WORKING_DIR, 'project-map', '.cursor-gen', 'generated-milestones.json'),
              path.join(process.cwd(), 'project-map', '.cursor-gen', 'generated-milestones.json'),
            ];
            for (const p of [milestonesPath, ...altPaths]) {
              if (p && fs.existsSync(p)) {
                try {
                  const raw = fs.readFileSync(p, 'utf8');
                  const parsed = JSON.parse(raw);
                  if (parsed?.milestones && Array.isArray(parsed.milestones)) {
                    milestonesData = extractors.extractMilestonesFromOutput(raw);
                    if (milestonesData) break;
                  }
                } catch (_) {}
              }
            }
            if (!milestonesData) {
              const accumulatedText =
                extractors.extractResultFromStreamJson(fullOutput) || fullOutput;
              milestonesData = extractors.extractMilestonesFromOutput(accumulatedText);
            }
            const milestones = milestonesData?.milestones || [];
            const pivotalMilestone = milestonesData?.pivotalMilestone ?? null;
            dbProjects.logPromptAudit(projectId, 'milestone_plan', prompt, fullOutput);
            sendSSE(res, 'done', { phase: 'milestone_plan', milestones, pivotalMilestone });
          }
        } else if (phase === 'plan') {
          let plan = null;
          const projectMapRoot = path.resolve(__dirname, '../..');
          const planPaths = [
            path.join(projectMapRoot, '.cursor-gen', 'generated-plan.json'),
            path.join(config.PROJECT_ROOT, '.cursor-gen', 'generated-plan.json'),
            handoff.getGeneratedPlanPath(),
            path.join(config.WORKING_DIR, 'project-map', '.cursor-gen', 'generated-plan.json'),
            path.join(process.cwd(), 'project-map', '.cursor-gen', 'generated-plan.json'),
            path.join(process.cwd(), '.cursor-gen', 'generated-plan.json'),
          ];
          for (const planPath of planPaths) {
            if (fs.existsSync(planPath)) {
              try {
                const raw = fs.readFileSync(planPath, 'utf8');
                const parsed = JSON.parse(raw);
                plan = extractors.normalizePlan(parsed);
                if (plan) break;
              } catch (_) {}
            }
          }
          if (!plan) {
            const accumulatedText =
              extractors.extractResultFromStreamJson(fullOutput) || fullOutput;
            plan = extractors.extractPlanFromOutput(accumulatedText);
            if (!plan) {
              const tried = planPaths.map((p) => ({ p, exists: fs.existsSync(p) }));
              logger.debug('Plan extraction failed. Paths tried:', JSON.stringify(tried, null, 2));
            }
          }
          session.plan = plan;
          cursorSessions.set(projectId, session);
          dbProjects.logPromptAudit(projectId, 'plan', prompt, fullOutput, plan || undefined);
          const donePayload =
            plan
              ? { phase: 'plan', plan }
              : {
                  phase: 'plan',
                  plan: null,
                  error:
                    'Could not extract plan. The agent may have written to a different path or produced invalid output. Check project-map/.cursor-gen/generated-plan.json.',
                };
          sendSSE(res, 'done', donePayload);
        } else if (phase === 'task' && taskId) {
          dbProjects.logPromptAudit(projectId, 'task', prompt, fullOutput);
          const proj = dbProjects.getProject(projectId);
          const tasks = proj?.tasks || [];
          const updated = tasks.map((t) =>
            t.id === taskId
              ? { ...t, prompt: fullOutput.trim().slice(0, 2000) }
              : t
          );
          if (updated.some((t) => t.id === taskId)) {
            dbProjects.upsertTasks(projectId, updated);
          }
          sendSSE(res, 'done', { phase: 'task' });
        } else if (phase === 'prioritize') {
          const proj = dbProjects.getProject(projectId);
          const tasks = proj?.tasks || [];
          const taskIds = tasks.map((t) => t.id);
          const accumulatedText =
            extractors.extractResultFromStreamJson(fullOutput) || fullOutput;
          const result = extractors.extractPrioritizedTasks(
            accumulatedText,
            taskIds
          );
          const orderedTaskIds = result?.orderedTaskIds;
          const priorities = result?.priorities;
          dbProjects.logPromptAudit(projectId, 'prioritize', prompt, fullOutput);
          if (orderedTaskIds && orderedTaskIds.length) {
            dbProjects.updateTaskOrder(projectId, orderedTaskIds);
            if (priorities && typeof priorities === 'object') {
              for (const [taskId, priority] of Object.entries(priorities)) {
                dbProjects.updateTask(projectId, taskId, { priority });
              }
            }
            sendSSE(res, 'done', { phase: 'prioritize', orderedTaskIds, priorities });
          } else {
            sendSSE(res, 'done', {
              phase: 'prioritize',
              error:
                'Could not extract task order from agent output.',
              orderedTaskIds: null,
            });
          }
        } else {
          sendSSE(res, 'done', {
            phase,
            error: code !== 0 ? `exit ${code}` : null,
          });
        }
          doneSent = true;
          res.end();
        })
        .catch((err) => {
          if (!doneSent) {
            doneSent = true;
            sendSSE(res, 'done', { phase, error: err.message });
            res.end();
          }
        });
      } catch (err) {
        logger.error('api', 'cursor/stream error', err);
        try { sendSSE(res, 'done', { phase: query.phase || 'test', error: err.message }); } catch (_) {}
        res.end();
      }
      return;
    }

    // --- API: cursor/confirm-milestones ---
    if (pathname === '/api/cursor/confirm-milestones' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const projectId = data.project_id || 'default';
          const milestones = data.milestones || [];
          if (!Array.isArray(milestones) || milestones.length === 0) {
            jsonResponse(res, 200, { error: 'No milestones to create.', ok: false });
            return;
          }
          const created = [];
          for (let i = 0; i < milestones.length; i++) {
            const m = milestones[i];
            const id = dbProjects.addMilestone(projectId, {
              id: m.id || undefined,
              name: m.name || 'Milestone ' + (i + 1),
              description: m.description || null,
              sort_order: typeof m.sort_order === 'number' ? m.sort_order : i,
            });
            created.push({ id, name: m.name || 'Milestone ' + (i + 1) });
          }
          const proj = dbProjects.getProject(projectId);
          jsonResponse(res, 200, {
            ok: true,
            milestones: proj?.milestones || created,
          });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    // --- API: cursor/confirm ---
    if (pathname === '/api/cursor/confirm' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const projectId = data.project_id || 'default';
          const agentAssignments = data.agentAssignments || {};
          const milestoneId = data.milestone_id || null;
          const session = cursorSessions.get(projectId);
          const plan = session?.plan;

          if (!plan || !plan.features?.length) {
            jsonResponse(res, 200, {
              error: 'No plan to confirm. Run Generate with Cursor first.',
            });
            return;
          }

          const nodes = plan.features.map((f, fi) => ({
            id: 'n_' + (f.id || 'f' + (fi + 1)).replace(/^f/, ''),
            title: f.name,
            description: f.description || '',
            feature_id: f.id || 'f' + (fi + 1),
            milestone_id: milestoneId,
            status: 'todo',
            agent_id:
              agentAssignments[
                'n_' + (f.id || 'f' + (fi + 1)).replace(/^f/, '')
              ] || 'cursor',
          }));

          dbProjects.upsertFeatures(projectId, plan.features);
          dbProjects.upsertTasks(projectId, nodes);
          if (plan.project) {
            dbProjects.updateProject(projectId, {
              name: plan.project.name,
              type: plan.project.type,
            });
          }

          const proj = dbProjects.getProject(projectId);
          jsonResponse(res, 200, {
            ok: true,
            tasks: {
              project: proj?.project,
              features: proj?.features || plan.features,
              nodes,
            },
          });
        } catch (e) {
          logger.error('api', e);
          jsonResponse(res, 500, { error: e.message });
        }
      });
      return;
    }

    // --- Static files ---
    const filePath = path.join(
      config.PUBLIC_DIR,
      pathname === '/' ? 'index.html' : pathname.slice(1)
    );
    const resolvedPath = path.resolve(filePath);
    const publicResolved = path.resolve(config.PUBLIC_DIR);
    if (!resolvedPath.startsWith(publicResolved)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.stat(resolvedPath, (err, stat) => {
      if (err || !stat.isFile()) {
        const fallback = path.join(config.PUBLIC_DIR, 'index.html');
        fs.readFile(fallback, (e, buf) => {
          if (e) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(buf);
          }
        });
        return;
      }
      const ext = path.extname(resolvedPath);
      const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.ico': 'image/x-icon',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      };
      res.writeHead(200, {
        'Content-Type': types[ext] || 'application/octet-stream',
      });
      fs.createReadStream(resolvedPath).pipe(res);
    });
  });

  return server;
}

module.exports = { createServer };
