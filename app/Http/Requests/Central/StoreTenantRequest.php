<?php

namespace App\Http\Requests\Central;

use App\Models\Central\Client;
use App\Support\Tenancy\TenantDomainManager;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth('central_admin')->check();
    }

    protected function prepareForValidation(): void
    {
        $domainManager = app(TenantDomainManager::class);
        $subdomain = $domainManager->normalizeSubdomain((string) $this->input('subdomain', $this->input('domain')));

        $tenantId = trim((string) $this->input('tenant_id'));

        if ($tenantId === '') {
            $tenantId = Str::slug((string) ($subdomain ?: $this->input('tenant_name') ?: $this->input('client_name')));
        }

        $this->merge([
            'tenant_id' => $tenantId,
            'subdomain' => strtolower($subdomain),
            'domain' => $domainManager->buildTenantDomain($subdomain),
            'active' => $this->boolean('active', true),
        ]);
    }

    public function rules(): array
    {
        $domainManager = app(TenantDomainManager::class);
        $domainRules = ['required', 'string', 'max:255', Rule::unique('domains', 'domain')];
        $subdomainRules = [
            'required',
            'string',
            'min:2',
            'max:63',
            'regex:/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/',
        ];

        if ($domainManager->reservedSubdomains() !== []) {
            $subdomainRules[] = Rule::notIn($domainManager->reservedSubdomains());
        }

        if ($this->clientsTableExists()) {
            $domainRules[] = Rule::unique('clients', 'domain');
        }

        return [
            'client_name' => ['required', 'string', 'max:120'],
            'tenant_name' => ['nullable', 'string', 'max:120'],
            'tenant_id' => ['required', 'string', 'max:60', Rule::unique('tenants', 'id')],
            'subdomain' => $subdomainRules,
            'domain' => $domainRules,
            'client_email' => ['nullable', 'email', 'max:120'],
            'client_document' => ['nullable', 'string', 'max:30'],
            'active' => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'subdomain.regex' => 'Use apenas letras minúsculas, números e hífen no subdomínio.',
            'subdomain.not_in' => 'Este subdomínio é reservado e não pode ser usado por um tenant.',
        ];
    }

    protected function clientsTableExists(): bool
    {
        return Schema::connection((new Client())->getConnectionName())->hasTable('clients');
    }
}
