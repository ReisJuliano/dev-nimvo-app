<?php

namespace App\Http\Requests\Tenant\Settings;

use App\Services\Tenant\TenantSettingsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) auth()->user()?->hasPermission('configuracoes.editar');
    }

    public function rules(): array
    {
        $settingsService = app(TenantSettingsService::class);

        return [
            'business' => ['required', 'array'],
            'business.preset' => ['required', 'string', Rule::in($settingsService->presetKeys())],
            'cash_closing' => ['required', 'array'],
            'cash_closing.require_conference' => ['required', 'boolean'],
            'cash_closing.max_cash_before_withdrawal_suggestion' => ['nullable', 'numeric', 'min:0'],
            'modules' => ['required', 'array'],
            'modules.comandas' => ['required', 'boolean'],
            'modules.pdv_simples' => ['required', 'boolean'],
            'modules.pdv_avancado' => ['required', 'boolean'],
            'modules.estoque' => ['required', 'boolean'],
            'modules.prazo' => ['required', 'boolean'],
            'modules.delivery' => ['required', 'boolean'],
            'modules.caixa' => ['required', 'boolean'],
            'modules.fiscal_basico' => ['required', 'boolean'],
            'modules.fiscal_avancado' => ['required', 'boolean'],
            'modules.relatorios_basicos' => ['required', 'boolean'],
            'modules.relatorios_avancados' => ['required', 'boolean'],
            'modules.clientes' => ['required', 'boolean'],
            'modules.fornecedores' => ['required', 'boolean'],
            'modules.compras' => ['required', 'boolean'],
            'modules.controle_lotes' => ['required', 'boolean'],
            'modules.controle_validade' => ['required', 'boolean'],
            'modules.mesas' => ['required', 'boolean'],
            'modules.impressao_automatica' => ['required', 'boolean'],
            'modules.catalogo_online' => ['required', 'boolean'],
            'modules.pedidos_online' => ['required', 'boolean'],
            'modules.whatsapp_pedidos' => ['required', 'boolean'],
            'modules.moda' => ['required', 'boolean'],
            'modules.fidelidade' => ['required', 'boolean'],
            'loyalty' => ['nullable', 'array'],
            'loyalty.cashback_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'accountant' => ['nullable', 'array'],
            'accountant.name' => ['nullable', 'string', 'max:255'],
            'accountant.email' => ['nullable', 'email', 'max:255'],
            'accountant.auto_send_enabled' => ['nullable', 'boolean'],
        ];
    }
}
