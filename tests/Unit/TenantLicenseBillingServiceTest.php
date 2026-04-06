<?php

namespace Tests\Unit;

use App\Models\Central\TenantLicense;
use App\Services\Central\NullLicenseBillingGateway;
use App\Services\Central\TenantLicenseBillingService;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\TestCase;

class TenantLicenseBillingServiceTest extends TestCase
{
    public function test_it_generates_distinct_references_for_multiple_cycles_in_the_same_month(): void
    {
        $service = new TenantLicenseBillingService(new NullLicenseBillingGateway());
        $buildReference = \Closure::bind(
            fn (TenantLicense $license, Carbon $periodStart) => $this->buildReference($license, $periodStart),
            $service,
            TenantLicenseBillingService::class,
        );

        $license = new TenantLicense([
            'tenant_id' => 'tenant-alpha',
        ]);

        $firstReference = $buildReference($license, Carbon::parse('2026-04-01'));
        $secondReference = $buildReference($license, Carbon::parse('2026-04-05'));

        $this->assertSame('LIC-tenant-alpha-20260401', $firstReference);
        $this->assertSame('LIC-tenant-alpha-20260405', $secondReference);
        $this->assertNotSame($firstReference, $secondReference);
    }
}
