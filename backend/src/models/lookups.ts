/**
 * Batched relational lookups.
 *
 * The alert / blocklist / audit list endpoints all enrich their rows with the
 * related rule and user. Doing that per row costs one `findOne` per row, so a
 * 50-row page fired ~100 extra queries and a 10 000-row CSV export fired
 * ~20 000. These helpers fetch every referenced id in a single `$in` query and
 * hand back a Map, which lets the per-row mappers stay synchronous.
 *
 * Both `UserModel` and `RuleModel` declare `id` as a unique indexed Number
 * (see `config/mongoSchemas.ts`), so the `$in` lookups are index-served.
 */
import { RuleModel, UserModel, type IRuleDoc } from '../config/mongoSchemas.js';

/** Collapses a column of possibly-null foreign keys into unique, defined ids. */
function uniqueIds(ids: readonly (number | null | undefined)[]): number[] {
  return [...new Set(ids.filter((id): id is number => typeof id === 'number'))];
}

/**
 * Maps user id → email for every id supplied. Ids with no matching user are
 * simply absent from the Map; callers supply their own fallback label.
 */
export async function loadUserEmails(
  ids: readonly (number | null | undefined)[],
): Promise<Map<number, string>> {
  const wanted = uniqueIds(ids);
  if (wanted.length === 0) return new Map();

  const docs = await UserModel.find({ id: { $in: wanted } }, { id: 1, email: 1 });
  return new Map(docs.map((d) => [d.id, d.email]));
}

/**
 * Maps rule id → rule document for every id supplied. Ids with no matching
 * rule are absent from the Map (a rule can be deleted while its alerts live on).
 */
export async function loadRules(
  ids: readonly (number | null | undefined)[],
): Promise<Map<number, IRuleDoc>> {
  const wanted = uniqueIds(ids);
  if (wanted.length === 0) return new Map();

  const docs = await RuleModel.find({ id: { $in: wanted } });
  return new Map(docs.map((d) => [d.id, d]));
}
