<?php

namespace App\Http\Controllers\Tenant\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\Tenant\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('Auth/Login');
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $credentials = $request->validated();

        Log::info('Tenant login attempt', [
            'username' => $credentials['username'],
            'tenant' => tenant('id'),
        ]);

        $user = User::query()
            ->where('username', $credentials['username'])
            ->where('active', true)
            ->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            Log::info('Tenant auth failed', [
                'username' => $credentials['username'],
                'tenant' => tenant('id'),
            ]);

            return back()->withErrors([
                'username' => 'Usuario ou senha incorretos.',
            ]);
        }

        Auth::login($user, (bool) ($credentials['remember'] ?? false));
        $request->session()->regenerate();

        Log::info('Tenant auth success', [
            'tenant' => tenant('id'),
            'user_id' => $user->id,
        ]);

        if ($user->must_change_password) {
            return redirect()->route('password.change.show');
        }

        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
