<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;

class LabelTemplate extends Model
{
    use UsesTenantConnection;

    public const BARCODE_MODES = ['auto', 'ean13', 'code128', 'none'];

    protected $fillable = [
        'name',
        'show_name',
        'show_price',
        'show_promo',
        'barcode_mode',
        'label_width_mm',
        'label_height_mm',
        'columns',
        'rows',
        'margin_left_mm',
        'margin_top_mm',
        'gap_x_mm',
        'gap_y_mm',
        'is_default',
        'layout',
    ];

    protected $casts = [
        'show_name' => 'boolean',
        'show_price' => 'boolean',
        'show_promo' => 'boolean',
        'label_width_mm' => 'decimal:2',
        'label_height_mm' => 'decimal:2',
        'columns' => 'integer',
        'rows' => 'integer',
        'margin_left_mm' => 'decimal:2',
        'margin_top_mm' => 'decimal:2',
        'gap_x_mm' => 'decimal:2',
        'gap_y_mm' => 'decimal:2',
        'is_default' => 'boolean',
        'layout' => 'array',
    ];

    public function hasLayout(): bool
    {
        return ! empty($this->layout['elements']);
    }
}
