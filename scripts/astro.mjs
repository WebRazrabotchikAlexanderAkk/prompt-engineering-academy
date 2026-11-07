import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep framework telemetry disabled without writing a global user preference.
const cli = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
