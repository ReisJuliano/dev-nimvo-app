<?php

namespace Tests\Unit;

use App\Services\Central\LocalAgentConfigService;
use Tests\TestCase;

class LocalAgentConfigServiceTest extends TestCase
{
    public function test_it_adds_default_polling_settings_to_runtime_config(): void
    {
        $service = new LocalAgentConfigService();

        $runtime = $service->normalizeRuntimeConfig([]);

        $this->assertSame(3, $runtime['poll_interval_seconds']);
    }

    public function test_it_preserves_custom_polling_settings(): void
    {
        $service = new LocalAgentConfigService();

        $runtime = $service->normalizeRuntimeConfig([
            'poll_interval_seconds' => 12,
        ]);

        $this->assertSame(12, $runtime['poll_interval_seconds']);
    }
}
