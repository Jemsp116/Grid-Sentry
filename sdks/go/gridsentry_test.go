package gridsentry

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestLogBeforeInitReturnsDescriptiveError(t *testing.T) {
	defaultMu.Lock()
	defaultClient = nil
	defaultMu.Unlock()

	err := GlobalLog("test_event", Payload{RawMessage: "Hello"})
	if err != ErrNotInitialized {
		t.Fatalf("expected ErrNotInitialized, got %v", err)
	}
}

func TestLogCreatesValidPayload(t *testing.T) {
	client, err := NewClient(Config{
		ApiKey:        "gs_live_test_go_123",
		BaseURL:       "http://mock.gridsentry.local",
		AppName:       "unit-test-app",
		FlushInterval: 10 * time.Minute, // prevent auto-flush during inspection
	})
	if err != nil {
		t.Fatalf("unexpected NewClient error: %v", err)
	}
	defer client.Close()

	client.Log("user_login_success", Payload{
		UserIdentifier: "gopher@example.com",
		RawMessage:     "Gopher logged in",
		Details:        map[string]interface{}{"ip": "10.0.0.1"},
	})

	time.Sleep(50 * time.Millisecond)

	client.mu.Lock()
	defer client.mu.Unlock()
	if len(client.buffer) != 1 {
		t.Fatalf("expected 1 buffered event, got %d", len(client.buffer))
	}
	ev := client.buffer[0]
	if ev.EventType != "user_login_success" {
		t.Errorf("expected EventType user_login_success, got %s", ev.EventType)
	}
	if ev.UserIdentifier != "gopher@example.com" {
		t.Errorf("expected UserIdentifier gopher@example.com, got %s", ev.UserIdentifier)
	}
}

func TestNetworkFailureNeverCrashesCaller(t *testing.T) {
	// Point to non-routable port that fails connection
	client, err := NewClient(Config{
		ApiKey:        "gs_live_test_go_123",
		BaseURL:       "http://127.0.0.1:59999",
		FlushInterval: 10 * time.Minute,
	})
	if err != nil {
		t.Fatalf("unexpected NewClient error: %v", err)
	}
	defer client.Close()

	client.Log("network_test", Payload{RawMessage: "test payload"})
	time.Sleep(50 * time.Millisecond)

	// Flush against dead port — must return 0 without panicking
	flushed := client.Flush()
	if flushed != 0 {
		t.Errorf("expected 0 flushed items on network error, got %d", flushed)
	}
}

func TestBatchingGroupsMultipleEvents(t *testing.T) {
	var requestCount int32
	var capturedEvents []IngestEvent

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &capturedEvents)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer ts.Close()

	client, err := NewClient(Config{
		ApiKey:        "gs_live_test_go_123",
		BaseURL:       ts.URL,
		BatchSize:     10,
		FlushInterval: 10 * time.Minute,
	})
	if err != nil {
		t.Fatalf("unexpected NewClient error: %v", err)
	}
	defer client.Close()

	client.Log("event_1", Payload{})
	client.Log("event_2", Payload{})
	client.Log("event_3", Payload{})

	time.Sleep(50 * time.Millisecond)

	flushed := client.Flush()
	if flushed != 3 {
		t.Errorf("expected 3 flushed items, got %d", flushed)
	}
	if atomic.LoadInt32(&requestCount) != 1 {
		t.Errorf("expected 1 HTTP request for batch, got %d", atomic.LoadInt32(&requestCount))
	}
	if len(capturedEvents) != 3 {
		t.Errorf("expected server to receive 3 events, got %d", len(capturedEvents))
	}
}
