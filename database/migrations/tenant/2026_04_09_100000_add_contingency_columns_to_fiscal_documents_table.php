<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table) {
            $table->text('contingency_reason')->nullable()->after('cancellation_reason');
            $table->timestamp('contingency_requested_at')->nullable()->after('cancellation_requested_at');
            $table->timestamp('contingency_released_at')->nullable()->after('contingency_requested_at');
            $table->unsignedInteger('contingency_attempts')->default(0)->after('contingency_released_at');
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table) {
            $table->dropColumn([
                'contingency_reason',
                'contingency_requested_at',
                'contingency_released_at',
                'contingency_attempts',
            ]);
        });
    }
};
