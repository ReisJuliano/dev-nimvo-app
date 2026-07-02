<?php

namespace App\Http\Controllers\Tenant\Settings;

use App\Http\Controllers\Controller;
use App\Models\Central\LocalAgent;
use App\Services\Central\LocalAgentBootstrapService;
use App\Services\Tenant\LocalAgentBridgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use RuntimeException;
use ZipArchive;

class LocalAgentSettingsController extends Controller
{
    public function index(LocalAgentBridgeService $bridgeService, LocalAgentBootstrapService $bootstrapService): JsonResponse
    {
        $this->authorizeTenantAdmin();
        $tenantId = (string) tenant()?->getTenantKey();

        $agents = LocalAgent::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('last_seen_at')
            ->get()
            ->map(fn (LocalAgent $agent) => $this->serializeAgent($agent, $bridgeService, $bootstrapService))
            ->values();

        return response()->json(['agents' => $agents]);
    }

    public function store(Request $request, LocalAgentBootstrapService $bootstrapService, LocalAgentBridgeService $bridgeService): JsonResponse
    {
        $this->authorizeTenantAdmin();
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:80'],
        ]);
        $tenantId = (string) tenant()?->getTenantKey();

        $agent = $bootstrapService->upsertForTenant($tenantId, [
            'name' => (string) $validated['label'],
            'label' => (string) $validated['label'],
            'active' => true,
            'create_new' => true,
            'backend_url' => config('app.url'),
            'runtime_config' => [
                'poll_interval_seconds' => (int) config('fiscal.agents.poll_interval_seconds', 3),
            ],
        ]);
        $activation = $bootstrapService->issueActivationCode($agent);

        return response()->json([
            'message' => 'Agente local criado. Baixe o instalador e use o código de ativação.',
            'agent' => $this->serializeAgent($activation['agent'], $bridgeService, $bootstrapService, $activation['code']),
        ], 201);
    }

    public function activationCode(
        LocalAgent $agent,
        LocalAgentBootstrapService $bootstrapService,
        LocalAgentBridgeService $bridgeService,
    ): JsonResponse {
        $this->authorizeTenantAdmin();
        $this->authorizeTenantAgent($agent);

        $activation = $bootstrapService->issueActivationCode($agent);

        return response()->json([
            'message' => 'Novo código de ativação gerado.',
            'agent' => $this->serializeAgent($activation['agent'], $bridgeService, $bootstrapService, $activation['code']),
        ]);
    }

    public function update(
        Request $request,
        LocalAgent $agent,
        LocalAgentBridgeService $bridgeService,
        LocalAgentBootstrapService $bootstrapService,
    ): JsonResponse {
        $this->authorizeTenantAdmin();
        $this->authorizeTenantAgent($agent);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:80'],
            'printer' => ['nullable', 'array'],
            'printer.mode' => ['nullable', 'in:local,relay'],
            'printer.name' => ['nullable', 'string', 'max:255'],
            'printer.relay_target' => ['nullable', 'string', 'max:255'],
            'printer.paper_width' => ['nullable', 'in:58mm,80mm'],
        ]);
        $metadata = is_array($agent->metadata) ? $agent->metadata : [];

        if (filled($validated['label'] ?? null)) {
            $agent->label = (string) $validated['label'];
            $agent->name = (string) $validated['label'];
        }

        if (isset($validated['printer'])) {
            $printer = is_array(data_get($metadata, 'device.printer'))
                ? data_get($metadata, 'device.printer')
                : [];
            data_set($metadata, 'device.printer', array_replace($printer, array_filter($validated['printer'], fn ($value) => $value !== null)));
        }

        $agent->forceFill(['metadata' => $metadata])->save();

        return response()->json([
            'message' => 'Configuração do agente atualizada.',
            'agent' => $this->serializeAgent($agent->refresh(), $bridgeService, $bootstrapService),
        ]);
    }

    public function download(LocalAgent $agent, LocalAgentBootstrapService $bootstrapService)
    {
        $this->authorizeTenantAdmin();
        $this->authorizeTenantAgent($agent);

        $binaryPath = $this->agentBinaryPath();
        if (! $binaryPath) {
            abort(404, 'Binário do agente Go não encontrado no servidor.');
        }

        $bootstrap = $bootstrapService->bootstrapFile($agent);
        $zipPath = tempnam(sys_get_temp_dir(), 'nimvo-agent-').'.zip';
        $zip = new ZipArchive();

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Não foi possível gerar o instalador do agente.');
        }

        $zip->addFile($binaryPath, 'nimvo-agent.exe');
        $zip->addFromString('nimvo-agent.json', $bootstrap['content']);
        $zip->addFromString('instalar.bat', $this->installerBatch());

        foreach (['nimvo.ico', 'nimvo-logo.png'] as $asset) {
            $assetPath = base_path("local-agent/go-agent/{$asset}");
            if (File::exists($assetPath)) {
                $zip->addFile($assetPath, $asset);
            }
        }

        $zip->close();

        return response()
            ->download($zipPath, sprintf('nimvo-agent-%s.zip', $agent->id))
            ->deleteFileAfterSend(true);
    }

    protected function serializeAgent(
        LocalAgent $agent,
        LocalAgentBridgeService $bridgeService,
        LocalAgentBootstrapService $bootstrapService,
        ?string $activationCode = null,
    ): array {
        $activation = $bootstrapService->activationStatus($agent);

        return [
            'id' => $agent->id,
            'label' => $agent->label ?: $agent->name,
            'name' => $agent->name,
            'active' => (bool) $agent->active,
            'online' => $bridgeService->isOnline($agent),
            'last_seen_at' => optional($agent->last_seen_at)?->toIso8601String(),
            'printer' => [
                'enabled' => (bool) data_get($agent->metadata, 'device.printer.enabled', true),
                'name' => (string) data_get($agent->metadata, 'device.printer.name', ''),
                'mode' => (string) data_get($agent->metadata, 'device.printer.mode', 'local'),
                'relay_target' => (string) data_get($agent->metadata, 'device.printer.relay_target', ''),
                'paper_width' => (string) data_get($agent->metadata, 'device.printer.paper_width', '80mm'),
            ],
            'activation' => [
                ...$activation,
                'code' => $activationCode,
            ],
        ];
    }

    protected function authorizeTenantAgent(LocalAgent $agent): void
    {
        abort_unless((string) $agent->tenant_id === (string) tenant()?->getTenantKey(), 404);
    }

    protected function authorizeTenantAdmin(): void
    {
        abort_unless(auth()->user()?->role === 'admin', 403);
    }

    protected function agentBinaryPath(): ?string
    {
        foreach ([
            base_path('local-agent/bin/nimvo-fiscal-agent.exe'),
            base_path('local-agent/go-agent/nimvo-fiscal-agent.exe'),
        ] as $path) {
            if (File::exists($path)) {
                return $path;
            }
        }

        return null;
    }

    protected function installerBatch(): string
    {
        return <<<'BAT'
@echo off
setlocal
cd /d "%~dp0"
echo Instalando agente local do Nimvo...
"%~dp0nimvo-agent.exe" install --seed-config "%~dp0nimvo-agent.json" --non-interactive
echo.
echo Instalacao concluida. Se o agente nao iniciar, execute nimvo-agent.exe tray.
pause
BAT;
    }
}
