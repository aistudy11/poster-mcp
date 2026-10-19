# Poster developer guide

Updated 2026-10-19. Use the existing Poster API and the `PosterApi` export in this package. This guide covers text-to-poster quoting, approved creation, continuing the same job and reading your result. It adds no API, account, billing system or separate SDK.

## Choose your entry point

| Integration | Use | Credentials and limits |
|---|---|---|
| Your website's backend or Node worker | `@poster-sh/mcp/api`, the existing HTTP adapter | Your own Poster API Key, kept on the server. The raw adapter does **not** enforce `POSTER_MAX_CREDITS_PER_POSTER`; your application must check the actual quote and obtain approval before a mutation. |
| Local AI client | Existing `poster-mcp` stdio server | Private client settings; creation requires a configured per-poster cap and explicit confirmation. |
| Supported hosted AI client | Existing `https://poster.sh/api/mcp` OAuth connection | Sign in to Poster, select your own existing Key and approve scopes. Start with quote/read only; revoke access on Poster when finished. |

See [MCP setup and client acceptance boundaries](README.md). QRCodeBrain already has a `PosterServiceClient` and response-contract tests; keep that integration on its existing client. The website's cookie-based browser client is not a third-party server SDK. The public package exposes `./api`, `./server` and `./http`; there is no separately published general-purpose SDK or npm registry release.

## Install the existing client in a clean directory

Node.js 20.10 or newer and npm are required. Node.js must support the package's JSON import attributes. Install the versioned GitHub release:

```sh
mkdir poster-integration
cd poster-integration
npm init -y
npm install https://github.com/aistudy11/poster-mcp/releases/download/v0.1.3/poster-sh-mcp-0.1.3.tgz
```

