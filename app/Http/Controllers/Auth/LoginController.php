<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
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

    public function store(LoginRequest $request)
    {
        $credentials = $request->validated();

        Log::info('Login attempt', [
            'username' => $credentials['username'],
            'tenant' => tenant('id'),
        ]);

        $user = User::query()
            ->where('username', $credentials['username'])
            ->where('active', true)
            ->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            Log::info('Auth failed', ['username' => $credentials['username']]);

            return back()->withErrors([
                'username' => 'Usuario ou senha incorretos.',
            ]);
        }

        Auth::login($user, (bool) ($credentials['remember'] ?? false));
        $request->session()->regenerate();

        Log::info('Auth success', ['user_id' => $user->id]);

        if ($user->must_change_password) {
            return redirect()->route('password.change.show');
        }

        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
