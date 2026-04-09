<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection($this->connection)->table('local_agent_commands', function (Blueprint $table) {
            $table->unsignedBigInteger('fiscal_number_inutilization_id')->nullable()->after('fiscal_document_id');
            $table->index(
                ['tenant_id', 'fiscal_number_inutilization_id'],
                'local_agent_commands_tenant_inutilization_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('local_agent_commands', function (Blueprint $table) {
            $table->dropIndex('local_agent_commands_tenant_inutilization_idx');
            $table->dropColumn('fiscal_number_inutilization_id');
        });
    }
};
