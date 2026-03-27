<?php
namespace App\Http\Middleware;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $tenant = tenant();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id'       => $request->user()->id,
                    'name'     => $request->user()->name,
                    'username' => $request->user()->username,
                    'role'     => $request->user()->role,
                ] : null,
            ],
            'tenant' => $tenant ? [
                'id' => $tenant->getTenantKey(),
                'name' => $tenant->name,
                'email' => $tenant->email,
            ] : null,
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
            ],
        ];
    }
}
