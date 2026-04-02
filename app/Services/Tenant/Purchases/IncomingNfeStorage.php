<?php

namespace App\Services\Tenant\Purchases;

use App\Models\Tenant\IncomingNfeDocument;
use Illuminate\Support\Facades\Storage;

class IncomingNfeStorage
{
    public function persist(string $tenantId, IncomingNfeDocument $document, array $payload): array
    {
        $directory = $this->directory($tenantId, $document->access_key);
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

        $metaPath = $directory.'/meta.json';
        Storage::disk('local')->put($metaPath, json_encode([
            'document_id' => $document->id,
            'access_key' => $document->access_key,
            'number' => $document->number,
            'series' => $document->series,
            'status' => $document->status,
            'source' => $document->source,
            'saved_at' => now()->toIso8601String(),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $paths['meta'] = $metaPath;
        $paths['absolute_meta'] = $this->absolutePath($metaPath);

        return $paths;
    }

    public function readXml(?string $path): ?string
    {
        if (!filled($path) || !Storage::disk('local')->exists((string) $path)) {
            return null;
        }

        return Storage::disk('local')->get((string) $path);
    }

    public function readDanfe(?string $path): ?string
    {
        if (!filled($path) || !Storage::disk('local')->exists((string) $path)) {
            return null;
        }

        return Storage::disk('local')->get((string) $path);
    }

    protected function directory(string $tenantId, string $accessKey): string
    {
        return sprintf('incoming-nfe/%s/%s', trim($tenantId), trim($accessKey));
    }

    protected function absolutePath(string $path): string
    {
        return Storage::disk('local')->path($path);
    }

    protected function fileMap(): array
    {
        return [
            'xml' => 'nfe.xml',
            'danfe' => 'danfe.pdf',
        ];
    }
}
