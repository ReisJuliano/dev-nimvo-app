<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Mobile\Concerns\FormatsMobileResponses;
use App\Http\Requests\Tenant\Mobile\MobileLoginRequest;
use App\Models\Tenant\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class MobileAuthController extends Controller
{
    use FormatsMobileResponses;

    private const ALLOWED_ROLES = ['admin', 'manager', 'owner'];

    public function login(MobileLoginRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::query()
            ->where('username', $data['username'])
            ->where('active', true)
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['Usuario ou senha invalidos.'],
            ]);
        }

        if (! in_array($user->role, self::ALLOWED_ROLES, true)) {
            throw ValidationException::withMessages([
                'username' => ['Este usuario nao tem permissao para acessar o app mobile.'],
            ]);
        }

        $tokenName = 'nimvo-mobile-'.$this->sanitizeDeviceName((string) $data['device_name']);
        $token = $user->createToken($tokenName)->plainTextToken;

        return response()->json($this->success([
            'token' => $token,
            'user' => $this->userPayload($user),
        ], 'Login realizado com sucesso.'));
    }

    public function logout(Request $request): JsonResponse
    {
        $accessToken = $request->user()?->currentAccessToken();

        if ($accessToken && method_exists($accessToken, 'delete')) {
            $accessToken->delete();
        }

        return response()->json($this->success([], 'Sessao encerrada.'));
    }

    public function me(Request $request): JsonResponse
    {
        /** @var \App\Models\Tenant\User $user */
        $user = $request->user();

        return response()->json($this->success([
            'user' => $this->userPayload($user),
            'tenant' => $this->tenantPayload(),
        ]));
    }

    protected function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'role' => $user->role,
            'is_supervisor' => (bool) $user->is_supervisor,
        ];
    }

    protected function tenantPayload(): array
    {
        $tenant = tenant();

        return [
            'id' => $tenant?->getTenantKey(),
            'name' => $tenant?->name ?? $tenant?->getTenantKey(),
        ];
    }

    protected function sanitizeDeviceName(string $deviceName): string
    {
        $deviceName = preg_replace('/[^A-Za-z0-9_.-]+/', '-', trim($deviceName)) ?: 'device';

        return trim($deviceName, '-');
    }
}
