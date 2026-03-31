<?php

namespace App\Http\Requests\Tenant\Delivery;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDeliveryStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['pending', 'dispatched', 'delivered'])],
        ];
    }
}

