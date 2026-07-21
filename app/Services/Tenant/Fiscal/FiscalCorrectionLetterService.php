<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Central\LocalAgent;
use App\Models\Tenant\FiscalDocument;
use App\Services\Central\LocalAgentCommandService;
use App\Services\Tenant\AuditLogService;
use App\Support\Tenant\AuditActions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FiscalCorrectionLetterService
{
    public const MIN_TEXT_LENGTH = 15;

    public const MAX_TEXT_LENGTH = 1000;

    public const MAX_LETTERS_PER_DOCUMENT = 20;

    public function __construct(
        protected LocalAgentCommandService $commandService,
        protected AuditLogService $auditLogService,
    ) {
    }

    public function requestCorrection(int $documentId, string $text, ?int $userId = null): array
    {
        return DB::transaction(function () use ($documentId, $text, $userId) {
            $document = FiscalDocument::query()
                ->with('events')
                ->lockForUpdate()
                ->findOrFail($documentId);

            $text = $this->normalizeText($text);
            $this->assertEligible($document);

            $sequence = $document->events()
                ->whereIn('status', ['correction_registered'])
                ->count() + 1;

            if ($sequence > self::MAX_LETTERS_PER_DOCUMENT) {
                throw ValidationException::withMessages([
                    'text' => sprintf('Este documento já atingiu o limite de %d cartas de correção.', self::MAX_LETTERS_PER_DOCUMENT),
                ]);
            }

            $tenantId = (string) tenant()->getTenantKey();
            $agent = $this->resolveCorrectionAgent($tenantId);

            if (! $agent) {
                throw ValidationException::withMessages([
                    'agent' => 'Nenhum agente local ativo com suporte a carta de correção foi encontrado para este tenant.',
                ]);
            }

            $payload = array_merge(is_array($document->payload) ? $document->payload : [], [
                'correction' => [
                    'access_key' => $document->access_key,
                    'text' => $text,
                    'sequence' => $sequence,
                ],
            ]);

            $command = $this->commandService->queueCorrectionLetter($agent, $document, $tenantId, $payload);

            $document->events()->create([
                'status' => 'correction_queued',
                'source' => 'backend',
                'message' => 'Carta de correção enviada para o agente local.',
                'payload' => [
                    'command_id' => $command->id,
                    'sequence' => $sequence,
                    'text' => $text,
                ],
            ]);

            $this->auditLogService->record(
                AuditActions::FISCAL_CORRECTION_LETTER_REQUESTED,
                $document,
                after: ['sequence' => $sequence, 'text' => $text],
                userId: $userId,
            );

            return [
                'mode' => 'correction_queued',
                'message' => 'Carta de correção enviada para processamento no agente local.',
                'sequence' => $sequence,
                'document' => $document->fresh('events'),
            ];
        });
    }

    protected function assertEligible(FiscalDocument $document): void
    {
        $documentModel = (string) data_get($document->payload, 'flags.document_model', '65');

        if ($documentModel !== '55') {
            throw ValidationException::withMessages([
                'document' => 'Carta de correção só está disponível para NF-e modelo 55. NFC-e não aceita esse evento.',
            ]);
        }

        if (! in_array($document->status, ['authorized', 'printed'], true) || blank($document->access_key)) {
            throw ValidationException::withMessages([
                'document' => 'Só é possível registrar carta de correção em um documento fiscal autorizado.',
            ]);
        }

        $pendingLetter = $document->events
            ->whereIn('status', ['correction_queued', 'correction_processing'])
            ->isNotEmpty();

        if ($pendingLetter) {
            throw ValidationException::withMessages([
                'document' => 'Já existe uma carta de correção em processamento para este documento. Aguarde a conclusão antes de enviar outra.',
            ]);
        }
    }

    protected function normalizeText(string $text): string
    {
        $normalized = trim(preg_replace('/\s+/', ' ', $text) ?? '');
        $length = mb_strlen($normalized);

        if ($length < self::MIN_TEXT_LENGTH || $length > self::MAX_TEXT_LENGTH) {
            throw ValidationException::withMessages([
                'text' => sprintf(
                    'Informe um texto de correção entre %d e %d caracteres.',
                    self::MIN_TEXT_LENGTH,
                    self::MAX_TEXT_LENGTH,
                ),
            ]);
        }

        return $normalized;
    }

    protected function resolveCorrectionAgent(string $tenantId): ?LocalAgent
    {
        return LocalAgent::query()
            ->where('tenant_id', $tenantId)
            ->where('active', true)
            ->orderByDesc('last_seen_at')
            ->get()
            ->first(function (LocalAgent $agent) {
                $supportedTypes = (array) data_get($agent->metadata, 'device.supported_types', []);

                return in_array('send_correction_letter', $supportedTypes, true);
            });
    }
}
