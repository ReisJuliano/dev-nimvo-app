<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('cash_registers', function (Blueprint $table) {
            $table->foreignId('till_id')->nullable()->after('user_id')
                ->constrained('tills')->nullOnDelete();
        });

        $defaultTillId = DB::table('tills')->where('name', 'Caixa principal')->value('id');

        if (! $defaultTillId) {
            $defaultTillId = DB::table('tills')->insertGetId([
                'name' => 'Caixa principal',
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('cash_registers')->whereNull('till_id')->update(['till_id' => $defaultTillId]);
    }

    public function down(): void
    {
        Schema::table('cash_registers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('till_id');
        });
    }
};
