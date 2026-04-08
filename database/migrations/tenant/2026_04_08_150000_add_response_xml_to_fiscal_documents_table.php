<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table) {
            if (!Schema::hasColumn('fiscal_documents', 'response_xml')) {
                $table->longText('response_xml')->nullable()->after('signed_xml');
            }
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table) {
            if (Schema::hasColumn('fiscal_documents', 'response_xml')) {
                $table->dropColumn('response_xml');
            }
        });
    }
};
