<?php

namespace App\Support\Tenancy;

use Illuminate\Support\Str;

class TenantDomainManager
{
    public function centralDomains(): array
    {
        return array_values(array_unique(array_filter(array_map(
            fn (mixed $domain): string => $this->normalizeHost((string) $domain),
            config('tenancy.central_domains', []),
        ))));
    }

    public function tenantBaseDomain(): string
    {
        $baseDomain = $this->normalizeHost((string) config('tenancy.tenant_base_domain', ''));

        if ($baseDomain !== '') {
            return $baseDomain;
        }

        return $this->centralDomains()[0] ?? 'localhost';
    }

    public function normalizeSubdomain(?string $value): string
    {
        $host = $this->stripHostDecorations($value);

        if ($host === '' || $this->isCentralDomain($host)) {
            return '';
        }

        $baseDomain = $this->tenantBaseDomain();
        $suffix = '.'.$baseDomain;

        if (Str::endsWith($host, $suffix)) {
            return trim(Str::beforeLast($host, $suffix), '.');
        }

        return trim($host, '.');
    }

    public function buildTenantDomain(string $subdomain): string
    {
        $subdomain = $this->normalizeSubdomain($subdomain);

        if ($subdomain === '') {
            return '';
        }

        return sprintf('%s.%s', $subdomain, $this->tenantBaseDomain());
    }

    public function isCentralDomain(?string $value): bool
    {
        $host = $this->stripHostDecorations($value);

        return $host !== '' && in_array($host, $this->centralDomains(), true);
    }

    public function reservedSubdomains(): array
    {
        $baseDomain = $this->tenantBaseDomain();
        $suffix = '.'.$baseDomain;

        return array_values(array_unique(array_filter(array_map(
            function (string $domain) use ($suffix): ?string {
                if (!Str::endsWith($domain, $suffix)) {
                    return null;
                }

                $subdomain = trim(Str::beforeLast($domain, $suffix), '.');

                return str_contains($subdomain, '.') ? null : $subdomain;
            },
            $this->centralDomains(),
        ))));
    }

    protected function stripHostDecorations(?string $value): string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return '';
        }

        $candidate = preg_match('#^[a-z][a-z0-9+.-]*://#i', $value)
            ? $value
            : 'https://'.$value;

        $host = parse_url($candidate, PHP_URL_HOST);

        if (is_string($host) && $host !== '') {
            return $this->normalizeHost($host);
        }

        return $this->normalizeHost($value);
    }

    protected function normalizeHost(string $host): string
    {
        $host = trim(strtolower($host));

        return trim(Str::before($host, '/'), '.');
    }
}
