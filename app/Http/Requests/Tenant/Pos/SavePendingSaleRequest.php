<?php

namespace App\Http\Requests\Tenant\Pos;

use Illuminate\Foundation\Http\FormRequest;

class SavePendingSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cash_register_id' => ['nullable', 'integer', 'exists:cash_registers,id'],
            'order_draft_id' => ['nullable', 'integer', 'exists:order_drafts,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'max:20'],
            'cart_payload' => ['required', 'array'],
            'cart_payload.*.id' => ['required', 'integer'],
            'cart_payload.*.qty' => ['required', 'numeric', 'gt:0'],
            'discount_payload' => ['nullable', 'array'],
            'payment_payload' => ['nullable', 'array'],
        ];
    }
}
