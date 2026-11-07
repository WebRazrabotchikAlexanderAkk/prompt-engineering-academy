import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLink, extractLinks } from './check-links.mjs';

test('extracts and deduplicates article links', () => {
  assert.deepEqual(extractLinks('[one](https://example.org/a) [two](https://example.org/a)'), ['https://example.org/a']);
});
test('follows relative redirects and records statuses', async () => {
  const result = await checkLink('https://example.org/a', async url => url.endsWith('/a')
    ? new Response(null, { status: 301, headers: { location: '/b' } })
    : new Response(null, { status: 200 }));
  assert.equal(result.result, 'available');
  assert.deepEqual(result.hops.map(hop => hop.status), [301, 200]);
});
test('distinguishes missing pages from denied or unavailable checks', async () => {
  for (const [status, expected] of [[404, 'broken'], [410, 'broken'], [403, 'unverified'], [429, 'unverified'], [503, 'unverified']]) {
    assert.equal((await checkLink('https://example.org/', async () => new Response(null, { status }))).result, expected);
  }
  assert.equal((await checkLink('https://example.org/', async () => { throw new Error('network'); })).result, 'unverified');
});
test('rejects loops, missing Location and HTTPS downgrade', async () => {
  for (const headers of [{ location: '/' }, {}, { location: 'http://example.org/' }]) {
    assert.equal((await checkLink('https://example.org/', async () => new Response(null, { status: 302, headers }))).result, 'unverified');
  }
});
