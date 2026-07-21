<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Models\Tenant\FiscalDocument;
use App\Services\Tenant\Fiscal\FiscalCorrectionLetterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FiscalDocumentCorrectionController extends Controller
{
    public function __invoke(
        Request $request,
        FiscalDocument $fiscalDocument,
        FiscalCorrectionLetterService $service,
    ): JsonResponse {
        abort_unless(auth()->user()?->hasPermission('fiscal.eventos'), 403);

        $validated = $request->validate([
            'text' => [
                'required',
                'string',
                'min:'.FiscalCorrectionLetterService::MIN_TEXT_LENGTH,
                'max:'.FiscalCorrectionLetterService::MAX_TEXT_LENGTH,
            ],
        ]);

        $result = $service->requestCorrection(
            (int) $fiscalDocument->id,
            (string) $validated['text'],
            auth()->id(),
        );

        return response()->json([
            'message' => $result['message'],
            'sequence' => $result['sequence'],
            'document' => [
                'id' => $result['document']->id,
                'events' => $result['document']->events->map(fn ($event) => [
                    'status' => $event->status,
                    'source' => $event->source,
                    'message' => $event->message,
                    'created_at' => optional($event->created_at)?->toIso8601String(),
                ])->values()->all(),
            ],
        ], 202);
    }
}
