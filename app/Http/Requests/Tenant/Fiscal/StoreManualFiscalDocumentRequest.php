<?php

namespace App\Http\Requests\Tenant\Fiscal;

use App\Support\Tenant\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreManualFiscalDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $allowedPaymentMethods = array_values(array_diff(
            PaymentMethod::saleMethods(),
            [PaymentMethod::MIXED],
        ));

        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],

            'recipient' => ['required', 'array'],
            'recipient.type' => ['required', 'string', Rule::in(['customer', 'document'])],
            'recipient.customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'recipient.name' => ['nullable', 'string', 'max:255'],
            'recipient.document' => ['nullable', 'string', 'max:30'],
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

            'payment_method' => ['required', 'string', Rule::in($allowedPaymentMethods)],
            'deduct_stock' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
