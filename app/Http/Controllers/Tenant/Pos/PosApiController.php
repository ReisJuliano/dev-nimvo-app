<?php

namespace App\Http\Controllers\Tenant\Pos;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\Pos\AuthorizeDiscountRequest;
use App\Http\Requests\Tenant\Pos\FinalizeSaleRequest;
use App\Http\Requests\Tenant\Pos\IssueSaleFiscalDocumentRequest;
use App\Http\Requests\Tenant\Pos\SavePendingSaleRequest;
use App\Models\Tenant\Company;
use App\Models\Tenant\Customer;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Services\Tenant\DiscountAuthorizationService;
use App\Services\Tenant\Fiscal\FiscalDocumentService;
use App\Services\Tenant\LocalAgentPrintQueueService;
use App\Services\Tenant\PendingSaleService;
use App\Services\Tenant\PosRecommendationService;
use App\Services\Tenant\PosService;
use App\Services\Tenant\TenantSettingsService;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class PosApiController extends Controller
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function searchProducts(Request $request): JsonResponse
    {
        $term = trim((string) $request->string('term'));
        $categoryId = $request->integer('category_id');

        if ($term === '') {
            return response()->json(['products' => []]);
        }

        $likeTerm = str_contains($term, '%') ? $term : "%{$term}%";

        $products = Product::query()
            ->when($categoryId, fn ($query) => $query->where('category_id', $categoryId))
            ->where('active', true)
            ->where(function ($nested) use ($term, $likeTerm) {
                $nested
                    ->where('barcode', $term)
                    ->orWhere('code', $term)
                    ->orWhere('barcode', 'like', $likeTerm)
                    ->orWhere('code', 'like', $likeTerm)
                    ->orWhere('name', 'like', $likeTerm)
                    ->orWhere('description', 'like', $likeTerm);
            })
            ->orderBy('name')
            ->limit(15)
            ->get()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'code' => $product->code,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'description' => $product->description,
                'unit' => $product->unit,
                'cost_price' => (float) $product->cost_price,
                'sale_price' => (float) $product->sale_price,
                'stock_quantity' => (float) $product->stock_quantity,
            ]);

        return response()->json(['products' => $products]);
    }

    public function recommendations(
        Request $request,
        PosRecommendationService $recommendationService,
    ): JsonResponse {
        $validated = $request->validate([
            'anchor_product_id' => ['nullable', 'integer', 'exists:products,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'exclude_product_ids' => ['nullable', 'array'],
            'exclude_product_ids.*' => ['integer', 'exists:products,id'],
        ]);

        return response()->json([
            'recommendations' => $recommendationService->build(
                anchorProductId: $validated['anchor_product_id'] ?? null,
                excludeProductIds: $validated['exclude_product_ids'] ?? [],
                customerId: $validated['customer_id'] ?? null,
            ),
        ]);
    }

    public function customerCredit(Customer $customer): JsonResponse
    {
        abort_unless(app(TenantSettingsService::class)->isModuleEnabled('prazo'), 404);

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
            'document' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
        ]);

        $document = filled($validated['document'] ?? null)
            ? preg_replace('/\D+/', '', (string) $validated['document'])
            : null;

        $payload = [
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'credit_limit' => 0,
            'active' => true,
        ];

        if ($this->hasColumn('customers', 'document')) {
            $payload['document'] = $document;
        }

        if ($this->hasColumn('customers', 'document_type')) {
            $payload['document_type'] = $this->documentTypeFor($document);
        }

        if ($this->hasColumn('customers', 'email')) {
            $payload['email'] = $validated['email'] ?? null;
        }

        $customer = Customer::query()->create($payload);

        return response()->json([
            'message' => 'Cliente cadastrado com sucesso.',
            'customer' => $customer,
        ], 201);
    }

    public function quickCompany(Request $request): JsonResponse
    {
        if (! $this->hasTable('companies')) {
            throw ValidationException::withMessages([
                'company' => 'O cadastro de empresas ainda nao esta habilitado neste tenant. Rode as migrations pendentes para usar esse recurso.',
            ]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'trade_name' => ['nullable', 'string', 'max:255'],
            'document' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'state_registration' => ['nullable', 'string', 'max:30'],
        ]);

        $document = filled($validated['document'] ?? null)
            ? preg_replace('/\D+/', '', (string) $validated['document'])
            : null;

        $company = Company::query()->create([
            'name' => $validated['name'],
            'trade_name' => $validated['trade_name'] ?? null,
            'document' => $document,
            'document_type' => $this->documentTypeFor($document),
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'state_registration' => $validated['state_registration'] ?? null,
            'active' => true,
        ]);

        return response()->json([
            'message' => 'Empresa cadastrada com sucesso.',
            'company' => $company,
        ], 201);
    }

    public function authorizeDiscount(
        AuthorizeDiscountRequest $request,
        DiscountAuthorizationService $discountAuthorizationService,
    ): JsonResponse {
        $authorizer = $discountAuthorizationService->authorize(
            $request->integer('authorizer_user_id'),
            $request->string('authorizer_password')->toString(),
        );

        $authorizations = (array) $request->session()->get('pos.discount_authorizations', []);
        $authorizations[$authorizer->id] = now()->toIso8601String();
        $request->session()->put('pos.discount_authorizations', $authorizations);

        return response()->json([
            'message' => 'Desconto autorizado com sucesso.',
            'authorizer' => [
                'id' => $authorizer->id,
                'name' => $authorizer->name,
                'role' => $authorizer->role,
                'authorized_at' => $authorizations[$authorizer->id],
            ],
        ]);
    }

    public function currentPendingSale(PendingSaleService $pendingSaleService): JsonResponse
    {
        $pendingSale = $pendingSaleService->currentForUser((int) auth()->id());

        return response()->json([
            'pending_sale' => $pendingSaleService->serialize($pendingSale),
        ]);
    }

    public function savePendingSale(
        SavePendingSaleRequest $request,
        PendingSaleService $pendingSaleService,
    ): JsonResponse {
        $pendingSale = $pendingSaleService->save((int) auth()->id(), $request->validated());

        return response()->json([
            'message' => 'Venda pendente salva com sucesso.',
            'pending_sale' => $pendingSaleService->serialize($pendingSale),
        ]);
    }

    public function restorePendingSale(
        Request $request,
        PendingSaleService $pendingSaleService,
    ): JsonResponse {
        $pendingSale = $pendingSaleService->currentForUser((int) auth()->id());

        if (! $pendingSale) {
            throw ValidationException::withMessages([
                'pending_sale' => 'Nenhuma venda pendente foi encontrada para restaurar.',
            ]);
        }

        $pendingSale = $pendingSaleService->markRestored($pendingSale);

        return response()->json([
            'message' => 'Venda pendente restaurada com sucesso.',
            'pending_sale' => $pendingSaleService->serialize($pendingSale),
        ]);
    }

    public function discardPendingSale(
        Request $request,
        PendingSaleService $pendingSaleService,
    ): JsonResponse {
        $pendingSaleService->discard((int) auth()->id());
        $request->session()->forget('pos.discount_authorizations');

        return response()->json([
            'message' => 'Venda pendente descartada com sucesso.',
        ]);
    }

    public function finalize(
        FinalizeSaleRequest $request,
        PosService $posService,
        LocalAgentPrintQueueService $printQueueService,
    ): JsonResponse {
        $this->validateDiscountAuthorizations($request);

        $sale = $posService->finalize($request->validated(), (int) auth()->user()?->getKey());
        $printResult = null;

        if (($sale['fiscal_decision'] ?? null) === 'close') {
            $saleModel = Sale::query()->find($sale['sale_id']);

            if ($saleModel) {
                try {
                    $printResult = $printQueueService->queuePaymentReceiptForSale($saleModel);
                } catch (\Throwable) {
                    $printResult = [
                        'status' => 'failed',
                        'message' => 'Venda finalizada. Nao foi possivel enviar o comprovante para a fila central de impressao.',
                    ];
                }
            }
        }

        $request->session()->forget('pos.discount_authorizations');

        return response()->json([
            'message' => 'Venda finalizada com sucesso.',
            'sale' => $sale,
            'local_agent_print' => $printResult,
        ]);
    }

    public function issueFiscalDocument(
        IssueSaleFiscalDocumentRequest $request,
        Sale $sale,
        FiscalDocumentService $fiscalDocumentService,
    ): JsonResponse {
        $validated = $request->validated();
        $recipient = $validated['recipient'] ?? null;

        if ($recipient) {
            $saleUpdates = [];

            if ($this->hasColumn('sales', 'requested_document_model')) {
                $saleUpdates['requested_document_model'] = $validated['document_model'];
            }

            if ($this->hasColumn('sales', 'recipient_payload')) {
                $saleUpdates['recipient_payload'] = $recipient;
            }

            if ($this->hasColumn('sales', 'fiscal_decision')) {
                $saleUpdates['fiscal_decision'] = 'emit';
            }

            if ($saleUpdates !== []) {
                $sale->forceFill($saleUpdates)->save();
                $sale->refresh();
            }
        }

        $document = $validated['document_model'] === '55'
            ? $fiscalDocumentService->prepareNfeFromSale($sale->id, $recipient)
            : $fiscalDocumentService->issueFromSale($sale->id, null, $validated['mode'] ?? null);

        return response()->json([
            'message' => $validated['document_model'] === '55'
                ? 'Venda preparada para emissao de NF-e / DANFE.'
                : 'Documento fiscal enfileirado com sucesso.',
            'document' => $this->serializeFiscalDocument($document),
        ]);
    }

    protected function validateDiscountAuthorizations(Request $request): void
    {
        $items = (array) $request->input('items', []);
        $authorizations = (array) $request->session()->get('pos.discount_authorizations', []);
        $minimumAuthorizedAt = now()->subMinutes(30);

        foreach ($items as $item) {
            $discount = round((float) ($item['discount'] ?? 0), 2);

            if ($discount <= 0) {
                continue;
            }

            $authorizerId = (int) ($item['discount_authorized_by'] ?? 0);
            $authorizedAt = $authorizations[$authorizerId] ?? null;

            if (! $authorizerId || ! $authorizedAt) {
                throw ValidationException::withMessages([
                    'items' => 'Todo desconto aplicado no PDV precisa de autorizacao gerencial valida.',
                ]);
            }

            try {
                $authorizedAtDate = Carbon::parse((string) $authorizedAt);
            } catch (\Throwable) {
                $authorizedAtDate = null;
            }

            if (! $authorizedAtDate || $authorizedAtDate->lt($minimumAuthorizedAt)) {
                throw ValidationException::withMessages([
                    'items' => 'A autorizacao do desconto expirou. Solicite a senha gerencial novamente.',
                ]);
            }
        }
    }

    protected function serializeFiscalDocument(mixed $document): ?array
    {
        if (! $document) {
            return null;
        }

        return [
            'id' => $document->id,
            'status' => $document->status,
            'type' => $document->type,
            'mode' => data_get($document->payload, 'flags.mode'),
            'series' => $document->series,
            'number' => $document->number,
            'agent_key' => $document->agent_key,
            'agent_command_id' => $document->agent_command_id,
            'access_key' => $document->access_key,
        ];
    }

    protected function documentTypeFor(?string $document): ?string
    {
        if (! $document) {
            return null;
        }

        return strlen($document) > 11 ? 'cnpj' : 'cpf';
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Sale)->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new Sale)->getConnectionName())->hasColumn($table, $column);
    }
}
