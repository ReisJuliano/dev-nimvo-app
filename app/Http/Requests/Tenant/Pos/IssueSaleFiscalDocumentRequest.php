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
            'mode' => ['nullable', 'string', Rule::in(['auto', 'sefaz', 'local_test'])],
            'document_model' => ['required', 'string', Rule::in(['55', '65'])],
            'recipient' => ['nullable', 'array'],
            'recipient.type' => ['nullable', 'string', Rule::in(['customer', 'company', 'document'])],
            'recipient.name' => ['nullable', 'string', 'max:255'],
            'recipient.document' => ['nullable', 'string', 'max:30'],
            'recipient.customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'recipient.company_id' => $companyRules,
            'recipient.email' => ['nullable', 'email', 'max:255'],
        ];
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Customer())->getConnectionName())->hasTable($table);
    }
}
