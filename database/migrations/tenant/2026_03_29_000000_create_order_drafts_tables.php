<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('order_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->string('type')->default('comanda');
            $table->string('reference')->nullable();
            $table->string('status')->default('draft');
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->decimal('cost_total', 10, 2)->default(0);
            $table->decimal('profit', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('sent_to_cashier_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('order_draft_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_draft_id')->constrained('order_drafts')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('product_name');
            $table->string('product_code')->nullable();
            $table->string('product_barcode')->nullable();
            $table->string('unit')->nullable();
            $table->decimal('quantity', 10, 3);
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->decimal('unit_price', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_draft_items');
        Schema::dropIfExists('order_drafts');
    }
};
