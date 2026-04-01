<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_profiles', function (Blueprint $table) {
            $table->id();
            $table->boolean('active')->default(true);
            $table->unsignedTinyInteger('environment')->default(2);
            $table->string('invoice_model', 2)->default('65');
            $table->string('operation_nature')->default('VENDA NFC-E');
            $table->unsignedSmallInteger('series')->default(1);
            $table->unsignedBigInteger('next_number')->default(1);
            $table->string('company_name');
            $table->string('trade_name')->nullable();
            $table->string('cnpj', 14);
            $table->string('ie');
            $table->string('im')->nullable();
            $table->string('cnae')->nullable();
            $table->string('crt', 1)->default('1');
            $table->string('phone')->nullable();
            $table->string('street');
            $table->string('number');
            $table->string('complement')->nullable();
            $table->string('district');
            $table->string('city_code', 7);
            $table->string('city_name');
            $table->string('state', 2);
            $table->string('zip_code', 8);
            $table->string('csc_id')->nullable();
            $table->text('csc_token')->nullable();
            $table->string('technical_contact_name')->nullable();
            $table->string('technical_contact_email')->nullable();
            $table->string('technical_contact_phone')->nullable();
            $table->string('technical_contact_cnpj', 14)->nullable();
            $table->timestamps();
        });

        Schema::create('fiscal_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->foreignId('profile_id')->nullable()->constrained('fiscal_profiles')->nullOnDelete();
            $table->string('type', 20)->default('nfce');
            $table->string('status', 30)->default('queued');
            $table->string('idempotency_key')->unique();
            $table->unsignedTinyInteger('environment')->default(2);
            $table->unsignedSmallInteger('series');
            $table->unsignedBigInteger('number');
            $table->string('access_key', 44)->nullable()->unique();
            $table->string('agent_key')->nullable();
            $table->uuid('agent_command_id')->nullable();
            $table->json('payload');
            $table->longText('request_xml')->nullable();
            $table->longText('signed_xml')->nullable();
            $table->longText('authorized_xml')->nullable();
            $table->string('sefaz_receipt')->nullable();
            $table->string('sefaz_protocol')->nullable();
            $table->string('sefaz_status_code')->nullable();
            $table->string('sefaz_status_reason')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('processing_started_at')->nullable();
            $table->timestamp('authorized_at')->nullable();
            $table->timestamp('printed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            $table->unique(['sale_id', 'type']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('fiscal_document_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fiscal_document_id')->constrained('fiscal_documents')->cascadeOnDelete();
            $table->string('status', 30);
            $table->string('source', 30)->default('backend');
            $table->string('message');
            $table->json('payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_document_events');
        Schema::dropIfExists('fiscal_documents');
        Schema::dropIfExists('fiscal_profiles');
    }
};
