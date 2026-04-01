<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\FiscalDocument;
use Illuminate\Support\Facades\Storage;

class FiscalDocumentXmlStorage
{
    public function persist(string $tenantId, FiscalDocument $document, array $payload): array
    {
        $directory = $this->directory($tenantId, $document);
        $paths = [
            'directory' => $directory,
            'absolute_directory' => $this->absolutePath($directory),
        ];

        foreach ($this->fileMap() as $payloadKey => $filename) {
            $contents = $payload[$payloadKey] ?? null;

            if (!filled($contents)) {
                continue;
            }

            $relativePath = $directory.'/'.$filename;
            Storage::disk('local')->put($relativePath, (string) $contents);

            $paths[$payloadKey] = $relativePath;
            $paths['absolute_'.$payloadKey] = $this->absolutePath($relativePath);
        }

        Storage::disk('local')->put($directory.'/meta.json', json_encode([
            'tenant_id' => $tenantId,
            'document_id' => $document->id,
            'sale_id' => $document->sale_id,
            'type' => $document->type,
            'status' => $document->status,
            'series' => $document->series,
            'number' => $document->number,
            'access_key' => $document->access_key,
            'saved_at' => now()->toIso8601String(),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $paths['meta'] = $directory.'/meta.json';
        $paths['absolute_meta'] = $this->absolutePath($paths['meta']);

        return $paths;
    }

    public function pathsFor(string $tenantId, FiscalDocument $document): array
    {
        $directory = $this->directory($tenantId, $document);
        $paths = [
            'directory' => $directory,
            'absolute_directory' => $this->absolutePath($directory),
        ];

        foreach ($this->fileMap() as $payloadKey => $filename) {
            $relativePath = $directory.'/'.$filename;

            if (!Storage::disk('local')->exists($relativePath)) {
                continue;
            }

            $paths[$payloadKey] = $relativePath;
            $paths['absolute_'.$payloadKey] = $this->absolutePath($relativePath);
        }

        $metaPath = $directory.'/meta.json';

        if (Storage::disk('local')->exists($metaPath)) {
            $paths['meta'] = $metaPath;
            $paths['absolute_meta'] = $this->absolutePath($metaPath);
        }

        return $paths;
    }

    protected function directory(string $tenantId, FiscalDocument $document): string
    {
        return sprintf(
            'fiscal-documents/%s/sales/%s/document-%s',
            trim($tenantId),
            $document->sale_id,
            $document->id,
        );
    }

    protected function absolutePath(string $path): string
    {
        return Storage::disk('local')->path($path);
    }

    protected function fileMap(): array
    {
        return [
            'request_xml' => 'request.xml',
            'signed_xml' => 'signed.xml',
            'authorized_xml' => 'authorized.xml',
        ];
    }
}
