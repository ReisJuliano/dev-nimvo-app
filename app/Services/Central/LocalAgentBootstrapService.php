<?php

namespace App\Services\Central;

use App\Models\Central\LocalAgent;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Carbon;
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

    public function issueActivationCode(LocalAgent $agent): array
    {
        $metadata = is_array($agent->metadata) ? $agent->metadata : [];
        $code = $this->generateActivationCode();
        $normalized = $this->normalizeActivationCode($code);
        $expiresAt = now()->addMinutes(max(5, (int) config('fiscal.agents.activation_code_expires_minutes', 30)));

        $metadata['activation'] = [
            'code_hash' => hash('sha256', $normalized),
            'code_encrypted' => encrypt($code),
            'generated_at' => now()->toIso8601String(),
            'expires_at' => $expiresAt->toIso8601String(),
            'activated_at' => null,
        ];

        $agent->forceFill([
            'metadata' => $metadata,
        ])->save();

        return [
            'agent' => $agent->refresh(),
            'code' => $code,
            'backend_url' => $this->resolveBackendUrl(data_get($metadata, 'bootstrap.backend_url')),
            'generated_at' => data_get($metadata, 'activation.generated_at'),
            'expires_at' => data_get($metadata, 'activation.expires_at'),
        ];
    }

    public function activationStatus(LocalAgent $agent): array
    {
        $activation = is_array(data_get($agent->metadata, 'activation'))
            ? data_get($agent->metadata, 'activation')
            : [];

        $expiresAt = $this->normalizeDate(data_get($activation, 'expires_at'));
        $generatedAt = $this->normalizeDate(data_get($activation, 'generated_at'));
        $activatedAt = $this->normalizeDate(data_get($activation, 'activated_at'));
        $pending = filled(data_get($activation, 'code_hash'))
            && (!$expiresAt || $expiresAt->isFuture());

        return [
            'pending' => $pending,
            'generated_at' => $generatedAt?->toIso8601String(),
            'expires_at' => $expiresAt?->toIso8601String(),
            'activated_at' => $activatedAt?->toIso8601String(),
            'backend_url' => $this->resolveBackendUrl(data_get($agent->metadata, 'bootstrap.backend_url')),
        ];
    }

    public function activateByCode(string $code): array
    {
        $normalized = $this->normalizeActivationCode($code);

        if ($normalized === '') {
            throw new RuntimeException('Informe um codigo de ativacao valido para conectar o agente.');
        }

        $agent = LocalAgent::query()
            ->where('active', true)
            ->get()
            ->first(fn (LocalAgent $candidate) => $this->activationMatches($candidate, $normalized));

        if (!$agent) {
            throw new RuntimeException('Codigo de ativacao invalido ou expirado. Gere um novo codigo no admin do Nimvo.');
        }

        $secret = $this->secret($agent);
        if (!$secret) {
            throw new RuntimeException('As credenciais permanentes do agente ainda nao estao disponiveis para esta ativacao.');
        }

        $metadata = is_array($agent->metadata) ? $agent->metadata : [];
        $metadata['activation'] = [
            'generated_at' => data_get($metadata, 'activation.generated_at'),
            'expires_at' => data_get($metadata, 'activation.expires_at'),
            'activated_at' => now()->toIso8601String(),
        ];

        $agent->forceFill([
            'metadata' => $metadata,
        ])->save();

        return [
            'agent' => $agent->refresh(),
            'secret' => $secret,
        ];
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
        $deviceLocalApi = is_array(data_get($agent->metadata, 'device.local_api'))
            ? data_get($agent->metadata, 'device.local_api')
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
                'enabled' => (bool) ($devicePrinter['enabled'] ?? true),
                'connector' => (string) ($devicePrinter['connector'] ?? 'windows'),
                'name' => (string) ($devicePrinter['name'] ?? ''),
                'host' => (string) ($devicePrinter['host'] ?? '127.0.0.1'),
                'port' => (int) ($devicePrinter['port'] ?? 9100),
                'logo_path' => (string) ($devicePrinter['logo_path'] ?? ''),
            ],
            'local_api' => [
                'enabled' => (bool) ($deviceLocalApi['enabled'] ?? true),
                'host' => (string) ($deviceLocalApi['host'] ?? '127.0.0.1'),
                'port' => (int) ($deviceLocalApi['port'] ?? 18123),
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

    protected function generateActivationCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $segments = [];

        for ($segment = 0; $segment < 3; $segment++) {
            $value = '';

            for ($index = 0; $index < 4; $index++) {
                $value .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }

            $segments[] = $value;
        }

        return implode('-', $segments);
    }

    protected function normalizeActivationCode(string $code): string
    {
        return preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($code))) ?: '';
    }

    protected function activationMatches(LocalAgent $agent, string $normalizedCode): bool
    {
        $activation = is_array(data_get($agent->metadata, 'activation'))
            ? data_get($agent->metadata, 'activation')
            : [];
        $codeHash = (string) data_get($activation, 'code_hash', '');
        $expiresAt = $this->normalizeDate(data_get($activation, 'expires_at'));

        if ($codeHash === '' || !$expiresAt || $expiresAt->isPast()) {
            return false;
        }

        return hash_equals($codeHash, hash('sha256', $normalizedCode));
    }

    protected function normalizeDate(mixed $value): ?Carbon
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
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
