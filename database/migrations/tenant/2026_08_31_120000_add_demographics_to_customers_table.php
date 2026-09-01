<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'birth_date')) {
                $table->date('birth_date')->nullable()->after('email');
            }

            if (! Schema::hasColumn('customers', 'gender')) {
                $table->string('gender', 30)->nullable()->after('birth_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $columns = array_values(array_filter([
                Schema::hasColumn('customers', 'gender') ? 'gender' : null,
                Schema::hasColumn('customers', 'birth_date') ? 'birth_date' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
