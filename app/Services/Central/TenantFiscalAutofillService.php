<?php

namespace App\Services\Central;

use App\Models\Central\LocalAgent;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class TenantFiscalAutofillService
{
    public function __construct(
        protected TenantFiscalProfileService $profileService,
        protected CnpjLookupService $lookupService,
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

        $companyLookup = $this->lookupService->lookup($source['cnpj']);
        $cityCode = $companyLookup['city_code'] ?? null;

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
            'company_name' => 'Razão social',
            'cnpj' => 'CNPJ',
            'street' => 'Logradouro',
            'number' => 'Número',
            'district' => 'Bairro',
            'city_name' => 'Município',
            'city_code' => 'Código IBGE',
            'state' => 'UF',
            'zip_code' => 'CEP',
        ] as $field => $label) {
            if (! array_key_exists($field, $suggested)) {
                $missingFields[] = $label;
            }
        }

        $warnings = [];

        if ($companyLookup === []) {
            $warnings[] = 'Consulta de CNPJ indisponível no momento.';
        }

        if (! array_key_exists('city_code', $suggested)) {
            $warnings[] = 'Código IBGE não foi localizado automaticamente.';
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
                    'cnpj' => 'Informe um CNPJ válido para consultar os dados do emitente.',
                ]),
            'certificate' => $certificateCnpj
                ? ['source' => 'certificate', 'label' => 'Certificado do agente', 'cnpj' => $certificateCnpj]
                : throw ValidationException::withMessages([
                    'certificate' => 'O agente ainda não sincronizou um resumo do certificado para este tenant.',
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
}
