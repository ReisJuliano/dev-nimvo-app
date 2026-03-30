<?php

namespace Tests\Feature;

use App\Http\Middleware\HandleInertiaRequests;
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
        $this->assertContains(HandleInertiaRequests::class, $dashboardMiddleware);
        $this->assertContains(InitializeTenancyByDomain::class, $ordersMiddleware);
        $this->assertContains(PreventAccessFromCentralDomains::class, $ordersMiddleware);
        $this->assertContains(HandleInertiaRequests::class, $ordersMiddleware);
        $this->assertLessThan(
            array_search(HandleInertiaRequests::class, $dashboardMiddleware, true),
            array_search(InitializeTenancyByDomain::class, $dashboardMiddleware, true),
        );
        $this->assertLessThan(
            array_search(HandleInertiaRequests::class, $ordersMiddleware, true),
            array_search(InitializeTenancyByDomain::class, $ordersMiddleware, true),
        );
    }
}
