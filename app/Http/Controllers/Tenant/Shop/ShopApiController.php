<?php

namespace App\Http\Controllers\Tenant\Shop;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Customer;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use App\Services\Tenant\FashionModuleSettingsService;
use App\Services\Tenant\OrderDraftService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ShopApiController extends Controller
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function checkout(
        Request $request,
        TenantSettingsService $tenantSettingsService,
        FashionModuleSettingsService $fashionSettingsService,
        OrderDraftService $orderDraftService,
    ): JsonResponse {
        abort_unless(
            $tenantSettingsService->isModuleEnabled('catalogo_online')
            && $tenantSettingsService->isModuleEnabled('pedidos_online'),
            404,
        );

        if (!$this->hasColumn('order_drafts', 'channel')) {
            return response()->json([
                'message' => 'O tenant ainda nao esta pronto para receber pedidos do shop.',
            ], 409);
        }

        $validated = $request->validate([
            'customer.name' => ['required', 'string', 'max:255'],
            'customer.phone' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
        ]);

        $items = collect($validated['items']);
        $availableProducts = Product::query()
            ->whereIn('id', $items->pluck('id')->all())
            ->where('active', true)
            ->when(
                $this->hasColumn('products', 'catalog_visible'),
                fn ($query) => $query->where('catalog_visible', true),
            )
            ->count();

        if ($availableProducts !== $items->pluck('id')->unique()->count()) {
            return response()->json([
                'message' => 'Um ou mais produtos nao estao disponiveis no shop.',
            ], 422);
        }

        $ownerUserId = $this->resolveOwnerUserId();

        if (!$ownerUserId) {
            return response()->json([
                'message' => 'Nao existe usuario ativo configurado para receber pedidos do shop.',
            ], 422);
        }

        $customer = $this->resolveCustomer((array) ($validated['customer'] ?? []));
        $draft = $orderDraftService->create($ownerUserId, [
            'type' => 'pedido',
            'channel' => OrderDraft::CHANNEL_SITE,
            'customer_id' => $customer?->id,
            'reference' => $this->buildReference(),
            'notes' => $this->buildNotes(
                (string) ($validated['notes'] ?? ''),
                (string) ($validated['customer']['phone'] ?? ''),
            ),
        ]);

        $draft = $orderDraftService->save($draft, [
            'type' => 'pedido',
            'channel' => OrderDraft::CHANNEL_SITE,
            'customer_id' => $customer?->id,
            'reference' => $draft->reference,
            'notes' => $draft->notes,
            'items' => $items->map(fn (array $item) => [
                'id' => (int) $item['id'],
                'qty' => (float) $item['qty'],
            ])->all(),
        ]);

        return response()->json([
            'message' => 'Pedido do shop enviado com sucesso.',
            'reference' => $draft->reference,
            'order' => $orderDraftService->toDetail($draft),
            'whatsapp_url' => $this->buildWhatsAppUrl(
                $fashionSettingsService->getWhatsApp(),
                $draft,
                (string) ($validated['customer']['name'] ?? ''),
            ),
        ], 201);
    }

    protected function resolveOwnerUserId(): ?int
    {
        return User::query()
            ->where('active', true)
            ->orderByRaw("CASE WHEN role = 'admin' THEN 0 ELSE 1 END")
            ->orderBy('id')
            ->value('id');
    }

    protected function resolveCustomer(array $data): Customer
    {
        $name = trim((string) ($data['name'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));

        $customer = filled($phone)
            ? Customer::query()->where('phone', $phone)->first()
            : null;

        if (!$customer && $name !== '') {
            $customer = Customer::query()->where('name', $name)->orderBy('id')->first();
        }

        $customer ??= new Customer();

        $customer->fill([
            'name' => $name,
            'phone' => $phone !== '' ? $phone : null,
            'credit_limit' => $customer->exists ? $customer->credit_limit : 0,
            'active' => true,
        ]);

        $customer->save();

        return $customer;
    }

    protected function buildReference(): string
    {
        return 'SHOP-' . now()->format('ymdHis');
    }

    protected function buildNotes(string $notes, string $phone): string
    {
        $lines = ['Origem: shop'];

        if (trim($phone) !== '') {
            $lines[] = 'Telefone: ' . trim($phone);
        }

        if (trim($notes) !== '') {
            $lines[] = 'Observacoes: ' . trim($notes);
        }

        return implode(PHP_EOL, $lines);
    }

    protected function buildWhatsAppUrl(array $settings, OrderDraft $draft, string $customerName): ?string
    {
        $phone = preg_replace('/\D+/', '', (string) ($settings['phone'] ?? ''));

        if (!$phone) {
            return null;
        }

        $items = $draft->items
            ->map(fn ($item) => "{$item->product_name} x{$item->quantity}")
            ->implode(', ');

        $template = (string) ($settings['checkout_template'] ?? '');
        $message = str_replace(
            ['{{items}}', '{{total}}', '{{customer}}'],
            [$items, number_format((float) $draft->total, 2, ',', '.'), $customerName],
            $template,
        );

        $greeting = trim((string) ($settings['greeting'] ?? ''));
        $fullText = trim($greeting . PHP_EOL . PHP_EOL . $message . PHP_EOL . 'Referencia: ' . $draft->reference);

        return 'https://wa.me/' . $phone . '?text=' . rawurlencode($fullText);
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Product())->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new Product())->getConnectionName())->hasColumn($table, $column);
    }
}
