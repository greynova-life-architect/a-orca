/**
 * Cursor CLI (cursor-agent) detection and spawning.
 * Windows: CURSOR_CLI_PATH, native PATH, common locations, WSL fallback.
 */
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);

async function getWslUser() {
  try {
    const r = await execAsync('wsl whoami', { timeout: 3000 });
    return (r.stdout || '').trim() || process.env.USER || process.env.DEFAULT_USER || 'user';
  } catch {
    return process.env.USER || process.env.LOGNAME || process.env.DEFAULT_USER || 'user';
  }
}

async function checkCursorCliAvailable(config, logger) {
  logger.log('cli', 'checking platform=', process.platform);
  if (process.platform === 'win32') {
    const envPath = config.CURSOR_CLI_PATH;
    if (envPath) {
      const resolved = path.resolve(envPath.trim());
      logger.log(
        'cli',
        'CURSOR_CLI_PATH=',
        resolved,
        'exists=',
        fs.existsSync(resolved)
      );
      if (fs.existsSync(resolved)) {
        const isPs1 = resolved.toLowerCase().endsWith('.ps1');
        try {
          const runCmd = isPs1
            ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "& '${resolved.replace(/'/g, "''")}' --version"`
            : `"${resolved}" --version`;
          const result = await execAsync(runCmd, { timeout: 5000 });
          if (result.stdout?.trim()) {
            console.log(
              `✓ Found cursor-agent (CURSOR_CLI_PATH): ${result.stdout.trim()}`
            );
            return { cliPath: resolved, useWsl: false, isPs1 };
          }
        } catch (e) {
          logger.log('cli', 'CURSOR_CLI_PATH check failed', e.message);
        }
      }
    }

    try {
      const result = await execAsync('cursor-agent --version', {
        timeout: 5000,
      });
      if (result.stdout?.trim()) {
        console.log(`✓ Found cursor-agent (Windows): ${result.stdout.trim()}`);
        return { cliPath: 'cursor-agent', useWsl: false };
      }
    } catch (e) {
      console.log('Windows cursor-agent check:', e.message?.split('\n')[0]);
    }

    const home = process.env.USERPROFILE || os.homedir();
    const localAppData =
      process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const winPaths = [
      path.join(home, '.cursor', 'bin', 'cursor-agent'),
      path.join(home, '.cursor', 'bin', 'cursor-agent.exe'),
      path.join(home, '.cursor', 'bin', 'cursor-agent.ps1'),
      path.join(localAppData, 'cursor-agent', 'cursor-agent.exe'),
      path.join(localAppData, 'cursor-agent.exe'),
      path.join(localAppData, 'cursor-agent.ps1'),
      path.join(home, '.local', 'bin', 'cursor-agent'),
      path.join(home, '.local', 'bin', 'cursor-agent.exe'),
      path.join(home, '.local', 'bin', 'cursor-agent.ps1'),
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) {
        const isPs1 = p.toLowerCase().endsWith('.ps1');
        try {
          const runCmd = isPs1
            ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "& '${p.replace(/'/g, "''")}' --version"`
            : `"${p}" --version`;
          const result = await execAsync(runCmd, { timeout: 5000 });
          if (result.stdout?.trim()) {
            console.log(`✓ Found cursor-agent at: ${p}`);
            return { cliPath: p, useWsl: false, isPs1 };
          }
        } catch (_) {}
      }
    }

    logger.log('cli', 'trying WSL...');
    const linuxUser = await getWslUser();
    const linuxHome = `/home/${linuxUser}`;
    const linuxLocalBin = `${linuxHome}/.local/bin/cursor-agent`;
    try {
      const result = await execAsync(
        `wsl bash -c "test -f ${linuxLocalBin} && ${linuxLocalBin} --version"`,
        { timeout: 5000 }
      );
      if (result.stdout?.trim()) {
        console.log(`✓ Found cursor-agent via WSL: ${result.stdout.trim()}`);
        return { cliPath: `wsl:${linuxLocalBin}`, useWsl: true };
      }
    } catch (e) {
      logger.log('cli', 'WSL check failed', e.message);
    }
    logger.log('cli', 'all checks failed');
    return null;
  }

  const linuxUser = await getWslUser();
  const linuxHome = `/home/${linuxUser}`;
  const linuxLocalBin = `${linuxHome}/.local/bin/cursor-agent`;
  const paths = [
    linuxLocalBin,
    `${linuxHome}/.cargo/bin/cursor-agent`,
    '/usr/local/bin/cursor-agent',
    '/usr/bin/cursor-agent',
    'cursor-agent',
  ];
  for (const p of paths) {
    try {
      if (p !== 'cursor-agent' && !fs.existsSync(p)) continue;
      const r = await execAsync(`"${p}" --version`, {
        timeout: 5000,
        env: {
          ...process.env,
          PATH: `${process.env.PATH || ''}:${path.dirname(linuxLocalBin)}`,
        },
      });
      if (r.stdout?.trim()) {
        console.log(`✓ Found cursor-agent at: ${p}`);
        return { cliPath: p, useWsl: false };
      }
    } catch (_) {}
  }
  return null;
}

const FALLBACK_PROMPT = 'Proceed with the requested task.';

