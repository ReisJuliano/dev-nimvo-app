<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\FiscalNumberInutilization;
use App\Support\Tenant\TenantContext;

class FiscalNumberInutilizationResultService
{
    public function __construct(
        protected TenantContext $tenantContext,
    ) {
    }

    public function markProcessing(string $tenantId, int $inutilizationId, string $agentKey): void
    {
        $this->tenantContext->run($tenantId, function () use ($inutilizationId, $agentKey) {
            $inutilization = FiscalNumberInutilization::query()->findOrFail($inutilizationId);

            $inutilization->forceFill([
                'status' => 'processing',
                'agent_key' => $agentKey,
                'processing_started_at' => now(),
            ])->save();
        });
    }

    public function markSucceeded(string $tenantId, int $inutilizationId, array $payload): void
    {
        $this->tenantContext->run($tenantId, function () use ($inutilizationId, $payload) {
            $inutilization = FiscalNumberInutilization::query()->findOrFail($inutilizationId);

            $inutilization->forceFill([
                'status' => 'processed',
                'request_xml' => $payload['request_xml'] ?? null,
                'response_xml' => $payload['response_xml'] ?? null,
                'protocol' => $payload['protocol'] ?? null,
                'sefaz_status_code' => $payload['sefaz_status_code'] ?? null,
                'sefaz_status_reason' => $payload['sefaz_status_reason'] ?? null,
                'last_error' => null,
                'processed_at' => now(),
                'failed_at' => null,
            ])->save();
        });
    }

    public function markFailed(string $tenantId, int $inutilizationId, array $payload): void
    {
        $this->tenantContext->run($tenantId, function () use ($inutilizationId, $payload) {
            $inutilization = FiscalNumberInutilization::query()->findOrFail($inutilizationId);
            $message = $payload['message'] ?? $payload['error'] ?? 'Falha na inutilizacao fiscal.';

            $inutilization->forceFill([
                'status' => ($payload['status'] ?? null) === 'rejected' ? 'rejected' : 'failed',
                'request_xml' => $payload['request_xml'] ?? $inutilization->request_xml,
                'response_xml' => $payload['response_xml'] ?? $inutilization->response_xml,
                'protocol' => $payload['protocol'] ?? $inutilization->protocol,
                'sefaz_status_code' => $payload['sefaz_status_code'] ?? $inutilization->sefaz_status_code,
                'sefaz_status_reason' => $payload['sefaz_status_reason'] ?? $inutilization->sefaz_status_reason,
                'last_error' => $message,
                'failed_at' => now(),
            ])->save();
        });
    }
}
