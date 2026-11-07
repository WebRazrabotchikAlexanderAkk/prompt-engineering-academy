import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Scope: absolute HTTPS links in the six authored MDX articles, not a site crawler.
export function extractLinks(source) {
  return [...new Set(source.match(/https:\/\/[^\s<>"'\)]+/gu) ?? [])];
}

export async function checkLink(url, fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const hops = [];
  let current = url;
  try {
    for (let index = 0; index <= 8; index++) {
      const response = await fetcher(current, {
        method: 'GET', redirect: 'manual', signal: controller.signal,
        headers: { 'User-Agent': 'PromptEngineeringAcademy-LinkCheck/1.0' },
      });
      hops.push({ url: current, status: response.status });
      await response.body?.cancel();
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect without Location');
        const next = new URL(location, current);
        if (next.protocol !== 'https:') throw new Error('Non-HTTPS redirect');
        if (hops.some(hop => hop.url === next.href)) throw new Error('Redirect loop');
        current = next.href;
        continue;
      }
      const result = response.ok ? 'available'
        : [404, 410].includes(response.status) ? 'broken' : 'unverified';
      return { url, result, hops, contentType: response.headers.get('content-type') };
    }
    throw new Error('Redirect limit exceeded');
  } catch (error) {
    return { url, result: 'unverified', hops, error: String(error), cause: String(error.cause ?? '') };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const directory = new URL('../src/content/articles/', import.meta.url);
  const sources = new Map();
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.mdx')).sort()) {
    for (const url of extractLinks(await readFile(new URL(name, directory), 'utf8'))) {
      sources.set(url, [...(sources.get(url) ?? []), name]);
    }
  }
  if (!sources.size) throw new Error('No article links found');
  const urls = [...sources.keys()];
  const results = [];
  // At most two requests concurrently; each chain has a total 20-second deadline.
  for (let index = 0; index < urls.length; index += 2) {
    results.push(...await Promise.all(urls.slice(index, index + 2).map(async url => ({
      ...await checkLink(url), articles: sources.get(url),
    }))));
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  process.exitCode = results.every(item => item.result === 'available') ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
