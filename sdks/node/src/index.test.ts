import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { GridSentry } from './index.js';

describe('Grid Sentry Node.js SDK', () => {
  it('raises clear error if static log() is called before init()', () => {
    // Reset singleton if any
    (GridSentry as any).defaultInstance = null;

    assert.throws(
      () => {
        GridSentry.log('test_event');
      },
      {
        message: /GridSentry is not initialized/,
      },
    );
  });

  it('initializes and buffers log calls properly', async () => {
    const client = new GridSentry({
      apiKey: 'gs_live_test_key_123',
      baseUrl: 'http://mock.gridsentry.local',
      appName: 'test-app',
      flushIntervalMs: 50,
    });

    client.log('user_login_success', {
      user_identifier: 'test@example.com',
      raw_message: 'Login succeeded',
    });

    assert.equal((client as any).buffer.length, 1);
    const event = (client as any).buffer[0];
    assert.equal(event.event_type, 'user_login_success');
    assert.equal(event.user_identifier, 'test@example.com');
  });

  it('guarantees simulated network failure NEVER throws into calling app', async () => {
    // Mock global fetch to reject with a Network Connection Error
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED: Connection refused');
    }) as any;

    try {
      const client = new GridSentry({
        apiKey: 'gs_live_test_key_123',
        baseUrl: 'http://unreachable-endpoint-999.local',
      });

      client.log('heartbeat', 'ping');

      // Should complete gracefully without throwing
      const flushedCount = await client.flush();
      assert.equal(flushedCount, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('batches multiple events within flush interval into a single request', async () => {
    let capturedBody: any = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: any, options: any) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ status: 'ok', ingested: capturedBody.length }),
      };
    }) as any;

    try {
      const client = new GridSentry({
        apiKey: 'gs_live_test_key_123',
        baseUrl: 'http://mock.local',
        batchSize: 10,
        flushIntervalMs: 50,
      });

      client.log('event_1');
      client.log('event_2');
      client.log('event_3');

      const count = await client.flush();
      assert.equal(count, 3);
      assert.equal(capturedBody.length, 3);
      assert.equal(capturedBody[0].event_type, 'event_1');
      assert.equal(capturedBody[1].event_type, 'event_2');
      assert.equal(capturedBody[2].event_type, 'event_3');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
