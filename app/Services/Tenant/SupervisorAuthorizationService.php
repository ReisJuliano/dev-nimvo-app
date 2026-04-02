<?php

namespace App\Services\Tenant;

use App\Models\Tenant\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class SupervisorAuthorizationService
{
    public function authorize(?int $userId, ?string $password): User
    {
        $user = $userId ? User::query()->find($userId) : null;

        if (!$user || !$user->active || !$this->isSupervisor($user)) {
            throw ValidationException::withMessages([
                'supervisor_user_id' => 'Selecione um supervisor valido para liberar a edicao.',
            ]);
        }

        if (!Hash::check((string) $password, (string) $user->password)) {
            throw ValidationException::withMessages([
                'supervisor_password' => 'Senha do supervisor invalida.',
            ]);
        }

        return $user;
    }

    protected function isSupervisor(User $user): bool
    {
        if ($this->hasSupervisorColumn()) {
            return (bool) $user->is_supervisor;
        }

        return in_array($user->role, ['admin', 'manager'], true);
    }

    protected function hasSupervisorColumn(): bool
    {
        return Schema::connection((new User())->getConnectionName())
            ->hasColumn('users', 'is_supervisor');
    }
}
