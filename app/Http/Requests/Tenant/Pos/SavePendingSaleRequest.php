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
            'cart_payload.*.code' => ['nullable', 'string', 'max:255'],
            'cart_payload.*.barcode' => ['nullable', 'string', 'max:255'],
            'cart_payload.*.name' => ['nullable', 'string', 'max:255'],
            'cart_payload.*.description' => ['nullable', 'string'],
            'cart_payload.*.unit' => ['nullable', 'string', 'max:50'],
            'cart_payload.*.cost_price' => ['nullable', 'numeric', 'min:0'],
            'cart_payload.*.sale_price' => ['nullable', 'numeric', 'min:0'],
            'cart_payload.*.stock_quantity' => ['nullable', 'numeric'],
            'cart_payload.*.lineSubtotal' => ['nullable', 'numeric', 'min:0'],
            'cart_payload.*.lineDiscount' => ['nullable', 'numeric', 'min:0'],
            'cart_payload.*.lineTotal' => ['nullable', 'numeric', 'min:0'],
            'discount_payload' => ['nullable', 'array'],
            'payment_payload' => ['nullable', 'array'],
        ];
    }
}
