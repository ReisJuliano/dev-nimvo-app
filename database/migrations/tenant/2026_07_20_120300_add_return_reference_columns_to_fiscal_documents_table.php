<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table) {
            $table->foreignId('related_sale_id')->nullable()->after('sale_id')->constrained('sales')->nullOnDelete();
            $table->foreignId('related_purchase_id')->nullable()->after('related_sale_id')->constrained('purchases')->nullOnDelete();
            $table->foreignId('origin_document_id')->nullable()->after('related_purchase_id')->constrained('fiscal_documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('related_sale_id');
            $table->dropConstrainedForeignId('related_purchase_id');
            $table->dropConstrainedForeignId('origin_document_id');
        });
    }
};
