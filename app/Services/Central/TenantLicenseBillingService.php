<?php

namespace App\Services\Central;

use App\Contracts\Central\LicenseBillingGateway;
use App\Models\Central\TenantLicense;
use App\Models\Central\TenantLicenseInvoice;
use Illuminate\Support\Carbon;

class TenantLicenseBillingService
{
    public function __construct(
        protected LicenseBillingGateway $gateway,
    ) {
    }

    public function firstOrCreateInvoice(TenantLicense $license, Carbon $periodStart, Carbon $periodEnd, Carbon $dueDate): TenantLicenseInvoice
    {
        $invoice = TenantLicenseInvoice::query()->firstOrCreate(
            [
                'tenant_license_id' => $license->id,
                'period_start' => $periodStart->toDateString(),
            ],
            [
                'reference' => $this->buildReference($license, $periodStart),
                'period_end' => $periodEnd->toDateString(),
                'due_date' => $dueDate->toDateString(),
                'amount' => (float) ($license->amount ?? 0),
                'status' => 'pending',
                'gateway_driver' => $this->gateway->driver(),
            ],
        );

        if (!$invoice->wasRecentlyCreated) {
            return $invoice;
        }

        $gatewayPayload = $this->gateway->createInvoice($license, $invoice);

        $invoice->forceFill([
            'status' => $gatewayPayload['status'] ?? $invoice->status,
            'boleto_url' => $gatewayPayload['boleto_url'] ?? null,
            'pix_payload' => $gatewayPayload['pix_payload'] ?? null,
            'metadata' => $gatewayPayload['metadata'] ?? null,
        ])->save();

        return $invoice->fresh();
    }

    protected function buildReference(TenantLicense $license, Carbon $periodStart): string
    {
        return sprintf(
            'LIC-%s-%s',
            $license->tenant_id,
            $periodStart->format('Ymd')
        );
    }
}
