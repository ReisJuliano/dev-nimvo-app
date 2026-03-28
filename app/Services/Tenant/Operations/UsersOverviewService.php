<?php

namespace App\Services\Tenant\Operations;

use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use App\Services\Tenant\Operations\Concerns\BuildsOverviewPages;

class UsersOverviewService
{
    use BuildsOverviewPages;

    public function users(array $filters): array
    {
        [$from, $to] = $this->resolvePeriod($filters);

        $users = User::query()
            ->orderBy('name')
            ->get()
            ->map(function (User $user) use ($from, $to) {
                $periodSales = Sale::query()
                    ->where('status', 'finalized')
                    ->where('user_id', $user->id)
                    ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);

                return [
                    'name' => $user->name,
                    'username' => $user->username,
                    'role' => $user->role,
                    'status' => $user->active ? 'Ativo' : 'Inativo',
                    'sales_count' => $periodSales->count(),
                    'sales_total' => (float) $periodSales->sum('total'),
                ];
            });

        return $this->page(
            'Usuarios',
            'Gerencie a visao operacional da equipe com leitura rapida de perfil, atividade e resultado comercial.',
            [
                $this->metric('Total', $users->count()),
                $this->metric('Ativos', $users->where('status', 'Ativo')->count()),
                $this->metric('Admins', $users->where('role', 'admin')->count()),
                $this->metric('Faturamento da equipe', $users->sum('sales_total'), 'money'),
            ],
            [],
            [
                $this->table('Equipe', [
                    ['key' => 'name', 'label' => 'Nome'],
                    ['key' => 'username', 'label' => 'Usuario'],
                    ['key' => 'role', 'label' => 'Perfil'],
                    ['key' => 'status', 'label' => 'Status'],
                    ['key' => 'sales_count', 'label' => 'Vendas', 'format' => 'number'],
                    ['key' => 'sales_total', 'label' => 'Faturamento', 'format' => 'money'],
                ], $users, 'Nenhum usuario cadastrado.'),
            ],
            $from,
            $to,
        );
    }
}
