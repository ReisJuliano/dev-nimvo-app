<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'document')) {
                $table->string('document', 30)->nullable()->after('name')->index();
            }

            if (!Schema::hasColumn('customers', 'document_type')) {
                $table->string('document_type', 10)->nullable()->after('document');
            }

            if (!Schema::hasColumn('customers', 'email')) {
                $table->string('email')->nullable()->after('phone');
            }

            if (!Schema::hasColumn('customers', 'state_registration')) {
                $table->string('state_registration', 30)->nullable()->after('email');
            }

            if (!Schema::hasColumn('customers', 'street')) {
                $table->string('street')->nullable()->after('state_registration');
            }

            if (!Schema::hasColumn('customers', 'number')) {
                $table->string('number', 30)->nullable()->after('street');
            }

            if (!Schema::hasColumn('customers', 'complement')) {
                $table->string('complement')->nullable()->after('number');
            }

            if (!Schema::hasColumn('customers', 'district')) {
                $table->string('district')->nullable()->after('complement');
            }

            if (!Schema::hasColumn('customers', 'city_name')) {
                $table->string('city_name')->nullable()->after('district');
            }

            if (!Schema::hasColumn('customers', 'city_code')) {
                $table->string('city_code', 7)->nullable()->after('city_name');
            }

            if (!Schema::hasColumn('customers', 'state')) {
                $table->string('state', 2)->nullable()->after('city_code');
            }

            if (!Schema::hasColumn('customers', 'zip_code')) {
                $table->string('zip_code', 8)->nullable()->after('state');
            }
        });
    }

    public function down(): void
    {
        $columns = array_values(array_filter([
            Schema::hasColumn('customers', 'document') ? 'document' : null,
            Schema::hasColumn('customers', 'document_type') ? 'document_type' : null,
            Schema::hasColumn('customers', 'email') ? 'email' : null,
            Schema::hasColumn('customers', 'state_registration') ? 'state_registration' : null,
            Schema::hasColumn('customers', 'street') ? 'street' : null,
            Schema::hasColumn('customers', 'number') ? 'number' : null,
            Schema::hasColumn('customers', 'complement') ? 'complement' : null,
            Schema::hasColumn('customers', 'district') ? 'district' : null,
            Schema::hasColumn('customers', 'city_name') ? 'city_name' : null,
            Schema::hasColumn('customers', 'city_code') ? 'city_code' : null,
            Schema::hasColumn('customers', 'state') ? 'state' : null,
            Schema::hasColumn('customers', 'zip_code') ? 'zip_code' : null,
        ]));

        if ($columns === []) {
            return;
        }

        Schema::table('customers', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }
};
