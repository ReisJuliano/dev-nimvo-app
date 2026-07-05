<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'sold_by')) {
                $table->string('sold_by', 10)->default('unit')->after('unit');
            }

            if (!Schema::hasColumn('products', 'scale_code')) {
                $table->unsignedInteger('scale_code')->nullable()->unique()->after('sold_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'scale_code')) {
                $table->dropUnique(['scale_code']);
                $table->dropColumn('scale_code');
            }

            if (Schema::hasColumn('products', 'sold_by')) {
                $table->dropColumn('sold_by');
            }
        });
    }
};
