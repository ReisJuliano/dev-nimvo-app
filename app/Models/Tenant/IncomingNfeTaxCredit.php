<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncomingNfeTaxCredit extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'document_id',
        'incoming_nfe_item_id',
        'tax_type',
        'status',
        'recoverable',
        'amount',
        'basis',
        'rate',
        'regime',
        'description',
        'appropriation_reference',
        'available_at',
        'payload',
    ];

    protected $casts = [
        'recoverable' => 'boolean',
        'amount' => 'decimal:2',
        'basis' => 'decimal:2',
        'rate' => 'decimal:4',
        'available_at' => 'date',
        'payload' => 'array',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(IncomingNfeDocument::class, 'document_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(IncomingNfeItem::class, 'incoming_nfe_item_id');
    }
}
