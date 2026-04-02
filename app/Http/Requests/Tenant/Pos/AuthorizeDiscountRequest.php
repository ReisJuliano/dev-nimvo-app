<?php

namespace App\Http\Requests\Tenant\Pos;

use Illuminate\Foundation\Http\FormRequest;

class AuthorizeDiscountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'authorizer_user_id' => ['required', 'integer', 'exists:users,id'],
            'authorizer_password' => ['required', 'string'],
        ];
    }
}
