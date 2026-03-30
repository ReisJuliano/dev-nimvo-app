<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('style_reference')->nullable()->after('description')->index();
            $table->string('color')->nullable()->after('style_reference')->index();
            $table->string('size')->nullable()->after('color')->index();
            $table->string('collection')->nullable()->after('size')->index();
            $table->boolean('catalog_visible')->default(false)->after('collection')->index();
        });

        Schema::table('order_drafts', function (Blueprint $table) {
            $table->string('channel')->default('store')->after('type')->index();
        });

        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('type')->default('percent');
            $table->string('scope')->default('all');
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('collection')->nullable();
            $table->decimal('discount_value', 10, 2)->default(0);
            $table->string('highlight_text')->nullable();
            $table->timestamp('start_at')->nullable();
            $table->timestamp('end_at')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('return_exchanges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('type')->default('troca');
            $table->string('status')->default('aberto');
            $table->string('product_name');
            $table->string('product_code')->nullable();
            $table->string('size')->nullable();
            $table->string('color')->nullable();
            $table->string('reason');
            $table->string('resolution')->nullable();
            $table->decimal('refund_amount', 10, 2)->default(0);
            $table->decimal('store_credit_amount', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('return_exchanges');
        Schema::dropIfExists('promotions');

        Schema::table('order_drafts', function (Blueprint $table) {
            $table->dropColumn('channel');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'style_reference',
                'color',
                'size',
                'collection',
                'catalog_visible',
            ]);
        });
    }
};
