<?php

namespace App\Http\Middleware\Tenant;

use App\Services\Tenant\TenantSettingsService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureModuleIsEnabled
{
    public function __construct(
        protected TenantSettingsService $settingsService,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->segment(1) === 'relatorios') {
            abort_unless($this->isReportsHubEnabled(), 404);

            return $next($request);
        }

        $moduleKey = $this->resolveModuleKey($request);

        abort_unless($this->settingsService->isModuleEnabled($moduleKey), 404);

        return $next($request);
    }

    protected function resolveModuleKey(Request $request): ?string
    {
        if ($request->is('api/pdv*')) {
            return 'pdv';
        }

        if ($request->is('api/cash-registers*')) {
            return 'caixa';
        }

        if ($request->is('api/products*')) {
            return 'produtos';
        }

        if ($request->is('api/orders*')) {
            return 'pedidos';
        }

        return match ($request->segment(1)) {
            'pdv' => 'pdv',
            'caixa' => 'caixa',
            'pedidos' => 'pedidos',
            'fiado' => 'crediario',
            'produtos' => 'produtos',
            'categorias' => 'categorias',
            'clientes' => 'clientes',
            'fornecedores' => 'fornecedores',
            'entrada-estoque' => 'entrada_estoque',
            'ajuste-estoque' => 'ajuste_estoque',
            'movimentacao-estoque' => 'movimentacao_estoque',
            'relatorios' => 'relatorios',
            'vendas' => 'vendas',
            'demanda' => 'demanda',
            'faltas' => 'faltas',
            'usuarios' => 'usuarios',
            default => null,
        };
    }

    protected function isReportsHubEnabled(): bool
    {
        return $this->settingsService->isModuleEnabled('relatorios')
            || $this->settingsService->isModuleEnabled('vendas')
            || $this->settingsService->isModuleEnabled('demanda');
    }
}
