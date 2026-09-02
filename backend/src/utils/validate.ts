/**
 * Zod validation helper.
 *
 * Every controller validated its input with the same six lines: `safeParse`,
 * map the issues to `path: message`, join with '; ', throw
 * `ApiError.badRequest`. This collapses that into one call so the failure
 * message format stays identical across all endpoints.
 */
import type { z } from 'zod';
import { ApiError } from './ApiError.js';

/**
 * Parses `data` against `schema`, or throws a 400 listing every issue.
 *
 * @param label What is being validated, used in the error message —
 *              e.g. 'query parameters' produces "Invalid query parameters: ...".
 */
export function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  label: string,
): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw ApiError.badRequest(`Invalid ${label}: ${issues}`);
  }
  return parsed.data;
}
