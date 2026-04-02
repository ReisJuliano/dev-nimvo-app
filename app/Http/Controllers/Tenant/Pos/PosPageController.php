<?php

namespace App\Http\Controllers\Tenant\Pos;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Category;
use App\Models\Tenant\Company;
use App\Models\Tenant\Customer;
use App\Models\Tenant\User;
use App\Services\Tenant\OrderDraftService;
use App\Services\Tenant\PendingSaleService;
use App\Services\Tenant\PosRecommendationService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class PosPageController extends Controller
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function __invoke(
        OrderDraftService $orderDraftService,
        PendingSaleService $pendingSaleService,
        PosRecommendationService $recommendationService,
        TenantSettingsService $settingsService,
    ): Response {
        $userId = auth()->user()?->getKey();
        $requestedOrderDraftId = request()->integer('orderDraft');
        $ordersEnabled = $settingsService->isModuleEnabled('pedidos');

        $cashRegister = CashRegister::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();
        $preloadedOrderDraft = $ordersEnabled && $requestedOrderDraftId
            ? $orderDraftService->findForCheckout($requestedOrderDraftId)
            : null;
        $pendingSale = $pendingSaleService->currentForUser((int) $userId);

        return Inertia::render('Pos/Index', [
            'categories' => Category::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'customers' => $this->customersPayload(),
            'companies' => $this->companiesPayload(),
            'managers' => User::query()
                ->where('active', true)
                ->whereIn('role', ['admin', 'manager'])
                ->orderByRaw("CASE WHEN role = 'admin' THEN 0 ELSE 1 END")
                ->orderBy('name')
                ->get(['id', 'name', 'username', 'role']),
            'supervisors' => $this->supervisorsPayload(),
            'pendingOrderDrafts' => $ordersEnabled ? $orderDraftService->pendingCheckoutDrafts() : [],
            'preloadedOrderDraft' => $preloadedOrderDraft ? $orderDraftService->toDetail($preloadedOrderDraft) : null,
            'pendingSale' => $pendingSaleService->serialize($pendingSale),
            'recommendations' => $recommendationService->build(),
            'cashRegister' => $cashRegister ? [
                'id' => $cashRegister->id,
                'status' => $cashRegister->status,
                'opened_at' => $cashRegister->opened_at?->toIso8601String(),
                'opening_amount' => (float) $cashRegister->opening_amount,
            ] : null,
            'posCapabilities' => [
                'pending_sales' => $this->hasTable('pending_sales'),
                'companies' => $this->hasTable('companies'),
            ],
        ]);
    }

    protected function customersPayload(): array
    {
        if (! $this->hasTable('customers')) {
            return [];
        }

        $columns = $this->availableColumns('customers', [
            'id',
            'name',
            'phone',
            'document',
            'document_type',
            'email',
            'credit_limit',
        ]);

        return Customer::query()
            ->where('active', true)
            ->orderBy('name')
            ->get($columns)
            ->map(fn (Customer $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'document' => $customer->getAttribute('document'),
                'document_type' => $customer->getAttribute('document_type'),
                'email' => $customer->getAttribute('email'),
                'credit_limit' => (float) ($customer->credit_limit ?? 0),
            ])
            ->values()
            ->all();
    }

    protected function supervisorsPayload(): array
    {
        $query = User::query()
            ->where('active', true)
            ->orderBy('name');

        if ($this->hasColumn('users', 'is_supervisor')) {
            $query->where('is_supervisor', true);
        } else {
            $query->whereIn('role', ['admin', 'manager']);
        }

        return $query
            ->get(['id', 'name', 'username', 'role'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'role' => $user->role,
            ])
            ->values()
            ->all();
    }

    protected function companiesPayload(): array
    {
        if (! $this->hasTable('companies')) {
            return [];
        }

        $columns = $this->availableColumns('companies', [
            'id',
            'name',
            'trade_name',
            'document',
            'document_type',
            'email',
            'phone',
            'state_registration',
        ]);

        return Company::query()
            ->where('active', true)
            ->orderBy('name')
            ->get($columns)
            ->map(fn (Company $company) => [
                'id' => $company->id,
                'name' => $company->name,
                'trade_name' => $company->trade_name,
                'document' => $company->document,
                'document_type' => $company->document_type,
                'email' => $company->email,
                'phone' => $company->phone,
                'state_registration' => $company->state_registration,
            ])
            ->values()
            ->all();
    }

    protected function availableColumns(string $table, array $columns): array
    {
        return array_values(array_filter($columns, fn (string $column) => $this->hasColumn($table, $column)));
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Customer)->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new Customer)->getConnectionName())->hasColumn($table, $column);
    }
}
