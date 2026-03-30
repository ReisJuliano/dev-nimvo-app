<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class TenantRoutesMiddlewareTest extends TestCase
{
    public function test_tenant_routes_use_tenancy_middleware(): void
    {
        $dashboardRoute = Route::getRoutes()->getByName('dashboard');
        $ordersRoute = Route::getRoutes()->getByName('orders.index');

        $this->assertNotNull($dashboardRoute);
        $this->assertNotNull($ordersRoute);

        $dashboardMiddleware = $dashboardRoute->gatherMiddleware();
        $ordersMiddleware = $ordersRoute->gatherMiddleware();

        $this->assertContains(InitializeTenancyByDomain::class, $dashboardMiddleware);
        $this->assertContains(PreventAccessFromCentralDomains::class, $dashboardMiddleware);
        $this->assertContains(InitializeTenancyByDomain::class, $ordersMiddleware);
        $this->assertContains(PreventAccessFromCentralDomains::class, $ordersMiddleware);
    }
}
