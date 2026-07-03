<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('sale_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('sale_payments', 'payment_details')) {
                $table->json('payment_details')->nullable()->after('amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sale_payments', function (Blueprint $table) {
            if (Schema::hasColumn('sale_payments', 'payment_details')) {
                $table->dropColumn('payment_details');
            }
        });
    }
};
