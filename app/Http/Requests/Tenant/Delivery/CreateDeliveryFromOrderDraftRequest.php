<?php

namespace App\Http\Requests\Tenant\Delivery;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateDeliveryFromOrderDraftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'reference' => ['nullable', 'string', 'max:80'],
            'channel' => ['required', Rule::in(['delivery', 'retirada'])],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:60'],
            'courier_name' => ['nullable', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'neighborhood' => ['nullable', 'string', 'max:255'],
            'delivery_fee' => ['nullable', 'numeric', 'gte:0'],
            'scheduled_for' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}

