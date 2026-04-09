<?php

declare(strict_types=1);

use Illuminate\Support\Carbon;

define('NIMVO_FISCAL_BRIDGE_BASE_PATH', __DIR__);

if (!function_exists('base_path')) {
    function base_path(string $path = ''): string
    {
        if ($path === '') {
            return NIMVO_FISCAL_BRIDGE_BASE_PATH;
        }

        return NIMVO_FISCAL_BRIDGE_BASE_PATH.DIRECTORY_SEPARATOR.ltrim($path, '\\/');
    }
}

if (!function_exists('config')) {
    function config(?string $key = null, mixed $default = null): mixed
    {
        $config = [
            'app' => [
                'name' => 'nimvo',
            ],
        ];

        if ($key === null) {
            return $config;
        }

        return data_get($config, $key, $default);
    }
}

if (!function_exists('data_get')) {
    function data_get(mixed $target, string|int|null $key, mixed $default = null): mixed
    {
        if ($key === null || $key === '') {
            return $target;
        }

        $segments = is_array($key) ? $key : explode('.', (string) $key);

        foreach ($segments as $segment) {
            if (is_array($target) && array_key_exists($segment, $target)) {
                $target = $target[$segment];
                continue;
            }

            if (is_object($target) && isset($target->{$segment})) {
                $target = $target->{$segment};
                continue;
            }

            return $default;
        }

        return $target;
    }
}

if (!function_exists('filled')) {
    function filled(mixed $value): bool
    {
        if (is_null($value)) {
            return false;
        }

        if (is_string($value)) {
            return trim($value) !== '';
        }

        if (is_array($value)) {
            return $value !== [];
        }

        return true;
    }
}

if (!function_exists('blank')) {
    function blank(mixed $value): bool
    {
        return !filled($value);
    }
}

if (!function_exists('now')) {
    function now(DateTimeZone|string|null $timezone = null): Carbon
    {
        return Carbon::now($timezone);
    }
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\Support\\';

    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $relativePath = str_replace('\\', DIRECTORY_SEPARATOR, $relativeClass).'.php';
    $path = base_path('app/Support/'.$relativePath);

    if (is_file($path)) {
        require_once $path;
    }
});

require __DIR__.'/vendor/autoload.php';
