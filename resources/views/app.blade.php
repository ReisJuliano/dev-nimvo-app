<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#133a30">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Nimvo">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="apple-touch-icon" href="/favicon.ico">
    <title>Nimvo</title>
    <script>
        (() => {
            const resetKey = 'nimvo:offline-reset:2026-06-23';
            const hasServiceWorker = 'serviceWorker' in navigator;
            const hasCaches = 'caches' in window;

            if (!hasServiceWorker && !hasCaches) {
                return;
            }

            try {
                if (window.localStorage.getItem(resetKey) === '1') {
                    return;
                }

                window.localStorage.setItem(resetKey, '1');
            } catch {
                // Keep the cleanup best-effort if storage is blocked.
            }

            Promise.all([
                hasServiceWorker
                    ? navigator.serviceWorker.getRegistrations()
                        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
                    : Promise.resolve(),
                hasCaches
                    ? window.caches.keys()
                        .then((keys) => Promise.all(
                            keys
                                .filter((key) => key.startsWith('nimvo-offline-'))
                                .map((key) => window.caches.delete(key)),
                        ))
                    : Promise.resolve(),
            ]).then(() => {
                if (hasServiceWorker && navigator.serviceWorker.controller) {
                    window.location.reload();
                }
            }).catch(() => {});
        })();
    </script>
    @viteReactRefresh
    @vite('resources/js/app.jsx')
    @inertiaHead
</head>
<body>
    @inertia
</body>
</html>
