<?php

namespace App\Services\Central;

use App\Models\Central\Client;
use App\Models\Tenant;

class ProvisionTenantService
{
    public function handle(array $data): Tenant
    {
        $tenantData = [
            'name' => $data['tenant_name'] ?? $data['client_name'],
            'email' => $data['client_email'] ?? null,
        ];

        if (!empty($data['tenant_id'])) {
            $tenantData['id'] = $data['tenant_id'];
        }

        $tenant = Tenant::create($tenantData);

        $tenant->domains()->create([
            'domain' => $data['domain'],
        ]);

        Client::create([
            'tenant_id' => $tenant->id,
            'name' => $data['client_name'],
            'email' => $data['client_email'] ?? null,
            'document' => $data['client_document'] ?? null,
            'domain' => $data['domain'],
            'active' => $data['active'] ?? true,
        ]);

        return $tenant->fresh(['domains', 'client']);
    }
}
