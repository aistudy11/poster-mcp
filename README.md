<p align="center"><img src="https://raw.githubusercontent.com/aistudy11/poster-mcp/codex/public-release/assets/logo.png" alt="Poster.sh logo" width="128" height="128"></p>

# Poster MCP — AI Poster Generator

[Poster.sh](https://poster.sh) is an **[AI Poster Generator](https://poster.sh)** that turns a text brief into a poster. This MCP server lets your AI assistant get an exact quote, create a poster after your approval, and retrieve your own result.

Use it for café openings, event announcements, product launches or promotional posters. Describe the message and visual direction in your assistant; Poster returns the actual preview URL and structured poster document when the task is ready.

**Four shared tools · Local stdio · Hosted Streamable HTTP · ChatGPT/Claude read-only verified · Gemini unverified · Your own Poster credits · MIT adapter**

[Website](https://poster.sh) · [API Keys](https://poster.sh/api-keys) · [Releases](https://github.com/aistudy11/poster-mcp/releases) · [Report an issue](https://github.com/aistudy11/poster-mcp/issues)

## Remote web connection — verified acceptance scopes

The hosted Streamable HTTP endpoint is `https://poster.sh/api/mcp`, with OAuth authorization through your existing Poster sign-in and personal API Key. Production health, authorization discovery and unauthenticated refusal have passed. **ChatGPT and Claude web read-only acceptance passed** on the tested accounts: OAuth, the two read-only tools, a real quote and an existing-result read. An additional user-approved ChatGPT web acceptance generated one real standard poster, verified a two-credit task ledger debit, and revoked the temporary creation grant; a subsequent read was refused. This does not verify independent text-layer editing. Gemini acceptance is paused by the user after the observed web page reported that the region is unsupported; it remains unverified. Deployment alone does not prove that a particular account or platform can connect.

In a compatible remote MCP client, add that exact server URL and select OAuth. Sign in to your existing Poster account and choose your own active API Key by its label on the Poster consent page. Read-only access is the default for quoting and reading an existing result; keep it read-only when testing quotes and existing-result reads. Never paste your original Key into an AI conversation or callback URL. Platform account, region, plan and permission restrictions still apply.

Client entry points checked on 2026-10-18:

- **ChatGPT web:** Plugins → Add a custom MCP server → enter the hosted URL → OAuth/Dynamic Client Registration → request only `poster:read` → create/install and connect the personal plugin → complete Poster consent → try it in chat.
- **Claude web:** Customize → Connectors → Add a custom connector → enter the hosted URL → sign in/register automatically → Connect → complete Poster consent. The observed Free account passed; account eligibility may differ.
- **Gemini web:** [Google’s official instructions](https://support.google.com/gemini/answer/17209137?hl=en-12) describe Connected Apps → Custom apps → enter the hosted URL. Current requirements include a personal Google account, age 18+, being in the US, English and Keep Activity enabled. Those are Google eligibility conditions; the current region-blocked account has not completed acceptance. Check your own privacy settings before enabling activity.

Connection has no additional Poster fee. Quote/read tools do not spend generation credits. Creation is opt-in during consent, requires a per-poster credit ceiling and explicit approval of the actual quote, and uses the same account balance and billing API as the website. A new AI connection does not create an account or grant credits again. Revoke future access in the existing account console at `/mcp/connections`; revocation does not cancel an already accepted poster job. AI-client subscriptions and access restrictions are separate.

Read-only remote grants expose `quote_poster` and `get_poster`; creation-enabled grants expose all four existing tools. Your original API Key is never returned to the AI client, callback or consent HTML. Delegated access expires; refresh rotates tokens; disabling the original Key also blocks delegated access.

## Quick start — released local stdio

Requires **Node.js 20.10+ with npm/npx** and an MCP client that can launch local **stdio** servers. The following configuration runs local stdio; the remote URL above uses the hosted HTTP transport. Your assistant runs this adapter locally and it calls the existing Poster HTTPS API.

1. Sign in to [Poster.sh API Keys](https://poster.sh/api-keys) and use your own existing key. Generation uses that account's balance.
2. Paste the configuration below into your client's **private local MCP settings**, replacing only the key placeholder. Clients using `mcpServers` JSON, including Claude Desktop and Cursor, can use this format.
3. Restart or reconnect your client's MCP server. Check that the four tools below appear, then ask for a quote. Quoting does not generate a poster or spend credits.

```json
{
  "mcpServers": {
    "poster": {
      "command": "npx",
      "args": [
        "--yes",
        "--package=https://github.com/aistudy11/poster-mcp/releases/download/v0.1.2/poster-sh-mcp-0.1.2.tgz",
        "poster-mcp"
      ],
      "env": {
        "POSTER_API_KEY": "YOUR_POSTER_API_KEY"
      }
    }
  }
}
```

This installs the versioned official GitHub release automatically; no private product checkout, global package install or absolute script path is needed. The first start downloads dependencies, so allow it to finish. `npx` needs network access during installation.

**Enable generation deliberately:** the configuration above allows quotes and reads but blocks new creation. To allow creation, add `POSTER_MAX_CREDITS_PER_POSTER` to `env` with your chosen integer limit as a string (for example `"10"` means a ceiling of 10 credits per new poster, **not** a price quote). If the actual quote exceeds your limit, creation is refused. It is a per-poster ceiling, not a daily or account budget. Your assistant must still show the exact prompt, selection and cost and ask for approval before creating. Do not auto-approve `create_poster` or `advance_poster`.

**Try this first:** “Quote a vertical 2:3 poster for a café opening, with the headline 'Grand Opening', warm terracotta colors and a simple modern layout. Show me the exact credits before generating.” A quote returns a request and its current cost. Only approve creation once you have checked them; a pending task is not a completed poster.

## Install from source (optional)

The standalone source is published at [aistudy11/poster-mcp](https://github.com/aistudy11/poster-mcp). For contributors or a fixed local checkout:

```sh
git clone https://github.com/aistudy11/poster-mcp.git
cd poster-mcp
pnpm install --frozen-lockfile
```

For a source checkout, validate it with:

```sh
pnpm check
pnpm test
```

Alternatively, configure that source checkout directly. Replace the path and key with your own values in the client's **private local settings**, never in a public repository or directory submission:

```json
{
  "mcpServers": {
    "poster": {
      "command": "node",
      "args": ["/absolute/path/to/poster-mcp/cli.mjs"],
      "env": {
        "POSTER_API_KEY": "your-existing-poster-api-key"
      }
    }
  }
}
```

Use an existing key from your own [Poster API Keys](https://poster.sh/api-keys) page. The key is sent only to the configured Poster origin as `X-API-Key`. No website cookies or shared operator account are needed for ordinary use. This directory is independent of the Next.js installation and its dependencies.

Both default configurations permit quoting and reading while new creation is disabled. To enable creation, explicitly configure `POSTER_MAX_CREDITS_PER_POSTER` to the maximum credits you approve **for each new poster**. This is a per-request limit, not a daily or account spending budget. Each creation still requires the user's explicit approval of the actual quoted prompt, selection and credits in the MCP client. Do not configure automatic approval of `create_poster` or `advance_poster`.

Advancing an existing job is a separate mutating operation, available only with `confirmed: true`. It can perform recovery attempts within the original job's budget and settle that job's frozen price. The new-creation cap does not change or limit an already accepted job's price. Only advance a job whose original operation and cost were approved; if that approval is unavailable, read it with `get_poster` and ask the user before continuing. No new creation cap or quote authorizes an old job's settlement.

| Variable | Behavior |
|---|---|
| `POSTER_API_KEY` | Required for business calls; without a key, only MCP discovery is available. Use your existing personal Poster key. Never pass it as tool input or a URL parameter. |
| `POSTER_API_URL` | Optional HTTPS origin; defaults to `https://poster.sh`. HTTP is allowed only for local development on loopback. |
| `POSTER_MAX_CREDITS_PER_POSTER` | Optional nonnegative integer. Omitted disables creation; quotes and existing results remain available. Zero permits only a genuinely zero-credit quote. |
| `POSTER_REQUEST_TIMEOUT_MS` | Optional positive integer, default 15000. A timeout does not prove a submission failed. |

## Tools and workflow

| Tool | Existing API | Effect |
|---|---|---|
| `quote_poster` | `GET /api/poster/structured/capability` | Free authenticated quote. Returns the actual model, selection, credits and an exact request with a UUID. |
| `create_poster` | `POST /api/poster/structured` | Potentially paid. Requires `confirmed: true`, the exact quoted request and an operator-configured credit limit. |
| `get_poster` | `GET /api/poster/structured/{id}` | Read-only owned task/result. |
| `advance_poster` | `POST /api/poster/structured/{id}` | Requires `confirmed: true` to continue the approved existing job, including original-budget recovery, persistence and frozen-price settlement. |

Example conversation:

1. “Quote a 2:3 poster for our café opening.” The client calls `quote_poster` with the brief and optional selection. Omitted model/quality/ratio values are resolved by Poster, not guessed locally.
2. Show the returned prompt, model, ratio and credits. Ask the user to approve the actual operation and cost.
3. After explicit approval and with the configured limit, call `create_poster` with the returned `request` unchanged and `confirmed: true`.
4. If the result is `planning` or `generating`, use `advance_poster` with its existing ID and `confirmed: true` only under the original job/cost approval. These states are pending; do not report an image as completed. Use `get_poster` when only reading status.
5. When the API returns `ready`, return its real `previewUrl`, document and other result fields. `get_poster` can reopen the same owned result. Private results stay subject to the existing API's ownership check; do not submit them to a public directory.

This initial adapter exposes the supported text-to-poster flow. It does not add editing, uploading, batch generation or translation tools. The existing website and QRCodeBrain capabilities remain available through their existing paths.

## Common setup questions

- **No Poster tools?** Check that Node/npm are installed and available to your desktop app, that the release URL is copied in full, and that the client supports local stdio. Restart the MCP connection and inspect its server log. If the desktop app cannot find `npx`, use its absolute executable path from your Node installation.
- **Can I use it in browser-only ChatGPT?** Yes, the hosted OAuth endpoint above passed read-only acceptance in ChatGPT web. Use the remote connection steps, rather than the local stdio configuration. Your account must expose custom MCP/plugin access. Gemini remains subject to its separate eligibility conditions and has not passed acceptance here.
- **Is it free?** The adapter is MIT licensed. Quotes and reads do not spend generation credits; poster creation uses your Poster account's actual quoted credits. Continuing an approved existing job can perform recovery and settle its original price.
- **What comes back?** A task ID and state; once `ready`, the actual `previewUrl`, structured `document` and other API result fields. The initial adapter has no editing, upload, translation or batch tools. The website's editor is a separate existing product capability.
- **Where does my key go?** For local stdio, it stays in your private client settings and is sent only to the configured Poster origin. For remote OAuth, select the existing Key by label on Poster’s consent page; the original Key is not given to the AI client. Never paste a real key into a directory, issue, example prompt or shared configuration.

## Errors and retries

- `API_KEY_REQUIRED`: tool discovery is available, but no Poster API request is sent until you configure your own key.

- `CREDIT_LIMIT_REQUIRED`: no creation cap configured; no submission was sent.
- `CREDIT_LIMIT_EXCEEDED`: the approved quote exceeds the configured cap; no submission was sent.
- `POSTER_HTTP_400/409`: the existing API refused the request; quote the intended selection again when the price or input needs correcting. Do not retry indefinitely.
- `POSTER_HTTP_401/403`: the key or permission is not accepted.
- `POSTER_HTTP_402`: the key owner's Poster balance is insufficient. This adapter does not create a new billing system.
- `POSTER_HTTP_404`: unavailable or non-owned result; do not infer another user's data exists.
- `POSTER_HTTP_429/503`: respect the service's refusal and retry deliberately; no automatic paid resubmission is performed.
- `REQUEST_OUTCOME_UNKNOWN`: the response was lost or timed out. Preserve the original UUID **and exact complete request**. Read/advance a known task ID, or explicitly retry that same request. Never invent a replacement UUID to recover an uncertain purchase.
- `INVALID_POSTER_RESPONSE`: malformed or incomplete output, including a false `ready` with no actual result; never presented as success.

The API remains authoritative for quote changes and idempotent retries. Credential-bearing redirects are refused. Arbitrary upstream error text is not returned to the AI client. Stdout carries only MCP protocol messages; startup diagnostics use sanitized structured stderr.

## Validation and distribution status

`pnpm test` uses the official MCP SDK client over a real child-process stdio transport and a controlled local HTTP API fixture. It proves adapter wiring, body preservation, confirmation/cap boundaries, error propagation and credential-safe redirects. The fixture is not a production generation or billing receipt. Production checks and release results belong to the project's current development checklist; do not claim they passed merely because local tests passed.

Create a reviewable installation archive with:

```sh
pnpm pack --pack-destination /absolute/path/to/output
```

The independently written adapter is distributed through the public GitHub repository under the included MIT license. `private: true` prevents accidental **npm** publication; it does not prevent cloning or installing this public repository. No npm registry package is published. The local archive remains v0.1.2; the hosted HTTP transport above reuses the same canonical tool implementation and existing Poster API.

Only this adapter directory is distributed. The parent product repository, licensed template source, `.env` files, API keys and private acceptance records are excluded. The product repository maintains the canonical adapter; the standalone repository is its distribution snapshot, not a separately developed business implementation. A directory submission, publication and a publicly visible backlink are separate states.

## Protocol references

- [Official TypeScript SDK server guide](https://ts.sdk.modelcontextprotocol.io/server)
- SDK dependency pinned to `@modelcontextprotocol/sdk@1.32.1`, using its real `McpServer`, `registerTool`, `StdioServerTransport` and `StdioClientTransport` APIs.
- JSON Schema in MCP tool inputs is validated by the SDK. This package does not modify website Schema.org JSON-LD.
