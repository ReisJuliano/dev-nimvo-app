<?php

namespace App\Services\Central;

use App\Models\Central\LocalAgent;
use App\Models\Central\LocalAgentCommand;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalNumberInutilization;
use Illuminate\Support\Facades\DB;

class LocalAgentCommandService
{
    public function queueEmission(LocalAgent $agent, FiscalDocument $document, string $tenantId): LocalAgentCommand
    {
        $existing = LocalAgentCommand::query()
            ->where('tenant_id', $tenantId)
            ->where('fiscal_document_id', $document->id)
            ->whereIn('status', ['pending', 'processing'])
            ->latest('created_at')
            ->first();

        if ($existing) {
            return $existing;
        }

        return LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $tenantId,
            'fiscal_document_id' => $document->id,
            'type' => 'emit_nfce',
            'status' => 'pending',
            'payload' => array_merge(is_array($document->payload) ? $document->payload : [], [
                'existing_document' => [
                    'request_xml' => $document->request_xml,
                    'signed_xml' => $document->signed_xml,
                    'response_xml' => $document->response_xml,
                    'authorized_xml' => $document->authorized_xml,
                    'access_key' => $document->access_key,
                    'printed_at' => optional($document->printed_at)?->toIso8601String(),
                ],
            ]),
            'available_at' => now(),
        ]);
    }

    public function queueCancellation(LocalAgent $agent, FiscalDocument $document, string $tenantId, array $payload): LocalAgentCommand
    {
        $existing = LocalAgentCommand::query()
            ->where('tenant_id', $tenantId)
            ->where('fiscal_document_id', $document->id)
            ->where('type', 'cancel_fiscal_document')
            ->whereIn('status', ['pending', 'processing'])
            ->latest('created_at')
            ->first();

        if ($existing) {
            return $existing;
        }

        return LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $tenantId,
            'fiscal_document_id' => $document->id,
            'type' => 'cancel_fiscal_document',
            'status' => 'pending',
            'payload' => $payload,
            'available_at' => now(),
        ]);
    }

    public function queueInutilization(
        LocalAgent $agent,
        FiscalNumberInutilization $inutilization,
        string $tenantId,
        array $payload,
    ): LocalAgentCommand {
        $existing = LocalAgentCommand::query()
            ->where('tenant_id', $tenantId)
            ->where('fiscal_number_inutilization_id', $inutilization->id)
            ->where('type', 'invalidate_fiscal_range')
            ->whereIn('status', ['pending', 'processing'])
            ->latest('created_at')
            ->first();

        if ($existing) {
            return $existing;
        }

        return LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $tenantId,
            'fiscal_number_inutilization_id' => $inutilization->id,
            'type' => 'invalidate_fiscal_range',
            'status' => 'pending',
            'payload' => $payload,
            'available_at' => now(),
        ]);
    }

    public function queuePaymentReceipt(LocalAgent $agent, string $tenantId, array $payload): LocalAgentCommand
    {
        $saleId = (int) ($payload['sale_id'] ?? 0);

        if ($saleId > 0) {
            $existing = LocalAgentCommand::query()
                ->where('local_agent_id', $agent->id)
                ->where('tenant_id', $tenantId)
                ->where('type', 'print_payment_receipt')
                ->whereIn('status', ['pending', 'processing'])
                ->latest('created_at')
                ->take(20)
                ->get()
                ->first(fn (LocalAgentCommand $command) => (int) data_get($command->payload, 'sale_id') === $saleId);

            if ($existing) {
                return $existing;
            }
        }

        return LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $tenantId,
            'type' => 'print_payment_receipt',
            'status' => 'pending',
            'payload' => $payload,
            'available_at' => now(),
        ]);
    }

    public function queuePrintTest(LocalAgent $agent, string $tenantId, array $payload): LocalAgentCommand
    {
        return LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $tenantId,
            'type' => 'print_test',
            'status' => 'pending',
            'payload' => $payload,
            'available_at' => now(),
        ]);
    }

    public function queueOperationReceipt(LocalAgent $agent, string $tenantId, array $payload): LocalAgentCommand
    {
        return LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $tenantId,
            'type' => 'print_operation_receipt',
            'status' => 'pending',
            'payload' => $payload,
            'available_at' => now(),
        ]);
    }

    public function queueLabelPrint(LocalAgent $agent, string $tenantId, array $payload): LocalAgentCommand
    {
        return LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $tenantId,
            'type' => 'print_label',
            'status' => 'pending',
            'payload' => $payload,
            'available_at' => now(),
        ]);
    }

    public function claimNext(LocalAgent $agent, array $supportedTypes = []): ?LocalAgentCommand
    {
        return DB::connection('central')->transaction(function () use ($agent, $supportedTypes) {
            $query = LocalAgentCommand::query()
                ->where('local_agent_id', $agent->id)
                ->where('status', 'pending')
                ->where(function ($query) {
                    $query
                        ->whereNull('available_at')
                        ->orWhere('available_at', '<=', now());
                })
                ->orderBy('created_at');

            if ($supportedTypes !== []) {
                $query->whereIn('type', $supportedTypes);
            }

            $command = $query->lockForUpdate()->first();

            if (!$command) {
                return null;
            }

            $command->forceFill([
                'status' => 'processing',
                'claimed_at' => now(),
                'attempts' => $command->attempts + 1,
            ])->save();

            return $command->fresh();
        });
    }

    public function complete(LocalAgentCommand $command, array $result, bool $successful): LocalAgentCommand
    {
        $command->forceFill([
            'status' => $successful ? 'completed' : 'failed',
            'result_payload' => $result,
            'last_error' => $successful ? null : ($result['message'] ?? $result['error'] ?? 'Falha no agente local.'),
            'completed_at' => now(),
        ])->save();

        return $command->fresh();
    }

    public function retry(LocalAgentCommand $command): LocalAgentCommand
    {
        return LocalAgentCommand::query()->create([
            'local_agent_id' => $command->local_agent_id,
            'tenant_id' => $command->tenant_id,
            'fiscal_document_id' => $command->fiscal_document_id,
            'fiscal_number_inutilization_id' => $command->fiscal_number_inutilization_id,
            'type' => $command->type,
            'status' => 'pending',
            'payload' => $command->payload ?? [],
            'available_at' => now(),
        ]);
    }

    public function failStaleProcessingCommands(?int $timeoutSeconds = null): int
    {
        $timeoutSeconds ??= (int) config('fiscal.agents.command_timeout_seconds', 120);

        return LocalAgentCommand::query()
            ->where('status', 'processing')
            ->whereNotNull('claimed_at')
            ->where('claimed_at', '<=', now()->subSeconds($timeoutSeconds))
            ->update([
                'status' => 'failed',
                'last_error' => 'Tempo limite excedido no agente local.',
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
    }
}
