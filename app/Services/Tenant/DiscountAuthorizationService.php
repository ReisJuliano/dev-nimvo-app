<?php

namespace App\Services\Tenant;

use App\Models\Tenant\User;
use App\Support\Tenant\AuditActions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class DiscountAuthorizationService
{
    public function __construct(
        protected AuditLogService $auditLogService,
    ) {
    }

    public function authorize(?int $userId, ?string $password, array $context = []): User
    {
        $user = $userId ? User::query()->find($userId) : null;

        if (!$user || !$user->active || !in_array($user->role, ['admin', 'manager'], true)) {
            throw ValidationException::withMessages([
                'authorizer_user_id' => 'Selecione um gerente válido para autorizar o desconto.',
            ]);
        }

        $password = (string) $password;
        $customPassword = (string) ($user->discount_authorization_password ?? '');
        $valid = false;

        if ($customPassword !== '') {
            $valid = Hash::check($password, $customPassword);
        }

        if (!$valid) {
            $valid = Hash::check($password, $user->password);
        }

        if (!$valid) {
            throw ValidationException::withMessages([
                'authorizer_password' => 'Senha gerencial inválida.',
            ]);
        }

        $this->auditLogService->record(
            AuditActions::DISCOUNT_AUTHORIZED,
            metadata: [
                'authorizer_id' => $user->id,
                'authorizer_name' => $user->name,
                ...$context,
            ],
        );

        return $user;
    }
}
