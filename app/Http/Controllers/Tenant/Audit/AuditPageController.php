<?php

namespace App\Http\Controllers\Tenant\Audit;

use App\Http\Controllers\Controller;
use App\Models\Tenant\User;
use App\Support\Tenant\AuditActions;
use Inertia\Inertia;
use Inertia\Response;

class AuditPageController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(auth()->user()?->hasPermission('auditoria.visualizar'), 403);

        $actions = collect(AuditActions::labels())
            ->map(fn (string $label, string $key) => ['value' => $key, 'label' => $label])
            ->values();

        $users = User::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => ['value' => $user->id, 'label' => $user->name])
            ->values();

        return Inertia::render('Audit/Index', [
            'actions' => $actions,
            'users' => $users,
        ]);
    }
}
