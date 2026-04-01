<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('ncm', 8)->nullable()->after('barcode');
            $table->string('cfop', 4)->nullable()->after('ncm');
            $table->string('cest', 7)->nullable()->after('cfop');
            $table->string('origin_code', 1)->default('0')->after('cest');
            $table->string('icms_csosn', 3)->default('102')->after('origin_code');
            $table->string('pis_cst', 2)->default('49')->after('icms_csosn');
            $table->string('cofins_cst', 2)->default('49')->after('pis_cst');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'ncm',
                'cfop',
                'cest',
                'origin_code',
                'icms_csosn',
                'pis_cst',
                'cofins_cst',
            ]);
        });
    }
};
