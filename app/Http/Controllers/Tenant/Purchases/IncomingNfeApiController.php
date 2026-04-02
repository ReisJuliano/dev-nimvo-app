<?php

namespace App\Http\Controllers\Tenant\Purchases;

use App\Http\Controllers\Controller;
use App\Models\Tenant\IncomingNfeDocument;
use App\Services\Tenant\Purchases\IncomingNfeService;
use App\Services\Tenant\Purchases\IncomingNfeStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;
use Illuminate\Validation\ValidationException;

class IncomingNfeApiController extends Controller
{
    public function sync(Request $request, IncomingNfeService $service): JsonResponse
    {
        return response()->json($service->sync($request->only(['access_key'])));
    }

    public function importXml(Request $request, IncomingNfeService $service): JsonResponse
    {
        $request->validate([
            'xml' => ['nullable', 'string'],
            'file' => ['nullable', 'file', 'mimetypes:text/plain,text/xml,application/xml'],
        ]);

        $xml = $request->string('xml')->toString();

        if ($request->hasFile('file')) {
            $contents = file_get_contents((string) $request->file('file')?->getRealPath());
            $xml = $contents === false ? '' : $contents;
        }

        if (trim($xml) === '') {
            throw ValidationException::withMessages([
                'xml' => 'Informe o XML da NF-e ou selecione um arquivo para importacao.',
            ]);
        }

        $document = $service->importXml($xml);

        return response()->json([
            'message' => 'NF-e importada com sucesso.',
            'record' => $service->serializeDocument($document),
            'status' => $service->integrationStatus(),
        ], 201);
    }

    public function updateMappings(
        Request $request,
        IncomingNfeDocument $document,
        IncomingNfeService $service,
    ): JsonResponse {
        $document = $service->updateMappings($document, $request->all());

        return response()->json([
            'message' => 'Vinculos atualizados com sucesso.',
            'record' => $service->serializeDocument($document),
        ]);
    }

    public function quickCreateSupplier(
        Request $request,
        IncomingNfeDocument $document,
        IncomingNfeService $service,
    ): JsonResponse {
        $document = $service->quickCreateSupplier($document, $request->all());

        return response()->json([
            'message' => 'Fornecedor vinculado a NF-e com sucesso.',
            'record' => $service->serializeDocument($document),
        ], 201);
    }

    public function confirm(
        Request $request,
        IncomingNfeDocument $document,
        IncomingNfeService $service,
    ): JsonResponse {
        $document = $service->confirm($document, $request->all(), (int) auth()->id());

        return response()->json([
            'message' => 'Entrada confirmada e estoque atualizado com sucesso.',
            'record' => $service->serializeDocument($document),
        ]);
    }

    public function reprocess(IncomingNfeDocument $document, IncomingNfeService $service): JsonResponse
    {
        $document = $service->reprocess($document);

        return response()->json([
            'message' => 'NF-e reprocessada com sucesso.',
            'record' => $service->serializeDocument($document),
            'status' => $service->integrationStatus(),
        ]);
    }

    public function xml(IncomingNfeDocument $document, IncomingNfeStorage $storage)
    {
        $contents = $storage->readXml($document->xml_path);

        abort_unless($contents !== null, 404);

        return Response::make($contents, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="nfe-'.$document->access_key.'.xml"',
        ]);
    }

    public function danfe(IncomingNfeDocument $document, IncomingNfeStorage $storage)
    {
        $contents = $storage->readDanfe($document->danfe_path);

        abort_unless($contents !== null, 404);

        return Response::make($contents, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="danfe-'.$document->access_key.'.pdf"',
        ]);
    }
}
