<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection($this->connection)->table('local_agents', function (Blueprint $table) {
            if (! Schema::connection($this->connection)->hasColumn('local_agents', 'label')) {
                $table->string('label')->nullable()->after('name');
            }
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('local_agents', function (Blueprint $table) {
            if (Schema::connection($this->connection)->hasColumn('local_agents', 'label')) {
                $table->dropColumn('label');
            }
        });
    }
};
