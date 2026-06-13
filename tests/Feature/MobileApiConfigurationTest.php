<?php

namespace Tests\Feature;

use App\Models\Tenant\User;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class MobileApiConfigurationTest extends TestCase
{
    public function test_mobile_routes_are_registered_with_expected_middleware(): void
    {
        $loginRoute = Route::getRoutes()->getByName('mobile.auth.login');
        $dashboardRoute = Route::getRoutes()->getByName('mobile.dashboard');

        $this->assertNotNull($loginRoute);
        $this->assertNotNull($dashboardRoute);

        $this->assertContains('throttle:10,1', $loginRoute->gatherMiddleware());
        $this->assertContains('auth:sanctum', $dashboardRoute->gatherMiddleware());
    }

    public function test_tenant_user_supports_sanctum_tokens(): void
    {
        $user = new User();

        $this->assertTrue(method_exists($user, 'createToken'));
        $this->assertTrue(method_exists($user, 'tokens'));
    }
}
