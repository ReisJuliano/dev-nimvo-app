<?php

namespace App\Console\Commands;

use App\Services\Central\LocalAgentCommandService;
use Illuminate\Console\Command;

class FailStaleLocalAgentCommands extends Command
{
    protected $signature = 'nimvo:fail-stale-local-agent-commands';

    protected $description = 'Marca comandos travados do agente local como falhos.';

    public function handle(LocalAgentCommandService $commandService): int
    {
        $failed = $commandService->failStaleProcessingCommands();

        $this->info("Comandos do agente local marcados como falhos: {$failed}");

        return self::SUCCESS;
    }
}
