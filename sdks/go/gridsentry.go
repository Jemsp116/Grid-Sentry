// Package gridsentry provides the official Go client SDK for streaming security,
// authentication, and application telemetry into the Grid Sentry SOC & SIEM platform.
//
// WARNING: Server-side only. Do NOT embed API keys into client-facing binaries.
package gridsentry

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ErrNotInitialized is returned when attempting to use global functions before Init.
var ErrNotInitialized = errors.New("[GridSentry] client is not initialized. Call gridsentry.Init(Config{...}) first")

// IngestEvent represents a single event payload formatted for /api/logs/ingest.
type IngestEvent struct {
	Timestamp      string                 `json:"timestamp"`
	EventType      string                 `json:"event_type"`
	SourceIP       string                 `json:"source_ip"`
	UserIdentifier string                 `json:"user_identifier,omitempty"`
	RawMessage     string                 `json:"raw_message"`
	Details        map[string]interface{} `json:"details"`
}

// Payload options passed by caller.
type Payload struct {
	Timestamp      string
	SourceIP       string
	UserIdentifier string
	RawMessage     string
	Details        map[string]interface{}
}

// Config options for initializing the Client.
type Config struct {
	ApiKey        string
	BaseURL       string
	AppName       string
	BatchSize     int
	FlushInterval time.Duration
	HTTPClient    *http.Client
}

// Client manages event buffering and asynchronous background log shipping.
type Client struct {
	apiKey        string
	baseURL       string
	appName       string
	batchSize     int
	flushInterval time.Duration
	httpClient    *http.Client

	queue      chan IngestEvent
	stopSignal chan struct{}
	wg         sync.WaitGroup

	mu     sync.Mutex
	buffer []IngestEvent
}

var (
	defaultClient *Client
	defaultMu     sync.RWMutex
)

// Init initializes the global singleton client.
func Init(cfg Config) (*Client, error) {
	c, err := NewClient(cfg)
	if err != nil {
		return nil, err
	}
	defaultMu.Lock()
	defaultClient = c
	defaultMu.Unlock()
	return c, nil
}

// GlobalLog logs using the default initialized singleton client.
func GlobalLog(eventType string, payload Payload) error {
	defaultMu.RLock()
	c := defaultClient
	defaultMu.RUnlock()

	if c == nil {
		return ErrNotInitialized
	}
	c.Log(eventType, payload)
	return nil
}

// NewClient creates a new Client instance with a background shipping goroutine.
func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.ApiKey) == "" {
		return nil, errors.New("[GridSentry] missing required ApiKey")
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:4000"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	appName := cfg.AppName
	if appName == "" {
		appName = "go-service"
	}

	batchSize := cfg.BatchSize
	if batchSize <= 0 {
		batchSize = 25
	}

	flushInterval := cfg.FlushInterval
	if flushInterval <= 0 {
		flushInterval = 500 * time.Millisecond
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 5 * time.Second}
	}

	c := &Client{
		apiKey:        cfg.ApiKey,
		baseURL:       baseURL,
		appName:       appName,
		batchSize:     batchSize,
		flushInterval: flushInterval,
		httpClient:    httpClient,
		queue:         make(chan IngestEvent, 1000),
		stopSignal:    make(chan struct{}),
		buffer:        make([]IngestEvent, 0, batchSize),
	}

	c.wg.Add(1)
	go c.worker()

	return c, nil
}

// Log queues an event for non-blocking asynchronous transmission.
func (c *Client) Log(eventType string, p Payload) {
	if eventType == "" {
		eventType = "custom_event"
	}

	ts := p.Timestamp
	if ts == "" {
		ts = time.Now().UTC().Format(time.RFC3339)
	}

	srcIP := p.SourceIP
	if srcIP == "" {
		srcIP = "127.0.0.1"
	}

	msg := p.RawMessage
	if msg == "" {
		msg = fmt.Sprintf("[%s] %s", c.appName, eventType)
	}

	details := p.Details
	if details == nil {
		details = make(map[string]interface{})
	}

	ev := IngestEvent{
		Timestamp:      ts,
		EventType:      eventType,
		SourceIP:       srcIP,
		UserIdentifier: p.UserIdentifier,
		RawMessage:     msg,
		Details:        details,
	}

	select {
	case c.queue <- ev:
	default:
		// Queue full — drop gracefully to prevent caller blocking
	}
}

// LoginSuccess logs a successful authentication event.
func (c *Client) LoginSuccess(userEmail string, details map[string]interface{}) {
	c.Log("user_login_success", Payload{
		UserIdentifier: userEmail,
		RawMessage:     fmt.Sprintf("User %s signed in successfully", userEmail),
		Details:        details,
	})
}

// LoginFailure logs a failed login event.
func (c *Client) LoginFailure(userEmail string, reason string, details map[string]interface{}) {
	if details == nil {
		details = make(map[string]interface{})
	}
	if reason != "" {
		details["reason"] = reason
	}
	c.Log("user_login_failed", Payload{
		UserIdentifier: userEmail,
		RawMessage:     fmt.Sprintf("Failed login attempt for %s: %s", userEmail, reason),
		Details:        details,
	})
}

// Error logs an application exception.
func (c *Client) Error(err error, details map[string]interface{}) {
	if err == nil {
		return
	}
	c.Log("application_error", Payload{
		RawMessage: fmt.Sprintf("Application exception: %v", err),
		Details:    details,
	})
}

func (c *Client) worker() {
	defer c.wg.Done()
	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case ev := <-c.queue:
			c.mu.Lock()
			c.buffer = append(c.buffer, ev)
			ready := len(c.buffer) >= c.batchSize
			c.mu.Unlock()

			if ready {
				c.Flush()
			}

		case <-ticker.C:
			c.Flush()

		case <-c.stopSignal:
			// Drain remaining in queue
			for len(c.queue) > 0 {
				c.buffer = append(c.buffer, <-c.queue)
			}
			c.Flush()
			return
		}
	}
}

// Flush immediately sends all buffered events.
// Fail-safe: Network and HTTP errors are discarded without panicking.
func (c *Client) Flush() int {
	c.mu.Lock()
	if len(c.buffer) == 0 {
		c.mu.Unlock()
		return 0
	}
	batch := make([]IngestEvent, len(c.buffer))
	copy(batch, c.buffer)
	c.buffer = c.buffer[:0]
	c.mu.Unlock()

	url := fmt.Sprintf("%s/api/logs/ingest", c.baseURL)
	body, err := json.Marshal(batch)
	if err != nil {
		return 0
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return 0
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("User-Agent", fmt.Sprintf("GridSentry-Go/1.0 (%s)", c.appName))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Suppressed silently for zero impact on calling service
		return 0
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return len(batch)
	}
	return 0
}

// Close gracefully flushes pending events and terminates background worker.
func (c *Client) Close() {
	close(c.stopSignal)
	c.wg.Wait()
}
