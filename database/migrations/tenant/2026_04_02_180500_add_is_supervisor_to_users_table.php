<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'is_supervisor')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_supervisor')->default(false)->after('role');
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('users', 'is_supervisor')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_supervisor');
        });
    }
};
