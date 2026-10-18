Standalone stdio MCP adapter to the existing Poster HTTP API; no database or generation implementation.

| File | Responsibility | Role |
|---|---|---|
| cli.mjs | Read environment and connect stdio | Client entry |
| server.mjs | Register quote/create/read/advance tools | MCP boundary |
| poster-api.mjs | Origin-bound credential transport and response validation | Existing API adapter |

Upstream: MCP-compatible client. Downstream: Poster structured API, which owns identity, task state, pricing and billing. Update when this boundary changes.
