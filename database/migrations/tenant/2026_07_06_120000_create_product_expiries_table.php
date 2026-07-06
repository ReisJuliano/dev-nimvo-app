<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'track_expiry')) {
                $table->boolean('track_expiry')->default(false)->after('label_printed_at');
            }

            if (!Schema::hasColumn('products', 'expiry_alert_days')) {
                $table->unsignedInteger('expiry_alert_days')->nullable()->after('track_expiry');
            }
        });

        Schema::create('product_expiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->date('expires_at');
            $table->decimal('quantity', 12, 3);
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['product_id', 'expires_at']);
            $table->index(['source_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_expiries');

        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'expiry_alert_days')) {
                $table->dropColumn('expiry_alert_days');
            }

            if (Schema::hasColumn('products', 'track_expiry')) {
                $table->dropColumn('track_expiry');
            }
        });
    }
};
