<?php

namespace App\Services\Central;

use App\Models\Central\LocalAgent;
use Illuminate\Support\Facades\File;
use RuntimeException;
use ZipArchive;

class LocalAgentInstallerPackageService
{
    public function __construct(
        protected LocalAgentBootstrapService $bootstrapService,
    ) {
    }

    public function build(LocalAgent $agent): array
    {
        $binaryPath = $this->agentBinaryPath();
        if (! $binaryPath) {
            throw new RuntimeException('Binario do agente Go nao encontrado no servidor.');
        }

        $bootstrap = $this->bootstrapService->bootstrapFile($agent);
        $zipPath = tempnam(sys_get_temp_dir(), 'nimvo-agent-').'.zip';
        $zip = new ZipArchive();

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Nao foi possivel gerar o instalador do agente.');
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

        return [
            'path' => $zipPath,
            'filename' => sprintf('nimvo-agent-%s.zip', $agent->id),
        ];
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
"%~dp0nimvo-agent.exe" install --seed-config "%~dp0nimvo-agent.json"
if errorlevel 1 (
    echo.
    echo Instalacao nao concluida. Veja a mensagem acima, ajuste as informacoes e execute este arquivo novamente.
    pause
    exit /b 1
)
echo.
echo Instalacao concluida. Se o agente nao iniciar, execute nimvo-agent.exe tray.
pause
BAT;
    }
}
