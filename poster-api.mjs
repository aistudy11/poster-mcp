/**
 * @fileoverview Credential-bound HTTP adapter to the existing Poster structured API.
 * @input Explicit environment configuration and validated MCP tool input.
 * @output PosterApi / PosterApiError; never stores jobs, prices, credits or credentials.
 * @pos Standalone MCP transport boundary; Poster remains the business authority.
 */
import { z } from 'zod';

const environmentSchema = z.object({
  POSTER_API_URL: z.string().url().default('https://poster.sh'),
  POSTER_API_KEY: z.string().trim().refine((value) => !/[\r\n]/u.test(value)).default(''),
  POSTER_MAX_CREDITS_PER_POSTER: z.coerce.number().int().nonnegative().optional(),
  POSTER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});

/** @param {NodeJS.ProcessEnv} environment */
export function readConfiguration(environment) {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) throw new Error('Invalid Poster configuration. Check the documented environment variables.');
  const url = new URL(parsed.data.POSTER_API_URL);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))) {
    throw new Error('POSTER_API_URL must be an HTTPS origin; HTTP is supported only for local development.');
  }
  return {
    origin: url.origin,
    apiKey: parsed.data.POSTER_API_KEY,
    maximumCredits: parsed.data.POSTER_MAX_CREDITS_PER_POSTER,
    timeoutMs: parsed.data.POSTER_REQUEST_TIMEOUT_MS,
  };
}

export class PosterApiError extends Error {
  /** @param {string} code @param {number | null} [status] */
  constructor(code, status = null) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/** JSON objects are retained intact; unknown upstream values do not become success. */
const objectResponse = z.record(z.unknown());
export const quoteResponse = z.object({
  vendor: z.string(), model: z.string(), quality: z.string(), aspectRatio: z.string(),
  credits: z.number().int().nonnegative(),
}).passthrough();
export const designResponse = z.object({
  id: z.string().uuid(), status: z.enum(['planning', 'generating', 'ready', 'failed']),
  previewUrl: z.string().url().nullable(), document: z.unknown().nullable(),
  revision: z.number().int().positive(),
}).passthrough().superRefine((value, context) => {
  if (value.status === 'ready' && (!value.previewUrl || !value.document)) {
    context.addIssue({ code: 'custom', message: 'A ready design must include its actual result.' });
  }
});

export class PosterApi {
  /** @param {ReturnType<typeof readConfiguration>} configuration @param {typeof fetch} [fetchImplementation] */
  constructor(configuration, fetchImplementation = globalThis.fetch.bind(globalThis)) {
    this.configuration = configuration;
    this.fetchImplementation = fetchImplementation;
  }

  /** @param {string} path @param {'GET'|'POST'} [method] @param {Record<string, unknown>} [body] */
  async request(path, method = 'GET', body) {
    if (!this.configuration.apiKey) throw new PosterApiError('API_KEY_REQUIRED');
    const url = new URL(path, this.configuration.origin);
    if (url.origin !== this.configuration.origin || !url.pathname.startsWith('/api/poster/structured')) {
      throw new PosterApiError('INVALID_API_PATH');
    }
    let response;
    try {
      response = await this.fetchImplementation(url, {
        method,
        headers: {
          'X-API-Key': this.configuration.apiKey,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
        signal: AbortSignal.timeout(this.configuration.timeoutMs),
      });
    } catch {
      // Acceptance is unknown: never retry a mutation or invent a new request id.
      throw new PosterApiError('REQUEST_OUTCOME_UNKNOWN');
    }
    if (!response.ok) {
      // Do not return arbitrary upstream error text or redirects to an AI client.
      throw new PosterApiError(`POSTER_HTTP_${response.status}`, response.status);
    }
    let bodyValue;
    try { bodyValue = await response.json(); } catch { throw new PosterApiError('INVALID_POSTER_RESPONSE'); }
    const parsed = objectResponse.safeParse(bodyValue);
    if (!parsed.success) throw new PosterApiError('INVALID_POSTER_RESPONSE');
    return parsed.data;
  }

  /** @param {Record<string, string | undefined>} selection */
  async quote(selection) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(selection)) if (value !== undefined) query.set(key, value);
    const response = await this.request(`/api/poster/structured/capability?${query}`);
    const parsed = quoteResponse.safeParse(response);
    if (!parsed.success) throw new PosterApiError('INVALID_POSTER_RESPONSE');
    return parsed.data;
  }

  /** @param {string} path @param {'GET'|'POST'} [method] @param {Record<string, unknown>} [body] */
  async design(path, method = 'GET', body) {
    const response = await this.request(path, method, body);
    const parsed = designResponse.safeParse(response);
    if (!parsed.success) throw new PosterApiError('INVALID_POSTER_RESPONSE');
    return parsed.data;
  }
}
