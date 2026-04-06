<?php

namespace App\Services\Central;

use App\Models\Central\Client;
use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ProvisionTenantService
{
    public function handle(array $data): Tenant
    {
        $tenantData = [
            'name' => $data['tenant_name'] ?? $data['client_name'],
            'email' => $data['client_email'] ?? null,
        ];

        $tenantData['id'] = $this->resolveTenantId($data);

        $tenant = Tenant::create($tenantData);

        $tenant->domains()->create([
            'domain' => $data['domain'],
        ]);

        if ($this->clientsTableExists()) {
            Client::create([
                'tenant_id' => $tenant->id,
                'name' => $data['client_name'],
                'email' => $data['client_email'] ?? null,
                'document' => $data['client_document'] ?? null,
                'domain' => $data['domain'],
                'active' => $data['active'] ?? true,
            ]);
        }

        if (!config('tenancy.dev_single_database')) {
            tenancy()->initialize($tenant);

            Artisan::call('db:seed', [
                '--class' => 'TenantDatabaseSeeder',
                '--force' => true,
            ]);

            tenancy()->end();
        }

        return $tenant->fresh(['domains', 'client']);
    }

    protected function clientsTableExists(): bool
    {
        return Schema::connection((new Client())->getConnectionName())->hasTable('clients');
    }

    protected function resolveTenantId(array $data): string
    {
        $tenantId = trim((string) ($data['tenant_id'] ?? ''));

        if ($tenantId !== '') {
            return $tenantId;
        }

        $baseId = Str::slug((string) ($data['subdomain'] ?? $data['tenant_name'] ?? $data['client_name'] ?? 'tenant'));

        if ($baseId === '') {
            $baseId = 'tenant';
        }

        $tenantId = $baseId;
        $suffix = 2;

        while (Tenant::query()->whereKey($tenantId)->exists()) {
            $tenantId = sprintf('%s-%d', $baseId, $suffix);
            $suffix++;
        }

        return $tenantId;
    }
}
