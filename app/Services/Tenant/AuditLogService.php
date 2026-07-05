<?php

namespace App\Services\Tenant;

use App\Models\Tenant\AuditLog;
use Illuminate\Database\Eloquent\Model;

class AuditLogService
{
    public function record(
        string $action,
        ?Model $auditable = null,
        array $before = [],
        array $after = [],
        array $metadata = [],
        ?int $userId = null,
    ): AuditLog {
        $userId ??= auth()->user()?->getKey();

        $request = request();

        return AuditLog::query()->create([
            'user_id' => $userId,
            'action' => $action,
            'auditable_type' => $auditable?->getMorphClass(),
            'auditable_id' => $auditable?->getKey(),
            'before' => $before ?: null,
            'after' => $after ?: null,
            'metadata' => array_filter([
                'ip' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
                ...$metadata,
            ], static fn ($value) => $value !== null),
            'occurred_at' => now(),
        ]);
    }
}
