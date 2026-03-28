<?php

namespace App\Http\Controllers\Tenant\Pos;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\Pos\FinalizeSaleRequest;
use App\Models\Tenant\Customer;
use App\Models\Tenant\Product;
use App\Services\Tenant\PosService;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PosApiController extends Controller
{
    public function searchProducts(Request $request): JsonResponse
    {
        $term = trim((string) $request->string('term'));
        $categoryId = $request->integer('category_id');

        $products = Product::query()
            ->when($categoryId, fn ($query) => $query->where('category_id', $categoryId))
            ->where('active', true)
            ->when($term !== '', function ($query) use ($term) {
                $query->where(function ($nested) use ($term) {
                    $nested
                        ->where('barcode', $term)
                        ->orWhere('code', $term)
                        ->orWhere('name', 'like', "%{$term}%");
                });
            })
            ->orderBy('name')
            ->limit(15)
            ->get()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'code' => $product->code,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'unit' => $product->unit,
                'cost_price' => (float) $product->cost_price,
                'sale_price' => (float) $product->sale_price,
                'stock_quantity' => (float) $product->stock_quantity,
            ]);

        return response()->json(['products' => $products]);
    }

    public function customerCredit(Customer $customer): JsonResponse
    {
        $openCredit = (float) $customer->sales()
            ->where('status', 'finalized')
            ->whereHas('payments', fn ($query) => $query->where('payment_method', PaymentMethod::CREDIT))
            ->with('payments')
            ->get()
            ->flatMap->payments
            ->where('payment_method', PaymentMethod::CREDIT)
            ->sum('amount');

        $available = max(0, (float) $customer->credit_limit - $openCredit);

        return response()->json([
            'credit_limit' => (float) $customer->credit_limit,
            'open_credit' => $openCredit,
            'available_credit' => $available,
        ]);
    }

    public function quickCustomer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
        ]);

        $customer = Customer::query()->create([
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'credit_limit' => 0,
            'active' => true,
        ]);

        return response()->json([
            'message' => 'Cliente cadastrado com sucesso.',
            'customer' => $customer,
        ], 201);
    }

    public function finalize(FinalizeSaleRequest $request, PosService $posService): JsonResponse
    {
        $sale = $posService->finalize($request->validated(), (int) auth()->user()?->getKey());

        return response()->json([
            'message' => 'Venda finalizada com sucesso.',
            'sale' => $sale,
        ]);
    }
}
