<?php

namespace App\Services\Central;

use App\Models\Central\LocalAgent;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class LocalAgentBootstrapService
{
    public function __construct(
        protected LocalAgentConfigService $configService,
    ) {
    }

    public function upsertForTenant(string $tenantId, array $data): LocalAgent
    {
        $agent = LocalAgent::query()->firstWhere('tenant_id', $tenantId);
        $metadata = is_array($agent?->metadata) ? $agent->metadata : [];
        $credentials = $this->generateCredentialsIfMissing($metadata);

        $metadata['runtime_config'] = $this->configService->normalizeRuntimeConfig($data['runtime_config'] ?? $metadata['runtime_config'] ?? []);
        $metadata['bootstrap'] = [
            'backend_url' => $this->resolveBackendUrl($data['backend_url'] ?? data_get($metadata, 'bootstrap.backend_url')),
        ];
        $metadata['credentials'] = [
            'secret_encrypted' => $credentials['secret_encrypted'],
        ];

        if (!$agent) {
            $agent = new LocalAgent();
            $agent->tenant_id = $tenantId;
            $agent->agent_key = Str::lower(Str::random(24));
        }

        $agent->forceFill([
            'name' => (string) ($data['name'] ?? $agent->name ?? sprintf('Agente fiscal %s', $tenantId)),
            'active' => (bool) ($data['active'] ?? true),
            'secret_hash' => $credentials['secret_hash'] ?? $agent->secret_hash,
            'metadata' => $metadata,
        ])->save();

        return $agent->refresh();
    }

    public function rotateSecret(LocalAgent $agent): LocalAgent
    {
        $credentials = $this->generateCredentials();
        $metadata = is_array($agent->metadata) ? $agent->metadata : [];
        $metadata['credentials'] = [
            'secret_encrypted' => $credentials['secret_encrypted'],
        ];

        $agent->forceFill([
            'secret_hash' => $credentials['secret_hash'],
            'metadata' => $metadata,
        ])->save();

        return $agent->refresh();
    }

    public function bootstrapAvailable(LocalAgent $agent): bool
    {
        return filled($this->secret($agent));
    }

    public function bootstrapPayload(LocalAgent $agent): array
    {
        $secret = $this->secret($agent);

        if (!$secret) {
            throw new RuntimeException('Este agente ainda nao possui bootstrap disponivel. Gere um novo bootstrap antes de instalar no cliente.');
        }

        $runtime = $this->configService->buildRuntimeConfig($agent);
        $devicePrinter = is_array(data_get($agent->metadata, 'device.printer'))
            ? data_get($agent->metadata, 'device.printer')
            : [];
        $bootstrapUrl = $this->resolveBackendUrl(data_get($agent->metadata, 'bootstrap.backend_url'));

        return [
            'backend' => [
                'base_url' => $bootstrapUrl,
                'timeout_seconds' => 30,
                'retry_times' => 3,
                'retry_sleep_ms' => 500,
            ],
            'agent' => [
                'key' => $agent->agent_key,
                'secret' => $secret,
                'poll_interval_seconds' => (int) ($runtime['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3)),
            ],
            'certificate' => [
                'path' => (string) data_get($agent->metadata, 'device.certificate.path', ''),
                'password' => '',
            ],
            'printer' => [
                'enabled' => (bool) ($devicePrinter['enabled'] ?? data_get($runtime, 'printer.enabled', true)),
                'connector' => (string) ($devicePrinter['connector'] ?? data_get($runtime, 'printer.connector', 'windows')),
                'name' => (string) ($devicePrinter['name'] ?? data_get($runtime, 'printer.name', '')),
                'host' => (string) ($devicePrinter['host'] ?? data_get($runtime, 'printer.host', '127.0.0.1')),
                'port' => (int) ($devicePrinter['port'] ?? data_get($runtime, 'printer.port', 9100)),
                'logo_path' => (string) ($devicePrinter['logo_path'] ?? data_get($runtime, 'printer.logo_path', '')),
            ],
        ];
    }

    public function bootstrapFile(LocalAgent $agent): array
    {
        $payload = $this->bootstrapPayload($agent);

        return [
            'filename' => sprintf('nimvo-agent-%s.json', $agent->tenant_id),
            'content' => json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
            'payload' => $payload,
        ];
    }

    public function secret(LocalAgent $agent): ?string
    {
        $encrypted = data_get($agent->metadata, 'credentials.secret_encrypted');

        if (!is_string($encrypted) || trim($encrypted) === '') {
            return null;
        }

        try {
            $secret = decrypt($encrypted);
        } catch (DecryptException) {
            return null;
        }

        return is_string($secret) ? $secret : null;
    }

    protected function generateCredentialsIfMissing(array $metadata): array
    {
        $encrypted = data_get($metadata, 'credentials.secret_encrypted');

        if (is_string($encrypted) && trim($encrypted) !== '') {
            return [
                'secret_encrypted' => $encrypted,
            ];
        }

        return $this->generateCredentials();
    }

    protected function generateCredentials(): array
    {
        $secret = Str::random(48);

        return [
            'secret_hash' => Hash::make($secret),
            'secret_encrypted' => encrypt($secret),
        ];
    }

    protected function resolveBackendUrl(?string $url): string
    {
        $url = trim((string) $url);

        if ($url !== '') {
            return rtrim($url, '/');
        }

        return rtrim((string) config('app.url', url('/')), '/');
    }
}
