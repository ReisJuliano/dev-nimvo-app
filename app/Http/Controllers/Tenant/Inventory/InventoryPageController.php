<?php

namespace App\Http\Controllers\Tenant\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Category;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use Inertia\Inertia;
use Inertia\Response;

class InventoryPageController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(auth()->user()?->hasPermission('inventario.gerenciar'), 403);

        return Inertia::render('Inventory/Index', [
            'categories' => Category::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'suppliers' => Supplier::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'supervisors' => $this->supervisorsPayload(),
            'canApprove' => (bool) auth()->user()?->hasPermission('inventario.aprovar'),
        ]);
    }

    protected function supervisorsPayload(): array
    {
        return User::query()
            ->where('active', true)
            ->where('is_supervisor', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name])
            ->all();
    }
}
