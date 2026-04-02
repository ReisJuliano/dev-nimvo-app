<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'fiscal_enabled')) {
                $table->boolean('fiscal_enabled')->default(true)->after('cofins_cst');
            }

            if (!Schema::hasColumn('products', 'commercial_unit')) {
                $table->string('commercial_unit', 10)->nullable()->after('unit');
            }

            if (!Schema::hasColumn('products', 'taxable_unit')) {
                $table->string('taxable_unit', 10)->nullable()->after('commercial_unit');
            }

            if (!Schema::hasColumn('products', 'icms_rate')) {
                $table->decimal('icms_rate', 8, 4)->nullable()->after('icms_csosn');
            }

            if (!Schema::hasColumn('products', 'pis_rate')) {
                $table->decimal('pis_rate', 8, 4)->nullable()->after('pis_cst');
            }

            if (!Schema::hasColumn('products', 'cofins_rate')) {
                $table->decimal('cofins_rate', 8, 4)->nullable()->after('cofins_cst');
            }

            if (!Schema::hasColumn('products', 'ipi_rate')) {
                $table->decimal('ipi_rate', 8, 4)->nullable()->after('cofins_rate');
            }
        });
    }

    public function down(): void
    {
        $columns = array_values(array_filter([
            Schema::hasColumn('products', 'fiscal_enabled') ? 'fiscal_enabled' : null,
            Schema::hasColumn('products', 'commercial_unit') ? 'commercial_unit' : null,
            Schema::hasColumn('products', 'taxable_unit') ? 'taxable_unit' : null,
            Schema::hasColumn('products', 'icms_rate') ? 'icms_rate' : null,
            Schema::hasColumn('products', 'pis_rate') ? 'pis_rate' : null,
            Schema::hasColumn('products', 'cofins_rate') ? 'cofins_rate' : null,
            Schema::hasColumn('products', 'ipi_rate') ? 'ipi_rate' : null,
        ]));

        if ($columns === []) {
            return;
        }

        Schema::table('products', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }
};
