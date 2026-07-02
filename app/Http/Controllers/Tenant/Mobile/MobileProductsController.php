<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MobileProductsController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $term = trim((string) $request->query('q', ''));
        $limit = min(max((int) $request->integer('limit', 20), 1), 50);

        $query = Product::query()->select('id', 'code', 'name');

        if ($term !== '') {
            $query->where(function ($builder) use ($term) {
                $builder
                    ->where('name', 'like', "%{$term}%")
                    ->orWhere('code', 'like', "%{$term}%");
            });
        }

        $items = $query
            ->orderBy('name')
            ->limit($limit)
            ->get()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'code' => $product->code ?: '-',
                'name' => $product->name,
            ])
            ->values();

        return response()->json([
            'data' => ['items' => $items],
            'message' => 'OK',
        ]);
    }
}
