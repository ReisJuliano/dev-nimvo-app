<?php

namespace Tests\Unit;

use App\Services\Central\LocalFiscalAgentRunner;
use App\Support\SpedNfeNfceEmitter;
use Tests\TestCase;

class LocalFiscalAgentRunnerTest extends TestCase
{
    public function test_it_only_merges_central_polling_settings_and_preserves_local_printer_config(): void
    {
        $runner = new class($this->createMock(SpedNfeNfceEmitter::class)) extends LocalFiscalAgentRunner
        {
            public function exposeMergeRuntimeConfig(array $localConfig, array $runtimeConfig): array
            {
                return $this->mergeRuntimeConfig($localConfig, $runtimeConfig);
            }
        };

        $merged = $runner->exposeMergeRuntimeConfig([
            'agent' => [
                'poll_interval_seconds' => 3,
            ],
            'printer' => [
                'enabled' => true,
                'connector' => 'windows',
                'name' => 'POS-58',
            ],
        ], [
            'poll_interval_seconds' => 12,
            'printer' => [
                'enabled' => false,
                'connector' => 'tcp',
                'name' => 'Central Override',
            ],
        ]);

        $this->assertSame(12, $merged['agent']['poll_interval_seconds']);
        $this->assertTrue($merged['printer']['enabled']);
        $this->assertSame('windows', $merged['printer']['connector']);
        $this->assertSame('POS-58', $merged['printer']['name']);
    }
}
