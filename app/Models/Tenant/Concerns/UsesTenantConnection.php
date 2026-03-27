<?php

namespace App\Models\Tenant\Concerns;

trait UsesTenantConnection
{
    public function getConnectionName(): ?string
    {
        if (config('tenancy.dev_single_database')) {
            return config('tenancy.dev_single_database_connection');
        }

        return parent::getConnectionName();
    }
}
