<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'discount_authorization_password')) {
                $table->string('discount_authorization_password')->nullable()->after('password');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('users', 'discount_authorization_password')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('discount_authorization_password');
        });
    }
};
