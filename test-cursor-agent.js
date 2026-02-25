#!/usr/bin/env node
/**
 * Test script to verify cursor-agent methodology.
 * Run: node test-cursor-agent.js
 *
 * Tests multiple invocation methods to find one that returns quickly.
 */
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

require('dotenv').config({ path: path.join(__dirname, '.env') });
const execAsync = promisify(exec);

const TEST_PROMPT = 'Reply with exactly: Connection confirmed.';
const TIMEOUT_MS = 45000; // 45 seconds max per method
const CWD = path.resolve(__dirname, '..');

const log = (...args) =>
  console.log(`[${new Date().toISOString().slice(11, 23)}]`, ...args);

async function runMethod(name, run) {
  log(`\n--- Testing: ${name} ---`);
  const start = Date.now();
  try {
    const result = await Promise.race([
      run(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('TIMEOUT')), TIMEOUT_MS)
      ),
    ]);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log(`✓ ${name}: SUCCESS in ${elapsed}s`);
    return { name, success: true, elapsed, ...result };
  } catch (e) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log(`✗ ${name}: FAILED in ${elapsed}s -`, e.message);
    return { name, success: false, elapsed, error: e.message };
  }
}

// Method 1: Direct PowerShell one-liner (simplest - prompt as string)
async function method1_directPs1() {
  const agentPath =
    process.env.CURSOR_CLI_PATH ||
    path.join(
      process.env.LOCALAPPDATA || '',
      'cursor-agent',
      'cursor-agent.ps1'
    );
  if (!agentPath || !fs.existsSync(agentPath)) {
    throw new Error('CURSOR_CLI_PATH not set or file not found');
  }
  // Escape single quotes for PowerShell: ' -> ''
  const escaped = TEST_PROMPT.replace(/'/g, "''");
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:NO_OPEN_BROWSER='1'; & '${agentPath.replace(/'/g, "''")}' -p -f --trust --mode ask --output-format text '${escaped}'"`;
  log('  cmd:', cmd.slice(0, 120) + '...');

  const result = await execAsync(cmd, {
    cwd: CWD,
    timeout: TIMEOUT_MS,
    env: {
      ...process.env,
      NO_OPEN_BROWSER: '1',
      CURSOR_API_KEY: process.env.CURSOR_API_KEY || '',
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

// Method 2: Wrapper script (matches server.js exactly)
async function method2_wrapper() {
  const agentPath = process.env.CURSOR_CLI_PATH;
  if (!agentPath || !fs.existsSync(agentPath))
    throw new Error('CURSOR_CLI_PATH not set');

  const stamp = Date.now();
  const promptFile = path.resolve(
    os.tmpdir(),
    `cursor-test-prompt-${stamp}.txt`
  );
  const wrapperFile = path.resolve(os.tmpdir(), `cursor-test-run-${stamp}.ps1`);

  fs.writeFileSync(promptFile, TEST_PROMPT, 'utf8');
  const wrapperContent = `param([string]$PromptFile,[string]$AgentPath)
$env:NO_OPEN_BROWSER = '1'
$p = Get-Content -Raw -LiteralPath $PromptFile
& $AgentPath -p -f --trust --mode ask --output-format text $p`;
  fs.writeFileSync(wrapperFile, wrapperContent, 'utf8');
  log('  promptFile:', promptFile);
  log('  wrapperFile:', wrapperFile);

  return new Promise((resolve, reject) => {
    const runStart = Date.now();
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
      ],
      {
        cwd: CWD,
        env: {
          ...process.env,
          NO_OPEN_BROWSER: '1',
          CURSOR_API_KEY: process.env.CURSOR_API_KEY || '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    let firstByteMs = null;

    const onData = () => {
      if (firstByteMs === null && (stdout || stderr).length > 0)
        firstByteMs = Date.now() - runStart;
    };
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      onData();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      onData();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      try {
        fs.unlinkSync(promptFile);
      } catch (_) {}
      try {
        fs.unlinkSync(wrapperFile);
      } catch (_) {}
      if (code !== 0 && code !== null) {
        reject(new Error(`exit ${code}: ${stderr.slice(0, 200)}`));
      } else {
        resolve({ stdout, stderr, firstByteMs });
      }
    });
  });
}

// Method 3: Spawn with --output-format stream-json for faster first byte (streaming)
async function method3_streamJson() {
  const agentPath = process.env.CURSOR_CLI_PATH;
  if (!agentPath || !fs.existsSync(agentPath))
    throw new Error('CURSOR_CLI_PATH not set');

  const stamp = Date.now();
  const promptFile = path.resolve(
    os.tmpdir(),
    `cursor-test-prompt-${stamp}.txt`
  );
  const wrapperFile = path.resolve(os.tmpdir(), `cursor-test-run-${stamp}.ps1`);

  fs.writeFileSync(promptFile, TEST_PROMPT, 'utf8');
  const wrapperContent = `param([string]$PromptFile,[string]$AgentPath)
$env:NO_OPEN_BROWSER = '1'
$p = Get-Content -Raw -LiteralPath $PromptFile
& $AgentPath -p -f --trust --mode ask --output-format stream-json --stream-partial-output $p`;
  fs.writeFileSync(wrapperFile, wrapperContent, 'utf8');

  return new Promise((resolve, reject) => {
    const runStart = Date.now();
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
      ],
      {
        cwd: CWD,
        env: {
          ...process.env,
          NO_OPEN_BROWSER: '1',
          CURSOR_API_KEY: process.env.CURSOR_API_KEY || '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    let firstByteMs = null;
    const onData = () => {
      if (firstByteMs === null && (stdout || stderr).length > 0)
        firstByteMs = Date.now() - runStart;
    };
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      onData();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      onData();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      try {
        fs.unlinkSync(promptFile);
      } catch (_) {}
      try {
        fs.unlinkSync(wrapperFile);
      } catch (_) {}
      if (code !== 0 && code !== null) reject(new Error(`exit ${code}`));
      else resolve({ stdout, stderr, firstByteMs });
    });
  });
}

// Method 4: WSL if available (cursor-connect uses this on Windows)
async function method4_wsl() {
  const linuxUser =
    (
      await execAsync('wsl whoami 2>nul', { timeout: 3000 }).catch(() => ({}))
    ).stdout?.trim() || process.env.USER || process.env.LINUX_USER || 'user';
  const linuxBin = `/home/${linuxUser}/.local/bin/cursor-agent`;
  try {
    await execAsync(`wsl test -f ${linuxBin}`, { timeout: 3000 });
  } catch {
    throw new Error('WSL cursor-agent not found');
  }

  const wslCwd = CWD.replace(
    /^([A-Za-z]):/,
    (_, d) => `/mnt/${d.toLowerCase()}`
  ).replace(/\\/g, '/');
  const cmd = `wsl bash -c "cd '${wslCwd}' && echo '${TEST_PROMPT.replace(/'/g, "'\"'\"'")}' | ${linuxBin} -p -f --trust --mode ask --output-format text -"`;
  log('  Using WSL, cwd=', wslCwd);

  const result = await execAsync(cmd, {
    cwd: CWD,
    timeout: TIMEOUT_MS,
    env: { ...process.env, CURSOR_API_KEY: process.env.CURSOR_API_KEY || '' },
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

async function main() {
  log('Cursor Agent Methodology Test');
  log('CWD:', CWD);
  log('CURSOR_CLI_PATH:', process.env.CURSOR_CLI_PATH || '(not set)');
  log(
    'CURSOR_API_KEY:',
    process.env.CURSOR_API_KEY ? '***set***' : '(not set)'
  );
  log('Prompt:', TEST_PROMPT);
  log('Timeout per method:', TIMEOUT_MS / 1000, 's');

  const results = [];

  // Try Method 1 first - simplest
  results.push(
    await runMethod('Method 1: Direct PS1 one-liner', method1_directPs1)
  );

  // Method 2 - server's approach
  results.push(
    await runMethod(
      'Method 2: Wrapper script (server.js match)',
      method2_wrapper
    )
  );

  // Method 3 - streaming
  results.push(
    await runMethod(
      'Method 3: stream-json (faster first byte?)',
      method3_streamJson
    )
  );

  // Method 4 - WSL (only if not on method 1/2 success to save time)
  if (!results.some((r) => r.success)) {
    results.push(
      await runMethod('Method 4: WSL (cursor-connect style)', method4_wsl)
    );
  }

  log('\n--- Summary ---');
  for (const r of results) {
    const status = r.success ? '✓' : '✗';
    const detail =
      r.firstByteMs != null
        ? ` first byte @ ${(r.firstByteMs / 1000).toFixed(1)}s`
        : '';
    const outPreview = r.stdout
      ? ` "${String(r.stdout).slice(0, 60).replace(/\n/g, ' ')}..."`
      : '';
    log(`${status} ${r.name}: ${r.elapsed}s${detail}${outPreview}`);
  }

  const best = results.find((r) => r.success);
  if (best) {
    log('\n✓ Recommended approach:', best.name);
    if (best.stdout) log('Sample output:', best.stdout.slice(0, 200));
  } else {
    log('\n✗ All methods failed. Check:');
    log('  1. cursor-agent is authenticated: run "cursor-agent status"');
    log('  2. CURSOR_API_KEY is valid in .env');
    log(
      "  3. Run manually: powershell -Command \"& 'C:\\path\\to\\cursor-agent.ps1' -p 'Reply OK'\""
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
