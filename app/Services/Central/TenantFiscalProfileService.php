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
                return [
                    'status' => 'missing_table',
                    'label' => 'Sem fiscal',
                    'tone' => 'is-muted',
                    'has_nfce_profile' => false,
                    'csc_id' => null,
                    'csc_token_configured' => false,
                    'environment' => null,
                    'company_name' => null,
                    'updated_at' => null,
                ];
            }

            $profile = $this->resolveNfceProfile();

            if (! $profile) {
                return [
                    'status' => 'missing_profile',
                    'label' => 'Sem perfil',
                    'tone' => 'is-muted',
                    'has_nfce_profile' => false,
                    'csc_id' => null,
                    'csc_token_configured' => false,
                    'environment' => null,
                    'company_name' => null,
                    'updated_at' => null,
                ];
            }

            $hasCscId = filled($profile->csc_id);
            $hasCscToken = filled($profile->csc_token);
            $status = $hasCscId && $hasCscToken
                ? 'configured'
                : ($hasCscId ? 'missing_token' : 'missing_csc');

            return [
                'status' => $status,
                'label' => match ($status) {
                    'configured' => 'Pronto',
                    'missing_token' => 'Sem token',
                    default => 'Sem CSC',
                },
                'tone' => match ($status) {
                    'configured' => 'is-active',
                    'missing_token' => 'is-info',
                    default => 'is-muted',
                },
                'has_nfce_profile' => true,
                'profile_id' => $profile->id,
                'invoice_model' => (string) $profile->invoice_model,
                'environment' => (int) $profile->environment,
                'company_name' => $profile->company_name,
                'csc_id' => $profile->csc_id,
                'csc_token_configured' => $hasCscToken,
                'updated_at' => $profile->updated_at?->toIso8601String(),
                'updated_label' => $profile->updated_at?->format('d/m/Y H:i'),
            ];
        });
    }

    public function updateNfceCredentials(string $tenantId, array $data): array
    {
        return $this->tenantContext->run($tenantId, function () use ($data) {
            if (! $this->fiscalProfilesTableExists()) {
                throw ValidationException::withMessages([
                    'fiscal' => 'A tabela fiscal ainda nao existe neste tenant. Rode as migrations do tenant antes de configurar o CSC.',
                ]);
            }

            $profile = $this->resolveNfceProfile();

            if (! $profile) {
                throw ValidationException::withMessages([
                    'fiscal' => 'Nenhum perfil fiscal NFC-e modelo 65 foi encontrado neste tenant. Cadastre o perfil fiscal primeiro.',
                ]);
            }

            $cscId = trim((string) ($data['csc_id'] ?? ''));
            $cscToken = trim((string) ($data['csc_token'] ?? ''));

            if ($cscId === '') {
                throw ValidationException::withMessages([
                    'csc_id' => 'Informe o CSC ID para salvar a configuracao fiscal.',
                ]);
            }

            if ($cscToken === '' && ! filled($profile->csc_token)) {
                throw ValidationException::withMessages([
                    'csc_token' => 'Informe o CSC Token para concluir a configuracao fiscal.',
                ]);
            }

            $profile->forceFill([
                'csc_id' => $cscId,
                'csc_token' => $cscToken !== '' ? $cscToken : $profile->csc_token,
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

    protected function snapshotForProfile(FiscalProfile $profile): array
    {
        $hasCscId = filled($profile->csc_id);
        $hasCscToken = filled($profile->csc_token);
        $status = $hasCscId && $hasCscToken
            ? 'configured'
            : ($hasCscId ? 'missing_token' : 'missing_csc');

        return [
            'status' => $status,
            'label' => match ($status) {
                'configured' => 'Pronto',
                'missing_token' => 'Sem token',
                default => 'Sem CSC',
            },
            'tone' => match ($status) {
                'configured' => 'is-active',
                'missing_token' => 'is-info',
                default => 'is-muted',
            },
            'has_nfce_profile' => true,
            'profile_id' => $profile->id,
            'invoice_model' => (string) $profile->invoice_model,
            'environment' => (int) $profile->environment,
            'company_name' => $profile->company_name,
            'csc_id' => $profile->csc_id,
            'csc_token_configured' => $hasCscToken,
            'updated_at' => $profile->updated_at?->toIso8601String(),
            'updated_label' => $profile->updated_at?->format('d/m/Y H:i'),
        ];
    }
}
