<?php

namespace App\Http\Requests\Tenant\Pos;

use App\Support\Tenant\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FinalizeSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order_draft_id' => ['nullable', 'integer', 'exists:order_drafts,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'issue_fiscal' => ['nullable', 'boolean'],
            'fiscal_mode' => ['nullable', 'string', Rule::in(['auto', 'sefaz', 'local_test'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.method' => ['required', 'string', Rule::in(PaymentMethod::all())],
            'payments.*.amount' => ['nullable', 'numeric', 'gt:0'],
        ];
    }
}
