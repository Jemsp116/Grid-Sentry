export interface MatchCondition {
  field: 'event_type' | 'outcome' | 'source_ip' | 'ssh_user' | 'raw_message';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists';
  value?: string;
}

export interface OpenSearchBoolQuery {
  bool: {
    must: object[];
    filter: object[];
    must_not?: object[];
  };
}

export function compileRuleToOpenSearchQuery(
  conditions: MatchCondition[],
  logSource: string,
  fromIso?: string,
  toIso?: string,
): OpenSearchBoolQuery {
  const must: object[] = [];
  const filter: object[] = [];
  const mustNot: object[] = [];

  filter.push({ term: { log_source: logSource } });

  if (fromIso || toIso) {
    const range: Record<string, string> = {};
    if (fromIso) range.gte = fromIso;
    if (toIso) range.lte = toIso;
    filter.push({ range: { '@timestamp': range } });
  }

  for (const cond of conditions) {
    const { field, operator, value = '' } = cond;

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
