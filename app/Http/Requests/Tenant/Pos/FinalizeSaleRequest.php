<?php

namespace App\Http\Requests\Tenant\Pos;

use App\Models\Tenant\Customer;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class FinalizeSaleRequest extends FormRequest
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
            'cash_register_id' => ['nullable', 'integer', 'exists:cash_registers,id'],
            'order_draft_id' => ['nullable', 'integer', 'exists:order_drafts,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'company_id' => $companyRules,
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'fiscal_decision' => ['nullable', 'string', Rule::in(['close', 'emit'])],
            'requested_document_model' => ['nullable', 'string', Rule::in(['55', '65'])],
            'recipient_payload' => ['nullable', 'array'],
            'recipient_payload.type' => ['nullable', 'string', Rule::in(['customer', 'company', 'document'])],
            'recipient_payload.name' => ['nullable', 'string', 'max:255'],
            'recipient_payload.document' => ['nullable', 'string', 'max:30'],
            'recipient_payload.customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'recipient_payload.company_id' => $companyRules,
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'gt:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.discount_scope' => ['nullable', 'string', 'max:20'],
            'items.*.discount_authorized_by' => ['nullable', 'integer', 'exists:users,id'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.method' => ['required', 'string', Rule::in(PaymentMethod::all())],
            'payments.*.amount' => ['nullable', 'numeric', 'gt:0'],
        ];
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Customer())->getConnectionName())->hasTable($table);
    }
}
