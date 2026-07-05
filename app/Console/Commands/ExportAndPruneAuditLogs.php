<?php

namespace App\Console\Commands;

use App\Models\Tenant as TenantModel;
use App\Models\Tenant\AuditLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class ExportAndPruneAuditLogs extends Command
{
    protected $signature = 'nimvo:export-audit-logs {--months=12 : Exportar e remover logs mais velhos que X meses}';

    protected $description = 'Exporta para storage e remove logs de auditoria antigos de todos os tenants';

    public function handle(): int
    {
        $months = max(1, (int) $this->option('months'));
        $cutoff = now()->subMonths($months);
        $totalExported = 0;

        foreach (TenantModel::query()->get() as $tenant) {
            tenancy()->initialize($tenant);

            try {
                $logs = AuditLog::query()
                    ->where('occurred_at', '<', $cutoff)
                    ->orderBy('occurred_at')
                    ->get();

                if ($logs->isEmpty()) {
                    continue;
                }

                $path = 'audit-exports/audit-logs-'.now()->format('Y-m-d_His').'.json';

                Storage::disk('local')->put($path, $logs->toJson(JSON_PRETTY_PRINT));

                AuditLog::query()
                    ->whereIn('id', $logs->pluck('id'))
                    ->delete();

                $totalExported += $logs->count();

                $this->line("Tenant {$tenant->id}: {$logs->count()} log(s) exportado(s) para {$path}.");
            } catch (\Throwable) {
                // Tenants antigos podem ainda nao ter a tabela de auditoria.
            } finally {
                tenancy()->end();
            }
        }

        $this->info("Total exportado e removido: {$totalExported} log(s) com mais de {$months} mes(es).");

        return self::SUCCESS;
    }
}
