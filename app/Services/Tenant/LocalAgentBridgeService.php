<?php

namespace App\Services\Tenant;

use App\Models\Central\LocalAgent;
use Illuminate\Support\Facades\Schema;
use Throwable;

class LocalAgentBridgeService
{
    public function forCurrentTenant(): ?array
    {
        $tenantId = tenant()?->getTenantKey();

        if (!filled($tenantId)) {
            return null;
        }

        try {
            $connection = (new LocalAgent())->getConnectionName();

            if (!Schema::connection($connection)->hasTable('local_agents')) {
                return null;
            }

            $agents = LocalAgent::query()
                ->where('tenant_id', (string) $tenantId)
                ->where('active', true)
                ->orderByDesc('last_seen_at')
                ->get();
        } catch (Throwable $exception) {
            return null;
        }

        $requestIp = request()?->ip();
        $agent = $agents
            ->first(fn (LocalAgent $candidate) => filled($requestIp) && $candidate->last_ip === $requestIp)
            ?: $agents->first(fn (LocalAgent $candidate) => $this->isOnline($candidate))
            ?: $agents->first();

        if (!$agent) {
            return null;
        }

        $isOnline = $this->isOnline($agent);
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
            'agent_id' => $agent->id,
            'agent_label' => $agent->label ?: $agent->name,
            'printer_enabled' => (bool) data_get($agent->metadata, 'device.printer.enabled', true),
            'printer_target' => data_get($agent->metadata, 'device.printer.name')
                ?: data_get($agent->metadata, 'device.printer.host')
                ?: '',
        ];
    }

    public function isOnline(LocalAgent $agent): bool
    {
        $runtime = is_array(data_get($agent->metadata, 'runtime_config'))
            ? data_get($agent->metadata, 'runtime_config')
            : [];
        $pollInterval = max(1, (int) ($runtime['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3)));
        $heartbeatWindowSeconds = max(90, $pollInterval * 20);

        return $agent->active
            && $agent->last_seen_at
            && $agent->last_seen_at->greaterThanOrEqualTo(now()->subSeconds($heartbeatWindowSeconds));
    }
}
