<?php

namespace App\Support\Tenant;

use App\Models\Tenant;
use Closure;

class TenantContext
{
    public function run(string $tenantId, Closure $callback): mixed
    {
        $tenant = Tenant::query()->findOrFail($tenantId);
        $shouldEnd = true;

        if (function_exists('tenant') && tenant()?->getTenantKey() === $tenant->getTenantKey()) {
            $shouldEnd = false;
        } else {
            tenancy()->initialize($tenant);
        }

        try {
            return $callback($tenant);
        } finally {
            if ($shouldEnd) {
                tenancy()->end();
            }
        }
    }
}
