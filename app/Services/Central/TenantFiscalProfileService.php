<?php

namespace App\Services\Central;

use App\Models\Tenant\FiscalProfile;
use App\Support\Tenant\TenantContext;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class TenantFiscalProfileService
{
    public function __construct(
        protected TenantContext $tenantContext,
    ) {
    }

    public function snapshot(string $tenantId): array
    {
        return $this->tenantContext->run($tenantId, function () {
            if (! $this->fiscalProfilesTableExists()) {
                return $this->blankSnapshot(
                    status: 'missing_table',
                    label: 'Sem fiscal',
                    tone: 'is-muted',
                );
            }

            $profile = $this->resolveNfceProfile();

            if (! $profile) {
                return $this->blankSnapshot(
                    status: 'missing_profile',
                    label: 'Sem perfil',
                    tone: 'is-muted',
                );
            }

            return $this->snapshotForProfile($profile);
        });
    }

    public function saveNfceProfile(string $tenantId, array $data): array
    {
        return $this->tenantContext->run($tenantId, function () use ($data) {
            if (! $this->fiscalProfilesTableExists()) {
                throw ValidationException::withMessages([
                    'fiscal' => 'A tabela fiscal ainda não existe neste tenant. Rode as migrations do tenant antes de configurar o emitente.',
                ]);
            }

            $profile = $this->resolveNfceProfile();
            $cscId = $this->nullableString($data['csc_id'] ?? null);
            $cscTokenInput = $this->nullableString($data['csc_token'] ?? null);

            $profile ??= new FiscalProfile();

            $profile->forceFill([
                'active' => (bool) ($data['active'] ?? true),
                'environment' => (int) ($data['environment'] ?? 2),
                'invoice_model' => '65',
                'operation_nature' => $this->nullableString($data['operation_nature'] ?? null) ?: 'VENDA NFC-E',
                'series' => (int) ($data['series'] ?? 1),
                'next_number' => (int) ($data['next_number'] ?? 1),
                'company_name' => $this->nullableString($data['company_name'] ?? null) ?: '',
                'trade_name' => $this->nullableString($data['trade_name'] ?? null),
                'cnpj' => $this->nullableString($data['cnpj'] ?? null) ?: '',
                'ie' => $this->nullableString($data['ie'] ?? null) ?: '',
                'im' => $this->nullableString($data['im'] ?? null),
                'cnae' => $this->nullableString($data['cnae'] ?? null),
                'crt' => $this->nullableString($data['crt'] ?? null) ?: '1',
                'phone' => $this->nullableString($data['phone'] ?? null),
                'street' => $this->nullableString($data['street'] ?? null) ?: '',
                'number' => $this->nullableString($data['number'] ?? null) ?: '',
                'complement' => $this->nullableString($data['complement'] ?? null),
                'district' => $this->nullableString($data['district'] ?? null) ?: '',
                'city_code' => $this->nullableString($data['city_code'] ?? null) ?: '',
                'city_name' => $this->nullableString($data['city_name'] ?? null) ?: '',
                'state' => $this->nullableString($data['state'] ?? null),
                'zip_code' => $this->nullableString($data['zip_code'] ?? null) ?: '',
                'csc_id' => $cscId,
                'csc_token' => $this->resolveTokenForSave($profile, $cscId, $cscTokenInput),
                'technical_contact_name' => $this->nullableString($data['technical_contact_name'] ?? null),
                'technical_contact_email' => $this->nullableString($data['technical_contact_email'] ?? null),
                'technical_contact_phone' => $this->nullableString($data['technical_contact_phone'] ?? null),
                'technical_contact_cnpj' => $this->nullableString($data['technical_contact_cnpj'] ?? null),
            ])->save();

            return $this->snapshotForProfile($profile->fresh());
        });
    }

    protected function resolveNfceProfile(): ?FiscalProfile
    {
        return FiscalProfile::query()
            ->where('invoice_model', '65')
            ->orderByDesc('active')
            ->orderByDesc('id')
            ->first();
    }

    protected function fiscalProfilesTableExists(): bool
    {
        return Schema::connection((new FiscalProfile())->getConnectionName())->hasTable('fiscal_profiles');
    }

    protected function blankSnapshot(string $status, string $label, string $tone): array
    {
        return [
            'status' => $status,
            'label' => $label,
            'tone' => $tone,
            'has_nfce_profile' => false,
            'profile_id' => null,
            'active' => true,
            'profile_ready' => false,
            'transmission_ready' => false,
            'missing_fields' => [],
            'missing_emitter_fields' => [],
            'missing_transmission_fields' => [],
            'invoice_model' => '65',
            'environment' => 2,
            'operation_nature' => 'VENDA NFC-E',
            'series' => 1,
            'next_number' => 1,
            'company_name' => null,
            'trade_name' => null,
            'cnpj' => null,
            'ie' => null,
            'im' => null,
            'cnae' => null,
            'crt' => '1',
            'phone' => null,
            'street' => null,
            'number' => null,
            'complement' => null,
            'district' => null,
            'city_code' => null,
            'city_name' => null,
            'state' => null,
            'zip_code' => null,
            'csc_id' => null,
            'csc_token_configured' => false,
            'technical_contact_name' => null,
            'technical_contact_email' => null,
            'technical_contact_phone' => null,
            'technical_contact_cnpj' => null,
            'updated_at' => null,
            'updated_label' => null,
        ];
    }

    protected function snapshotForProfile(FiscalProfile $profile): array
    {
        $missingEmitterFields = $this->missingEmitterFields($profile);
        $missingTransmissionFields = $this->missingTransmissionFields($profile);
        $status = $this->statusForProfile($profile, $missingEmitterFields, $missingTransmissionFields);

        return [
            'status' => $status['status'],
            'label' => $status['label'],
            'tone' => $status['tone'],
            'has_nfce_profile' => true,
            'profile_id' => $profile->id,
            'active' => (bool) $profile->active,
            'profile_ready' => $missingEmitterFields === [] && (bool) $profile->active,
            'transmission_ready' => $missingEmitterFields === [] && $missingTransmissionFields === [] && (bool) $profile->active,
            'missing_fields' => array_values(array_unique([...$missingEmitterFields, ...$missingTransmissionFields])),
            'missing_emitter_fields' => $missingEmitterFields,
            'missing_transmission_fields' => $missingTransmissionFields,
            'invoice_model' => (string) $profile->invoice_model,
            'environment' => (int) $profile->environment,
            'operation_nature' => $profile->operation_nature,
            'series' => (int) $profile->series,
            'next_number' => (int) $profile->next_number,
            'company_name' => $profile->company_name,
            'trade_name' => $profile->trade_name,
            'cnpj' => $profile->cnpj,
            'ie' => $profile->ie,
            'im' => $profile->im,
            'cnae' => $profile->cnae,
            'crt' => $profile->crt,
            'phone' => $profile->phone,
            'street' => $profile->street,
            'number' => $profile->number,
            'complement' => $profile->complement,
            'district' => $profile->district,
            'city_code' => $profile->city_code,
            'city_name' => $profile->city_name,
            'state' => $profile->state,
            'zip_code' => $profile->zip_code,
            'csc_id' => $profile->csc_id,
            'csc_token_configured' => filled($profile->csc_token),
            'technical_contact_name' => $profile->technical_contact_name,
            'technical_contact_email' => $profile->technical_contact_email,
            'technical_contact_phone' => $profile->technical_contact_phone,
            'technical_contact_cnpj' => $profile->technical_contact_cnpj,
            'updated_at' => $profile->updated_at?->toIso8601String(),
            'updated_label' => $profile->updated_at?->format('d/m/Y H:i'),
        ];
    }

    protected function statusForProfile(FiscalProfile $profile, array $missingEmitterFields, array $missingTransmissionFields): array
    {
        if (! $profile->active) {
            return [
                'status' => 'inactive',
                'label' => 'Inativo',
                'tone' => 'is-inactive',
            ];
        }

        if ($missingEmitterFields !== []) {
            return [
                'status' => 'incomplete',
                'label' => 'Emitente',
                'tone' => 'is-info',
            ];
        }

        if (blank($profile->csc_id)) {
            return [
                'status' => 'missing_csc',
                'label' => 'Sem CSC',
                'tone' => 'is-muted',
            ];
        }

        if (blank($profile->csc_token)) {
            return [
                'status' => 'missing_token',
                'label' => 'Sem token',
                'tone' => 'is-info',
            ];
        }

        if ($missingTransmissionFields !== []) {
            return [
                'status' => 'responsible_tech',
                'label' => 'RespTec',
                'tone' => 'is-info',
            ];
        }

        return [
            'status' => 'configured',
            'label' => 'Pronto',
            'tone' => 'is-active',
        ];
    }

    protected function missingEmitterFields(FiscalProfile $profile): array
    {
        $missing = [];

        foreach ([
            'company_name' => 'Razão social',
            'cnpj' => 'CNPJ',
            'ie' => 'Inscrição estadual',
            'street' => 'Logradouro',
            'number' => 'Número',
            'district' => 'Bairro',
            'city_code' => 'Código IBGE',
            'city_name' => 'Município',
            'state' => 'UF',
            'zip_code' => 'CEP',
            'operation_nature' => 'Natureza da operação',
        ] as $field => $label) {
            if (blank($profile->{$field})) {
                $missing[] = $label;
            }
        }

        if (! preg_match('/^\d{14}$/', (string) $profile->cnpj)) {
            $missing[] = 'CNPJ válido';
        }

        if (! preg_match('/^\d{7}$/', (string) $profile->city_code)) {
            $missing[] = 'Código IBGE válido';
        }

        if (! preg_match('/^\d{8}$/', (string) $profile->zip_code)) {
            $missing[] = 'CEP válido';
        }

        if (! preg_match('/^[A-Z]{2}$/', strtoupper((string) $profile->state))) {
            $missing[] = 'UF válida';
        }

        if ((int) $profile->environment < 1 || (int) $profile->environment > 2) {
            $missing[] = 'Ambiente fiscal';
        }

        if ((int) $profile->series < 1 || (int) $profile->series > 999) {
            $missing[] = 'Série fiscal';
        }

        if ((int) $profile->next_number < 1) {
            $missing[] = 'Próximo número';
        }

        if ((string) $profile->invoice_model !== '65') {
            $missing[] = 'Modelo NFC-e 65';
        }

        if (! in_array((string) $profile->crt, ['1', '2', '4'], true)) {
            $missing[] = 'CRT suportado';
        }

        if (
            preg_match('/^\d{7}$/', (string) $profile->city_code)
            && substr((string) $profile->city_code, 0, 2) !== $this->ufCode((string) $profile->state)
        ) {
            $missing[] = 'IBGE compatível com a UF';
        }

        if (filled($profile->cnae) && ! preg_match('/^\d{7}$/', (string) $profile->cnae)) {
            $missing[] = 'CNAE válido';
        }

        if (filled($profile->phone) && ! preg_match('/^\d{10,11}$/', (string) $profile->phone)) {
            $missing[] = 'Telefone válido';
        }

        return array_values(array_unique($missing));
    }

    protected function missingTransmissionFields(FiscalProfile $profile): array
    {
        $missing = [];

        if (blank($profile->csc_id)) {
            $missing[] = 'CSC ID';
        }

        if (blank($profile->csc_token)) {
            $missing[] = 'CSC Token';
        }

        foreach ([
            'technical_contact_name' => 'Responsável técnico',
            'technical_contact_email' => 'Email do responsável técnico',
            'technical_contact_phone' => 'Telefone do responsável técnico',
            'technical_contact_cnpj' => 'CNPJ do responsável técnico',
        ] as $field => $label) {
            if (blank($profile->{$field})) {
                $missing[] = $label;
            }
        }

        if (
            filled($profile->technical_contact_email)
            && filter_var((string) $profile->technical_contact_email, FILTER_VALIDATE_EMAIL) === false
        ) {
            $missing[] = 'Email do responsável técnico válido';
        }

        if (
            filled($profile->technical_contact_phone)
            && ! preg_match('/^\d{10,11}$/', (string) $profile->technical_contact_phone)
        ) {
            $missing[] = 'Telefone do responsável técnico válido';
        }

        if (
            filled($profile->technical_contact_cnpj)
            && ! preg_match('/^\d{14}$/', (string) $profile->technical_contact_cnpj)
        ) {
            $missing[] = 'CNPJ do responsável técnico válido';
        }

        return array_values(array_unique($missing));
    }

    protected function resolveTokenForSave(FiscalProfile $profile, ?string $cscId, ?string $input): ?string
    {
        if ($input !== null && $input !== '') {
            return $input;
        }

        if (! filled($cscId)) {
            return null;
        }

        return filled($profile->csc_token) ? (string) $profile->csc_token : null;
    }

    protected function nullableString(mixed $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    protected function ufCode(string $uf): string
    {
        return match (strtoupper($uf)) {
            'RO' => '11',
            'AC' => '12',
            'AM' => '13',
            'RR' => '14',
            'PA' => '15',
            'AP' => '16',
            'TO' => '17',
            'MA' => '21',
            'PI' => '22',
            'CE' => '23',
            'RN' => '24',
            'PB' => '25',
            'PE' => '26',
            'AL' => '27',
            'SE' => '28',
            'BA' => '29',
            'MG' => '31',
            'ES' => '32',
            'RJ' => '33',
            'SP' => '35',
            'PR' => '41',
            'SC' => '42',
            'RS' => '43',
            'MS' => '50',
            'MT' => '51',
            'GO' => '52',
            'DF' => '53',
            default => '00',
        };
    }
}
