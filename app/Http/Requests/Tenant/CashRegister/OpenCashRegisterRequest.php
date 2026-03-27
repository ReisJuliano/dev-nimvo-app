<?php

namespace App\Http\Requests\Tenant\CashRegister;

use Illuminate\Foundation\Http\FormRequest;

class OpenCashRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'opening_amount' => ['nullable', 'numeric', 'min:0'],
            'opening_notes' => ['nullable', 'string'],
        ];
    }
}
