/**
 * @fileoverview Stateless Streamable HTTP transport for the same four Poster tools.
 * @input A request and configuration already authenticated and scoped by its hosting application.
 * @output handlePosterMcpHttp; delegates all business operations to the existing API adapter.
 * @pos Web-standard transport only; the host must authenticate BEFORE invoking it.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createPosterMcpServer } from './server.mjs';

/**
 * @param {Request} request
 * @param {ReturnType<import('./poster-api.mjs').readConfiguration>} configuration
 * @param {{fetch?: typeof fetch, allowMutations: boolean, maxRequestBytes: number}} options
 */
export async function handlePosterMcpHttp(request, configuration, options) {
  const server = createPosterMcpServer(configuration, options);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: options.maxRequestBytes,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}
