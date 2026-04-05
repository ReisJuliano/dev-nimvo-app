<?php

namespace App\Services\Tenant;

use App\Models\Central\LocalAgent;

class LocalAgentBridgeService
{
    public function forCurrentTenant(): ?array
    {
        $tenantId = tenant()?->getTenantKey();

        if (!filled($tenantId)) {
            return null;
        }

        $agent = LocalAgent::query()->firstWhere('tenant_id', (string) $tenantId);

        if (!$agent) {
            return null;
        }

        $runtime = is_array(data_get($agent->metadata, 'runtime_config'))
            ? data_get($agent->metadata, 'runtime_config')
            : [];
        $pollInterval = max(1, (int) ($runtime['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3)));
        $heartbeatWindowSeconds = max(90, $pollInterval * 20);
        $isOnline = $agent->active
            && $agent->last_seen_at
            && $agent->last_seen_at->greaterThanOrEqualTo(now()->subSeconds($heartbeatWindowSeconds));
        $host = (string) data_get($agent->metadata, 'device.local_api.host', '127.0.0.1');
        $port = max(1, (int) data_get($agent->metadata, 'device.local_api.port', 18123));
        $baseUrl = trim((string) data_get($agent->metadata, 'device.local_api.url'));

        if ($baseUrl === '') {
            $baseUrl = sprintf('http://%s:%d', $host, $port);
        }

        return [
            'enabled' => (bool) $agent->active && (bool) data_get($agent->metadata, 'device.local_api.enabled', true),
            'online' => $isOnline,
            'base_url' => rtrim($baseUrl, '/'),
            'agent_key' => $agent->agent_key,
            'printer_enabled' => (bool) data_get($agent->metadata, 'device.printer.enabled', true),
            'printer_target' => data_get($agent->metadata, 'device.printer.name')
                ?: data_get($agent->metadata, 'device.printer.host')
                ?: '',
        ];
    }
}
