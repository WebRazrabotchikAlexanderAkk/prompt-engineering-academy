import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  packages: Record<string, { version?: string; dependencies?: Record<string, string> }>;
};
const minimums: Record<string, string> = {
  'http-cache-semantics': '4.3.0',
  sharp: '0.35.5',
  'smol-toml': '1.9.1',
  'source-map-js': '1.2.2',
};
function versionAtLeast(actual: string, minimum: string) {
  const left = actual.split('.').map(Number); const right = minimum.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index]! > right[index]!;
  }
  return true;
}

it.each(Object.entries(minimums))('зафиксированные версии %s не входят в выявленный уязвимый диапазон', (name, minimum) => {
  const instances = Object.entries(lock.packages).filter(([path]) => path.endsWith(`node_modules/${name}`));
  expect(instances.length).toBeGreaterThan(0);
  for (const [path, entry] of instances) expect(versionAtLeast(entry.version!, minimum), `${path}: ${entry.version}`).toBe(true);
});

it.each(Object.entries(minimums))('установленные версии %s совпадают с зафиксированными исправлениями', (name, minimum) => {
  const instances = Object.entries(lock.packages).filter(([path]) => path.endsWith(`node_modules/${name}`));
  let installed = 0;
  for (const [path, entry] of instances) {
    const file = `${path}/package.json`;
    if (!existsSync(file)) continue;
    installed++;
    const actual = JSON.parse(readFileSync(file, 'utf8')) as { version: string };
    expect(actual.version, file).toBe(entry.version);
    expect(versionAtLeast(actual.version, minimum), `${file}: ${actual.version}`).toBe(true);
  }
  expect(installed).toBeGreaterThan(0);
});

it('контракт Node.js учитывает установленную среду компонентных проверок', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as { engines: { node: string } };
  const jsdom = JSON.parse(readFileSync('node_modules/jsdom/package.json', 'utf8')) as { engines: { node: string } };
  expect(manifest.engines.node).toBe(jsdom.engines.node);
});

it('совместимые исправления не меняют утверждённые прямые зависимости', () => {
  expect(lock.packages['']!.dependencies).toMatchObject({
    astro: '7.3.3', react: '19.3.0', 'react-dom': '19.3.0',
    '@astrojs/react': '6.0.6', '@astrojs/mdx': '8.0.1',
    '@dnd-kit/react': '0.5.0', '@dnd-kit/dom': '0.5.0',
  });
});
