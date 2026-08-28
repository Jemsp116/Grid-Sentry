import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GridSentryClient } from '../gridSentryClient.js';

describe('Grid Sentry Client SDK (TICKET-015)', () => {
  let client: GridSentryClient;

  beforeEach(() => {
    client = new GridSentryClient();
  });

  it('throws descriptive error if log() is called before init()', () => {
    expect(() => {
      client.log('test_event');
    }).toThrow('gridSentry.log() called before gridSentry.init()');
  });

  it('throws descriptive error if init() is called with missing baseUrl or apiKey', () => {
    expect(() => {
      client.init({ baseUrl: '', apiKey: '' });
    }).toThrow('gridSentry.init() requires a non-empty baseUrl');
  });

  it('throws descriptive error if log() is called with invalid eventType', () => {
    client.init({ baseUrl: 'http://localhost:4000', apiKey: 'test_key' });
    expect(() => {
      client.log('');
    }).toThrow('gridSentry.log() requires a non-empty string eventType parameter');
  });

  it('does NOT throw when network request fails (fire-and-forget safety)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network connection refused'));
    const onError = vi.fn();

    client.init({
      baseUrl: 'http://localhost:4000',
      apiKey: 'test_key',
      onError,
    });

    expect(() => {
      client.log('network_fail_event', { source_ip: '10.0.0.1' });
    }).not.toThrow();

    // Wait short time for async fetch retry (200ms) to complete
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(onError).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 initial attempt + 1 retry

    fetchSpy.mockRestore();
  });

  it('correctly queues events in batched mode and flushes on demand', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', ingested: 2 }), { status: 200 }),
    );

    client.init({
      baseUrl: 'http://localhost:4000',
      apiKey: 'test_key',
      batching: true,
    });

    client.log('event_1', { source_ip: '10.0.0.1' });
    client.log('event_2', { source_ip: '10.0.0.2' });

    // In batched mode, fetch is not called immediately
    expect(fetchSpy).not.toHaveBeenCalled();

    // Manual flush triggers single batched request
    await client.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callBody = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(Array.isArray(callBody)).toBe(true);
    expect(callBody.length).toBe(2);
    expect(callBody[0].event_type).toBe('event_1');
    expect(callBody[1].event_type).toBe('event_2');

    fetchSpy.mockRestore();
  });
});
