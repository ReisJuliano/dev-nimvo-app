<?php

namespace Tests\Unit;

use App\Services\Tenant\Inventory\InventoryCycleCountService;
use PHPUnit\Framework\TestCase;

class InventoryCycleCountServiceTest extends TestCase
{
    public function test_top_revenue_products_within_eighty_percent_cumulative_are_class_a(): void
    {
        $class = InventoryCycleCountService::classForCumulativePercent(revenue: 500, cumulativePercent: 45);

        $this->assertSame('A', $class);
    }

    public function test_products_between_eighty_and_ninety_five_percent_cumulative_are_class_b(): void
    {
        $class = InventoryCycleCountService::classForCumulativePercent(revenue: 50, cumulativePercent: 90);

        $this->assertSame('B', $class);
    }

    public function test_products_past_ninety_five_percent_cumulative_are_class_c(): void
    {
        $class = InventoryCycleCountService::classForCumulativePercent(revenue: 5, cumulativePercent: 99);

        $this->assertSame('C', $class);
    }

    public function test_products_with_no_revenue_in_period_are_always_class_c_regardless_of_cumulative(): void
    {
        $class = InventoryCycleCountService::classForCumulativePercent(revenue: 0, cumulativePercent: 10);

        $this->assertSame('C', $class);
    }

    public function test_boundary_at_exactly_eighty_percent_is_class_a(): void
    {
        $class = InventoryCycleCountService::classForCumulativePercent(revenue: 10, cumulativePercent: 80);

        $this->assertSame('A', $class);
    }

    public function test_boundary_at_exactly_ninety_five_percent_is_class_b(): void
    {
        $class = InventoryCycleCountService::classForCumulativePercent(revenue: 10, cumulativePercent: 95);

        $this->assertSame('B', $class);
    }
}
