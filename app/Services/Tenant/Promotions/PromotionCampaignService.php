<?php

namespace App\Services\Tenant\Promotions;

use App\Models\Tenant\Promotion;
use App\Models\Tenant\PromotionCampaign;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PromotionCampaignService
{
    public function create(array $data, ?int $userId): PromotionCampaign
    {
        return PromotionCampaign::query()->create([
            'code' => $this->nextCode(),
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'cover_note' => $data['cover_note'] ?? null,
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
            'active' => $data['active'] ?? true,
            'created_by' => $userId,
        ]);
    }

    public function update(PromotionCampaign $campaign, array $data): PromotionCampaign
    {
        $campaign->fill([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'cover_note' => $data['cover_note'] ?? null,
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
            'active' => $data['active'] ?? $campaign->active,
        ])->save();

        // As ofertas do tabloide herdam a janela do tabloide na criacao
        // (bulkAddProducts); sem esta cascata, editar o periodo do tabloide
        // deixa as ofertas ja criadas com start_at/end_at desatualizados e
        // uma oferta pode continuar "ativa" apos o tabloide ser encerrado.
        $campaign->promotions()->update([
            'start_at' => $campaign->starts_at,
            'end_at' => $campaign->ends_at,
        ]);

        return $campaign->fresh();
    }

    public function duplicate(PromotionCampaign $campaign, ?int $userId): PromotionCampaign
    {
        return DB::transaction(function () use ($campaign, $userId) {
            $copy = PromotionCampaign::query()->create([
                'code' => $this->nextCode(),
                'name' => "{$campaign->name} (cópia)",
                'description' => $campaign->description,
                'cover_note' => $campaign->cover_note,
                'starts_at' => $campaign->starts_at,
                'ends_at' => $campaign->ends_at,
                'active' => false,
                'created_by' => $userId,
            ]);

            foreach ($campaign->promotions as $promotion) {
                $item = $promotion->replicate();
                $item->campaign_id = $copy->id;
                $item->active = false;
                $item->save();
            }

            return $copy;
        });
    }

    /**
     * @param  array<int, array{product_id: int, discount_value: float}>  $items
     */
    public function bulkAddProducts(PromotionCampaign $campaign, array $items): Collection
    {
        return DB::transaction(function () use ($campaign, $items) {
            $created = new Collection();

            foreach ($items as $item) {
                $created->push(Promotion::query()->create([
                    'campaign_id' => $campaign->id,
                    'name' => $item['name'] ?? $campaign->name,
                    'type' => 'promo_price',
                    'scope' => 'product',
                    'product_id' => $item['product_id'],
                    'discount_value' => $item['discount_value'],
                    'start_at' => $campaign->starts_at,
                    'end_at' => $campaign->ends_at,
                    'active' => true,
                ]));
            }

            return $created;
        });
    }

    public function deleteWithPromotions(PromotionCampaign $campaign): void
    {
        DB::transaction(function () use ($campaign) {
            $campaign->promotions()->delete();
            $campaign->delete();
        });
    }

    /**
     * Mesmo formato de query de ReportBrowserService::promotionsImpactReport(),
     * restrito às promoções de uma campanha — sem paginação (um tabloide tem
     * poucas ofertas).
     */
    public function performanceSummary(PromotionCampaign $campaign, array $filters): array
    {
        $from = isset($filters['from']) ? Carbon::parse($filters['from'])->startOfDay() : now()->subDays(30)->startOfDay();
        $to = isset($filters['to']) ? Carbon::parse($filters['to'])->endOfDay() : now()->endOfDay();

        $rows = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('promotions', 'promotions.id', '=', 'sale_items.promotion_id')
            ->where('promotions.campaign_id', $campaign->id)
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from, $to])
            ->groupBy('promotions.id', 'promotions.name')
            ->selectRaw('
                promotions.id as promotion_id,
                promotions.name as promotion_name,
                COALESCE(SUM(sale_items.quantity), 0) as quantity_sold,
                COALESCE(SUM(sale_items.total), 0) as revenue,
                COALESCE(SUM(sale_items.discount_amount), 0) as discount_granted,
                COALESCE(SUM(sale_items.profit), 0) as margin
            ')
            ->orderByDesc('revenue')
            ->get();

        return [
            'summary' => [
                'promotions_with_sales' => $rows->count(),
                'quantity_sold' => (float) $rows->sum('quantity_sold'),
                'revenue' => round((float) $rows->sum('revenue'), 2),
                'discount_granted' => round((float) $rows->sum('discount_granted'), 2),
                'margin' => round((float) $rows->sum('margin'), 2),
            ],
            'rows' => $rows->map(fn ($row) => [
                'promotion_id' => $row->promotion_id,
                'promotion_name' => $row->promotion_name,
                'quantity_sold' => (float) $row->quantity_sold,
                'revenue' => round((float) $row->revenue, 2),
                'discount_granted' => round((float) $row->discount_granted, 2),
                'margin' => round((float) $row->margin, 2),
            ])->values()->all(),
        ];
    }

    protected function nextCode(): string
    {
        $year = now()->format('Y');
        $sequence = PromotionCampaign::query()->whereYear('created_at', $year)->count() + 1;

        do {
            $code = sprintf('TAB-%s-%04d', $year, $sequence);
            $sequence++;
        } while (PromotionCampaign::query()->where('code', $code)->exists());

        return $code;
    }
}
