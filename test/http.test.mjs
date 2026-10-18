import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handlePosterMcpHttp } from '../http.mjs';
import { readConfiguration } from '../poster-api.mjs';

const id = '1ae1902a-debd-4b45-87be-78e16766b4bc';
const ready = { id, status: 'ready', previewUrl: 'https://assets.example/preview.png', document: { nodes: [] }, revision: 1 };
async function connect(allowMutations) {
  const calls = [];
  const configuration = readConfiguration({ POSTER_API_URL: 'https://poster.example', POSTER_API_KEY: 'fixture-only-key', POSTER_MAX_CREDITS_PER_POSTER: '10' });
  const apiFetch = async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: options.body });
    if (String(url).includes('/capability')) return Response.json({ vendor: 'fixture', model: 'fixture', quality: 'standard', aspectRatio: '2:3', credits: 2 });
    return Response.json(ready);
  };
  const transport = new StreamableHTTPClientTransport(new URL('https://poster.example/api/mcp'), {
    fetch: async (input, options) => handlePosterMcpHttp(new Request(input, options), configuration, { allowMutations, maxRequestBytes: 65536, fetch: apiFetch }),
  });
  const client = new Client({ name: 'http-acceptance', version: '1.0.0' });
  await client.connect(transport);
  return { client, calls };
}
test('real SDK HTTP client discovers only read tools under read-only consent', async () => {
  const { client, calls } = await connect(false);
  try {
    assert.deepEqual((await client.listTools()).tools.map(t => t.name), ['quote_poster', 'get_poster']);
    const quote = await client.callTool({ name: 'quote_poster', arguments: { prompt: 'A café opening poster' } });
    assert.equal(quote.structuredContent.quote.credits, 2);
    assert.equal(quote.structuredContent.confirmationRequired, true);
    const result = await client.callTool({ name: 'get_poster', arguments: { id } });
    assert.deepEqual(result.structuredContent, ready);
    assert.equal(JSON.stringify(result).includes('fixture-only-key'), false);
    const previous = calls.length;
    const refused = await client.callTool({ name: 'advance_poster', arguments: { id, confirmed: true } });
    assert.equal(refused.isError, true);
    assert.equal(calls.length, previous);
  } finally { await client.close(); }
});
test('same four tools run through stateless HTTP with exact request and configured creation cap', async () => {
  const { client, calls } = await connect(true);
  try {
    assert.equal((await client.listTools()).tools.length, 4);
    const quote = await client.callTool({ name: 'quote_poster', arguments: { prompt: 'A café opening poster' } });
    const request = quote.structuredContent.request;
    const result = await client.callTool({ name: 'create_poster', arguments: { request, confirmed: true } });
    assert.deepEqual(result.structuredContent, ready);
    assert.deepEqual(JSON.parse(calls.at(-1).body), request);
    const before = calls.length;
    const refused = await client.callTool({ name: 'create_poster', arguments: { request: { ...request, quotedCredits: 11 }, confirmed: true } });
    assert.equal(refused.isError, true);
    assert.equal(calls.length, before);
  } finally { await client.close(); }
});
