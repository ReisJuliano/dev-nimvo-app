<?php

namespace App\Services\Central;

use Illuminate\Support\Facades\File;
use RuntimeException;

/**
 * The Nimvo mobile app is a single, tenant-agnostic APK - the store is
 * chosen at login, not baked into the installer - so unlike the local
 * fiscal agent's per-tenant zip, there is exactly one static file to serve
 * here. It is manually replaced after each `flutter build apk --release`.
 */
class AppDownloadPackageService
{
    protected function candidatePaths(): array
    {
        return [
            storage_path('app/public/releases/nimvo-app.apk'),
            base_path('nimvo_app/build/app/outputs/flutter-apk/app-release.apk'),
        ];
    }

    public function latestApkPath(): string
    {
        foreach ($this->candidatePaths() as $path) {
            if (File::exists($path)) {
                return $path;
            }
        }

        throw new RuntimeException('Nenhum APK do app Nimvo foi publicado ainda em storage/app/public/releases/nimvo-app.apk.');
    }

    public function isAvailable(): bool
    {
        foreach ($this->candidatePaths() as $path) {
            if (File::exists($path)) {
                return true;
            }
        }

        return false;
    }

    public function versionLabel(): ?string
    {
        if (! $this->isAvailable()) {
            return null;
        }

        return date('d/m/Y', File::lastModified($this->latestApkPath()));
    }

    public function cacheKey(): ?string
    {
        if (! $this->isAvailable()) {
            return null;
        }

        return (string) File::lastModified($this->latestApkPath());
    }

    protected function versionMetadataPath(): string
    {
        return storage_path('app/public/releases/version.json');
    }

    /**
     * Metadata the app itself checks against to know a newer build was
     * published. Maintained by hand alongside nimvo-app.apk (see
     * nimvo_app/README.md) since there is no CI building/signing releases
     * yet.
     */
    public function versionMetadata(): ?array
    {
        $path = $this->versionMetadataPath();
        if (! File::exists($path)) {
            return null;
        }

        $decoded = json_decode(File::get($path), true);

        return is_array($decoded) ? $decoded : null;
    }
}
