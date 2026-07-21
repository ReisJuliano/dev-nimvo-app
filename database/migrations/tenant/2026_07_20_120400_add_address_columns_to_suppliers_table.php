<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('street')->nullable()->after('city_name');
            $table->string('number')->nullable()->after('street');
            $table->string('complement')->nullable()->after('number');
            $table->string('district')->nullable()->after('complement');
            $table->string('city_code', 7)->nullable()->after('district');
            $table->string('zip_code', 8)->nullable()->after('city_code');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn(['street', 'number', 'complement', 'district', 'city_code', 'zip_code']);
        });
    }
};
