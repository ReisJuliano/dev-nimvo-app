<?php

namespace App\Http\Requests\Central;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTenantFiscalProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth('central_admin')->check();
    }

    protected function prepareForValidation(): void
    {
        $trimmed = [
            'operation_nature' => $this->normalizeText($this->input('operation_nature')),
            'company_name' => $this->normalizeText($this->input('company_name')),
            'trade_name' => $this->normalizeNullableText($this->input('trade_name')),
            'ie' => $this->normalizeNullableText($this->input('ie'), upper: true),
            'im' => $this->normalizeNullableText($this->input('im'), upper: true),
            'street' => $this->normalizeText($this->input('street')),
            'number' => $this->normalizeText($this->input('number')),
            'complement' => $this->normalizeNullableText($this->input('complement')),
            'district' => $this->normalizeText($this->input('district')),
            'city_name' => $this->normalizeText($this->input('city_name')),
            'state' => $this->normalizeNullableText($this->input('state'), upper: true),
            'csc_id' => $this->normalizeNullableText($this->input('csc_id')),
            'csc_token' => $this->normalizeNullableText($this->input('csc_token')),
            'technical_contact_name' => $this->normalizeNullableText($this->input('technical_contact_name')),
            'technical_contact_email' => $this->normalizeNullableText($this->input('technical_contact_email')),
            'technical_contact_phone' => $this->digitsOnly($this->input('technical_contact_phone')),
            'technical_contact_cnpj' => $this->digitsOnly($this->input('technical_contact_cnpj')),
            'crt' => $this->normalizeNullableText($this->input('crt')),
            'cnpj' => $this->digitsOnly($this->input('cnpj')),
            'cnae' => $this->digitsOnly($this->input('cnae')),
            'phone' => $this->digitsOnly($this->input('phone')),
            'city_code' => $this->digitsOnly($this->input('city_code')),
            'zip_code' => $this->digitsOnly($this->input('zip_code')),
            'series' => $this->input('series'),
            'next_number' => $this->input('next_number'),
            'environment' => $this->input('environment'),
            'active' => $this->boolean('active', true),
        ];

        $this->merge($trimmed);
    }

    public function rules(): array
    {
        return [
            'active' => ['required', 'boolean'],
            'environment' => ['required', 'integer', Rule::in([1, 2])],
            'operation_nature' => ['required', 'string', 'max:120'],
            'series' => ['required', 'integer', 'min:1', 'max:999'],
            'next_number' => ['required', 'integer', 'min:1', 'max:999999999'],
            'company_name' => ['required', 'string', 'max:255'],
            'trade_name' => ['nullable', 'string', 'max:255'],
            'cnpj' => ['required', 'digits:14'],
            'ie' => ['required', 'string', 'max:30'],
            'im' => ['nullable', 'string', 'max:30'],
            'cnae' => ['nullable', 'digits:7'],
            'crt' => ['required', Rule::in(['1', '2', '4'])],
            'phone' => ['nullable', 'digits_between:10,11'],
            'street' => ['required', 'string', 'max:255'],
            'number' => ['required', 'string', 'max:20'],
            'complement' => ['nullable', 'string', 'max:120'],
            'district' => ['required', 'string', 'max:120'],
            'city_code' => ['required', 'digits:7'],
            'city_name' => ['required', 'string', 'max:120'],
            'state' => ['required', 'string', 'size:2'],
            'zip_code' => ['required', 'digits:8'],
            'csc_id' => ['nullable', 'string', 'max:30', 'required_with:csc_token'],
            'csc_token' => ['nullable', 'string', 'max:255'],
            'technical_contact_name' => ['nullable', 'string', 'max:120'],
            'technical_contact_email' => ['nullable', 'email', 'max:120'],
            'technical_contact_phone' => ['nullable', 'digits_between:10,11'],
            'technical_contact_cnpj' => ['nullable', 'digits:14'],
        ];
    }

    protected function normalizeText(mixed $value): string
    {
        return trim((string) $value);
    }

    protected function normalizeNullableText(mixed $value, bool $upper = false): ?string
    {
        $normalized = trim((string) $value);

        if ($normalized === '') {
            return null;
        }

        return $upper ? strtoupper($normalized) : $normalized;
    }

    protected function digitsOnly(mixed $value): ?string
    {
        $normalized = preg_replace('/\D+/', '', (string) $value) ?? '';

        return $normalized !== '' ? $normalized : null;
    }
}
