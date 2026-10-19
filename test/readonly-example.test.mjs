import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const example = fileURLToPath(new URL('../examples/readonly.mjs', import.meta.url));
const id = '8497089f-04ad-4bcb-a43c-0671ce6ba965';
const key = 'example-test-private-key';
const quote = { vendor: 'test-vendor', model: 'test-model', quality: 'standard', aspectRatio: '2:3',
  credits: 2, outputWidth: 1360, outputHeight: 2040, fourK: false };
const ready = { id, status: 'ready', revision: 1, previewUrl: 'https://images.example.com/result.png',
  document: { version: 4 }, editable: true, originals: {}, textCheck: null, extraResultField: 'preserved' };

function run(command, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [example, command], {
      env: { PATH: process.env.PATH, POSTER_API_KEY: key, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function fixture(t) {
  const calls = [];
  const server = createServer((request, response) => {
    calls.push({ method: request.method, path: request.url, key: request.headers['x-api-key'] });
    response.setHeader('Content-Type', 'application/json');
    if (request.url.startsWith('/api/poster/structured/capability?')) return response.end(JSON.stringify(quote));
    if (request.url === `/api/poster/structured/${id}`) return response.end(JSON.stringify(ready));
    response.writeHead(404);
    response.end(JSON.stringify({ error: `private details: ${key}` }));
  });
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { calls, environment: { POSTER_API_URL: `http://127.0.0.1:${server.address().port}` } };
}

test('example uses the exported client, preserves all quote/result fields and sends GETs only', async t => {
  const { calls, environment } = await fixture(t);
  const quoted = await run('quote', { ...environment, POSTER_ASPECT_RATIO: '2:3' });
  assert.equal(quoted.code, 0);
  assert.deepEqual(JSON.parse(quoted.stdout), quote);
  const result = await run('get', { ...environment, POSTER_ID: id });
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.stdout), ready);
  assert.deepEqual(calls, [
    { method: 'GET', path: '/api/poster/structured/capability?aspectRatio=2%3A3', key },
    { method: 'GET', path: `/api/poster/structured/${id}`, key },
  ]);
});

test('example refuses mutation commands, invalid IDs and missing keys without HTTP', async t => {
  const { calls, environment } = await fixture(t);
  for (const [command, variables, expected] of [
    ['create', {}, 'USAGE_QUOTE_OR_GET'],
    ['get', { POSTER_ID: '../../create' }, 'INVALID_POSTER_ID'],
    ['get', {}, 'INVALID_POSTER_ID'],
    ['quote', { POSTER_API_KEY: '' }, 'API_KEY_REQUIRED'],
  ]) {
    const result = await run(command, { ...environment, ...variables });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).error, expected);
  }
  assert.deepEqual(calls, []);
});

test('example propagates a refusal without upstream text, secret leakage or an automatic retry', async t => {
  const { calls, environment } = await fixture(t);
  const result = await run('get', { ...environment, POSTER_ID: '99999999-9999-4999-8999-999999999999' });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), { error: 'POSTER_HTTP_404', httpStatus: 404 });
  assert.equal(result.stderr.includes(key), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});
