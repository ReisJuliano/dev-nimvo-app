<?php

namespace App\Console\Commands;

use App\Models\Tenant as TenantModel;
use App\Models\Tenant\PendingSale;
use Illuminate\Console\Command;

class PruneOldPendingSales extends Command
{
    protected $signature = 'nimvo:prune-pending-sales {--days=3 : Apagar vendas pendentes mais velhas que X dias}';

    protected $description = 'Remove vendas pendentes obsoletas de todos os tenants';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);
        $total = 0;

        foreach (TenantModel::query()->get() as $tenant) {
            tenancy()->initialize($tenant);

            try {
                $count = PendingSale::query()
                    ->where('updated_at', '<', $cutoff)
                    ->delete();

                $total += $count;

                if ($count > 0) {
                    $this->line("Tenant {$tenant->id}: {$count} venda(s) pendente(s) removida(s).");
                }
            } catch (\Throwable) {
                // Tenants antigos podem ainda não ter a tabela de vendas pendentes.
            } finally {
                tenancy()->end();
            }
        }

        $this->info("Total removido: {$total} venda(s) pendente(s) com mais de {$days} dia(s).");

        return self::SUCCESS;
    }
}
