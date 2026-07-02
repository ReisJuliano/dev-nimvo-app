<?php

use App\Services\Central\LocalAgentBootstrapService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        if (
            ! Schema::connection($this->connection)->hasTable('tenants')
            || ! Schema::connection($this->connection)->hasTable('local_agents')
        ) {
            return;
        }

        $bootstrap = app(LocalAgentBootstrapService::class);
        $tenants = DB::connection($this->connection)
            ->table('tenants')
            ->select(['id', 'name'])
            ->orderBy('id')
            ->get();

        foreach ($tenants as $tenant) {
            $bootstrap->ensureDefaultForTenant((string) $tenant->id, [
                'name' => sprintf('Agente local %s', $tenant->name ?: $tenant->id),
            ]);
        }
    }

    public function down(): void
    {
    }
};
