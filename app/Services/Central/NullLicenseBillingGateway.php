<?php

namespace App\Services\Central;

use App\Contracts\Central\LicenseBillingGateway;
use App\Models\Central\TenantLicense;
use App\Models\Central\TenantLicenseInvoice;

class NullLicenseBillingGateway implements LicenseBillingGateway
{
    public function driver(): string
    {
        return 'null';
    }

    public function createInvoice(TenantLicense $license, TenantLicenseInvoice $invoice): array
    {
        return [
            'status' => $invoice->status ?: 'pending',
            'boleto_url' => null,
            'pix_payload' => null,
            'metadata' => [
                'provider_ready' => false,
                'message' => 'Gateway de cobranca ainda nao configurado.',
            ],
        ];
    }

    public function refreshInvoice(TenantLicenseInvoice $invoice): array
    {
        return [
            'status' => $invoice->status,
            'boleto_url' => $invoice->boleto_url,
            'pix_payload' => $invoice->pix_payload,
            'metadata' => $invoice->metadata,
        ];
    }
}
