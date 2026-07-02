<?php

namespace App\Services\Central;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Pure CNPJ -> company data lookup (BrasilAPI + IBGE city code), with no
 * dependency on an existing tenant/fiscal profile. Extracted from
 * TenantFiscalAutofillService so it can also back a brand-new tenant's
 * onboarding form, before the tenant even exists.
 */
class CnpjLookupService
{
    public function lookup(string $cnpj): array
    {
        $digits = $this->digitsOnly($cnpj);

        if ($digits === null || strlen($digits) !== 14) {
            return [];
        }

        $company = $this->lookupCompanyByCnpj($digits);

        if ($company === []) {
            return [];
        }

        $company['cnpj'] = $digits;
        $company['city_code'] = $this->resolveCityCode(
            (string) ($company['state'] ?? ''),
            (string) ($company['city_name'] ?? ''),
        );

        return array_filter($company, fn ($value) => $value !== null && $value !== '');
    }

    protected function lookupCompanyByCnpj(string $cnpj): array
    {
        $baseUrl = rtrim((string) config('services.company_lookup.base_url', 'https://brasilapi.com.br/api'), '/');

        try {
            $response = Http::baseUrl($baseUrl)
                ->acceptJson()
                ->timeout((int) config('services.company_lookup.timeout', 10))
                ->get("/cnpj/v1/{$cnpj}");
        } catch (\Throwable) {
            return [];
        }

        if (! $response->successful()) {
            return [];
        }

        $payload = $response->json();

        if (! is_array($payload)) {
            return [];
        }

        $street = trim(implode(' ', array_filter([
            $payload['descricao_tipo_logradouro'] ?? null,
            $payload['logradouro'] ?? null,
        ])));

        return array_filter([
            'company_name' => $this->nullableString($payload['razao_social'] ?? null),
            'trade_name' => $this->nullableString($payload['nome_fantasia'] ?? null),
            'cnae' => $this->digitsOnly($payload['cnae_fiscal'] ?? null),
            'phone' => $this->digitsOnly($payload['ddd_telefone_1'] ?? null),
            'street' => $this->nullableString($street),
            'number' => $this->nullableString($payload['numero'] ?? null),
            'complement' => $this->nullableString($payload['complemento'] ?? null),
            'district' => $this->nullableString($payload['bairro'] ?? null),
            'city_name' => $this->nullableString($payload['municipio'] ?? null),
            'state' => $this->upperNullableString($payload['uf'] ?? null),
            'zip_code' => $this->digitsOnly($payload['cep'] ?? null),
        ], fn ($value) => $value !== null && $value !== '');
    }

    protected function resolveCityCode(string $state, string $cityName): ?string
    {
        $state = strtoupper(trim($state));
        $cityName = trim($cityName);

        if ($state === '' || $cityName === '') {
            return null;
        }

        $baseUrl = rtrim((string) config('services.ibge.base_url', 'https://servicodados.ibge.gov.br/api/v1/localidades'), '/');

        try {
            $response = Http::baseUrl($baseUrl)
                ->acceptJson()
                ->timeout((int) config('services.ibge.timeout', 10))
                ->get("/estados/{$state}/municipios");
        } catch (\Throwable) {
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $payload = $response->json();

        if (! is_array($payload)) {
            return null;
        }

        $normalizedTarget = $this->normalizeCityName($cityName);

        $match = collect($payload)->first(function ($city) use ($normalizedTarget) {
            if (! is_array($city)) {
                return false;
            }

            return $this->normalizeCityName((string) ($city['nome'] ?? '')) === $normalizedTarget;
        });

        if (! is_array($match)) {
            return null;
        }

        $code = Arr::get($match, 'id');

        return $code !== null ? preg_replace('/\D+/', '', (string) $code) : null;
    }

    protected function normalizeCityName(string $cityName): string
    {
        return Str::upper(Str::ascii(trim($cityName)));
    }

    protected function digitsOnly(mixed $value): ?string
    {
        $normalized = preg_replace('/\D+/', '', (string) $value) ?? '';

        return $normalized !== '' ? $normalized : null;
    }

    protected function nullableString(mixed $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    protected function upperNullableString(mixed $value): ?string
    {
        $normalized = $this->nullableString($value);

        return $normalized !== null ? strtoupper($normalized) : null;
    }
}
