<?php

namespace App\Services\Central;

use App\Models\Central\TenantLicense;
use App\Models\Central\TenantLicenseInvoice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

class TenantLicenseService
{
    public function __construct(
        protected TenantLicenseBillingService $billingService,
    ) {
    }

    public function upsert(string $tenantId, array $data): TenantLicense
    {
        $startsAt = filled($data['starts_at'] ?? null)
            ? Carbon::parse((string) $data['starts_at'])->startOfDay()
            : now()->startOfDay();

        $license = TenantLicense::query()->updateOrCreate(
            ['tenant_id' => $tenantId],
            [
                'starts_at' => $startsAt->toDateString(),
                'cycle_days' => max(1, (int) ($data['cycle_days'] ?? 30)),
                'grace_days' => max(0, (int) ($data['grace_days'] ?? 10)),
                'amount' => $data['amount'] ?? null,
                'status' => $data['status'] ?? 'active',
            ],
        );

        $this->ensureInvoices($license);

        return $license->fresh('invoices');
    }

    public function markInvoicePaid(TenantLicenseInvoice $invoice): TenantLicenseInvoice
    {
        $invoice->forceFill([
            'status' => 'paid',
            'paid_at' => now(),
        ])->save();

        return $invoice->fresh();
    }

    public function markInvoicePending(TenantLicenseInvoice $invoice): TenantLicenseInvoice
    {
        $invoice->forceFill([
            'status' => 'pending',
            'paid_at' => null,
        ])->save();

        return $invoice->fresh();
    }

    public function stateForTenant(?string $tenantId): ?array
    {
        if (!$tenantId || !$this->licenseTablesExist()) {
            return null;
        }

        $license = TenantLicense::query()
            ->with(['invoices' => fn ($query) => $query->orderBy('due_date')])
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$license) {
            return null;
        }

        $this->ensureInvoices($license);
        $license->load(['invoices' => fn ($query) => $query->orderBy('due_date')]);

        $today = now()->startOfDay();
        $activeInvoice = $license->invoices
            ->first(fn (TenantLicenseInvoice $invoice) => $invoice->status !== 'paid')
            ?? $license->invoices->last();

        $dueDate = $activeInvoice?->due_date?->copy()?->startOfDay();
        $graceEndsAt = $dueDate?->copy()?->addDays((int) $license->grace_days);
        $daysRemaining = $dueDate ? $today->diffInDays($dueDate, false) : null;
        $manualBlocked = $license->status === 'blocked';
        $isBlocked = $manualBlocked || ($graceEndsAt ? $today->greaterThan($graceEndsAt) && $activeInvoice?->status !== 'paid' : false);
        $isExpired = $dueDate ? $today->greaterThan($dueDate) && !$isBlocked : false;
        $isWarning = !$isBlocked && $daysRemaining !== null && $daysRemaining <= 7;
        $status = $manualBlocked
            ? 'blocked'
            : ($license->status === 'paused'
                ? 'paused'
                : ($isBlocked ? 'blocked' : ($isExpired ? 'overdue' : ($isWarning ? 'warning' : 'active'))));

        if ($isBlocked && !$license->last_blocked_at) {
            $license->forceFill(['last_blocked_at' => now()])->save();
        }

        return [
            'status' => $status,
            'can_use' => !$isBlocked,
            'starts_at' => $license->starts_at?->toDateString(),
            'cycle_days' => (int) $license->cycle_days,
            'grace_days' => (int) $license->grace_days,
            'amount' => $license->amount !== null ? (float) $license->amount : null,
            'days_remaining' => $daysRemaining,
            'due_date' => $dueDate?->toDateString(),
            'grace_ends_at' => $graceEndsAt?->toDateString(),
            'message' => $this->buildStatusMessage($status, $daysRemaining, $dueDate, $graceEndsAt),
            'invoice' => $activeInvoice ? [
                'id' => $activeInvoice->id,
                'reference' => $activeInvoice->reference,
                'period_start' => $activeInvoice->period_start?->toDateString(),
                'period_end' => $activeInvoice->period_end?->toDateString(),
                'due_date' => $activeInvoice->due_date?->toDateString(),
                'status' => $activeInvoice->status,
                'amount' => (float) $activeInvoice->amount,
                'payment_method' => $activeInvoice->payment_method,
                'boleto_url' => $activeInvoice->boleto_url,
                'pix_payload' => $activeInvoice->pix_payload,
            ] : null,
        ];
    }

    public function ensureInvoices(TenantLicense $license): void
    {
        $today = now()->startOfDay();
        $startsAt = $license->starts_at?->copy()?->startOfDay();

        if (!$startsAt) {
            return;
        }

        $cycleDays = max(1, (int) $license->cycle_days);
        $cycles = max(0, (int) floor($startsAt->diffInDays($today, false) / $cycleDays));

        for ($index = 0; $index <= $cycles; $index++) {
            $periodStart = $startsAt->copy()->addDays($index * $cycleDays);
            $periodEnd = $periodStart->copy()->addDays($cycleDays - 1);
            $dueDate = $periodEnd->copy();

            $this->billingService->firstOrCreateInvoice($license, $periodStart, $periodEnd, $dueDate);
        }
    }

    protected function buildStatusMessage(string $status, ?int $daysRemaining, ?Carbon $dueDate, ?Carbon $graceEndsAt): string
    {
        return match ($status) {
            'blocked' => sprintf(
                'Licenca vencida. Regularize ate %s para liberar novamente o sistema.',
                optional($graceEndsAt)->format('d/m/Y')
            ),
            'paused' => 'Licenca pausada temporariamente no painel administrativo.',
            'overdue' => sprintf(
                'Licenca vencida em %s. O sistema sera bloqueado apos o prazo de tolerancia.',
                optional($dueDate)->format('d/m/Y')
            ),
            'warning' => sprintf(
                'Licenca vence em %d dia(s), na data de %s.',
                max(0, (int) $daysRemaining),
                optional($dueDate)->format('d/m/Y')
            ),
            default => sprintf(
                'Licenca ativa ate %s.',
                optional($dueDate)->format('d/m/Y')
            ),
        };
    }

    protected function licenseTablesExist(): bool
    {
        return Schema::connection((new TenantLicense())->getConnectionName())->hasTable('tenant_licenses')
            && Schema::connection((new TenantLicenseInvoice())->getConnectionName())->hasTable('tenant_license_invoices');
    }
}
