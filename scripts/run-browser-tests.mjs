import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const astroCli = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const playwrightCli = fileURLToPath(new URL('../node_modules/playwright/cli.js', import.meta.url));
const mode = process.argv[2];
const forwardedArgs = process.argv.slice(3);

if (mode !== 'dev' && mode !== 'static') {
  console.error('Usage: node scripts/run-browser-tests.mjs <dev|static> [Playwright arguments]');
  process.exit(2);
}

const isStatic = mode === 'static';
const serverUrl = isStatic
  ? 'http://127.0.0.1:4323/acceptance-preview/'
  : 'http://127.0.0.1:4322/';
const serverArgs = isStatic
  ? ['scripts/static-preview.mjs']
  : [astroCli, 'dev', '--host', '127.0.0.1', '--port', '4322', '--strictPort', '--ignore-lock'];
const serverEnv = {
  ...process.env,
  ASTRO_TELEMETRY_DISABLED: '1',
  ...(isStatic ? { SITE_BASE: '/acceptance-preview/' } : {}),
};
const testEnv = { ...serverEnv, PLAYWRIGHT_REUSE_SERVER: '1' };
const testArgs = [
  'test',
  ...(isStatic ? ['--config=playwright.static.config.ts'] : []),
  ...(!isStatic && !forwardedArgs.some(arg => arg === '--project' || arg.startsWith('--project='))
    ? ['--project=edge']
    : []),
  ...forwardedArgs,
];

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise(resolve => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', error => resolve({ error }));
  });
}

async function waitForServer(child, url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Server exited before readiness (code ' + child.exitCode + ').');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {
      // Retry until the server responds or the readiness deadline expires.
    }
    await sleep(250);
  }
  throw new Error('Server did not become ready at ' + url + ' within ' + timeoutMs + ' ms.');
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  const stopped = await Promise.race([
    waitForExit(child).then(() => true),
    sleep(5000).then(() => false),
  ]);
  if (stopped) return;

  if (process.platform === 'win32' && child.pid) {
    const cleanup = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      cwd: workspace,
      stdio: 'inherit',
    });
    if (cleanup.status !== 0) throw new Error('Could not stop test server process ' + child.pid + '.');
    await waitForExit(child);
    return;
  }

  throw new Error('Test server process ' + child.pid + ' did not stop.');
}

let exitCode = 1;
let server;
try {
  server = spawn(process.execPath, serverArgs, {
    cwd: workspace,
    stdio: 'inherit',
    env: serverEnv,
    windowsHide: true,
  });
  let serverError;
  server.once('error', error => { serverError = error; });
  const readiness = waitForServer(server, serverUrl);
  while (!serverError) {
    try {
      await readiness;
      break;
    } catch (error) {
      if (serverError) throw serverError;
      throw error;
    }
  }
  if (serverError) throw serverError;

  const playwright = spawn(process.execPath, [playwrightCli, ...testArgs], {
    cwd: workspace,
    stdio: 'inherit',
    env: testEnv,
    windowsHide: true,
  });
  const result = await waitForExit(playwright);
  if (result.error) throw result.error;
  exitCode = result.code ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  if (server) {
    try {
      await stopServer(server);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      exitCode = 1;
    }
  }
}

process.exitCode = exitCode;
