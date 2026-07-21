<?php

namespace App\Console\Commands;

use App\Mail\AccountantPackageMail;
use App\Models\Tenant as TenantModel;
use App\Services\Tenant\Fiscal\AccountantExportService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class SendAccountantPackages extends Command
{
    protected $signature = 'nimvo:send-accountant-packages {--year=} {--month=}';

    protected $description = 'Envia por e-mail o pacote fiscal mensal do contador pros tenants com envio automatico ligado';

    public function handle(): int
    {
        $reference = now()->subMonthNoOverflow();
        $year = (int) ($this->option('year') ?: $reference->format('Y'));
        $month = (int) ($this->option('month') ?: $reference->format('n'));
        $sent = 0;

        foreach (TenantModel::query()->get() as $tenant) {
            tenancy()->initialize($tenant);

            try {
                $settings = app(TenantSettingsService::class)->get();
                $email = (string) data_get($settings, 'accountant.email', '');
                $autoSendEnabled = (bool) data_get($settings, 'accountant.auto_send_enabled', false);

                if (! $autoSendEnabled || $email === '') {
                    continue;
                }

                $zipPath = app(AccountantExportService::class)->buildZip($year, $month);

                Mail::to($email)->send(new AccountantPackageMail(
                    (string) ($tenant->name ?: $tenant->id),
                    $year,
                    $month,
                    Storage::disk('local')->path($zipPath),
                ));

                $sent++;
                $this->line("Tenant {$tenant->id}: pacote de {$month}/{$year} enviado para {$email}.");
            } catch (\Throwable $exception) {
                $this->error("Tenant {$tenant->id}: falha ao enviar pacote do contador — {$exception->getMessage()}");
            } finally {
                tenancy()->end();
            }
        }

        $this->info("Total de pacotes enviados: {$sent}.");

        return self::SUCCESS;
    }
}
