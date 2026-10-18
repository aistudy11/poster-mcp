#!/usr/bin/env node
/**
 * @fileoverview Local stdio entry point for the standalone Poster MCP adapter.
 * @input API key for business calls; optional service origin, explicit credit cap and HTTP timeout.
 * @output Standard MCP JSON-RPC on stdout; sanitized startup diagnostics on stderr.
 * @pos MCP-client-spawned process; no web listener, account store or background scheduler.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readConfiguration } from './poster-api.mjs';
import { createPosterMcpServer } from './server.mjs';

try {
  const server = createPosterMcpServer(readConfiguration(process.env));
  await server.connect(new StdioServerTransport());
} catch {
  process.stderr.write(`${JSON.stringify({ event: 'poster_mcp_start_failed', module: 'poster-mcp', code: 'CONFIGURATION_OR_TRANSPORT_ERROR' })}\n`);
  process.exitCode = 1;
}
