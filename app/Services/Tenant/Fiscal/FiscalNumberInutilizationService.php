<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Central\LocalAgent;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalNumberInutilization;
use App\Models\Tenant\FiscalProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Services\Central\LocalAgentCommandService;

class FiscalNumberInutilizationService
{
    public function __construct(
        protected LocalAgentCommandService $commandService,
    ) {
    }

    public function queue(
        string $documentModel,
        int $series,
        int $numberStart,
        int $numberEnd,
        string $justification,
        ?int $requestedByUserId = null,
    ): FiscalNumberInutilization {
        return DB::transaction(function () use (
            $documentModel,
            $series,
            $numberStart,
            $numberEnd,
            $justification,
            $requestedByUserId,
        ) {
            $documentModel = in_array($documentModel, ['55', '65'], true) ? $documentModel : '65';
            $justification = $this->normalizeJustification($justification);
            $this->validateRange($series, $numberStart, $numberEnd);

            $profile = FiscalProfile::query()
                ->where('active', true)
                ->where('invoice_model', $documentModel)
                ->lockForUpdate()
                ->latest('id')
                ->first();

            if (! $profile) {
                throw ValidationException::withMessages([
                    'document_model' => "Configure um perfil fiscal ativo para o modelo {$documentModel} antes de inutilizar numeracao.",
                ]);
            }

            $this->assertRangeHasNoDocuments($documentModel, $series, $numberStart, $numberEnd);
            $this->assertRangeHasNoOverlap($profile, $series, $numberStart, $numberEnd);

            $tenantId = (string) tenant()->getTenantKey();
            $agent = $this->resolveAgent($tenantId);

            if (! $agent) {
                throw ValidationException::withMessages([
                    'agent' => 'Nenhum agente local ativo com suporte a inutilizacao fiscal foi encontrado para este tenant.',
                ]);
            }

            $inutilization = FiscalNumberInutilization::query()->create([
                'profile_id' => $profile->id,
                'status' => 'queued',
                'environment' => (int) $profile->environment,
                'document_model' => $documentModel,
                'series' => $series,
                'number_start' => $numberStart,
                'number_end' => $numberEnd,
                'justification' => $justification,
                'requested_by_user_id' => $requestedByUserId,
                'queued_at' => now(),
            ]);

            $payload = [
                'profile' => [
                    'environment' => (int) $profile->environment,
                    'company_name' => $profile->company_name,
                    'trade_name' => $profile->trade_name,
                    'cnpj' => $profile->cnpj,
                    'state' => $profile->state,
                    'csc_id' => $profile->csc_id,
                    'csc_token' => $profile->csc_token,
                ],
                'inutilization' => [
                    'document_model' => $documentModel,
                    'series' => $series,
                    'number_start' => $numberStart,
                    'number_end' => $numberEnd,
                    'justification' => $justification,
                    'year' => now()->format('y'),
                ],
            ];

            $command = $this->commandService->queueInutilization($agent, $inutilization, $tenantId, $payload);

            $inutilization->forceFill([
                'agent_key' => $agent->agent_key,
                'agent_command_id' => $command->id,
            ])->save();

            return $inutilization->fresh();
        });
    }

    protected function normalizeJustification(string $justification): string
    {
        $normalized = trim(preg_replace('/\s+/', ' ', $justification) ?? '');

        if (mb_strlen($normalized) < 15) {
            throw ValidationException::withMessages([
                'justification' => 'Informe uma justificativa com pelo menos 15 caracteres para inutilizar a faixa.',
            ]);
        }

        return mb_substr($normalized, 0, 255);
    }

    protected function validateRange(int $series, int $numberStart, int $numberEnd): void
    {
        $errors = [];

        if ($series < 1 || $series > 999) {
            $errors[] = 'A serie precisa estar entre 1 e 999.';
        }

        if ($numberStart < 1 || $numberEnd < 1) {
            $errors[] = 'Os numeros inicial e final precisam ser maiores que zero.';
        }

        if ($numberEnd < $numberStart) {
            $errors[] = 'O numero final precisa ser maior ou igual ao numero inicial.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages([
                'range' => implode(' ', $errors),
            ]);
        }
    }

    protected function assertRangeHasNoDocuments(string $documentModel, int $series, int $numberStart, int $numberEnd): void
    {
        $types = $documentModel === '55' ? ['nfe'] : ['nfce', 'nfce_local_test'];

        $exists = FiscalDocument::query()
            ->whereIn('type', $types)
            ->where('series', $series)
            ->whereBetween('number', [$numberStart, $numberEnd])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'range' => 'A faixa informada ja possui documentos fiscais reservados ou utilizados.',
            ]);
        }
    }

    protected function assertRangeHasNoOverlap(FiscalProfile $profile, int $series, int $numberStart, int $numberEnd): void
    {
        $exists = FiscalNumberInutilization::query()
            ->where('environment', (int) $profile->environment)
            ->where('document_model', (string) $profile->invoice_model)
            ->where('series', $series)
            ->whereNotIn('status', ['failed'])
            ->where(function ($query) use ($numberStart, $numberEnd) {
                $query
                    ->whereBetween('number_start', [$numberStart, $numberEnd])
                    ->orWhereBetween('number_end', [$numberStart, $numberEnd])
                    ->orWhere(function ($inner) use ($numberStart, $numberEnd) {
                        $inner
                            ->where('number_start', '<=', $numberStart)
                            ->where('number_end', '>=', $numberEnd);
                    });
            })
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'range' => 'Ja existe uma inutilizacao pendente ou concluida para parte dessa faixa numerica.',
            ]);
        }
    }

    protected function resolveAgent(string $tenantId): ?LocalAgent
    {
        return LocalAgent::query()
            ->where('tenant_id', $tenantId)
            ->where('active', true)
            ->orderByDesc('last_seen_at')
            ->get()
            ->first(function (LocalAgent $agent) {
                $supportedTypes = (array) data_get($agent->metadata, 'device.supported_types', []);

                return in_array('invalidate_fiscal_range', $supportedTypes, true);
            });
    }
}
