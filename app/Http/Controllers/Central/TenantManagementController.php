<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Http\Requests\Central\StoreTenantRequest;
use App\Http\Requests\Central\UpdateTenantSettingsRequest;
use App\Http\Requests\Central\UpdateTenantStatusRequest;
use App\Models\Central\Client;
use App\Models\Central\TenantLicenseInvoice;
use App\Models\Central\TenantSetting;
use App\Models\Tenant;
use App\Services\Central\ProvisionTenantService;
use App\Services\Central\TenantLicenseService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class TenantManagementController extends Controller
{
    public function store(
        StoreTenantRequest $request,
        ProvisionTenantService $provisionTenantService,
    ): JsonResponse {
        $tenant = $provisionTenantService->handle($request->validated());

        return response()->json([
            'message' => 'Tenant criado com sucesso.',
            'tenant' => [
                'id' => (string) $tenant->id,
            ],
        ]);
    }

    public function update(
        Request $request,
        Tenant $tenant,
    ): JsonResponse {
        $domain = trim((string) $request->input('domain'));
        $domain = preg_replace('#^https?://#i', '', $domain);
        $domain = rtrim((string) $domain, '/');
        $request->merge([
            'domain' => $domain,
            'active' => $request->boolean('active', true),
        ]);

        $client = Client::query()->firstWhere('tenant_id', $tenant->id);
        $tenantDomain = $tenant->domains()->orderBy('id')->first();

        $data = $request->validate([
            'client_name' => ['required', 'string', 'max:120'],
            'tenant_name' => ['nullable', 'string', 'max:120'],
            'domain' => [
                'required',
                'string',
                'max:255',
                Rule::unique('domains', 'domain')->ignore($tenantDomain?->getKey()),
                Rule::unique('clients', 'domain')->ignore($client?->getKey()),
            ],
            'client_email' => ['nullable', 'email', 'max:120'],
            'client_document' => ['nullable', 'string', 'max:30'],
            'active' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($data, $tenant): void {
            $tenant->forceFill([
                'name' => $data['tenant_name'] ?: $data['client_name'],
                'email' => $data['client_email'] ?? null,
            ])->save();

            $domain = $tenant->domains()->orderBy('id')->first();

            if ($domain) {
                $domain->update([
                    'domain' => $data['domain'],
                ]);
            } else {
                $tenant->domains()->create([
                    'domain' => $data['domain'],
                ]);
            }

            Client::query()->updateOrCreate(
                ['tenant_id' => $tenant->id],
                [
                    'name' => $data['client_name'],
                    'email' => $data['client_email'] ?? null,
                    'document' => $data['client_document'] ?? null,
                    'domain' => $data['domain'],
                    'active' => $data['active'],
                ],
            );
        });

        return response()->json([
            'message' => 'Tenant atualizado com sucesso.',
        ]);
    }

    public function updateStatus(
        UpdateTenantStatusRequest $request,
        Tenant $tenant,
    ): JsonResponse {
        $client = Client::query()->firstWhere('tenant_id', $tenant->id);

        if ($client) {
            $client->update([
                'active' => $request->boolean('active'),
            ]);
        }

        return response()->json([
            'message' => $request->boolean('active')
                ? 'Tenant ativado com sucesso.'
                : 'Tenant desativado com sucesso.',
        ]);
    }

    public function destroy(Tenant $tenant): JsonResponse
    {
        $tenantName = $tenant->name
            ?: Client::query()->where('tenant_id', $tenant->id)->value('name')
            ?: (string) $tenant->id;

        Client::query()->where('tenant_id', $tenant->id)->delete();

        if (Schema::connection((new TenantSetting())->getConnectionName())->hasTable('tenant_settings')) {
            TenantSetting::query()->where('tenant_id', $tenant->id)->delete();
        }

        $tenant->delete();

        return response()->json([
            'message' => sprintf('Tenant %s excluido com sucesso.', $tenantName),
        ]);
    }

    public function updateSettings(
        UpdateTenantSettingsRequest $request,
        Tenant $tenant,
        TenantSettingsService $settingsService,
    ): JsonResponse {
        $settings = $settingsService->update($request->validated(), (string) $tenant->id);

        return response()->json([
            'message' => 'Configuracoes salvas.',
            'settings' => $settings,
        ]);
    }

    public function updateLicense(
        Request $request,
        Tenant $tenant,
        TenantLicenseService $licenseService,
    ): JsonResponse {
        $data = $request->validate([
            'starts_at' => ['required', 'date'],
            'cycle_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'grace_days' => ['nullable', 'integer', 'min:0', 'max:90'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'paused', 'blocked'])],
        ]);

        $license = $licenseService->upsert((string) $tenant->id, $data);
        $state = $licenseService->stateForTenant((string) $tenant->id);

        return response()->json([
            'message' => 'Licenca atualizada com sucesso.',
            'license' => [
                'id' => $license->id,
                'starts_at' => $license->starts_at?->toDateString(),
                'cycle_days' => (int) $license->cycle_days,
                'grace_days' => (int) $license->grace_days,
                'amount' => $license->amount !== null ? (float) $license->amount : null,
                'status' => $license->status,
                'state' => $state,
                'invoices' => $license->invoices
                    ->map(fn ($invoice) => [
                        'id' => $invoice->id,
                        'reference' => $invoice->reference,
                        'due_date' => $invoice->due_date?->toDateString(),
                        'status' => $invoice->status,
                        'amount' => (float) $invoice->amount,
                        'payment_method' => $invoice->payment_method,
                        'boleto_url' => $invoice->boleto_url,
                        'pix_payload' => $invoice->pix_payload,
                    ])
                    ->values()
                    ->all(),
            ],
        ]);
    }

    public function updateLicenseInvoiceStatus(
        Request $request,
        TenantLicenseInvoice $invoice,
        TenantLicenseService $licenseService,
    ): JsonResponse {
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'paid'])],
        ]);

        $invoice = $data['status'] === 'paid'
            ? $licenseService->markInvoicePaid($invoice)
            : $licenseService->markInvoicePending($invoice);

        return response()->json([
            'message' => $data['status'] === 'paid'
                ? 'Fatura marcada como paga.'
                : 'Fatura marcada como pendente.',
            'invoice' => [
                'id' => $invoice->id,
                'reference' => $invoice->reference,
                'status' => $invoice->status,
                'due_date' => $invoice->due_date?->toDateString(),
                'amount' => (float) $invoice->amount,
                'paid_at' => $invoice->paid_at?->toIso8601String(),
                'payment_method' => $invoice->payment_method,
                'boleto_url' => $invoice->boleto_url,
                'pix_payload' => $invoice->pix_payload,
            ],
        ]);
    }
}
