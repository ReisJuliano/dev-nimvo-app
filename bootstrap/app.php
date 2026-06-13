<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            $centralDomains = array_values(array_filter(config('tenancy.central_domains', [])));
            $centralMiddleware = [
                'web',
                \App\Http\Middleware\HandleInertiaRequests::class,
            ];

            if ($centralDomains === []) {
                Route::middleware($centralMiddleware)->group(base_path('routes/central.php'));
            } else {
                foreach ($centralDomains as $centralDomain) {
                    Route::domain($centralDomain)
                        ->middleware($centralMiddleware)
                        ->group(base_path('routes/central.php'));
                }
            }

            Route::middleware([
                \Stancl\Tenancy\Middleware\InitializeTenancyByDomain::class,
                \Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains::class,
                'web',
                \App\Http\Middleware\HandleInertiaRequests::class,
            ])->group(base_path('routes/tenant.php'));
        }
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->preventRequestForgery([
            'api/local-agents/*',
            'mobile-api/*',
        ]);

        $middleware->alias([
            'auth.central_admin' => \App\Http\Middleware\Central\AuthenticateCentralAdmin::class,
            'password.changed' => \App\Http\Middleware\Tenant\EnsurePasswordIsChanged::class,
            'tenant.license' => \App\Http\Middleware\Tenant\EnsureTenantLicenseIsValid::class,
            'module.enabled' => \App\Http\Middleware\Tenant\EnsureModuleIsEnabled::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->respond(function (Response $response, \Throwable $exception, Request $request) {
            if (
                ! $request->expectsJson()
                && in_array($response->getStatusCode(), [403, 404, 500], true)
            ) {
                return Inertia::render('Error', ['status' => $response->getStatusCode()])
                    ->toResponse($request)
                    ->setStatusCode($response->getStatusCode());
            }

            return $response;
        });
    })->create();
