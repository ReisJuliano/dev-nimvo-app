<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('document', 30)->nullable()->after('name')->index();
            $table->string('document_type', 10)->nullable()->after('document');
            $table->string('trade_name')->nullable()->after('email');
            $table->string('state_registration', 30)->nullable()->after('trade_name');
            $table->string('city_name')->nullable()->after('state_registration');
            $table->string('state', 2)->nullable()->after('city_name');
        });

        Schema::create('incoming_nfe_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->nullable()->constrained('purchases')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('access_key', 44)->unique();
            $table->string('status', 40)->default('pending_products');
            $table->string('source', 40)->default('xml_upload');
            $table->string('manifest_status', 40)->nullable();
            $table->string('distribution_nsu', 20)->nullable()->index();
            $table->unsignedTinyInteger('environment')->nullable();
            $table->unsignedSmallInteger('series')->nullable();
            $table->unsignedBigInteger('number')->nullable()->index();
            $table->string('operation_nature')->nullable();
            $table->string('supplier_name');
            $table->string('supplier_trade_name')->nullable();
            $table->string('supplier_document', 30)->nullable()->index();
            $table->string('supplier_state_registration', 30)->nullable();
            $table->string('recipient_name');
            $table->string('recipient_document', 30)->index();
            $table->decimal('products_total', 12, 2)->default(0);
            $table->decimal('freight_total', 12, 2)->default(0);
            $table->decimal('invoice_total', 12, 2)->default(0);
            $table->string('xml_path')->nullable();
            $table->string('danfe_path')->nullable();
            $table->json('validation_snapshot')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('issued_at')->nullable()->index();
            $table->timestamp('authorized_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamp('last_processed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('incoming_nfe_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('incoming_nfe_documents')->cascadeOnDelete();
            $table->foreignId('purchase_item_id')->nullable()->constrained('purchase_items')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->unsignedInteger('item_number');
            $table->string('supplier_code')->nullable();
            $table->string('barcode')->nullable()->index();
            $table->string('description');
            $table->string('ncm', 8)->nullable();
            $table->string('cfop', 4)->nullable();
            $table->string('unit', 10)->nullable();
            $table->decimal('quantity', 10, 3)->default(0);
            $table->decimal('unit_price', 12, 4)->default(0);
            $table->decimal('total_price', 12, 2)->default(0);
            $table->string('match_status', 30)->default('pending');
            $table->string('match_type', 30)->nullable();
            $table->decimal('match_confidence', 5, 2)->nullable();
            $table->json('validation_warnings')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['document_id', 'item_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incoming_nfe_items');
        Schema::dropIfExists('incoming_nfe_documents');

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn([
                'document',
                'document_type',
                'trade_name',
                'state_registration',
                'city_name',
                'state',
            ]);
        });
    }
};
