<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Models\Tenant\TaxRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaxRulesApiController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorizeManage();

        $rules = TaxRule::query()
            ->orderByDesc('priority')
            ->orderBy('name')
            ->get()
            ->map(fn (TaxRule $rule) => $this->serialize($rule));

        return response()->json(['rules' => $rules]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $validated = $this->validated($request);

        $rule = TaxRule::query()->create($validated);

        return response()->json([
            'message' => 'Regra tributária criada com sucesso.',
            'rule' => $this->serialize($rule),
        ], 201);
    }

    public function update(Request $request, TaxRule $taxRule): JsonResponse
    {
        $this->authorizeManage();

        $validated = $this->validated($request);

        $taxRule->fill($validated)->save();

        return response()->json([
            'message' => 'Regra tributária atualizada com sucesso.',
            'rule' => $this->serialize($taxRule->fresh()),
        ]);
    }

    public function destroy(TaxRule $taxRule): JsonResponse
    {
        $this->authorizeManage();

        $taxRule->delete();

        return response()->json(['message' => 'Regra tributária removida com sucesso.']);
    }

    protected function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'active' => ['required', 'boolean'],
            'regime' => ['nullable', 'string', Rule::in(['simples', 'normal'])],
            'ncm_pattern' => ['nullable', 'string', 'max:8', 'regex:/^\d+$/'],
            'cfop' => ['nullable', 'string', 'size:4', 'regex:/^\d{4}$/'],
            'uf_origem' => ['nullable', 'string', 'size:2'],
            'uf_destino' => ['nullable', 'string', 'size:2'],
            'origin_code' => ['nullable', 'string', 'regex:/^[0-8]$/'],
            'csosn' => ['nullable', 'string', 'max:3'],
            'cst_icms' => ['nullable', 'string', 'max:3'],
            'icms_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'st_mva' => ['nullable', 'numeric', 'min:0', 'max:9999.99'],
            'st_fcp' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pis_cst' => ['nullable', 'string', 'max:2'],
            'pis_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cofins_cst' => ['nullable', 'string', 'max:2'],
            'cofins_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'ibs_cbs_cst' => ['nullable', 'string', 'max:3'],
            'c_class_trib' => ['nullable', 'string', 'max:6'],
            'priority' => ['required', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    protected function serialize(TaxRule $rule): array
    {
        return [
            'id' => $rule->id,
            'name' => $rule->name,
            'active' => $rule->active,
            'regime' => $rule->regime,
            'ncm_pattern' => $rule->ncm_pattern,
            'cfop' => $rule->cfop,
            'uf_origem' => $rule->uf_origem,
            'uf_destino' => $rule->uf_destino,
            'origin_code' => $rule->origin_code,
            'csosn' => $rule->csosn,
            'cst_icms' => $rule->cst_icms,
            'icms_rate' => $rule->icms_rate !== null ? (float) $rule->icms_rate : null,
            'st_mva' => $rule->st_mva !== null ? (float) $rule->st_mva : null,
            'st_fcp' => $rule->st_fcp !== null ? (float) $rule->st_fcp : null,
            'pis_cst' => $rule->pis_cst,
            'pis_rate' => $rule->pis_rate !== null ? (float) $rule->pis_rate : null,
            'cofins_cst' => $rule->cofins_cst,
            'cofins_rate' => $rule->cofins_rate !== null ? (float) $rule->cofins_rate : null,
            'ibs_cbs_cst' => $rule->ibs_cbs_cst,
            'c_class_trib' => $rule->c_class_trib,
            'priority' => $rule->priority,
            'notes' => $rule->notes,
        ];
    }

    protected function authorizeManage(): void
    {
        abort_unless(auth()->user()?->hasPermission('fiscal.matriz_tributaria'), 403);
    }
}
