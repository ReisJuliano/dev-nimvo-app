<?php

namespace App\Http\Controllers\Central\Api;

use App\Http\Controllers\Controller;
use App\Models\Central\LocalAgent;
use App\Models\Central\LocalAgentCommand;
use App\Services\Central\LocalAgentCommandService;
use App\Services\Central\LocalAgentBootstrapService;
use App\Services\Central\LocalAgentConfigService;
use App\Services\Tenant\Fiscal\FiscalDocumentResultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class LocalAgentApiController extends Controller
{
    public function activate(
        Request $request,
        LocalAgentBootstrapService $bootstrapService,
        LocalAgentConfigService $configService,
    ): JsonResponse {
        $validated = $request->validate([
            'activation_code' => ['required', 'string', 'max:64'],
        ]);

        try {
            ['agent' => $agent, 'secret' => $secret] = $bootstrapService->activateByCode((string) $validated['activation_code']);
        } catch (RuntimeException $exception) {
            abort(422, $exception->getMessage());
        }

        $runtimeConfig = $configService->buildRuntimeConfig($agent);

        return response()->json([
            'message' => 'Agente ativado com sucesso.',
            'agent' => [
                'id' => $agent->id,
                'tenant_id' => $agent->tenant_id,
                'name' => $agent->name,
                'key' => $agent->agent_key,
            ],
            'backend' => [
                'base_url' => rtrim((string) config('app.url', url('/')), '/'),
            ],
            'credentials' => [
                'key' => $agent->agent_key,
                'secret' => $secret,
                'poll_interval_seconds' => (int) ($runtimeConfig['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3)),
            ],
        ]);
    }

    public function heartbeat(Request $request, LocalAgentConfigService $configService): JsonResponse
    {
        /** @var LocalAgent $agent */
        $agent = $request->attributes->get('localAgent');
        $payload = $request->validate([
            'machine' => ['nullable', 'array'],
            'machine.name' => ['nullable', 'string', 'max:255'],
            'machine.user' => ['nullable', 'string', 'max:255'],
            'certificate' => ['nullable', 'array'],
            'certificate.path' => ['nullable', 'string', 'max:1024'],
            'printer' => ['nullable', 'array'],
            'printer.enabled' => ['nullable', 'boolean'],
            'printer.connector' => ['nullable', 'string', 'max:30'],
            'printer.name' => ['nullable', 'string', 'max:255'],
            'printer.host' => ['nullable', 'string', 'max:255'],
            'printer.port' => ['nullable', 'integer', 'between:1,65535'],
            'printer.logo_path' => ['nullable', 'string', 'max:1024'],
            'local_api' => ['nullable', 'array'],
            'local_api.enabled' => ['nullable', 'boolean'],
            'local_api.host' => ['nullable', 'string', 'max:255'],
            'local_api.port' => ['nullable', 'integer', 'between:1,65535'],
            'local_api.url' => ['nullable', 'string', 'max:255'],
            'software' => ['nullable', 'array'],
            'software.version' => ['nullable', 'string', 'max:255'],
            'software.project_root' => ['nullable', 'string', 'max:1024'],
            'software.php_path' => ['nullable', 'string', 'max:1024'],
            'software.installed_at' => ['nullable', 'date'],
            'software.config_path' => ['nullable', 'string', 'max:1024'],
        ]);
        $agent = $configService->syncInstallation($agent, $payload);

        return response()->json([
            'agent' => [
                'key' => $agent->agent_key,
                'tenant_id' => $agent->tenant_id,
                'name' => $agent->name,
                'last_seen_at' => optional($agent->last_seen_at)->toIso8601String(),
            ],
            'config' => $configService->buildRuntimeConfig($agent),
        ]);
    }

    public function poll(
        Request $request,
        LocalAgentCommandService $commandService,
        FiscalDocumentResultService $resultService,
    ): JsonResponse {
        /** @var LocalAgent $agent */
        $agent = $request->attributes->get('localAgent');
        $validated = $request->validate([
            'supported_types' => ['nullable', 'array'],
            'supported_types.*' => ['string', 'max:30'],
        ]);
        $supportedTypes = array_values(array_filter((array) ($validated['supported_types'] ?? [])));
        $command = $commandService->claimNext($agent, $supportedTypes);

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
            'message' => 'Resultado do comando recebido.',
            'command' => [
                'id' => $command->id,
                'status' => $command->status,
            ],
        ]);
    }
}
