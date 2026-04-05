<?php

namespace Tests\Unit;

use App\Support\EscposConnectorFactory;
use Mike42\Escpos\PrintConnectors\NetworkPrintConnector;
use PHPUnit\Framework\TestCase;

class EscposConnectorFactoryTest extends TestCase
{
    public function test_it_accepts_tcp_as_an_alias_for_network_connector(): void
    {
        $factory = new EscposConnectorFactory();
        $server = stream_socket_server('tcp://127.0.0.1:0', $errorNumber, $errorMessage);

        $this->assertNotFalse($server, "{$errorNumber} {$errorMessage}");

        $address = stream_socket_get_name($server, false);
        [$host, $port] = explode(':', (string) $address);

        $connector = $factory->make([
            'connector' => 'tcp',
            'host' => $host,
            'port' => (int) $port,
        ]);
        $peer = stream_socket_accept($server, 1);

        $this->assertInstanceOf(NetworkPrintConnector::class, $connector);

        $connector->finalize();

        if (is_resource($peer)) {
            fclose($peer);
        }

        fclose($server);
    }
}
