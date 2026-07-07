<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('label_templates', function (Blueprint $table) {
            $table->json('layout')->nullable()->after('is_default');
        });
    }

    public function down(): void
    {
        Schema::table('label_templates', function (Blueprint $table) {
            $table->dropColumn('layout');
        });
    }
};
