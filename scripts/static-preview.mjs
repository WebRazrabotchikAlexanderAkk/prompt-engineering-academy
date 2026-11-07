import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const astroCli = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const scratch = join(workspace, '.astro', 'static-checks');
await mkdir(scratch, { recursive: true });
const output = await mkdtemp(join(scratch, 'browser-'));
const common = ['--base', '/acceptance-preview/', '--outDir', output];
const env = { ...process.env, SITE_BASE: '/acceptance-preview/', ASTRO_TELEMETRY_DISABLED: '1' };
const build = spawnSync(process.execPath, [astroCli, 'build', ...common], {
  cwd: workspace, stdio: 'inherit', env,
});
if (build.error || build.status !== 0) {
  console.error(build.error ?? 'Static build failed');
  process.exit(build.status ?? 1);
}
const preview = spawn(process.execPath, [astroCli, 'preview', ...common, '--host', '127.0.0.1', '--port', '4323', '--strictPort', '--ignore-lock'], {
  cwd: workspace, stdio: 'inherit', env,
});
preview.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
preview.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
const stopPreview = () => preview.kill();
process.once('SIGINT', stopPreview);
process.once('SIGTERM', stopPreview);
