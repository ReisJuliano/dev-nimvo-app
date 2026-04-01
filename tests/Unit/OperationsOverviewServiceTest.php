<?php

namespace Tests\Unit;

use App\Services\Tenant\Operations\InventoryOverviewService;
use App\Services\Tenant\Operations\SalesOverviewService;
use App\Services\Tenant\Operations\UsersOverviewService;
use App\Services\Tenant\OperationsOverviewService;
use PHPUnit\Framework\TestCase;

class OperationsOverviewServiceTest extends TestCase
{
    public function test_workspace_modules_use_tabs_without_summary_panels_and_ready_status(): void
    {
        $service = new OperationsOverviewService(
            $this->createMock(SalesOverviewService::class),
            $this->createMock(InventoryOverviewService::class),
            $this->createMock(UsersOverviewService::class),
        );

        $module = $service->build('delivery', ['section' => 'operacao']);

        $this->assertSame('operacao', $module['activeSection']);
        $this->assertCount(2, $module['sections']);
        $this->assertSame([], $module['panels']);
        $this->assertNotEmpty($module['tables']);

        $implementationSection = current(array_filter(
            $module['sections'],
            fn (array $section) => $section['key'] === 'implantacao',
        ));

        $this->assertNotFalse($implementationSection);
        $this->assertSame([], $implementationSection['panels']);

        foreach ($implementationSection['tables'][0]['rows'] as $row) {
            $this->assertSame('Pronto', $row['status']);
        }
    }
}
