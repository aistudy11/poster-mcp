import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { PosterApi, readConfiguration } from '../poster-api.mjs';

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const taskId = '8497089f-04ad-4bcb-a43c-0671ce6ba965';
const key = 'test-only-key';
const quote = { vendor: 'test-vendor', model: 'test-model', quality: 'standard', aspectRatio: '2:3', credits: 2,
  canvasWidth: 1024, canvasHeight: 1536, outputWidth: 1024, outputHeight: 1536 };
const planning = { id: taskId, status: 'planning', previewUrl: null, document: null, revision: 1, delivery: { width: 1024, height: 1536 } };
const ready = { ...planning, status: 'ready', previewUrl: 'https://images.example.com/result.png',
  document: { version: 2, nodes: {}, assets: {} }, textCheck: { status: 'uncertain' }, batch: null, editable: true };

async function fixture(t, options = {}) {
  const calls = [];
  const api = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const call = { method: request.method, url: request.url, key: request.headers['x-api-key'], body: raw ? JSON.parse(raw) : undefined };
    calls.push(call);
    if (options.reply) return options.reply(call, response);
    response.setHeader('Content-Type', 'application/json');
    if (call.key !== key) { response.writeHead(401); return response.end(JSON.stringify({ error: 'AUTH_REQUIRED' })); }
    if (call.url.startsWith('/api/poster/structured/capability?')) return response.end(JSON.stringify(quote));
    if (call.url === '/api/poster/structured' && call.method === 'POST') return response.end(JSON.stringify(planning));
    if (call.url === `/api/poster/structured/${taskId}`) return response.end(JSON.stringify(ready));
    response.writeHead(404); response.end(JSON.stringify({ error: 'NOT_FOUND' }));
  });
  api.listen(0, '127.0.0.1');
  await new Promise((resolve) => api.once('listening', resolve));
  const origin = `http://127.0.0.1:${api.address().port}`;
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli], stderr: 'pipe',
    env: { POSTER_API_URL: origin, POSTER_API_KEY: options.key ?? key,
      ...(options.cap === null ? {} : { POSTER_MAX_CREDITS_PER_POSTER: options.cap ?? '2' }),
      POSTER_REQUEST_TIMEOUT_MS: options.timeout ?? '2000' } });
  let stderr = '';
  transport.stderr.on('data', (chunk) => { stderr += chunk; });
  const client = new Client({ name: 'poster-protocol-acceptance', version: '1.0.0' });
  t.after(async () => { await client.close(); api.closeAllConnections(); await new Promise((resolve) => api.close(resolve)); });
  await client.connect(transport);
  return { client, calls, origin, stderr: () => stderr };
}

function output(result) {
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  return result.structuredContent;
}

test('real SDK client over stdio walks quote → explicit create → existing progress → owned result', async (t) => {
  const { client, calls, stderr } = await fixture(t);
  const inventory = await client.listTools();
  assert.deepEqual(inventory.tools.map(({ name }) => name).sort(), ['advance_poster', 'create_poster', 'get_poster', 'quote_poster']);
  assert.equal(inventory.tools.find(({ name }) => name === 'create_poster').annotations.readOnlyHint, false);
  assert.equal(inventory.tools.find(({ name }) => name === 'advance_poster').annotations.readOnlyHint, false);
  const quoted = output(await client.callTool({ name: 'quote_poster', arguments: { prompt: 'Cafe opening', aspectRatio: '2:3', styleId: 'minimal' } }));
  assert.equal(quoted.quote.credits, 2);
  assert.equal(quoted.confirmationRequired, true);
  assert.match(quoted.request.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(calls.length, 1);
  const accepted = output(await client.callTool({ name: 'create_poster', arguments: { request: quoted.request, confirmed: true } }));
  assert.equal(accepted.status, 'planning');
  assert.equal(accepted.previewUrl, null);
  assert.deepEqual(calls[1].body, quoted.request);
  assert.equal(calls[1].key, key);
  const advanced = output(await client.callTool({ name: 'advance_poster', arguments: { id: taskId, confirmed: true } }));
  assert.deepEqual(advanced, ready);
  const restored = output(await client.callTool({ name: 'get_poster', arguments: { id: taskId } }));
  assert.deepEqual(restored, ready);
  assert.equal(calls[2].method, 'POST');
  assert.equal(calls[3].method, 'GET');
  assert.equal(stderr(), '');
});

test('missing/false confirmation never reaches the API', async (t) => {
  const { client, calls } = await fixture(t);
  const request = { requestId: randomUUID(), prompt: 'Poster', quotedCredits: 2 };
  for (const confirmed of [false, undefined]) {
    const result = await client.callTool({ name: 'create_poster', arguments: { request, ...(confirmed === undefined ? {} : { confirmed }) } });
    assert.equal(result.isError, true);
  }
  assert.equal(calls.length, 0);
});

test('continuing an existing job also requires explicit settlement/recovery approval', async (t) => {
  const { client, calls } = await fixture(t);
  for (const confirmed of [false, undefined]) {
    const result = await client.callTool({ name: 'advance_poster', arguments: { id: taskId,
      ...(confirmed === undefined ? {} : { confirmed }) } });
    assert.equal(result.isError, true);
  }
  assert.equal(calls.length, 0);
});

test('no operator credit cap means generation is disabled, reads stay available', async (t) => {
  const { client, calls } = await fixture(t, { cap: null });
  const request = { requestId: randomUUID(), prompt: 'Poster', quotedCredits: 2 };
  const refused = await client.callTool({ name: 'create_poster', arguments: { request, confirmed: true } });
  assert.equal(refused.isError, true);
  assert.equal(output(refused).error, 'CREDIT_LIMIT_REQUIRED');
  assert.equal(calls.length, 0);
  assert.equal(output(await client.callTool({ name: 'get_poster', arguments: { id: taskId } })).status, 'ready');
});

test('quotes over the operator credit cap are refused without a mutation', async (t) => {
  const { client, calls } = await fixture(t, { cap: '1' });
  const result = await client.callTool({ name: 'create_poster', arguments: { confirmed: true,
    request: { requestId: randomUUID(), prompt: 'Poster', quotedCredits: 2 } } });
  assert.equal(result.isError, true);
  assert.equal(output(result).error, 'CREDIT_LIMIT_EXCEEDED');
  assert.equal(calls.length, 0);
});

test('explicit retries preserve UUID and complete body; no new id is invented', async (t) => {
  const { client, calls } = await fixture(t);
  const request = { requestId: randomUUID(), prompt: 'Same request', aspectRatio: '2:3', quotedCredits: 2 };
  for (let index = 0; index < 2; index += 1) await client.callTool({ name: 'create_poster', arguments: { request, confirmed: true } });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, request);
  assert.deepEqual(calls[1].body, request);
});

