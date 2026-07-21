<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tax_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->boolean('active')->default(true);
            $table->string('regime', 20)->nullable();
            $table->string('ncm_pattern', 8)->nullable();
            $table->string('cfop', 4)->nullable();
            $table->string('uf_origem', 2)->nullable();
            $table->string('uf_destino', 2)->nullable();
            $table->string('origin_code', 1)->nullable();
            $table->string('csosn', 3)->nullable();
            $table->string('cst_icms', 3)->nullable();
            $table->decimal('icms_rate', 5, 2)->nullable();
            $table->decimal('st_mva', 6, 2)->nullable();
            $table->decimal('st_fcp', 5, 2)->nullable();
            $table->string('pis_cst', 2)->nullable();
            $table->decimal('pis_rate', 6, 4)->nullable();
            $table->string('cofins_cst', 2)->nullable();
            $table->decimal('cofins_rate', 6, 4)->nullable();
            $table->string('ibs_cbs_cst', 3)->nullable();
            $table->string('c_class_trib', 6)->nullable();
            $table->unsignedInteger('priority')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['active', 'ncm_pattern']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_rules');
    }
};
