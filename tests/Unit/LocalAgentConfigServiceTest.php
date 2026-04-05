<?php

namespace Tests\Unit;

use App\Services\Central\LocalAgentConfigService;
use Tests\TestCase;

class LocalAgentConfigServiceTest extends TestCase
{
    public function test_it_adds_default_local_api_settings_to_runtime_config(): void
    {
        $service = new LocalAgentConfigService();

        $runtime = $service->normalizeRuntimeConfig([]);

        $this->assertTrue($runtime['local_api']['enabled']);
        $this->assertSame('127.0.0.1', $runtime['local_api']['host']);
        $this->assertSame(18123, $runtime['local_api']['port']);
    }

    public function test_it_preserves_custom_local_api_settings(): void
    {
        $service = new LocalAgentConfigService();

        $runtime = $service->normalizeRuntimeConfig([
            'local_api' => [
                'enabled' => false,
                'host' => '0.0.0.0',
                'port' => 19090,
            ],
        ]);

        $this->assertFalse($runtime['local_api']['enabled']);
        $this->assertSame('0.0.0.0', $runtime['local_api']['host']);
        $this->assertSame(19090, $runtime['local_api']['port']);
    }
}
