<?php

namespace App\Http\Controllers\Tenant\Promotions;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Promotion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromotionsApiController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorizeManage();

        $promotions = Promotion::query()
            ->whereIn('type', Promotion::CORE_TYPES)
            ->with(['product:id,name', 'category:id,name'])
            ->latest('id')
            ->get()
            ->map(fn (Promotion $promotion) => $this->serialize($promotion));

        return response()->json(['promotions' => $promotions]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $promotion = Promotion::query()->create($this->validated($request));

        return response()->json([
            'message' => 'Promoção criada com sucesso.',
            'promotion' => $this->serialize($promotion->fresh(['product', 'category'])),
        ], 201);
    }

    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        $this->authorizeManage();

        $promotion->fill($this->validated($request, $promotion))->save();

        return response()->json([
            'message' => 'Promoção atualizada com sucesso.',
            'promotion' => $this->serialize($promotion->fresh(['product', 'category'])),
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
            'promotion' => $this->serialize($copy->fresh(['product', 'category'])),
        ], 201);
    }

    protected function validated(Request $request, ?Promotion $promotion = null): array
    {
        $validated = $request->validate([
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

    protected function serialize(Promotion $promotion): array
    {
        return [
            'id' => $promotion->id,
            'name' => $promotion->name,
            'description' => $promotion->description,
            'type' => $promotion->type,
            'scope' => $promotion->scope,
            'product_id' => $promotion->product_id,
            'product_name' => $promotion->product?->name,
            'category_id' => $promotion->category_id,
            'category_name' => $promotion->category?->name,
            'discount_value' => (float) $promotion->discount_value,
            'config' => $promotion->config,
            'highlight_text' => $promotion->highlight_text,
            'start_at' => $promotion->start_at?->format('Y-m-d\TH:i'),
            'end_at' => $promotion->end_at?->format('Y-m-d\TH:i'),
            'weekdays' => $promotion->weekdays,
            'active' => $promotion->active,
            'status' => $promotion->statusLabel(),
        ];
    }

    protected function authorizeManage(): void
    {
        abort_unless(auth()->user()?->hasPermission('promocoes.gerenciar'), 403);
    }
}
