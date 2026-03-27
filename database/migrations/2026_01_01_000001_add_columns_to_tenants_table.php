<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (config('tenancy.dev_single_database')) {
            return;
        }

        Schema::table('tenants', function (Blueprint $table) {
            $table->string('name')->nullable()->after('id');
            $table->string('email')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        if (config('tenancy.dev_single_database')) {
            return;
        }

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['name', 'email']);
        });
    }
};
