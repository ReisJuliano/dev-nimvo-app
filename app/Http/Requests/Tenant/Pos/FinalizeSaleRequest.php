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
            'cash_received' => ['nullable', 'numeric', 'min:0'],
            'fiscal_decision' => ['nullable', 'string', Rule::in(['close', 'emit'])],
            'requested_document_model' => ['nullable', 'string', Rule::in(['55', '65'])],
            'recipient_payload' => ['nullable', 'array'],
            'recipient_payload.type' => ['nullable', 'string', Rule::in(['customer', 'company', 'document'])],
            'recipient_payload.name' => ['nullable', 'string', 'max:255'],
            'recipient_payload.document' => ['nullable', 'string', 'max:30'],
            'recipient_payload.customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'recipient_payload.company_id' => $companyRules,
            'recipient_payload.email' => ['nullable', 'email', 'max:255'],
            'recipient_payload.phone' => ['nullable', 'string', 'max:30'],
            'recipient_payload.state_registration' => ['nullable', 'string', 'max:30'],
            'recipient_payload.ie_indicator' => ['nullable', 'string', Rule::in(['1', '2', '9'])],
            'recipient_payload.street' => ['nullable', 'string', 'max:255'],
            'recipient_payload.number' => ['nullable', 'string', 'max:60'],
            'recipient_payload.complement' => ['nullable', 'string', 'max:255'],
            'recipient_payload.district' => ['nullable', 'string', 'max:255'],
            'recipient_payload.city_name' => ['nullable', 'string', 'max:255'],
            'recipient_payload.city_code' => ['nullable', 'string', 'max:10'],
            'recipient_payload.state' => ['nullable', 'string', 'size:2'],
            'recipient_payload.zip_code' => ['nullable', 'string', 'max:12'],
            'recipient_payload.consumer_final' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'gt:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.discount_scope' => ['nullable', 'string', 'max:20'],
            'items.*.discount_authorized_by' => ['nullable', 'integer', 'exists:users,id'],
            'items.*.discount_authorized_at' => ['nullable', 'date'],
            'items.*.discount_authorized_offline' => ['nullable', 'boolean'],
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
