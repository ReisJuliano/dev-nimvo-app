<?php

namespace App\Http\Controllers\Tenant\Promotions;

use App\Http\Controllers\Controller;
use App\Models\Tenant\PromotionCampaign;
use App\Services\Tenant\Promotions\PromotionCampaignService;
use App\Services\Tenant\TabloidPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PromotionCampaignsApiController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorizeManage();

        $campaigns = PromotionCampaign::query()
            ->withCount('promotions')
            ->with(['createdBy:id,name', 'promotions:id,campaign_id,active,start_at,end_at'])
            ->latest('id')
            ->get()
            ->map(fn (PromotionCampaign $campaign) => $this->serialize($campaign));

        return response()->json(['campaigns' => $campaigns]);
    }

    public function store(Request $request, PromotionCampaignService $service): JsonResponse
    {
        $this->authorizeManage();

        $campaign = $service->create($this->validated($request), auth()->id());

        return response()->json([
            'message' => 'Tabloide criado com sucesso.',
            'campaign' => $this->serialize($campaign),
        ], 201);
    }

    public function show(PromotionCampaign $campaign): JsonResponse
    {
        $this->authorizeManage();

        $data = $this->serialize($campaign);
        $data['promotions'] = $campaign->promotions()
            ->with(['product:id,name,sale_price', 'category:id,name'])
            ->latest('id')
            ->get()
            ->map(fn ($promotion) => $promotion->toDisplayArray());

        return response()->json(['campaign' => $data]);
    }

    public function update(Request $request, PromotionCampaign $campaign, PromotionCampaignService $service): JsonResponse
    {
        $this->authorizeManage();

        $campaign = $service->update($campaign, $this->validated($request));

        return response()->json([
            'message' => 'Tabloide atualizado com sucesso.',
            'campaign' => $this->serialize($campaign),
        ]);
    }

    public function destroy(Request $request, PromotionCampaign $campaign, PromotionCampaignService $service): JsonResponse
    {
        $this->authorizeManage();

        if ($request->boolean('with_promotions')) {
            $service->deleteWithPromotions($campaign);

            return response()->json(['message' => 'Tabloide e suas ofertas foram removidos.']);
        }

        $campaign->delete();

        return response()->json(['message' => 'Tabloide removido. As ofertas continuam ativas como avulsas.']);
    }

    public function duplicate(PromotionCampaign $campaign, PromotionCampaignService $service): JsonResponse
    {
        $this->authorizeManage();

        $copy = $service->duplicate($campaign, auth()->id());

        return response()->json([
            'message' => 'Tabloide duplicado com sucesso.',
            'campaign' => $this->serialize($copy),
        ], 201);
    }

    public function bulkAddItems(Request $request, PromotionCampaign $campaign, PromotionCampaignService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.discount_value' => ['required', 'numeric', 'min:0.01'],
            'items.*.name' => ['nullable', 'string', 'max:255'],
        ]);

        $created = $service->bulkAddProducts($campaign, $validated['items']);
        $created->load(['product', 'category']);

        return response()->json([
            'message' => "{$created->count()} oferta(s) adicionada(s) ao tabloide.",
            'promotions' => $created->map(fn ($promotion) => $promotion->toDisplayArray()),
        ], 201);
    }

    public function performance(Request $request, PromotionCampaign $campaign, PromotionCampaignService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return response()->json($service->performanceSummary($campaign, $validated));
    }

    public function pdf(PromotionCampaign $campaign, TabloidPdfService $pdfService): Response
    {
        $this->authorizeManage();

        return $pdfService->build($campaign);
    }

    protected function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'cover_note' => ['nullable', 'string', 'max:255'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'active' => ['nullable', 'boolean'],
        ]);
    }

    protected function serialize(PromotionCampaign $campaign): array
    {
        return [
            'id' => $campaign->id,
            'code' => $campaign->code,
            'name' => $campaign->name,
            'description' => $campaign->description,
            'cover_note' => $campaign->cover_note,
            'starts_at' => $campaign->starts_at?->format('Y-m-d\TH:i'),
            'ends_at' => $campaign->ends_at?->format('Y-m-d\TH:i'),
            'active' => $campaign->active,
            'status' => $campaign->statusLabel(),
            'promotions_count' => $campaign->promotions_count ?? $campaign->promotions()->count(),
            'active_promotions_count' => $this->countActivePromotions($campaign),
            'created_by_name' => $campaign->createdBy?->name,
            'created_at' => $campaign->created_at?->toIso8601String(),
        ];
    }

    protected function countActivePromotions(PromotionCampaign $campaign): int
    {
        if (!$campaign->active || $campaign->ends_at?->isPast()) {
            return 0;
        }

        if ($campaign->relationLoaded('promotions')) {
            return $campaign->promotions
                ->each(fn ($promotion) => $promotion->setRelation('campaign', $campaign))
                ->filter(fn ($promotion) => $promotion->statusLabel() === 'ativa')
                ->count();
        }

        $now = now();

        return $campaign->promotions()
            ->where('active', true)
            ->where(fn ($query) => $query->whereNull('start_at')->orWhere('start_at', '<=', $now))
            ->where(fn ($query) => $query->whereNull('end_at')->orWhere('end_at', '>=', $now))
            ->count();
    }

    protected function authorizeManage(): void
    {
        abort_unless(auth()->user()?->hasPermission('promocoes.gerenciar'), 403);
    }
}
