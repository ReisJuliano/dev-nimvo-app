<?php

namespace App\Http\Requests\Central;

use App\Services\Tenant\TenantSettingsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTenantSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth('central_admin')->check();
    }

    public function rules(): array
    {
        $settingsService = app(TenantSettingsService::class);

        return [
            'business' => ['required', 'array'],
            'business.preset' => ['required', 'string', Rule::in($settingsService->presetKeys())],
            'cash_closing' => ['required', 'array'],
            'cash_closing.require_conference' => ['required', 'boolean'],
            'modules' => ['required', 'array'],
            'modules.comandas' => ['required', 'boolean'],
            'modules.pdv_simples' => ['required', 'boolean'],
            'modules.pdv_restaurante' => ['required', 'boolean'],
            'modules.estoque' => ['required', 'boolean'],
            'modules.producao' => ['required', 'boolean'],
            'modules.pesagem' => ['required', 'boolean'],
            'modules.fiado' => ['required', 'boolean'],
            'modules.delivery' => ['required', 'boolean'],
            'modules.caixa' => ['required', 'boolean'],
            'modules.relatorios_avancados' => ['required', 'boolean'],
            'modules.clientes' => ['required', 'boolean'],
            'modules.fornecedores' => ['required', 'boolean'],
            'modules.ordens_servico' => ['required', 'boolean'],
            'modules.produtos_variacao' => ['required', 'boolean'],
            'modules.controle_lotes' => ['required', 'boolean'],
            'modules.controle_validade' => ['required', 'boolean'],
            'modules.mesas' => ['required', 'boolean'],
            'modules.impressao_automatica' => ['required', 'boolean'],
        ];
    }
}
