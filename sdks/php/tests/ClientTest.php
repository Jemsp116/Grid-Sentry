<?php

declare(strict_types=1);

namespace GridSentry\Tests;

use GridSentry\Client;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use ReflectionClass;

class ClientTest extends TestCase
{
    protected function setUp(): void
    {
        // Reset singleton
        $ref = new ReflectionClass(Client::class);
        $prop = $ref->getProperty('defaultInstance');
        $prop->setAccessible(true);
        $prop->setValue(null, null);
    }

    public function testLogBeforeInitThrowsDescriptiveError(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('GridSentry is not initialized');

        Client::logEvent('test_event');
    }

    public function testLogBuffersProperlyFormattedEvent(): void
    {
        $client = new Client([
            'apiKey'  => 'gs_live_php_test_key',
            'baseUrl' => 'http://mock.gridsentry.local',
            'appName' => 'phpunit-app',
        ]);

        $client->log('user_login_success', [
            'user_identifier' => 'php_user@example.com',
            'raw_message'     => 'User signed in',
            'details'         => ['ip' => '127.0.0.1'],
        ]);

        $ref = new ReflectionClass($client);
        $prop = $ref->getProperty('buffer');
        $prop->setAccessible(true);
        $buffer = $prop->getValue($client);

        $this->assertCount(1, $buffer);
        $this->assertSame('user_login_success', $buffer[0]['event_type']);
        $this->assertSame('php_user@example.com', $buffer[0]['user_identifier']);
    }

    public function testNetworkFailureNeverThrows(): void
    {
        $client = new Client([
            'apiKey'  => 'gs_live_php_test_key',
            'baseUrl' => 'http://127.0.0.1:59998', // dead port
        ]);

        $client->log('fail_test', 'test message');

        // Should complete without throwing
        $result = $client->flush();
        $this->assertSame(0, $result);
    }
}
