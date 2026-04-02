<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('trade_name')->nullable();
            $table->string('document', 30)->nullable()->index();
            $table->string('document_type', 10)->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('state_registration', 30)->nullable();
            $table->string('street')->nullable();
            $table->string('number', 30)->nullable();
            $table->string('complement')->nullable();
            $table->string('district')->nullable();
            $table->string('city_name')->nullable();
            $table->string('city_code', 7)->nullable();
            $table->string('state', 2)->nullable();
            $table->string('zip_code', 8)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
