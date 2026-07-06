<?php

namespace App\Http\Controllers\Tenant\Promotions;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Category;
use App\Models\Tenant\Product;
use Inertia\Inertia;
use Inertia\Response;

class PromotionsPageController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(auth()->user()?->hasPermission('promocoes.gerenciar'), 403);

        return Inertia::render('Promotions/Index', [
            'categories' => Category::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'products' => Product::query()->where('active', true)->orderBy('name')->limit(500)->get(['id', 'name', 'code']),
        ]);
    }
}
