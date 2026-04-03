<?php

namespace App\Http\Requests\Central;

use App\Models\Central\Client;
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
        $domain = trim((string) $this->input('domain'));
        $domain = preg_replace('#^https?://#i', '', $domain);
        $domain = rtrim((string) $domain, '/');

        $tenantId = trim((string) $this->input('tenant_id'));

        if ($tenantId === '') {
            $tenantId = Str::slug((string) ($this->input('tenant_name') ?: $this->input('client_name')));
        }

        $this->merge([
            'tenant_id' => $tenantId,
            'domain' => $domain,
            'active' => $this->boolean('active', true),
        ]);
    }

    public function rules(): array
    {
        $domainRules = ['required', 'string', 'max:255', Rule::unique('domains', 'domain')];

        if ($this->clientsTableExists()) {
            $domainRules[] = Rule::unique('clients', 'domain');
        }

        return [
            'client_name' => ['required', 'string', 'max:120'],
            'tenant_name' => ['nullable', 'string', 'max:120'],
            'tenant_id' => ['required', 'string', 'max:60', Rule::unique('tenants', 'id')],
            'domain' => $domainRules,
            'client_email' => ['nullable', 'email', 'max:120'],
            'client_document' => ['nullable', 'string', 'max:30'],
            'active' => ['required', 'boolean'],
        ];
    }

    protected function clientsTableExists(): bool
    {
        return Schema::connection((new Client())->getConnectionName())->hasTable('clients');
    }
}
