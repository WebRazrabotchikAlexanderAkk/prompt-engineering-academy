import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const read = (path: string) => readFileSync(path, 'utf8');
const files = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap(entry => {
  const child = join(path, entry.name);
  return entry.isDirectory() ? files(child) : /\.(ts|tsx|astro)$/.test(entry.name) ? [child] : [];
});

it('QA-TECH-04: весь граф оценивания не зависит от браузера, React, сети и сохранения', () => {
  const visited = new Set<string>();
  function inspect(path: string) {
    path = normalize(path);
    if (visited.has(path)) return;
    visited.add(path);
    const source = read(path);
    expect(source, path).not.toMatch(/\b(window|document|localStorage|fetch|XMLHttpRequest)\b/);
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1]!);
    for (const imported of imports) {
      expect(imported, path).toMatch(/^\.\.?\//);
      expect(imported, path).not.toMatch(/storage|islands|components/);
      inspect(join(dirname(path), `${imported}.ts`));
    }
  }
  for (const path of files('src/domain/scoring')) inspect(path);
  expect(visited.size).toBeGreaterThanOrEqual(3);
});

it('QA-TECH-04: прямой доступ к localStorage сосредоточен только в адаптере хранения', () => {
  const owners = files('src').filter(path => /\blocalStorage\b/.test(read(path)));
  expect(owners.length).toBeGreaterThan(0);
  expect(owners.filter(path => !normalize(path).startsWith(normalize('src/storage/')))).toEqual([]);
});
