<?php

namespace App\Http\Controllers\Tenant\Promotions;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use App\Support\TextSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromotionsApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $promotions = Promotion::query()
            ->whereIn('type', Promotion::CORE_TYPES)
            ->with(['product:id,name,sale_price', 'category:id,name', 'campaign:id,name'])
            ->when($request->has('campaign_id'), fn ($query) => $query->where('campaign_id', $request->input('campaign_id')))
            ->when($request->boolean('standalone_only'), fn ($query) => $query->whereNull('campaign_id'))
            ->latest('id')
            ->get()
            ->map(fn (Promotion $promotion) => $promotion->toDisplayArray());

        return response()->json(['promotions' => $promotions]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $promotion = Promotion::query()->create($this->validated($request));

        return response()->json([
            'message' => 'Promoção criada com sucesso.',
            'promotion' => $promotion->fresh(['product', 'category', 'campaign'])->toDisplayArray(),
        ], 201);
    }

    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        $this->authorizeManage();

        $promotion->fill($this->validated($request, $promotion))->save();

        return response()->json([
            'message' => 'Promoção atualizada com sucesso.',
            'promotion' => $promotion->fresh(['product', 'category', 'campaign'])->toDisplayArray(),
        ]);
    }

    public function destroy(Promotion $promotion): JsonResponse
    {
        $this->authorizeManage();

        $promotion->delete();

        return response()->json(['message' => 'Promoção removida com sucesso.']);
    }

    public function duplicate(Promotion $promotion): JsonResponse
    {
        $this->authorizeManage();

        $copy = $promotion->replicate();
        $copy->name = "{$promotion->name} (cópia)";
        $copy->active = false;
        $copy->save();

        return response()->json([
            'message' => 'Promoção duplicada com sucesso.',
            'promotion' => $copy->fresh(['product', 'category', 'campaign'])->toDisplayArray(),
        ], 201);
    }

    public function searchProducts(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $term = TextSearch::normalize(trim((string) $request->query('q', '')));

        if ($term === '') {
            return response()->json(['products' => []]);
        }

        $likeTerm = TextSearch::likePattern($term);

        $products = Product::query()
            ->where('active', true)
            ->where(function ($query) use ($term, $likeTerm) {
                $query->where('barcode', $term)
                    ->orWhere('code', $term)
                    ->orWhere('barcode', 'like', $likeTerm)
                    ->orWhere('code', 'like', $likeTerm)
                    ->orWhere('name', 'like', $likeTerm);
            })
            ->orderBy('name')
            ->limit(30)
            ->get(['id', 'name', 'code', 'barcode', 'sale_price', 'category_id']);

        return response()->json(['products' => $products]);
    }

    protected function validated(Request $request, ?Promotion $promotion = null): array
    {
        $validated = $request->validate([
            'campaign_id' => ['nullable', 'integer', 'exists:promotion_campaigns,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'type' => ['required', 'string', Rule::in(Promotion::CORE_TYPES)],
            'scope' => ['required', 'string', Rule::in(['product', 'category'])],
            'product_id' => ['nullable', 'required_if:scope,product', 'integer', 'exists:products,id'],
            'category_id' => ['nullable', 'required_if:scope,category', 'integer', 'exists:categories,id'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'config' => ['nullable', 'array'],
            'config.buy_quantity' => ['required_if:type,buy_x_pay_y', 'integer', 'min:1'],
            'config.pay_quantity' => ['required_if:type,buy_x_pay_y', 'integer', 'min:0'],
            'config.tiers' => ['required_if:type,quantity_discount', 'array', 'min:1'],
            'config.tiers.*.min_quantity' => ['required_with:config.tiers', 'numeric', 'min:1'],
            'config.tiers.*.unit_price' => ['required_with:config.tiers', 'numeric', 'min:0'],
            'highlight_text' => ['nullable', 'string', 'max:120'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'weekdays' => ['nullable', 'array'],
            'weekdays.*' => ['integer', 'min:1', 'max:7'],
            'active' => ['required', 'boolean'],
        ]);

        if ($validated['scope'] === 'product') {
            $validated['category_id'] = null;
        } else {
            $validated['product_id'] = null;
        }

        $validated['discount_value'] = $validated['discount_value'] ?? 0;

        return $validated;
    }

    protected function authorizeManage(): void
    {
        abort_unless(auth()->user()?->hasPermission('promocoes.gerenciar'), 403);
    }
}
