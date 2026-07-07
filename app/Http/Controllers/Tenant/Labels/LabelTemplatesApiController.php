<?php

namespace App\Http\Controllers\Tenant\Labels;

use App\Http\Controllers\Controller;
use App\Models\Tenant\LabelTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LabelTemplatesApiController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorizeManage();

        $templates = LabelTemplate::query()
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get()
            ->map(fn (LabelTemplate $template) => $this->serialize($template));

        return response()->json(['templates' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $validated = $this->validated($request);

        if ($validated['is_default']) {
            LabelTemplate::query()->update(['is_default' => false]);
        }

        $template = LabelTemplate::query()->create($validated);

        return response()->json([
            'message' => 'Padrão de etiqueta criado com sucesso.',
            'template' => $this->serialize($template),
        ], 201);
    }

    public function update(Request $request, LabelTemplate $labelTemplate): JsonResponse
    {
        $this->authorizeManage();

        $validated = $this->validated($request);

        if ($validated['is_default']) {
            LabelTemplate::query()->where('id', '!=', $labelTemplate->id)->update(['is_default' => false]);
        }

        $labelTemplate->fill($validated)->save();

        return response()->json([
            'message' => 'Padrão de etiqueta atualizado com sucesso.',
            'template' => $this->serialize($labelTemplate->fresh()),
        ]);
    }

    public function destroy(LabelTemplate $labelTemplate): JsonResponse
    {
        $this->authorizeManage();

        abort_if(LabelTemplate::query()->count() <= 1, 422, 'É necessário manter ao menos um padrão de etiqueta.');

        $labelTemplate->delete();

        if (!LabelTemplate::query()->where('is_default', true)->exists()) {
            LabelTemplate::query()->oldest('id')->first()?->update(['is_default' => true]);
        }

        return response()->json(['message' => 'Padrão de etiqueta removido com sucesso.']);
    }

    protected function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'show_name' => ['required', 'boolean'],
            'show_price' => ['required', 'boolean'],
            'show_promo' => ['required', 'boolean'],
            'barcode_mode' => ['required', 'string', Rule::in(LabelTemplate::BARCODE_MODES)],
            'label_width_mm' => ['required', 'numeric', 'min:10', 'max:210'],
            'label_height_mm' => ['required', 'numeric', 'min:10', 'max:297'],
            'columns' => ['required', 'integer', 'min:1', 'max:10'],
            'rows' => ['required', 'integer', 'min:1', 'max:30'],
            'margin_left_mm' => ['required', 'numeric', 'min:0', 'max:50'],
            'margin_top_mm' => ['required', 'numeric', 'min:0', 'max:50'],
            'gap_x_mm' => ['required', 'numeric', 'min:0', 'max:50'],
            'gap_y_mm' => ['required', 'numeric', 'min:0', 'max:50'],
            'is_default' => ['required', 'boolean'],
        ]);
    }

    protected function serialize(LabelTemplate $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'show_name' => $template->show_name,
            'show_price' => $template->show_price,
            'show_promo' => $template->show_promo,
            'barcode_mode' => $template->barcode_mode,
            'label_width_mm' => (float) $template->label_width_mm,
            'label_height_mm' => (float) $template->label_height_mm,
            'columns' => $template->columns,
            'rows' => $template->rows,
            'margin_left_mm' => (float) $template->margin_left_mm,
            'margin_top_mm' => (float) $template->margin_top_mm,
            'gap_x_mm' => (float) $template->gap_x_mm,
            'gap_y_mm' => (float) $template->gap_y_mm,
            'is_default' => $template->is_default,
        ];
    }

    protected function authorizeManage(): void
    {
        abort_unless(auth()->user()?->hasPermission('produtos.imprimir_etiquetas'), 403);
    }
}