function spawnCursorAgent(prompt, onStdout, onStderr, opts, config, logger) {
  const raw = typeof prompt === 'string' ? prompt : '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed.length < 10) {
    logger.log('spawn', 'prompt empty or "-" or too short, using FALLBACK_PROMPT');
    prompt = FALLBACK_PROMPT;
  }
  const useStreamJson = opts.outputFormat === 'stream-json';
  const stdoutChunks = [];
  const stderrChunks = [];
  const workingDir = config.WORKING_DIR;
  const settings = require('../settings');
  const model = opts.model != null ? String(opts.model).trim() : settings.getCursorAgentModel();

  return new Promise(async (resolve, reject) => {
    logger.log('spawn', 'checking CLI...');
    const cliInfo = await checkCursorCliAvailable(config, logger);
    if (!cliInfo) {
      logger.log('spawn', 'CLI not found');
      return reject(
        new Error(
          'cursor-agent not found. Set CURSOR_CLI_PATH in .env to the full path (e.g. C:\\Users\\You\\...\\cursor-agent.exe). Or install: irm "https://cursor.com/install?win32=true" | iex'
        )
      );
    }
    logger.log(
      'spawn',
      'CLI ok',
      'path=',
      cliInfo.cliPath,
      'isPs1=',
      cliInfo.isPs1,
      'useWsl=',
      cliInfo.useWsl
    );

    let command = cliInfo.cliPath;
    let args = ['-p', prompt, '--model', model];
    let useStdin = false;

    // On Windows, never pass the prompt as a CLI arg: shell escaping/truncation can
    // corrupt it (e.g. agent receives "-" or empty). Use stdin like the PS1 path.
    if (process.platform === 'win32' && !cliInfo.isPs1) {
      useStdin = true;
      args = ['-p', '-', '--model', model];
    }

    if (cliInfo.isPs1) {
      const normPrompt = (prompt || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const stamp = Date.now();
      const promptFile = path.resolve(
        os.tmpdir(),
        `cursor-prompt-${stamp}.txt`
      );
      const wrapperFile = path.resolve(os.tmpdir(), `cursor-run-${stamp}.ps1`);
      fs.writeFileSync(promptFile, normPrompt, 'utf8');
      const verify = fs.readFileSync(promptFile, 'utf8').trim();
      if (!verify || verify === '-' || verify.length < 10) {
        logger.log('spawn', 'prompt file empty or "-" after write, overwriting with FALLBACK_PROMPT');
        fs.writeFileSync(promptFile, FALLBACK_PROMPT, 'utf8');
      }
      const agentPath = path.resolve(cliInfo.cliPath);
      const wrapperContent = `param([string]$PromptFile,[string]$AgentPath,[string]$UseStream,[string]$Model)
$env:NO_OPEN_BROWSER = '1'
$pipe = Get-Content -Raw -LiteralPath $PromptFile -Encoding UTF8
if ($UseStream -eq '1') { $pipe | & $AgentPath -p - -f --trust --mode ask --model $Model --output-format stream-json --stream-partial-output }
else { $pipe | & $AgentPath -p - -f --trust --mode ask --model $Model --output-format text }`;
      fs.writeFileSync(wrapperFile, wrapperContent, 'utf8');
      command = 'powershell';
      args = [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        wrapperFile,
        '-PromptFile',
        promptFile,
        '-AgentPath',
        agentPath,
        '-UseStream',
        useStreamJson ? '1' : '0',
        '-Model',
        model,
      ];
    }

    const cwd = opts.cwd ? path.resolve(opts.cwd) : workingDir;
    if (cliInfo.useWsl && command.startsWith('wsl:')) {
      const linuxBin = command.replace('wsl:', '');
      command = 'wsl';
      const wslCwd = cwd
        .replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`)
        .replace(/\\/g, '/');
      const modelEsc = model.replace(/'/g, "'\\''");
      args = ['bash', '-c', `cd '${wslCwd}' && ${linuxBin} -p - --model '${modelEsc}'`];
      useStdin = true;
    }

    const env = { ...process.env, NO_OPEN_BROWSER: '1' };
    if (config.CURSOR_API_KEY) env.CURSOR_API_KEY = config.CURSOR_API_KEY;
    if (opts.cwd) env.CURSOR_WORKSPACE_ROOT = cwd;

    const spawnOpts = {
      cwd,
      stdio: useStdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
      env,
    };
    if (!cliInfo.isPs1) spawnOpts.shell = true;

    logger.log(
      'spawn',
      'spawning',
      'cmd=',
      command,
      'args=',
      args.slice(0, 3).join(' '),
      'cwd=',
      cwd
    );
    const child = spawn(command, args, spawnOpts);

    if (useStdin) {
      const toSend = prompt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      child.stdin.write(toSend, 'utf8');
      child.stdin.end();
    }

    child.stdout.on('data', (d) => {
      const t = d.toString();
      stdoutChunks.push(t);
      if (onStdout) onStdout(t);
    });
    child.stderr.on('data', (d) => {
      const t = d.toString();
      stderrChunks.push(t);
      if (onStderr) onStderr(t);
    });
    child.on('error', (err) => {
      logger.log('spawn', 'child error', err.message);
      reject(err);
    });
    const timeoutMs = 180000;
    const timeout = setTimeout(() => {
      if (!child.killed) {
        logger.log(
          'spawn',
          'TIMEOUT killing child after',
          timeoutMs / 1000,
          's'
        );
        child.kill('SIGTERM');
        reject(
          new Error(
            `Agent timed out after ${timeoutMs / 1000}s with no completion`
          )
        );
      }
    }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');
      logger.log('spawn', 'child closed', 'code=', code, 'signal=', signal);
      resolve({ exitCode: code, stdout, stderr });
    });
  });
}

module.exports = {
  checkCursorCliAvailable,
  spawnCursorAgent,
  getWslUser,
};
