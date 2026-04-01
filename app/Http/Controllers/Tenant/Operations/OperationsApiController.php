<?php

namespace App\Http\Controllers\Tenant\Operations;

use App\Http\Controllers\Controller;
use App\Services\Tenant\OperationsWorkspaceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperationsApiController extends Controller
{
    public function index(
        OperationsWorkspaceService $workspaceService,
        string $module,
    ): JsonResponse {
        abort_unless($workspaceService->isWorkspaceModule($module), 404);

        return response()->json($workspaceService->records($module));
    }

    public function store(
        Request $request,
        OperationsWorkspaceService $workspaceService,
        string $module,
    ): JsonResponse {
        abort_unless($workspaceService->isWorkspaceModule($module), 404);

        $response = $workspaceService->store($module, $request->all(), (int) auth()->id());

        return response()->json($response, 201);
    }

    public function update(
        Request $request,
        OperationsWorkspaceService $workspaceService,
        string $module,
        int $record,
    ): JsonResponse {
        abort_unless($workspaceService->isWorkspaceModule($module), 404);

        return response()->json(
            $workspaceService->update($module, $record, $request->all(), (int) auth()->id()),
        );
    }

    public function destroy(
        OperationsWorkspaceService $workspaceService,
        string $module,
        int $record,
    ): JsonResponse {
        abort_unless($workspaceService->isWorkspaceModule($module), 404);

        return response()->json([
            'message' => $workspaceService->destroy($module, $record),
        ]);
    }
}
