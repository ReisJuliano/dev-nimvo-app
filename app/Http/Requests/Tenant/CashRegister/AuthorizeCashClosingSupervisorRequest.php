<?php

namespace App\Http\Requests\Tenant\CashRegister;

use Illuminate\Foundation\Http\FormRequest;

class AuthorizeCashClosingSupervisorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'supervisor_user_id' => ['required', 'integer', 'exists:users,id'],
            'supervisor_password' => ['required', 'string'],
        ];
    }
}
