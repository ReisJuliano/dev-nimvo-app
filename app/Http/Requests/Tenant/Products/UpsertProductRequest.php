<?php

namespace App\Http\Requests\Tenant\Products;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => ['nullable', 'string', 'max:255'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'ncm' => ['nullable', 'regex:/^\d{8}$/'],
            'cfop' => ['nullable', 'regex:/^\d{4}$/'],
            'cest' => ['nullable', 'regex:/^\d{7}$/'],
            'origin_code' => ['nullable', 'string', Rule::in(['0', '1', '2', '3', '4', '5', '6', '7', '8'])],
            'icms_csosn' => ['nullable', 'string', 'max:3'],
            'pis_cst' => ['nullable', 'string', 'max:2'],
            'cofins_cst' => ['nullable', 'string', 'max:2'],
            'fiscal_enabled' => ['nullable', 'boolean'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'internal_notes' => ['nullable', 'string'],
            'style_reference' => ['nullable', 'string', 'max:255'],
            'color' => ['nullable', 'string', 'max:120'],
            'size' => ['nullable', 'string', 'max:120'],
            'collection' => ['nullable', 'string', 'max:120'],
            'catalog_visible' => ['nullable', 'boolean'],
            'active' => ['nullable', 'boolean'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'unit' => ['nullable', 'string', 'max:10'],
            'commercial_unit' => ['nullable', 'string', 'max:10'],
            'taxable_unit' => ['nullable', 'string', 'max:10'],
            'sold_by' => ['nullable', 'string', Rule::in(['unit', 'weight'])],
            'is_kit' => ['nullable', 'boolean'],
            'kit_items' => ['nullable', 'array'],
            'kit_items.*.component_product_id' => ['required_with:kit_items', 'integer', 'exists:products,id'],
            'kit_items.*.quantity' => ['required_with:kit_items', 'numeric', 'min:0.001'],
            'scale_code' => [
                'nullable',
                'integer',
                'min:1',
                Rule::unique('products', 'scale_code')->ignore($this->route('product')),
            ],
            'track_expiry' => ['nullable', 'boolean'],
            'expiry_alert_days' => ['nullable', 'integer', 'min:1'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['required', 'numeric', 'min:0'],
            'stock_quantity' => ['nullable', 'numeric', 'min:0'],
            'min_stock' => ['nullable', 'numeric', 'min:0'],
            'icms_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pis_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cofins_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'ipi_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
