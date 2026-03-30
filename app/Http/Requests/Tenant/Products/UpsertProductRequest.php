<?php

namespace App\Http\Requests\Tenant\Products;

use Illuminate\Foundation\Http\FormRequest;

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
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'style_reference' => ['nullable', 'string', 'max:255'],
            'color' => ['nullable', 'string', 'max:120'],
            'size' => ['nullable', 'string', 'max:120'],
            'collection' => ['nullable', 'string', 'max:120'],
            'catalog_visible' => ['nullable', 'boolean'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'unit' => ['required', 'string', 'max:10'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'stock_quantity' => ['nullable', 'numeric', 'min:0'],
            'min_stock' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
