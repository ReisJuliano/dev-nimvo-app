<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->unsignedTinyInteger('fiscal_operation_type')->default(1)->after('requested_document_model');
            $table->unsignedTinyInteger('fiscal_finalidade')->default(1)->after('fiscal_operation_type');
            $table->json('fiscal_reference_access_keys')->nullable()->after('fiscal_finalidade');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['fiscal_operation_type', 'fiscal_finalidade', 'fiscal_reference_access_keys']);
        });
    }
};
