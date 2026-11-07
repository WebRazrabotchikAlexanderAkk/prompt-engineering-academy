import { mkdir, mkdtemp, readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

export function localPath(reference, pageUrl, base, directory) {
  const url = new URL(reference, pageUrl);
  if (url.origin !== new URL(pageUrl).origin) return null;
  if (!url.pathname.startsWith(base)) throw new Error(`Outside base: ${url.pathname}`);
  const target = resolve(directory, decodeURIComponent(url.pathname.slice(base.length)));
  const rel = relative(resolve(directory), target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(directory) === target && !url.pathname.endsWith('/')) throw new Error('Outside output directory');
  return { target: url.pathname.endsWith('/') ? join(target, 'index.html') : target, hash: decodeURIComponent(url.hash.slice(1)) };
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await walk(path) : [path]));
  }
  return files;
}

export async function inspectBuild(directory, base) {
  const files = await walk(directory);
  const html = files.filter(path => path.endsWith('.html'));
  const documents = new Map();
  const failures = [];
  let checked = 0;
  const documentAt = async path => {
    if (!documents.has(path)) documents.set(path, new JSDOM(await readFile(path, 'utf8')));
    return documents.get(path).window.document;
  };
  const check = async (reference, pageUrl, source) => {
    try {
      const location = localPath(reference, pageUrl, base, directory);
      if (!location) return;
      checked++;
      if (!(await stat(location.target)).isFile()) throw new Error('Not a file');
      if (location.hash && location.target.endsWith('.html')) {
        const doc = await documentAt(location.target);
        if (!doc.getElementById(location.hash) && ![...doc.querySelectorAll('a[name]')].some(a => a.getAttribute('name') === location.hash)) throw new Error(`Missing anchor: ${location.hash}`);
      }
    } catch (error) {
      failures.push({ source, reference, error: String(error) });
    }
  };
  for (const path of files) {
    const name = relative(directory, path).split(sep).join('/');
    const pageUrl = `https://static-check.invalid${base}${name.replace(/index\.html$/, '')}`;
    if (path.endsWith('.html')) {
      const doc = await documentAt(path);
      if (!doc.querySelector('h1')?.textContent?.trim()) failures.push({ source: name, error: 'Missing page heading' });
      for (const element of doc.querySelectorAll('[href],[src],astro-island')) {
        for (const attr of ['href', 'src', 'component-url', 'renderer-url', 'before-hydration-url']) {
          const value = element.getAttribute(attr);
          if (value) await check(value, pageUrl, name);
        }
      }
    } else if (path.endsWith('.css')) {
      const source = await readFile(path, 'utf8');
      for (const match of source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gu)) await check(match[1], pageUrl, name);
    } else if (path.endsWith('.js')) {
      const source = await readFile(path, 'utf8');
      // Literal relative module references only; runtime-generated URLs require browser checks.
      for (const match of source.matchAll(/["'](\.\.?\/[^"']+\.js)["']/gu)) await check(match[1], pageUrl, name);
    }
  }
  for (const dom of documents.values()) dom.window.close();
  return { base, directory, pages: html.length, checked, failures };
}

async function main() {
  const workspace = fileURLToPath(new URL('../', import.meta.url));
  // Astro moves prerender assets with rename: output must stay on the same drive.
  const scratch = join(workspace, '.astro', 'static-checks');
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, 'run-'));
  const results = [];
  for (const [name, base] of [['root', '/'], ['subpath', '/acceptance-preview/']]) {
    const output = join(root, name);
    const build = spawnSync(process.execPath, ['scripts/astro.mjs', 'build', '--outDir', output], {
      cwd: workspace, env: { ...process.env, SITE_BASE: base }, encoding: 'utf8', timeout: 120000,
    });
    if (build.error || build.status !== 0) throw new Error(`Build failed: ${build.error ?? build.stderr}\n${build.stdout}`);
    const result = await inspectBuild(output, base);
    if (result.pages !== 9) result.failures.push({ error: `Expected 9 pages, got ${result.pages}` });
    results.push(result);
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  process.exitCode = results.some(result => result.failures.length) ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
