<?php

namespace App\Http\Controllers\Tenant\Till;

use App\Http\Controllers\Controller;
use App\Services\Tenant\TillService;
use Illuminate\Http\JsonResponse;

class TillApiController extends Controller
{
    public function index(TillService $tillService): JsonResponse
    {
        $tills = $tillService->activeTills()->map(fn ($till) => [
            'id' => $till->id,
            'name' => $till->name,
        ])->values();

        return response()->json(['tills' => $tills]);
    }
}
