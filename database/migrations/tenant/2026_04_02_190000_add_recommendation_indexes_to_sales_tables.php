<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'sales_status_created_at_idx');
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->index(['product_id', 'sale_id'], 'sale_items_product_sale_idx');
            $table->index(['sale_id', 'product_id'], 'sale_items_sale_product_idx');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropIndex('sale_items_product_sale_idx');
            $table->dropIndex('sale_items_sale_product_idx');
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('sales_status_created_at_idx');
        });
    }
};
