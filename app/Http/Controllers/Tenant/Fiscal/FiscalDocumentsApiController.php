<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Models\Tenant\FiscalDocument;
use App\Services\Tenant\Fiscal\FiscalDocumentService;
use App\Services\Tenant\Fiscal\FiscalDocumentXmlStorage;
use App\Support\DanfePdfRenderer;
use App\Support\DanfcePdfRenderer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class FiscalDocumentsApiController extends Controller
{
    public function store(Request $request, FiscalDocumentService $service): JsonResponse
    {
        $validated = $request->validate([
            'sale_id' => ['required', 'integer', 'exists:sales,id'],
            'idempotency_key' => ['nullable', 'string', 'max:255'],
            'mode' => ['nullable', 'string', 'in:auto,sefaz,local_test'],
        ]);

        $document = $service->issueFromSale(
            (int) $validated['sale_id'],
            $validated['idempotency_key'] ?? null,
            $validated['mode'] ?? null,
        );

        return response()->json([
            'message' => 'Documento fiscal enviado para processamento.',
            'document' => $this->serialize($document),
        ], 202);
    }

    public function show(FiscalDocument $fiscalDocument): JsonResponse
    {
        return response()->json([
            'document' => $this->serialize($fiscalDocument->load('events')),
        ]);
    }

    public function retry(FiscalDocument $fiscalDocument, FiscalDocumentService $service): JsonResponse
    {
        $document = $service->retry($fiscalDocument);

        return response()->json([
            'message' => 'Documento fiscal reenfileirado.',
            'document' => $this->serialize($document),
        ]);
    }

    public function preview(
        FiscalDocument $fiscalDocument,
        DanfcePdfRenderer $danfceRenderer,
        DanfePdfRenderer $danfeRenderer,
    ): Response
    {
        abort_unless(filled($fiscalDocument->authorized_xml), 422, 'O documento fiscal ainda nao possui XML autorizado.');

        $documentModel = (string) data_get($fiscalDocument->payload, 'flags.document_model', '65');
        $pdf = $documentModel === '55'
            ? $danfeRenderer->render($fiscalDocument->authorized_xml)
            : $danfceRenderer->render($fiscalDocument->authorized_xml);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf(
                'inline; filename="%s-%s.pdf"',
                $documentModel === '55' ? 'danfe' : 'danfce',
                $fiscalDocument->number,
            ),
        ]);
    }

    public function signedXml(FiscalDocument $fiscalDocument): Response
    {
        abort_unless(filled($fiscalDocument->signed_xml), 422, 'O documento fiscal ainda nao possui XML assinado.');

        return response($fiscalDocument->signed_xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="signed-%s.xml"', $fiscalDocument->number),
        ]);
    }

    public function authorizedXml(FiscalDocument $fiscalDocument): Response
    {
        abort_unless(filled($fiscalDocument->authorized_xml), 422, 'O documento fiscal ainda nao possui XML autorizado.');

        return response($fiscalDocument->authorized_xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="authorized-%s.xml"', $fiscalDocument->number),
        ]);
    }

    public function responseXml(FiscalDocument $fiscalDocument): Response
    {
        abort_unless(filled($fiscalDocument->response_xml), 422, 'O documento fiscal ainda nao possui retorno XML da SEFAZ.');

        return response($fiscalDocument->response_xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="response-%s.xml"', $fiscalDocument->number),
        ]);
    }

    protected function serialize(FiscalDocument $document): array
    {
        $tenantId = (string) tenant('id');
        $xmlFiles = app(FiscalDocumentXmlStorage::class)->pathsFor($tenantId, $document);

        return [
            'id' => $document->id,
            'sale_id' => $document->sale_id,
            'status' => $document->status,
            'type' => $document->type,
            'mode' => data_get($document->payload, 'flags.mode'),
            'document_model' => (string) data_get($document->payload, 'flags.document_model', '65'),
            'series' => $document->series,
            'number' => $document->number,
            'access_key' => $document->access_key,
            'agent_key' => $document->agent_key,
            'agent_command_id' => $document->agent_command_id,
            'signed_xml_available' => filled($document->signed_xml),
            'response_xml_available' => filled($document->response_xml),
            'authorized_xml_available' => filled($document->authorized_xml),
            'cancelled_xml_available' => filled($document->cancelled_xml),
            'xml_files' => $xmlFiles,
            'sefaz_status_code' => $document->sefaz_status_code,
            'sefaz_status_reason' => $document->sefaz_status_reason,
            'cancellation_protocol' => $document->cancellation_protocol,
            'cancellation_reason' => $document->cancellation_reason,
            'last_error' => $document->last_error,
            'cancellation_requested_at' => optional($document->cancellation_requested_at)?->toIso8601String(),
            'authorized_at' => optional($document->authorized_at)?->toIso8601String(),
            'printed_at' => optional($document->printed_at)?->toIso8601String(),
            'cancelled_at' => optional($document->cancelled_at)?->toIso8601String(),
            'events' => $document->relationLoaded('events')
                ? $document->events->map(fn ($event) => [
                    'status' => $event->status,
                    'source' => $event->source,
                    'message' => $event->message,
                    'created_at' => optional($event->created_at)?->toIso8601String(),
                ])->values()->all()
                : [],
        ];
    }
}
