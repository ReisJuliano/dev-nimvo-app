<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        Log::info('Dashboard accessed', [
            'user' => auth()->user()?->only(['id', 'name', 'username', 'role']),
            'session_id' => session()->getId(),
        ]);

        return Inertia::render('Dashboard');
    }
}
