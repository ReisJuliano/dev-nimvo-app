<?php

namespace App\Http\Controllers\Tenant\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class PasswordChangeController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('Auth/ChangePassword');
    }

    public function update(UpdatePasswordRequest $request): RedirectResponse
    {
        $request->user()->forceFill([
            'password' => Hash::make($request->string('password')->toString()),
            'must_change_password' => false,
        ])->save();

        return redirect()
            ->route('dashboard')
            ->with('success', 'Senha atualizada com sucesso.');
    }
}
