<?php

namespace App\Contracts\Central;

use App\Models\Central\TenantLicense;
use App\Models\Central\TenantLicenseInvoice;

interface LicenseBillingGateway
{
    public function driver(): string;

    public function createInvoice(TenantLicense $license, TenantLicenseInvoice $invoice): array;

    public function refreshInvoice(TenantLicenseInvoice $invoice): array;
}
