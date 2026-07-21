<?php

namespace Tests\Unit;

use App\Services\Tenant\TenantNavigationService;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;

class TenantNavigationServiceTest extends TestCase
{
    public function test_it_resolves_navigation_items_from_request_patterns(): void
    {
        $service = new TenantNavigationService();
        $request = Request::create('/pedidos', 'GET');
        $reportsShortcutRequest = Request::create('/vendas', 'GET');
        $deferredPaymentRequest = Request::create('/fiado', 'GET');
        $legacyCashShortcutRequest = Request::create('/caixa', 'GET');

        $item = $service->resolveItem($request);
        $reportsShortcutItem = $service->resolveItem($reportsShortcutRequest);
        $deferredPaymentItem = $service->resolveItem($deferredPaymentRequest);
        $legacyCashShortcutItem = $service->resolveItem($legacyCashShortcutRequest);

        $this->assertNotNull($item);
        $this->assertSame('/pedidos', $item['href']);
        $this->assertSame('pedidos', $item['access_key']);
        $this->assertNotNull($reportsShortcutItem);
        $this->assertSame('/relatorios', $reportsShortcutItem['href']);
        $this->assertSame('relatorios_avancados', $reportsShortcutItem['access_key']);
        $this->assertNotNull($deferredPaymentItem);
        $this->assertSame('/a-prazo', $deferredPaymentItem['href']);
        $this->assertSame('prazo', $deferredPaymentItem['access_key']);
        $this->assertNotNull($legacyCashShortcutItem);
        $this->assertSame('/caixa', $legacyCashShortcutItem['href']);
        $this->assertSame('caixa', $legacyCashShortcutItem['access_key']);
    }

    public function test_it_checks_required_roles_from_the_navigation_catalog(): void
    {
        $service = new TenantNavigationService();
        $request = Request::create('/consultas-cancelamentos', 'GET');

        $request->setUserResolver(fn () => (object) ['role' => 'operador']);
        $this->assertFalse($service->userHasRequiredRole($request));

        $request->setUserResolver(fn () => (object) ['role' => 'admin']);
        $this->assertTrue($service->userHasRequiredRole($request));
    }

    public function test_it_shows_cash_register_as_a_sidebar_shortcut(): void
    {
        $service = new TenantNavigationService();
        $items = collect($service->catalog())->flatMap(fn (array $group) => $group['items'] ?? []);

        $this->assertTrue($items->contains(fn (array $item) => ($item['href'] ?? null) === '/caixa'));
    }

    public function test_advanced_navigation_uses_specific_module_flags(): void
    {
        $service = new TenantNavigationService();
        $items = collect($service->catalog())->flatMap(fn (array $group) => $group['items'] ?? []);

        $this->assertSame(
            'consultas_fiscais',
            $items->firstWhere('href', '/consultas-cancelamentos')['access_key'],
        );
        $this->assertSame(
            'categorias',
            $items->firstWhere('href', '/categorias')['access_key'],
        );
        $this->assertSame(
            'entrada_estoque_avancado',
            $items->firstWhere('href', '/entrada-estoque/manutencao')['access_key'],
        );
    }
}
