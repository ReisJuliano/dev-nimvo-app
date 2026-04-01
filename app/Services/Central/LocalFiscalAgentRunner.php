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
        $interval = (int) ($config['agent']['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3));
        $baseUrl = rtrim((string) ($config['backend']['base_url'] ?? ''), '/');

        $output('info', sprintf('Agente fiscal iniciado para %s.', $baseUrl));
        Log::info('Agente fiscal iniciado.', ['backend' => $baseUrl, 'config' => $configPath]);

        do {
            try {
                $this->post($config, '/api/local-agents/heartbeat');
                $polled = $this->post($config, '/api/local-agents/commands/poll');
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
                    ? $this->emitter->emitLocalTest($command['payload'], $config)
                    : $this->emitter->emit($command['payload'], $config);

                $this->post(
                    $config,
                    sprintf('/api/local-agents/commands/%s/complete', $command['id']),
                    array_merge(['successful' => true], $result),
                );

                $output('info', sprintf('Comando %s concluido com sucesso.', $command['id']));
                Log::info('Comando fiscal concluido.', ['command_id' => $command['id']]);
            } catch (Throwable $exception) {
                $this->post(
                    $config,
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
}
