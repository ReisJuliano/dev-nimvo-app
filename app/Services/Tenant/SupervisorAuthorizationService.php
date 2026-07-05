<?php

namespace App\Services\Tenant;

use App\Models\Tenant\User;
use App\Support\Tenant\AuditActions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class SupervisorAuthorizationService
{
    public function __construct(
        protected AuditLogService $auditLogService,
    ) {
    }

    public function authorize(?int $userId, ?string $password, array $context = []): User
    {
        $user = $userId ? User::query()->find($userId) : null;

        if (!$user || !$user->active || !$this->isSupervisor($user)) {
            throw ValidationException::withMessages([
                'supervisor_user_id' => 'Selecione um supervisor válido para liberar a edição.',
            ]);
        }

        if (!Hash::check((string) $password, (string) $user->password)) {
            throw ValidationException::withMessages([
                'supervisor_password' => 'Senha do supervisor invalida.',
            ]);
        }

        $this->auditLogService->record(
            AuditActions::SUPERVISOR_AUTHORIZED,
            metadata: [
                'authorizer_id' => $user->id,
                'authorizer_name' => $user->name,
                ...$context,
            ],
        );

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
