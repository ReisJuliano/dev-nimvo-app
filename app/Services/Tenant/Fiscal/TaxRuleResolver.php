<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\TaxRule;
use Illuminate\Support\Facades\Cache;

class TaxRuleResolver
{
    public function resolve(
        ?string $ncm,
        ?string $cfop = null,
        ?string $ufOrigem = null,
        ?string $ufDestino = null,
        ?string $regime = null,
    ): ?TaxRule {
        $ncm = (string) $ncm;

        $candidates = $this->activeRules()->filter(function (TaxRule $rule) use ($ncm, $cfop, $ufOrigem, $ufDestino, $regime) {
            if (filled($rule->ncm_pattern) && ! str_starts_with($ncm, $rule->ncm_pattern)) {
                return false;
            }

            if (filled($rule->cfop) && $rule->cfop !== $cfop) {
                return false;
            }

            if (filled($rule->uf_origem) && $rule->uf_origem !== $ufOrigem) {
                return false;
            }

            if (filled($rule->uf_destino) && $rule->uf_destino !== $ufDestino) {
                return false;
            }

            if (filled($rule->regime) && $rule->regime !== $regime) {
                return false;
            }

            return true;
        });

        if ($candidates->isEmpty()) {
            return null;
        }

        return $candidates
            ->sortByDesc(fn (TaxRule $rule) => $this->specificityScore($rule))
            ->first();
    }

    protected function specificityScore(TaxRule $rule): array
    {
        return [
            strlen((string) $rule->ncm_pattern),
            filled($rule->cfop) ? 1 : 0,
            (filled($rule->uf_origem) ? 1 : 0) + (filled($rule->uf_destino) ? 1 : 0),
            filled($rule->regime) ? 1 : 0,
            $rule->priority,
            $rule->id,
        ];
    }

    /**
     * @return \Illuminate\Support\Collection<int, TaxRule>
     */
    protected function activeRules(): \Illuminate\Support\Collection
    {
        return Cache::remember($this->cacheKey(), 3600, function () {
            return TaxRule::query()->where('active', true)->get();
        });
    }

    protected function cacheKey(): string
    {
        return sprintf('tax-rules:%s', (string) tenant('id'));
    }

    public function forgetCache(): void
    {
        Cache::forget($this->cacheKey());
    }
}
