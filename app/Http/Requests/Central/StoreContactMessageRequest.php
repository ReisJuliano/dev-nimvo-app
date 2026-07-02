<?php

namespace App\Http\Requests\Central;

use Illuminate\Foundation\Http\FormRequest;

class StoreContactMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name')),
            'email' => trim((string) $this->input('email')),
            'phone' => trim((string) $this->input('phone')),
            'message' => trim((string) $this->input('message')),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:180'],
            'phone' => ['nullable', 'string', 'max:30'],
            'message' => ['required', 'string', 'min:5', 'max:4000'],
            // Honeypot: real visitors never fill this hidden field.
            'website' => ['nullable', 'string', 'max:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Informe seu nome.',
            'email.required' => 'Informe um e-mail valido.',
            'email.email' => 'Informe um e-mail valido.',
            'message.required' => 'Escreva uma mensagem.',
            'message.min' => 'Escreva uma mensagem um pouco mais detalhada.',
        ];
    }
}
