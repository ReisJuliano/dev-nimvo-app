<?php

namespace App\Http\Requests\Tenant\CashRegister;

use Illuminate\Foundation\Http\FormRequest;

class CloseCashRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'closing_amount' => ['required', 'numeric', 'min:0'],
            'closing_notes' => ['nullable', 'string'],
            'closing_totals' => ['nullable', 'array'],
            'closing_totals.cash' => ['nullable', 'numeric', 'min:0'],
            'closing_totals.pix' => ['nullable', 'numeric', 'min:0'],
            'closing_totals.debit_card' => ['nullable', 'numeric', 'min:0'],
            'closing_totals.credit_card' => ['nullable', 'numeric', 'min:0'],
            'closing_totals.credit' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
