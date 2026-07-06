<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->string('payment_method', 20);
            $table->foreignId('cash_register_id')->nullable()->constrained('cash_registers')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('notes')->nullable();
            $table->timestamp('received_at');
            $table->timestamps();

            $table->index(['customer_id', 'received_at']);
        });

        Schema::table('delivery_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('delivery_orders', 'payment_collected_at')) {
                $table->timestamp('payment_collected_at')->nullable()->after('delivered_at');
            }

            if (!Schema::hasColumn('delivery_orders', 'payment_method')) {
                $table->string('payment_method', 20)->nullable()->after('payment_collected_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('delivery_orders', function (Blueprint $table) {
            if (Schema::hasColumn('delivery_orders', 'payment_method')) {
                $table->dropColumn('payment_method');
            }

            if (Schema::hasColumn('delivery_orders', 'payment_collected_at')) {
                $table->dropColumn('payment_collected_at');
            }
        });

        Schema::dropIfExists('credit_payments');
    }
};
