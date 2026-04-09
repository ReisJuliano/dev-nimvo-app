<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\FiscalDocument;
use App\Support\Tenant\TenantContext;

class FiscalDocumentResultService
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected FiscalDocumentXmlStorage $xmlStorage,
    ) {
    }

    public function markProcessing(string $tenantId, int $documentId, string $agentKey): void
    {
        $this->tenantContext->run($tenantId, function () use ($documentId, $agentKey) {
            $document = FiscalDocument::query()->findOrFail($documentId);

            $document->forceFillCompatible([
                'status' => 'processing',
                'agent_key' => $agentKey,
                'processing_started_at' => now(),
            ])->save();

            $document->events()->create([
                'status' => 'processing',
                'source' => 'agent',
                'message' => 'Agente local assumiu o processamento da NFC-e.',
            ]);
        });
    }

    public function markCancellationProcessing(string $tenantId, int $documentId, string $agentKey): void
    {
        $this->tenantContext->run($tenantId, function () use ($documentId, $agentKey) {
            $document = FiscalDocument::query()->findOrFail($documentId);

            $document->forceFillCompatible([
                'status' => 'cancellation_processing',
                'agent_key' => $agentKey,
                'processing_started_at' => now(),
            ])->save();

            $document->events()->create([
                'status' => 'cancellation_processing',
                'source' => 'agent',
                'message' => 'Agente local assumiu o cancelamento fiscal.',
            ]);
        });
    }

    public function markAwaitingAgent(string $tenantId, int $documentId): void
    {
        $this->tenantContext->run($tenantId, function () use ($documentId) {
            $document = FiscalDocument::query()->findOrFail($documentId);

            $document->forceFillCompatible([
                'status' => 'awaiting_agent',
            ])->save();

            $document->events()->create([
                'status' => 'awaiting_agent',
                'source' => 'backend',
                'message' => 'Nenhum agente local ativo foi encontrado para este tenant.',
            ]);
        });
    }

    public function markQueuedToAgent(string $tenantId, int $documentId, string $agentKey, string $commandId): void
    {
        $this->tenantContext->run($tenantId, function () use ($documentId, $agentKey, $commandId) {
            $document = FiscalDocument::query()->findOrFail($documentId);

            $document->forceFillCompatible([
                'status' => 'queued_to_agent',
                'agent_key' => $agentKey,
                'agent_command_id' => $commandId,
                'queued_at' => now(),
            ])->save();

            $document->events()->create([
                'status' => 'queued_to_agent',
                'source' => 'backend',
                'message' => 'Comando fiscal enviado para o agente local.',
                'payload' => ['command_id' => $commandId],
            ]);
        });
    }

    public function markAuthorized(string $tenantId, int $documentId, array $payload): void
    {
        $this->tenantContext->run($tenantId, function () use ($tenantId, $documentId, $payload) {
            $document = FiscalDocument::query()->findOrFail($documentId);
            $documentPayload = is_array($document->payload) ? $document->payload : [];
            $printedAt = $payload['printed_at'] ?? optional($document->printed_at)?->toIso8601String();
            $isLocalTest = ($payload['status'] ?? null) === 'local_test'
                || (bool) data_get($document->payload, 'flags.local_test', false);
            $isOfflineIssue = in_array($payload['status'] ?? null, ['contingency_offline_signed', 'contingency_offline_printed'], true);
            $isOfflineTransmission = ($payload['status'] ?? null) === 'contingency_transmitted';

            if ($isLocalTest) {
                $status = $printedAt ? 'printed_local' : 'signed_local';
                $authorizedAt = now();
                $eventMessage = $printedAt
                    ? 'NFC-e de ensaio assinada e impressa localmente.'
                    : 'NFC-e de ensaio assinada localmente.';
            } elseif ($isOfflineIssue) {
                $status = $printedAt ? 'contingency_offline_printed' : 'contingency_offline_signed';
                $authorizedAt = null;
                data_set($documentPayload, 'flags.mode', 'contingency_offline');
                data_set($documentPayload, 'flags.offline_contingency', true);
                data_set($documentPayload, 'flags.offline_contingency_stage', 'transmit_pending');
                $eventMessage = $printedAt
                    ? 'NFC-e emitida e impressa em contingencia offline legal.'
                    : 'NFC-e emitida em contingencia offline legal e pendente de impressao.';
            } else {
                $status = $printedAt ? 'printed' : 'authorized';
                $authorizedAt = now();

                if ($isOfflineTransmission) {
                    data_set($documentPayload, 'flags.offline_contingency_stage', 'transmitted');
                    $eventMessage = $printedAt
                        ? 'NFC-e autorizada pela SEFAZ apos contingencia offline, mantendo a impressao local.'
                        : 'NFC-e autorizada pela SEFAZ apos contingencia offline.';
                } else {
                    $eventMessage = $printedAt
                        ? 'NFC-e autorizada e impressa pelo agente local.'
                        : 'NFC-e autorizada pelo agente local.';
                }
            }

            $document->forceFillCompatible([
                'status' => $status,
                'payload' => $documentPayload,
                'request_xml' => $payload['request_xml'] ?? null,
                'signed_xml' => $payload['signed_xml'] ?? null,
                'response_xml' => $payload['response_xml'] ?? null,
                'authorized_xml' => $payload['authorized_xml'] ?? null,
                'access_key' => $payload['access_key'] ?? null,
                'sefaz_receipt' => $payload['receipt'] ?? null,
                'sefaz_protocol' => $payload['protocol'] ?? null,
                'sefaz_status_code' => $payload['sefaz_status_code'] ?? null,
                'sefaz_status_reason' => $payload['sefaz_status_reason'] ?? null,
                'authorized_at' => $authorizedAt,
                'printed_at' => $printedAt,
                'contingency_requested_at' => $isOfflineIssue
                    ? ($document->contingency_requested_at ?: now())
                    : $document->contingency_requested_at,
                'contingency_released_at' => $isOfflineTransmission
                    ? now()
                    : $document->contingency_released_at,
                'last_error' => null,
                'failed_at' => null,
            ])->save();

            $xmlFiles = $this->xmlStorage->persist($tenantId, $document, $payload);

            $document->events()->create([
                'status' => $status,
                'source' => 'agent',
                'message' => $eventMessage,
                'payload' => [
                    'access_key' => $payload['access_key'] ?? null,
                    'protocol' => $payload['protocol'] ?? null,
                    'xml_files' => $xmlFiles,
                ],
            ]);
        });
    }

    public function markFailed(string $tenantId, int $documentId, array $payload): void
    {
        $this->tenantContext->run($tenantId, function () use ($tenantId, $documentId, $payload) {
            $document = FiscalDocument::query()->findOrFail($documentId);
            $documentPayload = is_array($document->payload) ? $document->payload : [];
            $message = $payload['message'] ?? $payload['error'] ?? 'Falha no processamento fiscal.';
            $rejected = ($payload['status'] ?? null) === 'rejected'
                || filled($payload['sefaz_status_code'] ?? null);
            $isOfflineContingency = (bool) data_get($documentPayload, 'flags.offline_contingency', false);
            $status = $isOfflineContingency ? 'contingency_failed' : ($rejected ? 'rejected' : 'failed');

            if ($isOfflineContingency) {
                $hasSignedArtifacts = filled($payload['signed_xml'] ?? null)
                    || filled($document->signed_xml)
                    || filled($payload['access_key'] ?? null)
                    || filled($document->access_key);

                data_set(
                    $documentPayload,
                    'flags.offline_contingency_stage',
                    $hasSignedArtifacts ? 'transmit_pending' : 'issue',
                );
            }

            $document->forceFillCompatible([
                'status' => $status,
                'payload' => $documentPayload,
                'request_xml' => $payload['request_xml'] ?? $document->request_xml,
                'signed_xml' => $payload['signed_xml'] ?? $document->signed_xml,
                'response_xml' => $payload['response_xml'] ?? $document->response_xml,
                'authorized_xml' => $payload['authorized_xml'] ?? $document->authorized_xml,
                'access_key' => $payload['access_key'] ?? $document->access_key,
                'sefaz_receipt' => $payload['receipt'] ?? $document->sefaz_receipt,
                'sefaz_protocol' => $payload['protocol'] ?? $document->sefaz_protocol,
                'sefaz_status_code' => $payload['sefaz_status_code'] ?? $document->sefaz_status_code,
                'sefaz_status_reason' => $payload['sefaz_status_reason'] ?? $document->sefaz_status_reason,
                'printed_at' => $payload['printed_at'] ?? $document->printed_at,
                'last_error' => $message,
                'failed_at' => now(),
            ])->save();

            $xmlFiles = $this->xmlStorage->persist($tenantId, $document, $payload);

            $document->events()->create([
                'status' => $status,
                'source' => 'agent',
                'message' => $message,
                'payload' => [
                    ...$payload,
                    'xml_files' => $xmlFiles,
                ],
            ]);
        });
    }

    public function markCancelled(string $tenantId, int $documentId, array $payload): void
    {
        $this->tenantContext->run($tenantId, function () use ($tenantId, $documentId, $payload) {
            $document = FiscalDocument::query()->with('sale')->findOrFail($documentId);
            $cancelledAt = $payload['cancelled_at'] ?? now();

            $document->forceFillCompatible([
                'status' => 'cancelled',
                'cancellation_request_xml' => $payload['cancellation_request_xml'] ?? null,
                'cancellation_response_xml' => $payload['cancellation_response_xml'] ?? null,
                'cancelled_xml' => $payload['cancelled_xml'] ?? null,
                'cancellation_protocol' => $payload['cancellation_protocol'] ?? null,
                'cancellation_reason' => $payload['cancellation_reason'] ?? $document->cancellation_reason,
                'sefaz_status_code' => $payload['sefaz_status_code'] ?? $document->sefaz_status_code,
                'sefaz_status_reason' => $payload['sefaz_status_reason'] ?? $document->sefaz_status_reason,
                'cancelled_at' => $cancelledAt,
                'last_error' => null,
                'failed_at' => null,
            ])->save();

            $xmlFiles = $this->xmlStorage->persist($tenantId, $document, $payload);

            if ($document->sale) {
                $document->sale->forceFill(['status' => 'cancelled'])->save();
            }

            $document->events()->create([
                'status' => 'cancelled',
                'source' => 'agent',
                'message' => 'Documento fiscal cancelado pela SEFAZ.',
                'payload' => [
                    'protocol' => $payload['cancellation_protocol'] ?? null,
                    'reason' => $payload['cancellation_reason'] ?? null,
                    'xml_files' => $xmlFiles,
                ],
            ]);
        });
    }

    public function markCancellationFailed(string $tenantId, int $documentId, array $payload): void
    {
        $this->tenantContext->run($tenantId, function () use ($tenantId, $documentId, $payload) {
            $document = FiscalDocument::query()->findOrFail($documentId);
            $message = $payload['message'] ?? $payload['error'] ?? 'Falha no cancelamento fiscal.';

            $document->forceFillCompatible([
                'status' => 'cancellation_failed',
                'cancellation_request_xml' => $payload['cancellation_request_xml'] ?? $document->cancellation_request_xml,
                'cancellation_response_xml' => $payload['cancellation_response_xml'] ?? $document->cancellation_response_xml,
                'cancellation_protocol' => $payload['cancellation_protocol'] ?? $document->cancellation_protocol,
                'cancellation_reason' => $payload['cancellation_reason'] ?? $document->cancellation_reason,
                'sefaz_status_code' => $payload['sefaz_status_code'] ?? $document->sefaz_status_code,
                'sefaz_status_reason' => $payload['sefaz_status_reason'] ?? $document->sefaz_status_reason,
                'last_error' => $message,
                'failed_at' => now(),
            ])->save();

            $xmlFiles = $this->xmlStorage->persist($tenantId, $document, $payload);

            $document->events()->create([
                'status' => 'cancellation_failed',
                'source' => 'agent',
                'message' => $message,
                'payload' => [
                    'reason' => $payload['cancellation_reason'] ?? null,
                    'status_code' => $payload['sefaz_status_code'] ?? null,
                    'xml_files' => $xmlFiles,
                ],
            ]);
        });
    }
}
