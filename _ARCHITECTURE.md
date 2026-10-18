Shared stdio and Streamable HTTP MCP adapter to the existing Poster HTTP API; no database or generation implementation.

| File | Responsibility | Role |
|---|---|---|
| cli.mjs | Read environment and connect stdio (keyless discovery) | Client entry |
| server.mjs | Register the same four tools; host can omit mutating tools for read-only grants | Shared MCP boundary |
| http.mjs | Stateless official SDK Streamable HTTP transport; host supplies verified owner configuration | Remote transport; no independent business logic |
| poster-api.mjs | Origin-bound credential-required business transport and response validation | Existing API adapter |

Upstream: MCP-compatible client. Downstream: Poster structured API, which owns identity, task state, pricing and billing. Update when this boundary changes.

Poster hosts remote OAuth and delegates an existing owner Key; the standalone package never stores sessions, grants credits or reimplements authentication. Root pnpm workspace imports this source so hosted and local tools share one implementation.
