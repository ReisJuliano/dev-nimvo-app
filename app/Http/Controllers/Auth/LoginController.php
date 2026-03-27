<?php
namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class LoginController extends Controller
{
    public function show()
    {
        return Inertia::render('Auth/Login');
    }

    public function store(Request $request)
    {
        Log::info('Login attempt', ['username' => $request->username, 'tenant' => tenant('id')]);

        $user = User::where('username', $request->username)
                    ->where('active', true)
                    ->first();

        Log::info('User found', ['user' => $user?->toArray()]);

        if (!$user || !Hash::check($request->password, $user->password)) {
            Log::info('Auth failed');
            return back()->withErrors(['username' => 'Usuário ou senha incorretos.']);
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        Log::info('Auth success', ['user_id' => $user->id]);

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
