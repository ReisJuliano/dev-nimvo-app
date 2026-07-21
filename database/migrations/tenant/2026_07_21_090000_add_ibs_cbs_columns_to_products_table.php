<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('ibs_cbs_cst', 3)->nullable()->after('icms_csosn');
            $table->string('c_class_trib', 6)->nullable()->after('ibs_cbs_cst');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['ibs_cbs_cst', 'c_class_trib']);
        });
    }
};
