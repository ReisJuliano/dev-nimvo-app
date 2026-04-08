<?php

namespace App\Services\Central;

use App\Models\Central\LocalAgent;

class LocalAgentConfigService
{
    public function buildRuntimeConfig(LocalAgent $agent): array
    {
        return $this->normalizeRuntimeConfig($this->runtimeMetadata($agent));
    }

    public function updateRuntimeConfig(LocalAgent $agent, array $runtime): LocalAgent
    {
        $metadata = is_array($agent->metadata) ? $agent->metadata : [];
        $metadata['runtime_config'] = $this->normalizeRuntimeConfig($runtime);

        $agent->forceFill(['metadata' => $metadata])->save();

        return $agent->refresh();
    }

    public function syncInstallation(LocalAgent $agent, array $payload): LocalAgent
    {
        $metadata = is_array($agent->metadata) ? $agent->metadata : [];
        $device = is_array($metadata['device'] ?? null) ? $metadata['device'] : [];
        $metadata['device'] = array_filter(array_replace_recursive($device, [
            'machine' => array_filter([
                'name' => $payload['machine']['name'] ?? null,
                'user' => $payload['machine']['user'] ?? null,
            ], [$this, 'filledValue']),
            'certificate' => array_filter([
                'path' => $payload['certificate']['path'] ?? null,
            ], [$this, 'filledValue']),
            'printer' => array_filter([
                'enabled' => array_key_exists('enabled', $payload['printer'] ?? [])
                    ? (bool) $payload['printer']['enabled']
                    : null,
                'connector' => $payload['printer']['connector'] ?? null,
                'name' => $payload['printer']['name'] ?? null,
                'host' => $payload['printer']['host'] ?? null,
                'port' => isset($payload['printer']['port']) ? (int) $payload['printer']['port'] : null,
                'logo_path' => $payload['printer']['logo_path'] ?? null,
            ], fn ($value) => $value !== null && $value !== ''),
            'local_api' => array_filter([
                'enabled' => array_key_exists('enabled', $payload['local_api'] ?? [])
                    ? (bool) $payload['local_api']['enabled']
                    : null,
                'host' => $payload['local_api']['host'] ?? null,
                'port' => isset($payload['local_api']['port']) ? (int) $payload['local_api']['port'] : null,
                'url' => $payload['local_api']['url'] ?? null,
            ], fn ($value) => $value !== null && $value !== ''),
            'software' => array_filter([
                'version' => $payload['software']['version'] ?? null,
                'project_root' => $payload['software']['project_root'] ?? null,
                'php_path' => $payload['software']['php_path'] ?? null,
                'installed_at' => $payload['software']['installed_at'] ?? null,
                'config_path' => $payload['software']['config_path'] ?? null,
            ], [$this, 'filledValue']),
            'supported_types' => array_values(array_filter(
                (array) ($payload['supported_types'] ?? []),
                fn ($value) => $value !== null && $value !== '',
            )),
            'last_sync_at' => now()->toIso8601String(),
        ]), fn ($value) => is_array($value) ? $value !== [] : $value !== null && $value !== '');

        $agent->forceFill(['metadata' => $metadata])->save();

        return $agent->refresh();
    }

    protected function runtimeMetadata(LocalAgent $agent): array
    {
        return is_array(data_get($agent->metadata, 'runtime_config'))
            ? data_get($agent->metadata, 'runtime_config')
            : [];
    }

    public function normalizeRuntimeConfig(array $runtime): array
    {
        return [
            'poll_interval_seconds' => max(
                1,
                (int) ($runtime['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3)),
            ),
        ];
    }

    protected function filledValue(mixed $value): bool
    {
        return $value !== null && $value !== '';
    }
}
