<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'company_id')) {
                $table->foreignId('company_id')->nullable()->after('customer_id')->constrained('companies')->nullOnDelete();
            }

            if (!Schema::hasColumn('sales', 'requested_document_model')) {
                $table->string('requested_document_model', 2)->default('65')->after('payment_method');
            }

            if (!Schema::hasColumn('sales', 'fiscal_decision')) {
                $table->string('fiscal_decision', 20)->nullable()->after('status');
            }

            if (!Schema::hasColumn('sales', 'recipient_payload')) {
                $table->json('recipient_payload')->nullable()->after('notes');
            }
        });

        Schema::table('sale_items', function (Blueprint $table) {
            if (!Schema::hasColumn('sale_items', 'discount_amount')) {
                $table->decimal('discount_amount', 10, 2)->default(0)->after('unit_price');
            }

            if (!Schema::hasColumn('sale_items', 'discount_percent')) {
                $table->decimal('discount_percent', 8, 4)->nullable()->after('discount_amount');
            }

            if (!Schema::hasColumn('sale_items', 'discount_authorized_by')) {
                $table->foreignId('discount_authorized_by')->nullable()->after('discount_percent')->constrained('users')->nullOnDelete();
            }

            if (!Schema::hasColumn('sale_items', 'discount_authorization_scope')) {
                $table->string('discount_authorization_scope', 20)->nullable()->after('discount_authorized_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'company_id')) {
                $table->dropConstrainedForeignId('company_id');
            }

            $columns = array_values(array_filter([
                Schema::hasColumn('sales', 'requested_document_model') ? 'requested_document_model' : null,
                Schema::hasColumn('sales', 'fiscal_decision') ? 'fiscal_decision' : null,
                Schema::hasColumn('sales', 'recipient_payload') ? 'recipient_payload' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });

        Schema::table('sale_items', function (Blueprint $table) {
            if (Schema::hasColumn('sale_items', 'discount_authorized_by')) {
                $table->dropConstrainedForeignId('discount_authorized_by');
            }

            $columns = array_values(array_filter([
                Schema::hasColumn('sale_items', 'discount_amount') ? 'discount_amount' : null,
                Schema::hasColumn('sale_items', 'discount_percent') ? 'discount_percent' : null,
                Schema::hasColumn('sale_items', 'discount_authorization_scope') ? 'discount_authorization_scope' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
