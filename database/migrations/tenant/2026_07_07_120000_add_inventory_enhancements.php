<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_sessions', function (Blueprint $table) {
            $table->boolean('blind_count')->default(false)->after('count_resolution');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->timestamp('last_counted_at')->nullable()->after('stock_quantity');
            $table->index('last_counted_at');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['last_counted_at']);
            $table->dropColumn('last_counted_at');
        });

        Schema::table('inventory_sessions', function (Blueprint $table) {
            $table->dropColumn('blind_count');
        });
    }
};
