<?php

namespace Tests\Feature;

use App\Models\Tenant\TaxRule;
use App\Services\Tenant\Fiscal\TaxRuleResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaxRuleResolverTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate', [
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
        ])->run();
    }

    public function test_it_returns_null_when_no_rule_matches(): void
    {
        $resolver = app(TaxRuleResolver::class);

        $this->assertNull($resolver->resolve('22030000', '5102', 'SP', 'SP', 'simples'));
    }

    public function test_a_longer_ncm_prefix_wins_over_a_shorter_one(): void
    {
        TaxRule::query()->create(['name' => 'Genérico bebidas', 'ncm_pattern' => '2203', 'csosn' => '102', 'priority' => 0]);
        TaxRule::query()->create(['name' => 'Cerveja específica', 'ncm_pattern' => '22030000', 'csosn' => '500', 'priority' => 0]);

        $resolver = app(TaxRuleResolver::class);
        $rule = $resolver->resolve('22030000');

        $this->assertSame('Cerveja específica', $rule->name);
        $this->assertSame('500', $rule->csosn);
    }

    public function test_a_rule_with_exact_cfop_wins_over_a_rule_with_only_ncm(): void
    {
        TaxRule::query()->create(['name' => 'So NCM', 'ncm_pattern' => '2203', 'csosn' => '102', 'priority' => 0]);
        TaxRule::query()->create(['name' => 'NCM + CFOP', 'ncm_pattern' => '2203', 'cfop' => '5102', 'csosn' => '500', 'priority' => 0]);

        $resolver = app(TaxRuleResolver::class);
        $rule = $resolver->resolve('22030000', '5102');

        $this->assertSame('NCM + CFOP', $rule->name);
    }

    public function test_priority_breaks_a_tie_between_equally_specific_rules(): void
    {
        TaxRule::query()->create(['name' => 'Prioridade baixa', 'ncm_pattern' => '2203', 'priority' => 1]);
        TaxRule::query()->create(['name' => 'Prioridade alta', 'ncm_pattern' => '2203', 'priority' => 10]);

        $resolver = app(TaxRuleResolver::class);
        $rule = $resolver->resolve('22030000');

        $this->assertSame('Prioridade alta', $rule->name);
    }

    public function test_it_ignores_inactive_rules(): void
    {
        TaxRule::query()->create(['name' => 'Regra inativa', 'active' => false, 'ncm_pattern' => '2203']);

        $resolver = app(TaxRuleResolver::class);

        $this->assertNull($resolver->resolve('22030000'));
    }

    public function test_it_does_not_match_a_rule_with_a_different_uf(): void
    {
        TaxRule::query()->create(['name' => 'Regra PR', 'ncm_pattern' => '2203', 'uf_destino' => 'PR']);

        $resolver = app(TaxRuleResolver::class);

        $this->assertNull($resolver->resolve('22030000', null, 'SP', 'SP'));
        $this->assertNotNull($resolver->resolve('22030000', null, 'SP', 'PR'));
    }

    public function test_cache_is_invalidated_after_creating_a_new_rule(): void
    {
        $resolver = app(TaxRuleResolver::class);

        $this->assertNull($resolver->resolve('22030000'));

        TaxRule::query()->create(['name' => 'Nova regra', 'ncm_pattern' => '2203']);

        $this->assertNotNull($resolver->resolve('22030000'));
    }
}
