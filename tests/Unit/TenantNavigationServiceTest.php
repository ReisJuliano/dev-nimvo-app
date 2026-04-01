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
        $deferredPaymentRequest = Request::create('/a-prazo', 'GET');

        $item = $service->resolveItem($request);
        $reportsShortcutItem = $service->resolveItem($reportsShortcutRequest);
        $deferredPaymentItem = $service->resolveItem($deferredPaymentRequest);

        $this->assertNotNull($item);
        $this->assertSame('/pedidos', $item['href']);
        $this->assertSame('pedidos', $item['access_key']);
        $this->assertNotNull($reportsShortcutItem);
        $this->assertSame('/relatorios', $reportsShortcutItem['href']);
        $this->assertSame('relatorios', $reportsShortcutItem['access_key']);
        $this->assertNotNull($deferredPaymentItem);
        $this->assertSame('/a-prazo', $deferredPaymentItem['href']);
        $this->assertSame('prazo', $deferredPaymentItem['access_key']);
    }

    public function test_it_checks_required_roles_from_the_navigation_catalog(): void
    {
        $service = new TenantNavigationService();
        $request = Request::create('/configuracoes', 'GET');

        $request->setUserResolver(fn () => (object) ['role' => 'operador']);
        $this->assertFalse($service->userHasRequiredRole($request));

        $request->setUserResolver(fn () => (object) ['role' => 'admin']);
        $this->assertTrue($service->userHasRequiredRole($request));
    }

    public function test_it_does_not_show_cash_register_as_a_sidebar_shortcut(): void
    {
        $service = new TenantNavigationService();
        $items = collect($service->catalog())->flatMap(fn (array $group) => $group['items'] ?? []);

        $this->assertFalse($items->contains(fn (array $item) => ($item['href'] ?? null) === '/caixa'));
    }
}
