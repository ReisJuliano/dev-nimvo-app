<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Services\Central\AppDownloadPackageService;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\SvgWriter;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AppDownloadController extends Controller
{
    public function show(Request $request, AppDownloadPackageService $packageService)
    {
        $store = trim((string) $request->query('store', ''));

        return view('app-download', [
            'available' => $packageService->isAvailable(),
            'versionLabel' => $packageService->versionLabel(),
            'store' => $store,
        ]);
    }

    public function download(AppDownloadPackageService $packageService)
    {
        abort_unless($packageService->isAvailable(), 404, 'O app Nimvo ainda nao foi publicado.');

        return response()->download($packageService->latestApkPath(), 'nimvo-app.apk', [
            'Content-Type' => 'application/vnd.android.package-archive',
        ]);
    }

    public function qr(Request $request): Response
    {
        $store = trim((string) $request->query('store', ''));
        $url = route('app.download.page');
        if ($store !== '') {
            $url .= '?store='.urlencode($store);
        }

        $qrCode = new QrCode(data: $url, size: 320, margin: 10);
        $result = (new SvgWriter())->write($qrCode);

        return response($result->getString(), 200, [
            'Content-Type' => $result->getMimeType(),
        ]);
    }
}
