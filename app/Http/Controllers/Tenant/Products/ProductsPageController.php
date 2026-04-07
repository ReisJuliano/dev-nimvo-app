<?php

namespace App\Http\Controllers\Tenant\Products;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Category;
use App\Models\Tenant\Supplier;
use App\Services\Tenant\ProductService;
use Inertia\Inertia;
use Inertia\Response;

class ProductsPageController extends Controller
{
    public function __invoke(ProductService $productService): Response
    {
        return Inertia::render('Products/Index', [
            'products' => $productService->activeCatalog(),
            'categories' => Category::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
            'suppliers' => Supplier::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }
}
