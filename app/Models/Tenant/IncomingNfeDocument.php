<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IncomingNfeDocument extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'purchase_id',
        'supplier_id',
        'access_key',
        'status',
        'source',
        'manifest_status',
        'distribution_nsu',
        'environment',
        'series',
        'number',
        'operation_nature',
        'supplier_name',
        'supplier_trade_name',
        'supplier_document',
        'supplier_state_registration',
        'recipient_name',
        'recipient_document',
        'products_total',
        'freight_total',
        'invoice_total',
        'xml_path',
        'danfe_path',
        'validation_snapshot',
        'metadata',
        'issued_at',
        'authorized_at',
        'last_synced_at',
        'last_processed_at',
    ];

    protected $casts = [
        'environment' => 'integer',
        'series' => 'integer',
        'number' => 'integer',
        'products_total' => 'decimal:2',
        'freight_total' => 'decimal:2',
        'invoice_total' => 'decimal:2',
        'validation_snapshot' => 'array',
        'metadata' => 'array',
        'issued_at' => 'datetime',
        'authorized_at' => 'datetime',
        'last_synced_at' => 'datetime',
        'last_processed_at' => 'datetime',
    ];

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(IncomingNfeItem::class, 'document_id');
    }
}
