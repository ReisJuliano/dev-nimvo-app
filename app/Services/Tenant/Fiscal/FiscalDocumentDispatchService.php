<?php

namespace App\Services\Tenant\Fiscal;

use App\Jobs\Tenant\QueueFiscalDocumentForEmission;
use App\Models\Tenant\FiscalDocument;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Support\Facades\Schema;

class FiscalDocumentDispatchService
{
    public function __construct(
        protected Dispatcher $dispatcher,
    ) {
    }

    public function dispatch(string $tenantId, int $documentId): void
    {
        $job = (new QueueFiscalDocumentForEmission($tenantId, $documentId))
            ->onQueue(config('fiscal.queues.documents'));

        if ($this->shouldFallbackToSync()) {
            $this->dispatcher->dispatchSync($job);

            return;
        }

        $this->dispatcher->dispatch($job);
    }

    protected function shouldFallbackToSync(): bool
    {
        $connectionName = (string) config('queue.default', 'sync');

        if ($connectionName !== 'database') {
            return false;
        }

        $queueConfig = (array) config('queue.connections.database', []);
        $databaseConnection = $queueConfig['connection']
            ?: (new FiscalDocument())->getConnection()->getName();
        $table = (string) ($queueConfig['table'] ?? 'jobs');

        return ! Schema::connection((string) $databaseConnection)->hasTable($table);
    }
}
