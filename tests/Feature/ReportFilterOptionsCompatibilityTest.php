<?php

namespace Tests\Feature;

use App\Services\Tenant\Reports\ReportBrowserService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ReportFilterOptionsCompatibilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropAllTables();

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });
    }

    public function test_sales_daily_report_ignores_missing_optional_filter_tables(): void
    {
        DB::table('users')->insert([
            'name' => 'Operador legado',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $payload = app(ReportBrowserService::class)->show('sales-daily', []);

        $this->assertFalse($payload['filtersApplied']);
        $this->assertSame([], $payload['filterOptions']['customers']);
        $this->assertSame([], $payload['filterOptions']['categories']);
        $this->assertSame([], $payload['filterOptions']['suppliers']);
        $this->assertSame([
            [
                'value' => '1',
                'label' => 'Operador legado',
            ],
        ], $payload['filterOptions']['operators']);
    }
}
