<?php

namespace App\Http\Requests\Central;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AutofillTenantFiscalProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth('central_admin')->check();
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'cnpj' => $this->digitsOnly($this->input('cnpj')),
            'source' => trim((string) $this->input('source', 'auto')) ?: 'auto',
        ]);
    }

    public function rules(): array
    {
        return [
            'cnpj' => ['nullable', 'digits:14'],
            'source' => ['required', Rule::in(['auto', 'cnpj', 'certificate'])],
        ];
    }

    protected function digitsOnly(mixed $value): ?string
    {
        $normalized = preg_replace('/\D+/', '', (string) $value) ?? '';

        return $normalized !== '' ? $normalized : null;
    }
}
