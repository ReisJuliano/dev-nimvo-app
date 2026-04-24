<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incoming_nfe_documents', function (Blueprint $table) {
            $table->string('document_model', 2)->nullable()->after('environment');
            $table->string('fiscal_status', 40)->default('pending_review')->after('status');
            $table->string('sefaz_status_code', 10)->nullable()->after('fiscal_status');
            $table->string('sefaz_status_reason')->nullable()->after('sefaz_status_code');
            $table->string('sefaz_protocol', 30)->nullable()->after('sefaz_status_reason');
            $table->timestamp('sefaz_verified_at')->nullable()->after('last_synced_at');
            $table->string('signature_status', 40)->default('pending')->after('sefaz_protocol');
            $table->string('signature_subject')->nullable()->after('signature_status');
            $table->timestamp('signature_checked_at')->nullable()->after('signature_subject');
            $table->string('authenticity_status', 40)->default('pending')->after('signature_checked_at');
            $table->string('bookkeeping_status', 40)->default('pending')->after('authenticity_status');
            $table->string('physical_receipt_status', 40)->default('pending')->after('bookkeeping_status');
            $table->timestamp('physical_received_at')->nullable()->after('physical_receipt_status');
            $table->timestamp('last_manifested_at')->nullable()->after('physical_received_at');
            $table->timestamp('last_audited_at')->nullable()->after('last_manifested_at');
            $table->json('fiscal_snapshot')->nullable()->after('validation_snapshot');
            $table->json('match_snapshot')->nullable()->after('fiscal_snapshot');
            $table->json('bookkeeping_snapshot')->nullable()->after('match_snapshot');
        });

        Schema::table('incoming_nfe_items', function (Blueprint $table) {
            $table->string('purchase_order_reference')->nullable()->after('description');
            $table->unsignedInteger('purchase_order_item')->nullable()->after('purchase_order_reference');
            $table->string('cest', 7)->nullable()->after('ncm');
            $table->string('origin_code', 1)->nullable()->after('cfop');
            $table->string('icms_cst_csosn', 4)->nullable()->after('origin_code');
            $table->decimal('icms_base', 12, 2)->nullable()->after('icms_cst_csosn');
            $table->decimal('icms_rate', 8, 4)->nullable()->after('icms_base');
            $table->decimal('icms_amount', 12, 2)->nullable()->after('icms_rate');
            $table->decimal('icms_st_base', 12, 2)->nullable()->after('icms_amount');
            $table->decimal('icms_st_rate', 8, 4)->nullable()->after('icms_st_base');
            $table->decimal('icms_st_amount', 12, 2)->nullable()->after('icms_st_rate');
            $table->decimal('icms_mva_rate', 8, 4)->nullable()->after('icms_st_amount');
            $table->decimal('difal_amount', 12, 2)->nullable()->after('icms_mva_rate');
            $table->decimal('fcp_st_amount', 12, 2)->nullable()->after('difal_amount');
            $table->string('ipi_cst', 3)->nullable()->after('fcp_st_amount');
            $table->decimal('ipi_base', 12, 2)->nullable()->after('ipi_cst');
            $table->decimal('ipi_rate', 8, 4)->nullable()->after('ipi_base');
            $table->decimal('ipi_amount', 12, 2)->nullable()->after('ipi_rate');
            $table->string('pis_cst', 3)->nullable()->after('ipi_amount');
            $table->decimal('pis_base', 12, 2)->nullable()->after('pis_cst');
            $table->decimal('pis_rate', 8, 4)->nullable()->after('pis_base');
            $table->decimal('pis_amount', 12, 2)->nullable()->after('pis_rate');
            $table->string('cofins_cst', 3)->nullable()->after('pis_amount');
            $table->decimal('cofins_base', 12, 2)->nullable()->after('cofins_cst');
            $table->decimal('cofins_rate', 8, 4)->nullable()->after('cofins_base');
            $table->decimal('cofins_amount', 12, 2)->nullable()->after('cofins_rate');
            $table->json('fiscal_snapshot')->nullable()->after('validation_warnings');
        });

        Schema::create('incoming_nfe_manifestations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('incoming_nfe_documents')->cascadeOnDelete();
            $table->string('event_type', 40);
            $table->string('status', 30)->default('pending');
            $table->string('sefaz_status_code', 10)->nullable();
            $table->string('sefaz_status_reason')->nullable();
            $table->text('justification')->nullable();
            $table->longText('request_xml')->nullable();
            $table->longText('response_xml')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('manifested_at')->nullable();
            $table->timestamps();

            $table->index(['document_id', 'event_type']);
        });

        Schema::create('incoming_nfe_book_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('incoming_nfe_documents')->cascadeOnDelete();
            $table->string('entry_type', 40);
            $table->string('status', 30)->default('ready');
            $table->string('period_reference', 7)->nullable();
            $table->string('reference_code', 40)->nullable();
            $table->json('payload');
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('transmitted_at')->nullable();
            $table->timestamps();

            $table->index(['document_id', 'entry_type']);
        });

        Schema::create('incoming_nfe_tax_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('incoming_nfe_documents')->cascadeOnDelete();
            $table->foreignId('incoming_nfe_item_id')->nullable()->constrained('incoming_nfe_items')->nullOnDelete();
            $table->string('tax_type', 20);
            $table->string('status', 30)->default('suggested');
            $table->boolean('recoverable')->default(false);
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('basis', 12, 2)->nullable();
            $table->decimal('rate', 8, 4)->nullable();
            $table->string('regime', 20)->nullable();
            $table->string('description')->nullable();
            $table->string('appropriation_reference')->nullable();
            $table->date('available_at')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['document_id', 'tax_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incoming_nfe_tax_credits');
        Schema::dropIfExists('incoming_nfe_book_entries');
        Schema::dropIfExists('incoming_nfe_manifestations');

        Schema::table('incoming_nfe_items', function (Blueprint $table) {
            $table->dropColumn([
                'purchase_order_reference',
                'purchase_order_item',
                'cest',
                'origin_code',
                'icms_cst_csosn',
                'icms_base',
                'icms_rate',
                'icms_amount',
                'icms_st_base',
                'icms_st_rate',
                'icms_st_amount',
                'icms_mva_rate',
                'difal_amount',
                'fcp_st_amount',
                'ipi_cst',
                'ipi_base',
                'ipi_rate',
                'ipi_amount',
                'pis_cst',
                'pis_base',
                'pis_rate',
                'pis_amount',
                'cofins_cst',
                'cofins_base',
                'cofins_rate',
                'cofins_amount',
                'fiscal_snapshot',
            ]);
        });

        Schema::table('incoming_nfe_documents', function (Blueprint $table) {
            $table->dropColumn([
                'document_model',
                'fiscal_status',
                'sefaz_status_code',
                'sefaz_status_reason',
                'sefaz_protocol',
                'sefaz_verified_at',
                'signature_status',
                'signature_subject',
                'signature_checked_at',
                'authenticity_status',
                'bookkeeping_status',
                'physical_receipt_status',
                'physical_received_at',
                'last_manifested_at',
                'last_audited_at',
                'fiscal_snapshot',
                'match_snapshot',
                'bookkeeping_snapshot',
            ]);
        });
    }
};
