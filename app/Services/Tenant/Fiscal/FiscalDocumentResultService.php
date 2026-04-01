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

            $document->forceFill([
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

    public function markAwaitingAgent(string $tenantId, int $documentId): void
    {
        $this->tenantContext->run($tenantId, function () use ($documentId) {
            $document = FiscalDocument::query()->findOrFail($documentId);

            $document->forceFill([
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

            $document->forceFill([
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
            $printedAt = $payload['printed_at'] ?? null;
            $isLocalTest = ($payload['status'] ?? null) === 'local_test'
                || (bool) data_get($document->payload, 'flags.local_test', false);
            $status = $isLocalTest
                ? ($printedAt ? 'printed_local' : 'signed_local')
                : ($printedAt ? 'printed' : 'authorized');

            $document->forceFill([
                'status' => $status,
                'request_xml' => $payload['request_xml'] ?? null,
                'signed_xml' => $payload['signed_xml'] ?? null,
                'authorized_xml' => $payload['authorized_xml'] ?? null,
                'access_key' => $payload['access_key'] ?? null,
                'sefaz_receipt' => $payload['receipt'] ?? null,
                'sefaz_protocol' => $payload['protocol'] ?? null,
                'sefaz_status_code' => $payload['sefaz_status_code'] ?? null,
                'sefaz_status_reason' => $payload['sefaz_status_reason'] ?? null,
                'authorized_at' => now(),
                'printed_at' => $printedAt,
                'last_error' => null,
                'failed_at' => null,
            ])->save();

            $xmlFiles = $this->xmlStorage->persist($tenantId, $document, $payload);

            $document->events()->create([
                'status' => $status,
                'source' => 'agent',
                'message' => $isLocalTest
                    ? ($printedAt
                        ? 'NFC-e de ensaio assinada e impressa localmente.'
                        : 'NFC-e de ensaio assinada localmente.')
                    : ($printedAt
                        ? 'NFC-e autorizada e impressa pelo agente local.'
                        : 'NFC-e autorizada pelo agente local.'),
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
        $this->tenantContext->run($tenantId, function () use ($documentId, $payload) {
            $document = FiscalDocument::query()->findOrFail($documentId);
            $message = $payload['message'] ?? $payload['error'] ?? 'Falha no processamento fiscal.';

            $document->forceFill([
                'status' => 'failed',
                'last_error' => $message,
                'failed_at' => now(),
            ])->save();

            $document->events()->create([
                'status' => 'failed',
                'source' => 'agent',
                'message' => $message,
                'payload' => $payload,
            ]);
        });
    }
}
