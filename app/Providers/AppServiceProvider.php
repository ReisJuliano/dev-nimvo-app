<?php

namespace App\Providers;

use App\Contracts\Central\LicenseBillingGateway;
use App\Services\Central\NullLicenseBillingGateway;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(LicenseBillingGateway::class, NullLicenseBillingGateway::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);
    }
}
