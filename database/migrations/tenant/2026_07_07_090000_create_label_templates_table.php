<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('label_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->boolean('show_name')->default(true);
            $table->boolean('show_price')->default(true);
            $table->boolean('show_promo')->default(false);
            $table->string('barcode_mode')->default('auto');
            $table->decimal('label_width_mm', 6, 2)->default(66.7);
            $table->decimal('label_height_mm', 6, 2)->default(25.4);
            $table->unsignedTinyInteger('columns')->default(3);
            $table->unsignedTinyInteger('rows')->default(9);
            $table->decimal('margin_left_mm', 6, 2)->default(4.5);
            $table->decimal('margin_top_mm', 6, 2)->default(13.5);
            $table->decimal('gap_x_mm', 6, 2)->default(3);
            $table->decimal('gap_y_mm', 6, 2)->default(0);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        $now = now();

        DB::table('label_templates')->insert([
            [
                'name' => 'Gôndola padrão',
                'show_name' => true,
                'show_price' => true,
                'show_promo' => false,
                'barcode_mode' => 'auto',
                'label_width_mm' => 66.7,
                'label_height_mm' => 25.4,
                'columns' => 3,
                'rows' => 9,
                'margin_left_mm' => 4.5,
                'margin_top_mm' => 13.5,
                'gap_x_mm' => 3,
                'gap_y_mm' => 0,
                'is_default' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Gôndola de oferta (De/Por)',
                'show_name' => true,
                'show_price' => true,
                'show_promo' => true,
                'barcode_mode' => 'auto',
                'label_width_mm' => 66.7,
                'label_height_mm' => 25.4,
                'columns' => 3,
                'rows' => 9,
                'margin_left_mm' => 4.5,
                'margin_top_mm' => 13.5,
                'gap_x_mm' => 3,
                'gap_y_mm' => 0,
                'is_default' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Adesiva com EAN-13',
                'show_name' => true,
                'show_price' => true,
                'show_promo' => false,
                'barcode_mode' => 'ean13',
                'label_width_mm' => 66.7,
                'label_height_mm' => 25.4,
                'columns' => 3,
                'rows' => 9,
                'margin_left_mm' => 4.5,
                'margin_top_mm' => 13.5,
                'gap_x_mm' => 3,
                'gap_y_mm' => 0,
                'is_default' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Adesiva com código interno (Code-128)',
                'show_name' => true,
                'show_price' => true,
                'show_promo' => false,
                'barcode_mode' => 'code128',
                'label_width_mm' => 66.7,
                'label_height_mm' => 25.4,
                'columns' => 3,
                'rows' => 9,
                'margin_left_mm' => 4.5,
                'margin_top_mm' => 13.5,
                'gap_x_mm' => 3,
                'gap_y_mm' => 0,
                'is_default' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('label_templates');
    }
};
