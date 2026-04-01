<?php

namespace App\Jobs\Tenant;

use App\Models\Central\LocalAgent;
use App\Models\Tenant\FiscalDocument;
use App\Services\Central\LocalAgentCommandService;
use App\Services\Tenant\Fiscal\FiscalDocumentResultService;
use App\Support\Tenant\TenantContext;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class QueueFiscalDocumentForEmission implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Queueable;

    public function __construct(
        public string $tenantId,
        public int $documentId,
    ) {
    }

    public function uniqueId(): string
    {
        return sprintf('%s:%d', $this->tenantId, $this->documentId);
    }

    public function middleware(): array
    {
        return [
            new WithoutOverlapping($this->uniqueId()),
        ];
    }

    public function handle(
        TenantContext $tenantContext,
        LocalAgentCommandService $commandService,
        FiscalDocumentResultService $resultService,
    ): void {
        $tenantContext->run($this->tenantId, function () use ($commandService, $resultService) {
            $document = FiscalDocument::query()->findOrFail($this->documentId);

            if (in_array($document->status, ['authorized', 'printed', 'signed_local', 'printed_local'], true)) {
                return;
            }

            $agent = LocalAgent::query()
                ->where('tenant_id', $this->tenantId)
                ->where('active', true)
                ->orderByDesc('last_seen_at')
                ->first();

            if (!$agent) {
                $resultService->markAwaitingAgent($this->tenantId, $document->id);

                return;
            }

            $command = $commandService->queueEmission($agent, $document, $this->tenantId);

            $resultService->markQueuedToAgent(
                $this->tenantId,
                $document->id,
                $agent->agent_key,
                $command->id,
            );
        });
    }
}
