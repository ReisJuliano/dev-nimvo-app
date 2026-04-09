<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_number_inutilizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->nullable()->constrained('fiscal_profiles')->nullOnDelete();
            $table->string('status', 30)->default('queued');
            $table->unsignedTinyInteger('environment');
            $table->string('document_model', 2);
            $table->unsignedSmallInteger('series');
            $table->unsignedInteger('number_start');
            $table->unsignedInteger('number_end');
            $table->string('justification', 255);
            $table->unsignedBigInteger('requested_by_user_id')->nullable();
            $table->string('agent_key')->nullable();
            $table->string('agent_command_id')->nullable();
            $table->longText('request_xml')->nullable();
            $table->longText('response_xml')->nullable();
            $table->string('protocol')->nullable();
            $table->string('sefaz_status_code')->nullable();
            $table->string('sefaz_status_reason')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('processing_started_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            $table->index(['document_model', 'series', 'status'], 'fiscal_number_inutilizations_model_series_status_idx');
            $table->unique(
                ['environment', 'document_model', 'series', 'number_start', 'number_end'],
                'fiscal_number_inutilizations_unique_range'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_number_inutilizations');
    }
};
