<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Services\Central\AppDownloadPackageService;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\SvgWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AppDownloadController extends Controller
{
    public function show(Request $request, AppDownloadPackageService $packageService)
    {
        $store = trim((string) $request->query('store', ''));
        $cacheKey = $packageService->cacheKey();

        return response()
            ->view('app-download', [
                'available' => $packageService->isAvailable(),
                'versionLabel' => $packageService->versionLabel(),
                'store' => $store,
                'cacheKey' => $cacheKey,
                'downloadUrl' => $cacheKey
                    ? route('app.download.apk', ['v' => $cacheKey])
                    : route('app.download.apk'),
            ])
            ->withHeaders($this->noStoreHeaders());
    }

    public function download(AppDownloadPackageService $packageService)
    {
        abort_unless($packageService->isAvailable(), 404, 'O app Nimvo ainda nao foi publicado.');

        return response()->download($packageService->latestApkPath(), 'nimvo-app.apk', [
            'Content-Type' => 'application/vnd.android.package-archive',
            ...$this->noStoreHeaders(),
        ]);
    }

    public function qr(AppDownloadPackageService $packageService): Response
    {
        $cacheKey = $packageService->cacheKey();
        $url = $cacheKey
            ? route('app.download.apk', ['v' => $cacheKey])
            : route('app.download.apk');

        $qrCode = new QrCode(data: $url, size: 320, margin: 10);
        $result = (new SvgWriter())->write($qrCode);

        return response($result->getString(), 200, [
            'Content-Type' => $result->getMimeType(),
            ...$this->noStoreHeaders(),
        ]);
    }

    /**
     * Polled by the installed app itself (unauthenticated, tenant-agnostic)
     * to know whether a newer APK was published, since a direct-APK
     * distribution has no store-level auto-update.
     */
    public function version(AppDownloadPackageService $packageService): JsonResponse
    {
        $metadata = $packageService->versionMetadata();

        if (! $metadata) {
            return response()
                ->json(['available' => false])
                ->withHeaders($this->noStoreHeaders());
        }

        $buildNumber = (int) ($metadata['build_number'] ?? 0);

        return response()->json([
            'available' => true,
            'version' => $metadata['version'] ?? null,
            'build_number' => $buildNumber,
            'notes' => $metadata['notes'] ?? null,
            'download_url' => route('app.download.page', ['v' => $buildNumber]),
        ])->withHeaders($this->noStoreHeaders());
    }

    protected function noStoreHeaders(): array
    {
        return [
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ];
    }
}
