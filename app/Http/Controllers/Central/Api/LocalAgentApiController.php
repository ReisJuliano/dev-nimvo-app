<?php

namespace App\Http\Controllers\Central\Api;

use App\Http\Controllers\Controller;
use App\Models\Central\LocalAgent;
use App\Models\Central\LocalAgentCommand;
use App\Services\Central\LocalAgentCommandService;
use App\Services\Tenant\Fiscal\FiscalDocumentResultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocalAgentApiController extends Controller
{
    public function heartbeat(Request $request): JsonResponse
    {
        /** @var LocalAgent $agent */
        $agent = $request->attributes->get('localAgent');

        return response()->json([
            'agent' => [
                'key' => $agent->agent_key,
                'tenant_id' => $agent->tenant_id,
                'name' => $agent->name,
                'last_seen_at' => optional($agent->last_seen_at)->toIso8601String(),
            ],
        ]);
    }

    public function poll(
        Request $request,
        LocalAgentCommandService $commandService,
        FiscalDocumentResultService $resultService,
    ): JsonResponse {
        /** @var LocalAgent $agent */
        $agent = $request->attributes->get('localAgent');
        $command = $commandService->claimNext($agent);

        if (!$command) {
            return response()->json(['command' => null]);
        }

        if ($command->fiscal_document_id) {
            $resultService->markProcessing($agent->tenant_id, (int) $command->fiscal_document_id, $agent->agent_key);
        }

        return response()->json([
            'command' => [
                'id' => $command->id,
                'type' => $command->type,
                'payload' => $command->payload,
                'attempts' => $command->attempts,
            ],
        ]);
    }

    public function complete(
        Request $request,
        LocalAgentCommand $command,
        LocalAgentCommandService $commandService,
        FiscalDocumentResultService $resultService,
    ): JsonResponse {
        /** @var LocalAgent $agent */
        $agent = $request->attributes->get('localAgent');

        abort_unless($command->local_agent_id === $agent->id, 404);

        $validated = $request->validate([
            'successful' => ['required', 'boolean'],
            'message' => ['nullable', 'string'],
            'request_xml' => ['nullable', 'string'],
            'signed_xml' => ['nullable', 'string'],
            'authorized_xml' => ['nullable', 'string'],
            'access_key' => ['nullable', 'string'],
            'receipt' => ['nullable', 'string'],
            'protocol' => ['nullable', 'string'],
            'sefaz_status_code' => ['nullable', 'string'],
            'sefaz_status_reason' => ['nullable', 'string'],
            'printed_at' => ['nullable', 'date'],
            'error' => ['nullable', 'string'],
        ]);

        $command = $commandService->complete($command, $validated, (bool) $validated['successful']);

        if ($command->fiscal_document_id) {
            if ($validated['successful']) {
                $resultService->markAuthorized($agent->tenant_id, (int) $command->fiscal_document_id, $validated);
            } else {
                $resultService->markFailed($agent->tenant_id, (int) $command->fiscal_document_id, $validated);
            }
        }

        return response()->json([
            'message' => 'Resultado do comando fiscal recebido.',
            'command' => [
                'id' => $command->id,
                'status' => $command->status,
            ],
        ]);
    }
}
