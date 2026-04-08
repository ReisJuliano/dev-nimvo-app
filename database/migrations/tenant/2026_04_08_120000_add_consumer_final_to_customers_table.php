<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'consumer_final')) {
                $table->boolean('consumer_final')->default(true)->after('zip_code');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('customers', 'consumer_final')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('consumer_final');
        });
    }
};
