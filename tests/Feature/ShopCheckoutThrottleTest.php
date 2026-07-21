<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ShopCheckoutThrottleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate', [
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
        ])->run();

        $this->withoutMiddleware([
            InitializeTenancyByDomain::class,
            PreventAccessFromCentralDomains::class,
        ]);
    }

    public function test_checkout_endpoint_is_rate_limited(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $response = $this->postJson('/shop/api/checkout', []);
            $this->assertNotSame(429, $response->getStatusCode());
        }

        $this->postJson('/shop/api/checkout', [])->assertStatus(429);
    }
}
