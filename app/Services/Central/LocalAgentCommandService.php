<?php

namespace App\Services\Central;

use App\Models\Central\LocalAgent;
use App\Models\Central\LocalAgentCommand;
use App\Models\Tenant\FiscalDocument;
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
            'payload' => $document->payload,
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

    public function claimNext(LocalAgent $agent, array $supportedTypes = []): ?LocalAgentCommand
    {
        $timeout = config('fiscal.agents.command_timeout_seconds', 120);

        return DB::connection('central')->transaction(function () use ($agent, $timeout, $supportedTypes) {
            $query = LocalAgentCommand::query()
                ->where('local_agent_id', $agent->id)
                ->where(function ($query) use ($timeout) {
                    $query
                        ->where('status', 'pending')
                        ->orWhere(function ($stalled) use ($timeout) {
                            $stalled
                                ->where('status', 'processing')
                                ->where('claimed_at', '<=', now()->subSeconds($timeout));
                        });
                })
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
}
