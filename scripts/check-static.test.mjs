import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { localPath } from './check-static.mjs';

const output = resolve('dist');
test('maps subpath pages and anchor-only URLs', () => {
  assert.deepEqual(localPath('#итог', 'https://static-check.invalid/preview/quiz/', '/preview/', output), { target: join(output, 'quiz', 'index.html'), hash: 'итог' });
});
test('rejects assets escaping the configured base or output', () => {
  assert.throws(() => localPath('/_astro/a.js', 'https://static-check.invalid/preview/', '/preview/', output));
  assert.throws(() => localPath('/preview/..%2fsecret', 'https://static-check.invalid/preview/', '/preview/', output));
});
test('ignores external links and maps relative module URLs', () => {
  assert.equal(localPath('https://example.org/', 'https://static-check.invalid/', '/', output), null);
  assert.equal(localPath('./chunk.js', 'https://static-check.invalid/_astro/app.js', '/', output).target, join(output, '_astro', 'chunk.js'));
});