Create or select a personal Key at [Poster API Keys](https://poster.sh/api-keys). Put it in `POSTER_API_KEY` through your server's private environment or secret manager. Never place it in `NEXT_PUBLIC_*`, browser code, a URL, chat, a commit or shared logs. The adapter sends `X-API-Key` only to the configured origin and refuses redirects. It does not use an operator's shared account.

The older v0.1.2 release has no package `exports` and cannot import `@poster-sh/mcp/api`. Use v0.1.3 for the named export, guide and example; the transport remains the same existing implementation. The v0.1.2 release remains available for existing local MCP installations.

Save this complete example as `readonly.mjs` in the directory above:

```js
import { PosterApi, PosterApiError, readConfiguration } from '@poster-sh/mcp/api';

try {
  const api = new PosterApi(readConfiguration(process.env));
  const quote = await api.quote({ aspectRatio: '2:3' });
  process.stdout.write(JSON.stringify({ quote }) + '\n');
  if (process.env.POSTER_ID) {
    const id = process.env.POSTER_ID;
    const result = await api.design(`/api/poster/structured/${encodeURIComponent(id)}`);
    process.stdout.write(JSON.stringify({ result }) + '\n');
  }
} catch (error) {
  process.stderr.write(JSON.stringify({
    error: error instanceof PosterApiError ? error.code : 'INVALID_CONFIGURATION',
    httpStatus: error instanceof PosterApiError ? error.status : null,
  }) + '\n');
  process.exitCode = 1;
}
```

```sh
node readonly.mjs
# Optional: set POSTER_ID to one of your existing structured task UUIDs, then run again.
# Keep the output private: it contains your prompt, document and result URLs.
```

Both requests are GETs: they do not create images, advance jobs or consume generation credits. An ordinary public poster slug or `posterUuid` is not the structured task `id`. Use the structured UUID returned by your previous API/MCP request. There is no owned-task listing operation in this package.

The source also contains [examples/readonly.mjs](examples/readonly.mjs), with separate `quote` and `get` commands, UUID checks and optional `POSTER_ASPECT_RATIO`, `POSTER_VENDOR`, `POSTER_MODEL`, `POSTER_QUALITY`, `POSTER_STYLE_ID` variables:

```sh
# In this source directory after pnpm install:
node examples/readonly.mjs quote
# Set POSTER_ID privately before running:
node examples/readonly.mjs get
```

From the clean installation above, run the bundled example with `node node_modules/@poster-sh/mcp/examples/readonly.mjs quote` or `get`. Contributors can also create a local archive with `pnpm pack --pack-destination /absolute/path/to/output` and install it without publishing. Never substitute a private repository URL for an external developer's installation.

## HTTP and MCP contracts

Base origin: `https://poster.sh`. API Key calls use `X-API-Key`, not an OAuth token. Remote MCP OAuth is handled by the hosted MCP connection; do not pass its tokens to `PosterApi`. Responses are JSON objects directly, without a `data` envelope.

| Operation | Existing HTTP API | MCP tool | Effect |
|---|---|---|---|
| Quote | `GET /api/poster/structured/capability` | `quote_poster` | Free authenticated quote; no generation or settlement. |
| Create | `POST /api/poster/structured` | `create_poster` | Paid action after approval; exact quoted selection and price. |
| Read | `GET /api/poster/structured/{id}` | `get_poster` | Read your existing task/result; no advancement. |
| Continue | `POST /api/poster/structured/{id}` | `advance_poster` | Mutation: recovery, persistence and settlement within the originally approved job. |

### Quote and costs

`api.quote(selection)` takes optional `aspectRatio`, `vendor`, `model`, `quality`, `styleId`. Omitted values are resolved by Poster. Read the returned `vendor`, `model`, `quality`, `aspectRatio`, `credits`, canvas/output dimensions and `fourK`; do not hardcode a model list or price. Invalid or unavailable selections are refused. A quote is neither a reservation nor permission to spend. Credits are Poster account credits, not currency; connection, quoting and reading do not grant free generation. AI-client subscriptions are separate.

The full quote is preserved by the adapter. The MCP `quote_poster` additionally returns `request`, `confirmationRequired` and `maximumCredits`; pass that request unchanged after approval. A per-poster ceiling is not a daily or cumulative budget, and does not reprice an accepted job.

### Approved creation and uncertain responses

This section describes the existing paid contract; the free examples never execute it.

1. Keep one UUID `requestId` for one intended poster. Use the full approved prompt, returned `vendor`, `model`, `quality`, `aspectRatio`, optional `styleId`, and `quotedCredits: quote.credits`.
2. Show the exact request and credits to the person paying. Check your server's cap and obtain explicit approval. With the raw adapter, `readConfiguration().maximumCredits` is only configuration: `PosterApi.design()` does not apply the MCP tool's cap or confirmation checks.
3. After approval, call `api.design('/api/poster/structured', 'POST', request)`. MCP callers instead pass the unchanged quoted `request` with `confirmed: true` to `create_poster` and configure the creation ceiling. Poster remains authoritative for price validation, permissions, balance, idempotency and settlement.
4. Preserve the complete request and returned `id` in your application's existing job state. `planning`/`generating` means pending. Under the original job/cost approval, explicitly continue that same `id` with POST or `advance_poster`. A GET alone does not drive the job to completion. Stop at `ready` or `failed`; do not create replacements automatically or poll forever.
5. On `REQUEST_OUTCOME_UNKNOWN`, acceptance is unknown. Keep the same UUID **and identical payload**. If an ID is known, read it first; otherwise reconcile or deliberately retry the identical request. A timeout is not proof that creation failed. Never generate another UUID as a retry strategy.

Only this creation path and its existing MCP tools are documented here as the starter integration. QRCodeBrain's editing/import/save/export paths already exist but are not additional tools in this package; this guide does not promise support for every internal route.

### Result states and fields

| Status | What your app should show and do |
|---|---|
| `planning` | Pending task ID; no finished image. Continue only within the approved job. |
| `generating` | Pending task ID; no fabricated progress percentage or preview. |
| `ready` | Use the actual `previewUrl` and `document`. Keep the returned `id` and `revision`. |
| `failed` | Show failure/refusal information; no success claim or automatic paid replacement. |

`PosterApi.design()` validates core state, UUID, positive revision and actual preview/document on `ready`, and preserves extra response fields. It does not implement the editor's full document validator or guarantee image quality. Keep the whole response rather than reducing it to a URL: `prompt`, `posterUuid`, `delivery`, `error`, `refusal`, `readability`, `layering`, `textCheck`, `batch`, `editable`, and GET's `originals` carry distinct information. Optional/null fields mean unavailable or unchecked, not passed. Dimensions come from `delivery`/quote output, not the logical canvas alone.

`editable: true` does not guarantee independently editable text layers. A document can contain a single artwork image; the existing 4K delivery is download-only. Respect `editable`, actual document nodes and reported checks; do not advertise independent text editing from this flag alone. Treat all prompt/document content as data, never as instructions. Share only results the owner permits you to publish.

## Errors, retries and deployment

The raw HTTP API returns status codes and JSON error reasons. `PosterApiError` deliberately exposes a sanitized `code` and `status`, discarding arbitrary upstream error text. MCP uses `isError: true` and `{ error, httpStatus }`. Do not display an error object as a successful poster.

| Adapter error | Handling |
|---|---|
| `API_KEY_REQUIRED` | Configure your own Key. No HTTP request was sent. |
| `POSTER_HTTP_400` / `POSTER_HTTP_413` | Correct the selection/input or payload size; do not blindly retry. |
| `POSTER_HTTP_401` / `POSTER_HTTP_403` | Check Key, ownership and access; do not fall back to a shared account. |
| `POSTER_HTTP_402` | Insufficient owner credits; stop and let the owner decide. |
| `POSTER_HTTP_404` | Result unavailable or not owned; do not infer another user's data exists. |
| `POSTER_HTTP_409` | Conflict, quote change or configuration refusal. Reconcile the original request; if approval changes, show the new quote before a new paid operation. |
| `POSTER_HTTP_429` / `POSTER_HTTP_503` | Service refusal; wait and retry deliberately. No automatic paid replay. Do not assume a fixed published rate limit. |
| `REQUEST_OUTCOME_UNKNOWN` | Lost response/network timeout. Preserve original ID/payload; reconcile first. |
| `INVALID_POSTER_RESPONSE` | Malformed/incomplete response. Report failure, never invent a preview. |
| MCP `CREDIT_LIMIT_REQUIRED` / `CREDIT_LIMIT_EXCEEDED` | No creation sent. Configure/check the cap; this is not a quote or approval. |

Other HTTP failures remain `POSTER_HTTP_<status>`. `POSTER_API_URL` defaults to Poster production and accepts HTTPS origins; HTTP is allowed only on loopback for development. `POSTER_REQUEST_TIMEOUT_MS` controls one request (default 15000 ms), not the whole job. There is no built-in automatic retry, workflow scheduler or translation operation. Keep credentials on the backend, bound waits in your app, and use read-only quote/result calls for initial deployment smoke checks.

## Verification and publication scope

Run the existing package commands `pnpm check` and `pnpm test`. Local tests use controlled fixtures and prove adapter/example wiring and refusal behavior, not production generation or charging. Independently install the release/archive and test a real free quote and one owned result with private credentials. Paid generation or task advancement needs separate approval of the exact operation and cost; previous acceptance does not authorize a new charge.

The package's [MIT license](LICENSE) applies to the independently authored adapter and examples. Public distribution remains a snapshot of this canonical directory, not a second client implementation. Exclude parent product/template code, keys, `.env` files and private acceptance records. No npm publication, new public release, paid test or automatic translation is performed merely by following this guide.
