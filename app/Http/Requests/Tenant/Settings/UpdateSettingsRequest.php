<?php

namespace App\Http\Requests\Tenant\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'cash_closing' => ['required', 'array'],
            'cash_closing.require_conference' => ['required', 'boolean'],
            'modules' => ['required', 'array'],
            'modules.pdv' => ['required', 'boolean'],
            'modules.caixa' => ['required', 'boolean'],
            'modules.pedidos' => ['required', 'boolean'],
            'modules.crediario' => ['required', 'boolean'],
            'modules.produtos' => ['required', 'boolean'],
            'modules.categorias' => ['required', 'boolean'],
            'modules.clientes' => ['required', 'boolean'],
            'modules.fornecedores' => ['required', 'boolean'],
            'modules.entrada_estoque' => ['required', 'boolean'],
            'modules.ajuste_estoque' => ['required', 'boolean'],
            'modules.movimentacao_estoque' => ['required', 'boolean'],
            'modules.relatorios' => ['required', 'boolean'],
            'modules.vendas' => ['required', 'boolean'],
            'modules.demanda' => ['required', 'boolean'],
            'modules.faltas' => ['required', 'boolean'],
            'modules.usuarios' => ['required', 'boolean'],
        ];
    }
}