test('uncertain paid submission returns uncertainty and is never automatically retried', async (t) => {
  const { client, calls } = await fixture(t, { timeout: '30', reply(_call, response) {
    setTimeout(() => { if (!response.destroyed) response.end('{}'); }, 150);
  } });
  const result = await client.callTool({ name: 'create_poster', arguments: { confirmed: true,
    request: { requestId: randomUUID(), prompt: 'Poster', quotedCredits: 2 } } });
  assert.equal(result.isError, true);
  assert.equal(output(result).error, 'REQUEST_OUTCOME_UNKNOWN');
  assert.equal(calls.length, 1);
});

for (const status of [400, 401, 402, 404, 409, 429, 503]) {
  test(`API HTTP ${status} remains a tool error and raw upstream secrets never escape`, async (t) => {
    const { client } = await fixture(t, { reply(_call, response) {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: `private account details ${key}` }));
    } });
    const result = await client.callTool({ name: 'get_poster', arguments: { id: taskId } });
    assert.equal(result.isError, true);
    assert.equal(output(result).httpStatus, status);
    assert.doesNotMatch(JSON.stringify(result), /private account|test-only-key/);
  });
}

test('a false ready response, HTML or wrong result shape never becomes success', async (t) => {
  const values = [JSON.stringify({ ...ready, document: null }), '<html>Access denied</html>', '[]'];
  for (const body of values) {
    const { client } = await fixture(t, { reply(_call, response) { response.end(body); } });
    const result = await client.callTool({ name: 'get_poster', arguments: { id: taskId } });
    assert.equal(result.isError, true);
    assert.equal(output(result).error, 'INVALID_POSTER_RESPONSE');
  }
});

test('redirects never forward the API key to another origin', async (t) => {
  let leaked = false;
  const target = createServer((_request, response) => { leaked = true; response.end('{}'); });
  target.listen(0, '127.0.0.1');
  await new Promise((resolve) => target.once('listening', resolve));
  t.after(() => new Promise((resolve) => target.close(resolve)));
  const { client } = await fixture(t, { reply(_call, response) {
    response.writeHead(302, { Location: `http://127.0.0.1:${target.address().port}/collect` }); response.end();
  } });
  const result = await client.callTool({ name: 'get_poster', arguments: { id: taskId } });
  assert.equal(result.isError, true);
  assert.equal(output(result).httpStatus, 302);
  assert.equal(leaked, false);
});

test('invalid IDs and extra creation fields are rejected before HTTP', async (t) => {
  const { client, calls } = await fixture(t);
  assert.equal((await client.callTool({ name: 'get_poster', arguments: { id: '../../private' } })).isError, true);
  assert.equal((await client.callTool({ name: 'create_poster', arguments: { confirmed: true,
    request: { requestId: randomUUID(), prompt: 'Poster', quotedCredits: 2, owner: 'someone-else' } } })).isError, true);
  assert.equal(calls.length, 0);
});

test('configuration rejects credentials in URLs, nonlocal HTTP and malformed caps', () => {
  for (const POSTER_API_URL of ['http://poster.sh', 'https://user:password@poster.sh', 'https://poster.sh/path', 'https://poster.sh?key=secret']) {
    assert.throws(() => readConfiguration({ POSTER_API_KEY: key, POSTER_API_URL }));
  }
  assert.throws(() => readConfiguration({ POSTER_API_KEY: key, POSTER_MAX_CREDITS_PER_POSTER: '-1' }));
  assert.throws(() => readConfiguration({ POSTER_API_KEY: 'injected\r\nheader' }));
  assert.equal(readConfiguration({ POSTER_API_KEY: key }).maximumCredits, undefined);
});

test('a client cannot use the internal HTTP adapter as an arbitrary-origin proxy', async () => {
  let sent = false;
  const api = new PosterApi(readConfiguration({ POSTER_API_KEY: key }), async () => { sent = true; return Response.json({}); });
  await assert.rejects(api.request('https://elsewhere.example/api/poster/structured'), /INVALID_API_PATH/);
  assert.equal(sent, false);
});
