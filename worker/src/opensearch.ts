import { Client } from '@opensearch-project/opensearch';

const node = process.env.OPENSEARCH_NODE ?? 'http://opensearch:9200';
const username = process.env.OPENSEARCH_USERNAME;
const password = process.env.OPENSEARCH_PASSWORD;

export const opensearch = new Client({
  node,
  ...(username
    ? {
        auth: {
          username,
          password: password ?? '',
        },
      }
    : {}),
  ssl: { rejectUnauthorized: false },
});

export const SOC_LOGS_PATTERN = 'soc-logs-*';
