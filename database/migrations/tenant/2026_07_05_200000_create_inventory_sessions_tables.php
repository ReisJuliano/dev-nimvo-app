<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_collector_layouts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('direction', 10);
            $table->string('format', 20);
            $table->json('config');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('inventory_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('type', 10)->default('general');
            $table->string('mode', 10)->default('snapshot');
            $table->string('count_resolution', 20)->default('manual_review');
            $table->string('status', 15)->default('draft');
            $table->json('filters')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('counting_finished_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('status');
        });

        Schema::create('inventory_session_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_session_id')->constrained('inventory_sessions')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('snapshot_quantity', 12, 3)->default(0);
            $table->decimal('counted_quantity', 12, 3)->nullable();
            $table->decimal('interim_delta', 12, 3)->default(0);
            $table->decimal('final_delta', 12, 3)->nullable();
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->string('status', 15)->default('pending');
            $table->string('resolution', 20)->nullable();
            $table->string('resolution_reason')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['inventory_session_id', 'product_id']);
            $table->index(['inventory_session_id', 'status']);
        });

        Schema::create('inventory_import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_session_id')->constrained('inventory_sessions')->cascadeOnDelete();
            $table->string('filename');
            $table->foreignId('layout_id')->nullable()->constrained('inventory_collector_layouts')->nullOnDelete();
            $table->unsignedTinyInteger('count_round')->default(1);
            $table->unsignedInteger('total_lines')->default(0);
            $table->unsignedInteger('matched_lines')->default(0);
            $table->unsignedInteger('unmatched_lines')->default(0);
            $table->unsignedInteger('duplicate_lines')->default(0);
            $table->json('unmatched_payload')->nullable();
            $table->string('status', 20)->default('processed');
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('inventory_counts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_session_item_id')->constrained('inventory_session_items')->cascadeOnDelete();
            $table->unsignedTinyInteger('count_round')->default(1);
            $table->decimal('quantity', 12, 3);
            $table->string('source', 20)->default('manual');
            $table->foreignId('import_batch_id')->nullable()->constrained('inventory_import_batches')->nullOnDelete();
            $table->foreignId('counted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('counted_at');
            $table->timestamps();

            $table->index(['inventory_session_item_id', 'count_round']);
        });

        $this->seedDefaultLayouts();
    }

    protected function seedDefaultLayouts(): void
    {
        $now = now();

        DB::table('inventory_collector_layouts')->insert([
            [
                'name' => 'Carga simples (delimitado)',
                'direction' => 'export',
                'format' => 'delimited',
                'config' => json_encode([
                    'encoding' => 'ISO-8859-1',
                    'line_ending' => 'CRLF',
                    'has_header' => false,
                    'delimiter' => ';',
                    'decimal_separator' => ',',
                    'fields' => [
                        ['name' => 'barcode', 'position' => 1],
                        ['name' => 'description', 'position' => 2],
                        ['name' => 'quantity', 'position' => 3],
                    ],
                ]),
                'is_default' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Carga posicional',
                'direction' => 'export',
                'format' => 'fixed_width',
                'config' => json_encode([
                    'encoding' => 'ISO-8859-1',
                    'line_ending' => 'CRLF',
                    'fields' => [
                        ['name' => 'barcode', 'start' => 1, 'length' => 14],
                        ['name' => 'description', 'start' => 15, 'length' => 40],
                        ['name' => 'quantity', 'start' => 55, 'length' => 11, 'decimals' => 3],
                    ],
                ]),
                'is_default' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Contagem delimitada',
                'direction' => 'import',
                'format' => 'delimited',
                'config' => json_encode([
                    'encoding' => 'UTF-8',
                    'line_ending' => 'CRLF',
                    'has_header' => false,
                    'delimiter' => ';',
                    'decimal_separator' => ',',
                    'fields' => [
                        ['name' => 'barcode', 'position' => 1],
                        ['name' => 'quantity', 'position' => 2],
                    ],
                ]),
                'is_default' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Contagem posicional',
                'direction' => 'import',
                'format' => 'fixed_width',
                'config' => json_encode([
                    'encoding' => 'UTF-8',
                    'line_ending' => 'CRLF',
                    'fields' => [
                        ['name' => 'barcode', 'start' => 1, 'length' => 14],
                        ['name' => 'quantity', 'start' => 15, 'length' => 10, 'implied_decimals' => 3],
                    ],
                ]),
                'is_default' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_counts');
        Schema::dropIfExists('inventory_import_batches');
        Schema::dropIfExists('inventory_session_items');
        Schema::dropIfExists('inventory_sessions');
        Schema::dropIfExists('inventory_collector_layouts');
    }
};
