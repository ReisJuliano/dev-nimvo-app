<?php

namespace App\Services\Central;

use App\Models\Central\LocalAgent;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TenantFiscalAutofillService
{
    public function __construct(
        protected TenantFiscalProfileService $profileService,
    ) {
    }

    public function suggestNfceProfile(string $tenantId, array $input): array
    {
        $profile = $this->profileService->snapshot($tenantId);
        $certificate = $this->certificateSummary($tenantId);
        $source = $this->resolveSource(
            requestedSource: (string) ($input['source'] ?? 'auto'),
            inputCnpj: $input['cnpj'] ?? null,
            certificate: $certificate,
            profile: $profile,
        );

        $companyLookup = $this->lookupCompanyByCnpj($source['cnpj']);
        $cityCode = $this->resolveCityCode(
            (string) ($companyLookup['state'] ?? ''),
            (string) ($companyLookup['city_name'] ?? ''),
        );

        $suggested = array_filter([
            'company_name' => $companyLookup['company_name'] ?? data_get($certificate, 'company_name'),
            'trade_name' => $companyLookup['trade_name'] ?? null,
            'cnpj' => $source['cnpj'],
            'cnae' => $companyLookup['cnae'] ?? null,
            'phone' => $companyLookup['phone'] ?? null,
            'street' => $companyLookup['street'] ?? null,
            'number' => $companyLookup['number'] ?? null,
            'complement' => $companyLookup['complement'] ?? null,
            'district' => $companyLookup['district'] ?? null,
            'city_name' => $companyLookup['city_name'] ?? null,
            'city_code' => $cityCode,
            'state' => $companyLookup['state'] ?? null,
            'zip_code' => $companyLookup['zip_code'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');

        $filledFields = array_keys($suggested);
        $missingFields = [];

        foreach ([
            'company_name' => 'Razao social',
            'cnpj' => 'CNPJ',
            'street' => 'Logradouro',
            'number' => 'Numero',
            'district' => 'Bairro',
            'city_name' => 'Municipio',
            'city_code' => 'Codigo IBGE',
            'state' => 'UF',
            'zip_code' => 'CEP',
        ] as $field => $label) {
            if (! array_key_exists($field, $suggested)) {
                $missingFields[] = $label;
            }
        }

        $warnings = [];

        if ($companyLookup === []) {
            $warnings[] = 'Consulta de CNPJ indisponivel no momento.';
        }

        if (! array_key_exists('city_code', $suggested)) {
            $warnings[] = 'Codigo IBGE nao foi localizado automaticamente.';
        }

        return [
            'suggested' => $suggested,
            'meta' => [
                'source' => $source['source'],
                'source_label' => $source['label'],
                'cnpj' => $source['cnpj'],
                'filled_fields' => $filledFields,
                'missing_fields' => array_values(array_unique($missingFields)),
                'warnings' => array_values(array_unique($warnings)),
                'certificate' => $certificate,
            ],
        ];
    }

    protected function resolveSource(
        string $requestedSource,
        ?string $inputCnpj,
        array $certificate,
        array $profile,
    ): array {
        $inputCnpj = $this->digitsOnly($inputCnpj);
        $certificateCnpj = $this->digitsOnly(data_get($certificate, 'cnpj'));
        $profileCnpj = $this->digitsOnly($profile['cnpj'] ?? null);

        return match ($requestedSource) {
            'cnpj' => $inputCnpj
                ? ['source' => 'cnpj', 'label' => 'CNPJ informado', 'cnpj' => $inputCnpj]
                : throw ValidationException::withMessages([
                    'cnpj' => 'Informe um CNPJ valido para consultar os dados do emitente.',
                ]),
            'certificate' => $certificateCnpj
                ? ['source' => 'certificate', 'label' => 'Certificado do agente', 'cnpj' => $certificateCnpj]
                : throw ValidationException::withMessages([
                    'certificate' => 'O agente ainda nao sincronizou um resumo do certificado para este tenant.',
                ]),
            default => match (true) {
                filled($inputCnpj) => ['source' => 'cnpj', 'label' => 'CNPJ informado', 'cnpj' => $inputCnpj],
                filled($certificateCnpj) => ['source' => 'certificate', 'label' => 'Certificado do agente', 'cnpj' => $certificateCnpj],
                filled($profileCnpj) => ['source' => 'profile', 'label' => 'Perfil fiscal atual', 'cnpj' => $profileCnpj],
                default => throw ValidationException::withMessages([
                    'cnpj' => 'Informe um CNPJ ou sincronize o certificado do agente para sugerir o cadastro fiscal.',
                ]),
            },
        };
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

    protected function certificateSummary(string $tenantId): array
    {
        if (! $this->localAgentsTableExists()) {
            return [];
        }

        $agent = LocalAgent::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('last_seen_at')
            ->orderByDesc('id')
            ->first();

        if (! $agent) {
            return [];
        }

        return array_filter([
            'path' => data_get($agent->metadata, 'device.certificate.path'),
            'cnpj' => $this->digitsOnly(data_get($agent->metadata, 'device.certificate.cnpj')),
            'company_name' => $this->nullableString(data_get($agent->metadata, 'device.certificate.company_name')),
            'valid_from' => $this->nullableString(data_get($agent->metadata, 'device.certificate.valid_from')),
            'valid_to' => $this->nullableString(data_get($agent->metadata, 'device.certificate.valid_to')),
        ], fn ($value) => $value !== null && $value !== '');
    }

    protected function localAgentsTableExists(): bool
    {
        return Schema::connection((new LocalAgent())->getConnectionName())->hasTable('local_agents');
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
