<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('conditional_sales', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('customer_id')->constrained('customers');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->string('status')->default('open')->index();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->timestamp('withdrawn_at');
            $table->date('due_at')->index();
            $table->timestamp('closed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('conditional_sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conditional_sale_id')->constrained('conditional_sales')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->string('product_code');
            $table->string('product_name');
            $table->decimal('quantity_sent', 10, 3);
            $table->decimal('quantity_returned', 10, 3)->default(0);
            $table->decimal('quantity_kept', 10, 3)->default(0);
            $table->decimal('quantity_lost', 10, 3)->default(0);
            $table->decimal('quantity_damaged', 10, 3)->default(0);
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->decimal('unit_price', 10, 2)->default(0);
            $table->timestamps();

            $table->unique(['conditional_sale_id', 'product_id'], 'conditional_sale_items_sale_product_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conditional_sale_items');
        Schema::dropIfExists('conditional_sales');
    }
};
