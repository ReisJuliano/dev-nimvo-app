<?php

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;

class TenancyConfigurationTest extends TestCase
{
    public function test_tenancy_config_enables_database_bootstrapping_outside_single_database_mode(): void
    {
        $config = file_get_contents(dirname(__DIR__, 2).'/config/tenancy.php');

        $this->assertIsString($config);
        $this->assertStringContainsString('FILTER_VALIDATE_BOOLEAN', $config);
        $this->assertStringContainsString(
            '$devSingleDatabase ? null : Stancl\\Tenancy\\Bootstrappers\\DatabaseTenancyBootstrapper::class',
            $config,
        );
    }
}
