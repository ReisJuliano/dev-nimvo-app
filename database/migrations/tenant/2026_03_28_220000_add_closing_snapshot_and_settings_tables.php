<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('cash_registers', function (Blueprint $table) {
            $table->json('closing_breakdown')->nullable()->after('closing_notes');
            $table->json('closing_snapshot')->nullable()->after('closing_breakdown');
        });

        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');

        Schema::table('cash_registers', function (Blueprint $table) {
            $table->dropColumn(['closing_breakdown', 'closing_snapshot']);
        });
    }
};
