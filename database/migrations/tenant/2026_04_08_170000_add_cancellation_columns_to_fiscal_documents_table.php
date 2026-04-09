<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('fiscal_documents', 'cancellation_request_xml')) {
                $table->longText('cancellation_request_xml')->nullable()->after('authorized_xml');
            }

            if (! Schema::hasColumn('fiscal_documents', 'cancellation_response_xml')) {
                $table->longText('cancellation_response_xml')->nullable()->after('cancellation_request_xml');
            }

            if (! Schema::hasColumn('fiscal_documents', 'cancelled_xml')) {
                $table->longText('cancelled_xml')->nullable()->after('cancellation_response_xml');
            }

            if (! Schema::hasColumn('fiscal_documents', 'cancellation_protocol')) {
                $table->string('cancellation_protocol')->nullable()->after('sefaz_protocol');
            }

            if (! Schema::hasColumn('fiscal_documents', 'cancellation_reason')) {
                $table->string('cancellation_reason', 255)->nullable()->after('sefaz_status_reason');
            }

            if (! Schema::hasColumn('fiscal_documents', 'cancellation_requested_at')) {
                $table->timestamp('cancellation_requested_at')->nullable()->after('processing_started_at');
            }

            if (! Schema::hasColumn('fiscal_documents', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('printed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_documents', function (Blueprint $table) {
            $columns = array_values(array_filter([
                Schema::hasColumn('fiscal_documents', 'cancellation_request_xml') ? 'cancellation_request_xml' : null,
                Schema::hasColumn('fiscal_documents', 'cancellation_response_xml') ? 'cancellation_response_xml' : null,
                Schema::hasColumn('fiscal_documents', 'cancelled_xml') ? 'cancelled_xml' : null,
                Schema::hasColumn('fiscal_documents', 'cancellation_protocol') ? 'cancellation_protocol' : null,
                Schema::hasColumn('fiscal_documents', 'cancellation_reason') ? 'cancellation_reason' : null,
                Schema::hasColumn('fiscal_documents', 'cancellation_requested_at') ? 'cancellation_requested_at' : null,
                Schema::hasColumn('fiscal_documents', 'cancelled_at') ? 'cancelled_at' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
