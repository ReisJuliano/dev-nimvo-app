<?php

namespace App\Http\Requests\Tenant\Pos;

use App\Models\Tenant\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class IssueSaleFiscalDocumentRequest extends FormRequest
{
    protected array $schemaTableCache = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyRules = $this->hasTable('companies')
            ? ['nullable', 'integer', 'exists:companies,id']
            : ['nullable', 'integer'];

        return [
            'mode' => ['nullable', 'string', Rule::in(['auto', 'sefaz', 'local_test', 'contingency_offline'])],
            'contingency_reason' => ['nullable', 'string', 'min:15', 'max:255'],
            'document_model' => ['required', 'string', Rule::in(['55', '65'])],
            'recipient' => ['nullable', 'array'],
            'recipient.type' => ['nullable', 'string', Rule::in(['customer', 'company', 'document'])],
            'recipient.name' => ['nullable', 'string', 'max:255'],
            'recipient.document' => ['nullable', 'string', 'max:30'],
            'recipient.customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'recipient.company_id' => $companyRules,
            'recipient.email' => ['nullable', 'email', 'max:255'],
            'recipient.phone' => ['nullable', 'string', 'max:30'],
            'recipient.state_registration' => ['nullable', 'string', 'max:30'],
            'recipient.ie_indicator' => ['nullable', 'string', Rule::in(['1', '2', '9'])],
            'recipient.street' => ['nullable', 'string', 'max:255'],
            'recipient.number' => ['nullable', 'string', 'max:60'],
            'recipient.complement' => ['nullable', 'string', 'max:255'],
            'recipient.district' => ['nullable', 'string', 'max:255'],
            'recipient.city_name' => ['nullable', 'string', 'max:255'],
            'recipient.city_code' => ['nullable', 'string', 'max:10'],
            'recipient.state' => ['nullable', 'string', 'size:2'],
            'recipient.zip_code' => ['nullable', 'string', 'max:12'],
            'recipient.consumer_final' => ['nullable', 'boolean'],
        ];
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Customer())->getConnectionName())->hasTable($table);
    }
}
