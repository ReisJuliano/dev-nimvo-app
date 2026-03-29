<?php

namespace App\Http\Requests\Tenant\Orders;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertOrderDraftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(['comanda', 'mesa', 'pedido'])],
            'reference' => ['nullable', 'string', 'max:80'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array'],
            'items.*.id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
        ];
    }
}
