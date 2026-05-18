<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->nullable()->constrained('purchases')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('code')->unique();
            $table->string('description');
            $table->string('category')->default('supplier');
            $table->string('status')->default('open');
            $table->string('payment_method')->nullable();
            $table->decimal('amount', 10, 2)->default(0);
            $table->decimal('amount_paid', 10, 2)->default(0);
            $table->date('due_date')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('barcode')->nullable();
            $table->string('installment_label')->nullable();
            $table->unsignedInteger('installment_number')->nullable();
            $table->unsignedInteger('installment_total')->nullable();
            $table->string('recurrence')->default('once');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['status', 'due_date']);
            $table->index(['supplier_id', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payables');
    }
};
