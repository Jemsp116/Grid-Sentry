<?php

declare(strict_types=1);

namespace GridSentry;

use RuntimeException;
use InvalidArgumentException;
use Throwable;

/**
 * Grid Sentry Official Client for PHP.
 *
 * WARNING: Server-side only. Do not expose API keys in client-side HTML/JS.
 */
class Client
{
    private static ?Client $defaultInstance = null;

    private string $apiKey;
    private string $baseUrl;
    private string $appName;
    private int $batchSize;
    private bool $disabled;

    /** @var array<int, array<string, mixed>> */
    private array $buffer = [];

    public function __construct(array $config = [])
    {
        $key = $config['apiKey'] ?? $config['api_key'] ?? '';
        if (empty($key) || !is_string($key)) {
            throw new InvalidArgumentException('[GridSentry] Missing required "apiKey" configuration.');
        }

        $this->apiKey = trim($key);
        $baseUrl = $config['baseUrl'] ?? $config['base_url'] ?? 'http://localhost:4000';
        $this->baseUrl = rtrim((string)$baseUrl, '/');
        $this->appName = (string)($config['appName'] ?? $config['app_name'] ?? 'php-service');
        $this->batchSize = (int)($config['batchSize'] ?? $config['batch_size'] ?? 25);
        $this->disabled = (bool)($config['disabled'] ?? false);

        // Register shutdown handler to flush buffered logs before script termination
        register_shutdown_function([$this, 'flush']);
    }

    public static function init(array $config): self
    {
        $instance = new self($config);
        self::$defaultInstance = $instance;
        return $instance;
    }

    public static function getInstance(): self
    {
        if (self::$defaultInstance === null) {
            throw new RuntimeException('[GridSentry] GridSentry is not initialized. Please call Client::init(["apiKey" => "..."]) first.');
        }
        return self::$defaultInstance;
    }

    public static function logEvent(string $eventType, array $payload = []): void
    {
        self::getInstance()->log($eventType, $payload);
    }

    /**
     * Buffer a security or telemetry event.
     *
     * @param string $eventType
     * @param array<string, mixed>|string $payload
     */
    public function log(string $eventType, $payload = []): void
    {
        if ($this->disabled) {
            return;
        }

        if (is_string($payload)) {
            $payload = ['raw_message' => $payload];
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $srcIp = $payload['source_ip'] ?? $payload['ip'] ?? ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
        $msg = $payload['raw_message'] ?? $payload['message'] ?? sprintf('[%s] %s', $this->appName, $eventType);

        $event = [
            'timestamp'   => $payload['timestamp'] ?? $now,
            'event_type'  => $eventType ?: 'custom_event',
            'source_ip'   => (string)$srcIp,
            'raw_message' => (string)$msg,
            'details'     => (array)($payload['details'] ?? $payload['data'] ?? []),
        ];

        $userId = $payload['user_identifier'] ?? $payload['user'] ?? $payload['email'] ?? null;
        if ($userId !== null) {
            $event['user_identifier'] = (string)$userId;
        }

        $this->buffer[] = $event;

        if (count($this->buffer) >= $this->batchSize) {
            $this->flush();
        }
    }

    public function loginSuccess(string $userEmail, array $details = []): void
    {
        $this->log('user_login_success', [
            'user_identifier' => $userEmail,
            'raw_message'     => sprintf('User %s signed in successfully', $userEmail),
            'details'         => $details,
        ]);
    }

    public function loginFailure(string $userEmail, ?string $reason = null, array $details = []): void
    {
        if ($reason !== null) {
            $details['reason'] = $reason;
        }
        $this->log('user_login_failed', [
            'user_identifier' => $userEmail,
            'raw_message'     => sprintf('Failed login attempt for %s%s', $userEmail, $reason ? ": $reason" : ''),
            'details'         => $details,
        ]);
    }

    public function error(Throwable $err, array $details = []): void
    {
        $details['stack'] = $err->getTraceAsString();
        $this->log('application_error', [
            'raw_message' => sprintf('PHP Exception: %s in %s:%d', $err->getMessage(), $err->getFile(), $err->getLine()),
            'details'     => $details,
        ]);
    }

    /**
     * Send buffered logs to Grid Sentry over HTTP POST.
     * Guaranteed fail-safe: network errors are silently caught.
     */
    public function flush(): int
    {
        if (empty($this->buffer) || $this->disabled) {
            return 0;
        }

        $batch = $this->buffer;
        $this->buffer = [];

        $url = $this->baseUrl . '/api/logs/ingest';
        $json = json_encode($batch);
        if ($json === false) {
            return 0;
        }

        try {
            if (function_exists('curl_init')) {
                $ch = curl_init($url);
                if ($ch === false) {
                    return 0;
                }
                curl_setopt_array($ch, [
                    CURLOPT_POST           => true,
                    CURLOPT_POSTFIELDS     => $json,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT        => 3,
                    CURLOPT_CONNECTTIMEOUT => 2,
                    CURLOPT_HTTPHEADER     => [
                        'Content-Type: application/json',
                        'X-API-Key: ' . $this->apiKey,
                        'User-Agent: GridSentry-PHP/1.0 (' . $this->appName . ')',
                    ],
                ]);
                $res = curl_exec($ch);
                $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                return ($code >= 200 && $code < 300) ? count($batch) : 0;
            } else {
                // Fallback to stream context
                $context = stream_context_create([
                    'http' => [
                        'method'  => 'POST',
                        'header'  => "Content-Type: application/json\r\n" .
                                     "X-API-Key: {$this->apiKey}\r\n" .
                                     "User-Agent: GridSentry-PHP/1.0\r\n",
                        'content' => $json,
                        'timeout' => 3,
                    ],
                ]);
                $fp = @fopen($url, 'r', false, $context);
                if ($fp) {
                    fclose($fp);
                    return count($batch);
                }
                return 0;
            }
        } catch (Throwable $e) {
            // Silently suppress to prevent crashing caller
            return 0;
        }
    }
}
