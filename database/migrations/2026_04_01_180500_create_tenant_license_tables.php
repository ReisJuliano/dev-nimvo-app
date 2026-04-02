<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('tenant_licenses')) {
            Schema::create('tenant_licenses', function (Blueprint $table) {
                $table->id();
                $table->string('tenant_id')->unique();
                $table->date('starts_at');
                $table->unsignedInteger('cycle_days')->default(30);
                $table->unsignedInteger('grace_days')->default(10);
                $table->decimal('amount', 10, 2)->nullable();
                $table->string('status')->default('active');
                $table->timestamp('last_blocked_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')
                    ->references('id')
                    ->on('tenants')
                    ->cascadeOnUpdate()
                    ->cascadeOnDelete();
            });
        }

        if (!Schema::hasTable('tenant_license_invoices')) {
            Schema::create('tenant_license_invoices', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_license_id')->constrained('tenant_licenses')->cascadeOnDelete();
                $table->string('reference')->unique();
                $table->date('period_start');
                $table->date('period_end');
                $table->date('due_date');
                $table->decimal('amount', 10, 2);
                $table->string('status')->default('pending');
                $table->string('payment_method', 20)->nullable();
                $table->string('gateway_driver')->nullable();
                $table->string('gateway_reference')->nullable();
                $table->text('boleto_url')->nullable();
                $table->json('pix_payload')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(['tenant_license_id', 'period_start']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_license_invoices');
        Schema::dropIfExists('tenant_licenses');
    }
};
