<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Sale;

class FiscalCancellationRules
{
    public function minReasonLength(): int
    {
        return max(5, (int) config('fiscal.cancellation.min_reason_length', 15));
    }

    public function maxHoursAfterAuthorization(): int
    {
        return max(0, (int) config('fiscal.cancellation.max_hours_after_authorization', 24));
    }

    public function retryCooldownMinutes(): int
    {
        return max(0, (int) config('fiscal.cancellation.retry_cooldown_minutes', 5));
    }

    public function evaluate(Sale $sale, ?FiscalDocument $document): array
    {
        if ($sale->status === 'cancelled' || in_array($document?->status, ['cancelled', 'cancelled_local'], true)) {
            return [
                'allowed' => false,
                'mode' => 'already_cancelled',
                'message' => 'Essa venda ja esta cancelada.',
            ];
        }

        if (! $document) {
            return [
                'allowed' => true,
                'mode' => 'commercial_cancelled',
                'message' => 'Sem documento fiscal vinculado.',
            ];
        }

        if (in_array($document->status, ['queued', 'queued_to_agent', 'processing', 'cancellation_queued', 'cancellation_processing'], true)) {
            return [
                'allowed' => false,
                'mode' => 'blocked_processing',
                'message' => 'O documento fiscal ainda esta em processamento.',
            ];
        }

        if (
            (bool) data_get($document->payload, 'flags.offline_contingency', false)
            && in_array($document->status, ['contingency_offline_signed', 'contingency_offline_printed', 'contingency_failed'], true)
        ) {
            return [
                'allowed' => false,
                'mode' => 'blocked_offline_contingency',
                'message' => 'A NFC-e em contingencia offline precisa ser transmitida ou regularizada antes do cancelamento.',
            ];
        }

        if (in_array($document->status, ['awaiting_agent', 'failed', 'rejected', 'signed_local', 'printed_local'], true)) {
            return [
                'allowed' => true,
                'mode' => in_array($document->status, ['signed_local', 'printed_local'], true) ? 'local_cancelled' : 'commercial_cancelled',
                'message' => in_array($document->status, ['signed_local', 'printed_local'], true)
                    ? 'Cancela localmente sem transmissao SEFAZ.'
                    : 'Cancela a venda antes da autorizacao fiscal.',
            ];
        }

        if (! in_array($document->status, ['authorized', 'printed', 'cancellation_failed'], true)) {
            return [
                'allowed' => false,
                'mode' => 'blocked_status',
                'message' => 'O status atual do documento nao permite cancelamento por este fluxo.',
            ];
        }

        if (blank($document->access_key) || blank($document->sefaz_protocol) || blank($document->authorized_xml)) {
            return [
                'allowed' => false,
                'mode' => 'missing_artifacts',
                'message' => 'O documento nao possui chave, protocolo e XML autorizado suficientes para cancelamento.',
            ];
        }

        if (! $document->authorized_at) {
            return [
                'allowed' => false,
                'mode' => 'missing_authorization_time',
                'message' => 'O documento nao possui data de autorizacao para validar o prazo de cancelamento.',
            ];
        }

        $maxHours = $this->maxHoursAfterAuthorization();
        if ($maxHours > 0 && $document->authorized_at->lt(now()->subHours($maxHours))) {
            return [
                'allowed' => false,
                'mode' => 'expired_deadline',
                'message' => sprintf('O prazo operacional de cancelamento (%d horas) ja foi excedido.', $maxHours),
            ];
        }

        $cooldown = $this->retryCooldownMinutes();
        if (
            $document->status === 'cancellation_failed'
            && $cooldown > 0
            && $document->cancellation_requested_at
            && $document->cancellation_requested_at->gt(now()->subMinutes($cooldown))
        ) {
            return [
                'allowed' => false,
                'mode' => 'retry_cooldown',
                'message' => sprintf('A ultima tentativa de cancelamento falhou recentemente. Aguarde %d minuto(s) para tentar de novo.', $cooldown),
            ];
        }

        return [
            'allowed' => true,
            'mode' => 'fiscal_queued',
            'message' => 'Cancela na SEFAZ.',
        ];
    }
}
