<?php

namespace App\Http\Controllers\Tenant\Products;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Category;
use App\Models\Tenant\Supplier;
use App\Services\Tenant\ProductService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductsPageController extends Controller
{
    public function __invoke(Request $request, ProductService $productService): Response
    {
        $applied = $request->boolean('applied');
        $search = trim((string) $request->query('search', ''));

        $canViewCost = (bool) auth()->user()?->hasPermission('produtos.ver_custo');

        return Inertia::render('Products/Index', [
            'products' => $applied ? $productService->fullCatalog($canViewCost) : [],
            'categories' => Category::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
            'suppliers' => Supplier::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
            'filters' => [
                'applied' => $applied,
                'search' => $search,
            ],
            'canViewCost' => $canViewCost,
        ]);
    }
}
