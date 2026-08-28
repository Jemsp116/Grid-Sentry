import type { MatchCondition } from './rules.validator.js';

/**
 * OpenSearch Rule Compiler (TICKET-005).
 * Compiles stored match_conditions JSON into OpenSearch bool query clauses.
 */

export interface OpenSearchBoolQuery {
  bool: {
    must: object[];
    filter: object[];
    must_not?: object[];
  };
}

/**
 * Convert a rule's match_conditions and log_source into a valid OpenSearch bool query.
 * Optionally includes a time range filter on `@timestamp`.
 */
export function compileRuleToOpenSearchQuery(
  conditions: MatchCondition[],
  logSource: string,
  fromIso?: string,
  toIso?: string,
): OpenSearchBoolQuery {
  const must: object[] = [];
  const filter: object[] = [];
  const mustNot: object[] = [];

  // Always filter by log_source
  filter.push({ term: { log_source: logSource } });

  // Optional time range filter
  if (fromIso || toIso) {
    const range: Record<string, string> = {};
    if (fromIso) range.gte = fromIso;
    if (toIso) range.lte = toIso;
    filter.push({ range: { '@timestamp': range } });
  }

  // Process conditions
  for (const cond of conditions) {
    const { field, operator, value } = cond;

    switch (operator) {
      case 'equals':
        if (field === 'raw_message') {
          must.push({ match: { raw_message: { query: value, operator: 'and' } } });
        } else {
          filter.push({ term: { [field]: value } });
        }
        break;

      case 'not_equals':
        if (field === 'raw_message') {
          mustNot.push({ match: { raw_message: { query: value, operator: 'and' } } });
        } else {
          mustNot.push({ term: { [field]: value } });
        }
        break;

      case 'contains':
        if (field === 'raw_message') {
          must.push({ match: { raw_message: { query: value, operator: 'and' } } });
        } else {
          must.push({ wildcard: { [field]: `*${value}*` } });
        }
        break;

      case 'not_contains':
        if (field === 'raw_message') {
          mustNot.push({ match: { raw_message: { query: value, operator: 'and' } } });
        } else {
          mustNot.push({ wildcard: { [field]: `*${value}*` } });
        }
        break;

      case 'exists':
        filter.push({ exists: { field } });
        break;
    }
  }

  return {
    bool: {
      must: must.length > 0 ? must : [{ match_all: {} }],
      filter,
      ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
    },
  };
}
