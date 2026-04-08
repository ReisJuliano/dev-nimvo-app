<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (! Schema::hasColumn('sales', 'cash_received')) {
                $table->decimal('cash_received', 10, 2)->nullable()->after('payment_method');
            }

            if (! Schema::hasColumn('sales', 'change_amount')) {
                $table->decimal('change_amount', 10, 2)->default(0)->after('cash_received');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $columns = array_values(array_filter([
                Schema::hasColumn('sales', 'cash_received') ? 'cash_received' : null,
                Schema::hasColumn('sales', 'change_amount') ? 'change_amount' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
