<?php

namespace Tests\Feature;

use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantDomainRoutingTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_tenant_subdomain_returns_not_found(): void
    {
        $response = $this->get('http://inexistente.nimvo.com.br/login');

        $response->assertNotFound();
    }

    public function test_registered_tenant_subdomain_can_access_tenant_routes(): void
    {
        $tenant = Tenant::create([
            'id' => 'tenant-alpha',
            'name' => 'Tenant Alpha',
            'email' => 'alpha@nimvo.com.br',
        ]);

        $tenant->domains()->create([
            'domain' => 'alpha.nimvo.com.br',
        ]);

        $response = $this->get('http://alpha.nimvo.com.br/login');

        $response->assertOk();
    }

    public function test_central_routes_are_not_available_on_tenant_subdomains(): void
    {
        $tenant = Tenant::create([
            'id' => 'tenant-alpha',
            'name' => 'Tenant Alpha',
            'email' => 'alpha@nimvo.com.br',
        ]);

        $tenant->domains()->create([
            'domain' => 'alpha.nimvo.com.br',
        ]);

        $response = $this->get('http://alpha.nimvo.com.br/admin');

        $response->assertNotFound();
    }

    public function test_central_routes_stay_available_on_root_domain(): void
    {
        $response = $this->get('http://nimvo.com.br/admin');

        $response->assertRedirect('/admin/login');
    }
}
