/**
 * @fileoverview Free quote or owned-result example using the existing exported PosterApi.
 * @input Private POSTER_* environment configuration and quote|get command.
 * @output Complete API JSON on stdout; sanitized errors on stderr, with nonzero exit.
 * @pos Developer example only; no creation, task advancement, retries or billing logic.
 */
import { z } from 'zod';
import { PosterApi, PosterApiError, readConfiguration } from '@poster-sh/mcp/api';

try {
  const command = process.argv[2] ?? 'quote';
  if (!['quote', 'get'].includes(command)) throw new PosterApiError('USAGE_QUOTE_OR_GET');
  const id = command === 'get' ? z.string().uuid().safeParse(process.env.POSTER_ID) : null;
  if (id && !id.success) throw new PosterApiError('INVALID_POSTER_ID');
  const api = new PosterApi(readConfiguration(process.env));
  const result = id === null
    ? await api.quote({
      aspectRatio: process.env.POSTER_ASPECT_RATIO,
      vendor: process.env.POSTER_VENDOR,
      model: process.env.POSTER_MODEL,
      quality: process.env.POSTER_QUALITY,
      styleId: process.env.POSTER_STYLE_ID,
    })
    : await api.design(`/api/poster/structured/${encodeURIComponent(id.data)}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const failure = error instanceof PosterApiError
    ? { error: error.code, httpStatus: error.status }
    : { error: 'INVALID_EXAMPLE_CONFIGURATION', httpStatus: null };
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
}
