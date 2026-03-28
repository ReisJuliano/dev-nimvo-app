<?php

namespace App\Services\Tenant;

use App\Services\Tenant\Operations\InventoryOverviewService;
use App\Services\Tenant\Operations\SalesOverviewService;
use App\Services\Tenant\Operations\UsersOverviewService;

class OperationsOverviewService
{
    public function __construct(
        protected SalesOverviewService $sales,
        protected InventoryOverviewService $inventory,
        protected UsersOverviewService $users,
    ) {
    }

    public function build(string $module, array $filters = []): array
    {
        return match ($module) {
            'pedidos' => $this->sales->orders($filters),
            'fiado' => $this->sales->credit($filters),
            'clientes' => $this->sales->customers($filters),
            'fornecedores' => $this->inventory->suppliers(),
            'categorias' => $this->inventory->categories(),
            'entrada-estoque' => $this->inventory->stockInbound(),
            'ajuste-estoque' => $this->inventory->stockAdjustments(),
            'movimentacao-estoque' => $this->inventory->stockHistory($filters),
            'relatorios' => $this->sales->reports($filters),
            'vendas' => $this->sales->sales($filters),
            'demanda' => $this->sales->demand($filters),
            'faltas' => $this->inventory->shortages(),
            'usuarios' => $this->users->users($filters),
            default => abort(404),
        };
    }
}
