<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Http\Requests\Central\StoreTenantRequest;
use App\Http\Requests\Central\UpdateTenantSettingsRequest;
use App\Http\Requests\Central\UpdateTenantStatusRequest;
use App\Models\Central\Client;
use App\Models\Central\LocalAgent;
use App\Models\Central\TenantLicenseInvoice;
use App\Models\Central\TenantSetting;
use App\Models\Tenant;
use App\Services\Central\LocalAgentBootstrapService;
use App\Services\Central\LocalAgentConfigService;
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
    protected function clientsTableExists(): bool
    {
        return Schema::connection((new Client())->getConnectionName())->hasTable('clients');
    }

    protected function localAgentsTableExists(): bool
    {
        return Schema::connection((new LocalAgent())->getConnectionName())->hasTable('local_agents');
    }

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

        $client = $this->clientsTableExists()
            ? Client::query()->firstWhere('tenant_id', $tenant->id)
            : null;
        $tenantDomain = $tenant->domains()->orderBy('id')->first();

        $domainRules = [
            'required',
            'string',
            'max:255',
            Rule::unique('domains', 'domain')->ignore($tenantDomain?->getKey()),
        ];

        if ($this->clientsTableExists()) {
            $domainRules[] = Rule::unique('clients', 'domain')->ignore($client?->getKey());
        }

        $data = $request->validate([
            'client_name' => ['required', 'string', 'max:120'],
            'tenant_name' => ['nullable', 'string', 'max:120'],
            'domain' => $domainRules,
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

            if ($this->clientsTableExists()) {
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
            }
        });

        return response()->json([
            'message' => 'Tenant atualizado com sucesso.',
        ]);
    }

    public function updateStatus(
        UpdateTenantStatusRequest $request,
        Tenant $tenant,
    ): JsonResponse {
        $client = $this->clientsTableExists()
            ? Client::query()->firstWhere('tenant_id', $tenant->id)
            : null;

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
            ?: ($this->clientsTableExists() ? Client::query()->where('tenant_id', $tenant->id)->value('name') : null)
            ?: (string) $tenant->id;

        if ($this->clientsTableExists()) {
            Client::query()->where('tenant_id', $tenant->id)->delete();
        }

        if (Schema::connection((new TenantSetting())->getConnectionName())->hasTable('tenant_settings')) {
            TenantSetting::query()->where('tenant_id', $tenant->id)->delete();
        }

        if ($this->localAgentsTableExists()) {
            LocalAgent::query()->where('tenant_id', $tenant->id)->delete();
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

    public function upsertLocalAgent(
        Request $request,
        Tenant $tenant,
        LocalAgentBootstrapService $bootstrapService,
        LocalAgentConfigService $configService,
    ): JsonResponse {
        abort_unless($this->localAgentsTableExists(), 422, 'A tabela de agentes locais ainda nao foi criada neste ambiente.');

        $existingAgent = LocalAgent::query()->firstWhere('tenant_id', $tenant->id);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'active' => ['required', 'boolean'],
            'poll_interval_seconds' => ['nullable', 'integer', 'min:1', 'max:300'],
        ]);

        $agent = $bootstrapService->upsertForTenant((string) $tenant->id, [
            'name' => trim((string) ($data['name'] ?? '')) ?: sprintf('Agente fiscal %s', $tenant->id),
            'active' => $data['active'],
            'runtime_config' => [
                'poll_interval_seconds' => (int) ($data['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3)),
            ],
        ]);

        return response()->json([
            'message' => $existingAgent
                ? 'Agente fiscal atualizado com sucesso.'
                : 'Agente fiscal criado com sucesso.',
            'agent' => $this->serializeLocalAgent($agent, $configService, $bootstrapService),
        ]);
    }

    public function issueLocalAgentActivationCode(
        Request $request,
        Tenant $tenant,
        LocalAgentBootstrapService $bootstrapService,
        LocalAgentConfigService $configService,
    ): JsonResponse {
        abort_unless($this->localAgentsTableExists(), 422, 'A tabela de agentes locais ainda nao foi criada neste ambiente.');

        $agent = LocalAgent::query()->firstWhere('tenant_id', $tenant->id);
        abort_unless($agent, 404, 'Nenhum agente fiscal foi cadastrado para este tenant.');

        $issued = $bootstrapService->issueActivationCode($agent);
        $agent = $issued['agent'];

        return response()->json([
            'message' => 'Codigo de ativacao gerado. Use esse codigo no instalador do agente da maquina.',
            'activation' => [
                'code' => $issued['code'],
                'backend_url' => $issued['backend_url'],
                'generated_at' => $issued['generated_at'],
                'expires_at' => $issued['expires_at'],
            ],
            'agent' => $this->serializeLocalAgent($agent, $configService, $bootstrapService),
        ]);
    }

    protected function serializeLocalAgent(
        LocalAgent $agent,
        LocalAgentConfigService $configService,
        LocalAgentBootstrapService $bootstrapService,
    ): array {
        $runtime = $configService->buildRuntimeConfig($agent);
        $pollInterval = max(1, (int) ($runtime['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3)));
        $heartbeatWindowSeconds = max(90, $pollInterval * 20);
        $isOnline = $agent->active
            && $agent->last_seen_at
            && $agent->last_seen_at->greaterThanOrEqualTo(now()->subSeconds($heartbeatWindowSeconds));
        $status = !$agent->active ? 'inactive' : ($isOnline ? 'online' : 'offline');

        return [
            'id' => $agent->id,
            'name' => $agent->name,
            'agent_key' => $agent->agent_key,
            'active' => (bool) $agent->active,
            'status' => $status,
            'last_ip' => $agent->last_ip,
            'last_seen_at' => optional($agent->last_seen_at)?->toIso8601String(),
            'last_seen_label' => optional($agent->last_seen_at)?->format('d/m/Y H:i'),
            'activation' => $bootstrapService->activationStatus($agent),
            'runtime_config' => $runtime,
            'device' => [
                'machine_name' => data_get($agent->metadata, 'device.machine.name'),
                'machine_user' => data_get($agent->metadata, 'device.machine.user'),
                'certificate_path' => data_get($agent->metadata, 'device.certificate.path'),
                'printer_enabled' => data_get($agent->metadata, 'device.printer.enabled'),
                'printer_connector' => data_get($agent->metadata, 'device.printer.connector'),
                'printer_name' => data_get($agent->metadata, 'device.printer.name'),
                'printer_host' => data_get($agent->metadata, 'device.printer.host'),
                'printer_port' => data_get($agent->metadata, 'device.printer.port'),
                'logo_path' => data_get($agent->metadata, 'device.printer.logo_path'),
                'local_api_enabled' => data_get($agent->metadata, 'device.local_api.enabled'),
                'local_api_host' => data_get($agent->metadata, 'device.local_api.host'),
                'local_api_port' => data_get($agent->metadata, 'device.local_api.port'),
                'local_api_url' => data_get($agent->metadata, 'device.local_api.url'),
                'project_root' => data_get($agent->metadata, 'device.software.project_root'),
                'php_path' => data_get($agent->metadata, 'device.software.php_path'),
                'version' => data_get($agent->metadata, 'device.software.version'),
                'config_path' => data_get($agent->metadata, 'device.software.config_path'),
                'installed_at' => data_get($agent->metadata, 'device.software.installed_at'),
                'last_sync_at' => data_get($agent->metadata, 'device.last_sync_at'),
            ],
        ];
    }
}
