<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            if (!Schema::hasColumn('promotions', 'weekdays')) {
                $table->json('weekdays')->nullable()->after('end_at');
            }

            if (!Schema::hasColumn('promotions', 'config')) {
                $table->json('config')->nullable()->after('discount_value');
            }
        });

        Schema::table('sale_items', function (Blueprint $table) {
            if (!Schema::hasColumn('sale_items', 'promotion_id')) {
                $table->foreignId('promotion_id')->nullable()->after('discount_authorization_scope')
                    ->constrained('promotions')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            if (Schema::hasColumn('sale_items', 'promotion_id')) {
                $table->dropConstrainedForeignId('promotion_id');
            }
        });

        Schema::table('promotions', function (Blueprint $table) {
            if (Schema::hasColumn('promotions', 'config')) {
                $table->dropColumn('config');
            }

            if (Schema::hasColumn('promotions', 'weekdays')) {
                $table->dropColumn('weekdays');
            }
        });
    }
};
