<?php

namespace App\Console\Commands;

use App\Models\Tenant as TenantModel;
use App\Models\Tenant\ProductExpiry;
use Illuminate\Console\Command;

class PruneExpiredProductLots extends Command
{
    protected $signature = 'nimvo:prune-expired-lots';

    protected $description = 'Remove registros de validade zerados apos a data de vencimento, em todos os tenants';

    public function handle(): int
    {
        $total = 0;

        foreach (TenantModel::query()->get() as $tenant) {
            tenancy()->initialize($tenant);

            try {
                $count = ProductExpiry::query()
                    ->where('quantity', '<=', 0)
                    ->whereDate('expires_at', '<', now())
                    ->delete();

                $total += $count;

                if ($count > 0) {
                    $this->line("Tenant {$tenant->id}: {$count} registro(s) de validade removido(s).");
                }
            } catch (\Throwable) {
                // Tenants antigos podem ainda nao ter a tabela de validade.
            } finally {
                tenancy()->end();
            }
        }

        $this->info("Total removido: {$total} registro(s) de validade zerados e vencidos.");

        return self::SUCCESS;
    }
}
