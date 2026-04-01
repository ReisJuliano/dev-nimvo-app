<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection($this->connection)->create('local_agents', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->index();
            $table->string('name');
            $table->string('agent_key')->unique();
            $table->string('secret_hash');
            $table->boolean('active')->default(true);
            $table->string('last_ip')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::connection($this->connection)->create('local_agent_commands', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('local_agent_id')->constrained('local_agents')->cascadeOnDelete();
            $table->string('tenant_id')->index();
            $table->unsignedBigInteger('fiscal_document_id')->nullable();
            $table->string('type', 30);
            $table->string('status', 30)->default('pending');
            $table->longText('payload');
            $table->longText('result_payload')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('available_at')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['local_agent_id', 'status', 'available_at']);
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('local_agent_commands');
        Schema::connection($this->connection)->dropIfExists('local_agents');
    }
};
