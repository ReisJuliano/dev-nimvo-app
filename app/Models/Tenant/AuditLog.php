<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use RuntimeException;

class AuditLog extends Model
{
    use UsesTenantConnection;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'auditable_type',
        'auditable_id',
        'before',
        'after',
        'metadata',
        'occurred_at',
    ];

    protected $casts = [
        'before' => 'array',
        'after' => 'array',
        'metadata' => 'array',
        'occurred_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new RuntimeException('Registros de auditoria sao imutaveis e nao podem ser alterados.');
        });

        static::deleting(function (): void {
            throw new RuntimeException('Registros de auditoria sao imutaveis e nao podem ser excluidos.');
        });

        static::creating(function (self $log): void {
            $log->created_at ??= $log->occurred_at ?? now();
            $log->occurred_at ??= now();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }
}
