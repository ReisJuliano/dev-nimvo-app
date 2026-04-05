<?php

namespace App\Services\Central;

use App\Support\SpedNfeNfceEmitter;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class LocalFiscalAgentRunner
{
    public function __construct(
        protected SpedNfeNfceEmitter $emitter,
    ) {
    }

    public function run(string $configPath, bool $once, callable $output): int
    {
        $config = $this->loadConfig($configPath);
        $runtimeConfig = $config;
        $interval = (int) ($runtimeConfig['agent']['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3));
        $baseUrl = rtrim((string) ($config['backend']['base_url'] ?? ''), '/');

        $output('info', sprintf('Agente fiscal iniciado para %s.', $baseUrl));
        Log::info('Agente fiscal iniciado.', ['backend' => $baseUrl, 'config' => $configPath]);

        do {
            try {
                $heartbeat = $this->post($config, '/api/local-agents/heartbeat', $this->heartbeatPayload($config, $configPath));
                $runtimeConfig = $this->mergeRuntimeConfig($config, (array) ($heartbeat['config'] ?? []));
                $interval = (int) ($runtimeConfig['agent']['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3));
                $polled = $this->post($runtimeConfig, '/api/local-agents/commands/poll');
                $command = $polled['command'] ?? null;
            } catch (Throwable $exception) {
                Log::error('Falha de comunicacao com o backend fiscal.', [
                    'backend' => $baseUrl,
                    'error' => $exception->getMessage(),
                ]);
                $output('error', sprintf('Falha de comunicacao com o backend fiscal: %s', $exception->getMessage()));

                if ($once) {
                    return 1;
                }

                sleep(max(1, $interval));
                continue;
            }

            if (!$command) {
                if ($once) {
                    $output('info', 'Nenhum comando pendente para o agente local.');

                    return 0;
                }

                sleep(max(1, $interval));
                continue;
            }

            $output('info', sprintf('Processando comando %s (%s).', $command['id'], $command['type']));
            Log::info('Processando comando fiscal.', [
                'command_id' => $command['id'],
                'type' => $command['type'],
            ]);

            try {
                $isLocalTest = (bool) data_get($command, 'payload.flags.local_test', false);
                $result = $isLocalTest
                    ? $this->emitter->emitLocalTest($command['payload'], $runtimeConfig)
                    : $this->emitter->emit($command['payload'], $runtimeConfig);

                $this->post(
                    $runtimeConfig,
                    sprintf('/api/local-agents/commands/%s/complete', $command['id']),
                    array_merge(['successful' => true], $result),
                );

                $output('info', sprintf('Comando %s concluido com sucesso.', $command['id']));
                Log::info('Comando fiscal concluido.', ['command_id' => $command['id']]);
            } catch (Throwable $exception) {
                $this->post(
                    $runtimeConfig,
                    sprintf('/api/local-agents/commands/%s/complete', $command['id']),
                    [
                        'successful' => false,
                        'message' => $exception->getMessage(),
                        'error' => $exception->getMessage(),
                    ],
                );

                $output('error', sprintf('Comando %s falhou: %s', $command['id'], $exception->getMessage()));
                Log::error('Comando fiscal falhou.', [
                    'command_id' => $command['id'],
                    'error' => $exception->getMessage(),
                ]);

                if ($once) {
                    return 1;
                }
            }

            if ($once) {
                return 0;
            }
        } while (true);
    }

    protected function loadConfig(string $configPath): array
    {
        if (!is_file($configPath)) {
            throw new RuntimeException("Arquivo de configuracao do agente nao encontrado em {$configPath}.");
        }

        $content = file_get_contents($configPath);

        if ($content === false) {
            throw new RuntimeException('Nao foi possivel ler o arquivo de configuracao do agente.');
        }

        $config = json_decode($content, true);

        if (!is_array($config)) {
            throw new RuntimeException('O arquivo de configuracao do agente nao contem JSON valido.');
        }

        foreach (['backend', 'agent', 'certificate'] as $required) {
            if (!is_array($config[$required] ?? null)) {
                throw new RuntimeException("Secao obrigatoria ausente na configuracao: {$required}.");
            }
        }

        return $config;
    }

    protected function post(array $config, string $uri, array $payload = []): array
    {
        $baseUrl = rtrim((string) ($config['backend']['base_url'] ?? ''), '/');
        $retryTimes = max(1, (int) ($config['backend']['retry_times'] ?? 3));
        $retrySleepMs = max(100, (int) ($config['backend']['retry_sleep_ms'] ?? 500));

        if ($baseUrl === '') {
            throw new RuntimeException('A URL base do backend nao foi configurada no agente local.');
        }

        $response = Http::acceptJson()
            ->asJson()
            ->timeout((int) ($config['backend']['timeout_seconds'] ?? 30))
            ->retry($retryTimes, $retrySleepMs)
            ->withHeaders([
                'X-Agent-Key' => (string) ($config['agent']['key'] ?? ''),
                'X-Agent-Secret' => (string) ($config['agent']['secret'] ?? ''),
            ])
            ->post($baseUrl.$uri, $payload);

        $response->throw();

        return $response->json() ?: [];
    }

    protected function heartbeatPayload(array $config, string $configPath): array
    {
        return [
            'machine' => [
                'name' => php_uname('n'),
                'user' => get_current_user() ?: null,
            ],
            'certificate' => [
                'path' => (string) data_get($config, 'certificate.path', ''),
            ],
            'printer' => [
                'enabled' => (bool) data_get($config, 'printer.enabled', true),
                'connector' => (string) data_get($config, 'printer.connector', 'windows'),
                'name' => (string) data_get($config, 'printer.name', ''),
                'host' => (string) data_get($config, 'printer.host', '127.0.0.1'),
                'port' => (int) data_get($config, 'printer.port', 9100),
                'logo_path' => (string) data_get($config, 'printer.logo_path', ''),
            ],
            'local_api' => [
                'enabled' => (bool) data_get($config, 'local_api.enabled', true),
                'host' => (string) data_get($config, 'local_api.host', '127.0.0.1'),
                'port' => (int) data_get($config, 'local_api.port', 18123),
                'url' => sprintf(
                    'http://%s:%d',
                    (string) data_get($config, 'local_api.host', '127.0.0.1'),
                    (int) data_get($config, 'local_api.port', 18123),
                ),
            ],
            'software' => [
                'version' => 'nimvo-go-agent-bridge',
                'project_root' => base_path(),
                'php_path' => PHP_BINARY,
                'installed_at' => date(DATE_ATOM, filemtime($configPath) ?: time()),
                'config_path' => $configPath,
            ],
        ];
    }

    protected function mergeRuntimeConfig(array $localConfig, array $runtimeConfig): array
    {
        $merged = $localConfig;

        if (isset($runtimeConfig['poll_interval_seconds'])) {
            $merged['agent']['poll_interval_seconds'] = max(1, (int) $runtimeConfig['poll_interval_seconds']);
        }

        return $merged;
    }
}
