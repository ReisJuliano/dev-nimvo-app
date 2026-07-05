<?php

namespace App\Http\Controllers\Tenant\Settings;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Till;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TillSettingsController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorizeTenantAdmin();

        $tills = Till::query()
            ->orderByDesc('active')
            ->orderBy('name')
            ->get()
            ->map(fn (Till $till) => $this->serializeTill($till))
            ->values();

        return response()->json(['tills' => $tills]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeTenantAdmin();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('tills', 'name')],
        ]);

        $till = Till::query()->create([
            'name' => $validated['name'],
            'active' => true,
        ]);

        return response()->json([
            'message' => 'Caixa cadastrado com sucesso.',
            'till' => $this->serializeTill($till),
        ], 201);
    }

    public function update(Request $request, Till $till): JsonResponse
    {
        $this->authorizeTenantAdmin();

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80', Rule::unique('tills', 'name')->ignore($till->id)],
            'active' => ['sometimes', 'boolean'],
        ]);

        $till->fill($validated)->save();

        return response()->json([
            'message' => 'Caixa atualizado com sucesso.',
            'till' => $this->serializeTill($till->fresh()),
        ]);
    }

    protected function serializeTill(Till $till): array
    {
        return [
            'id' => $till->id,
            'name' => $till->name,
            'active' => (bool) $till->active,
        ];
    }

    protected function authorizeTenantAdmin(): void
    {
        abort_unless(auth()->user()?->hasPermission('configuracoes.editar'), 403);
    }
}
