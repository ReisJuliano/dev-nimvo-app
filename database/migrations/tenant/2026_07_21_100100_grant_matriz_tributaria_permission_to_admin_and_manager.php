<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('permission_groups') || ! Schema::hasTable('permission_group_grants')) {
            return;
        }

        $groupIds = DB::table('permission_groups')
            ->whereIn('base_role', ['admin', 'manager'])
            ->pluck('id');

        foreach ($groupIds as $groupId) {
            $exists = DB::table('permission_group_grants')
                ->where('permission_group_id', $groupId)
                ->where('permission_key', 'fiscal.matriz_tributaria')
                ->exists();

            if (! $exists) {
                DB::table('permission_group_grants')->insert([
                    'permission_group_id' => $groupId,
                    'permission_key' => 'fiscal.matriz_tributaria',
                    'created_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('permission_group_grants')) {
            return;
        }

        DB::table('permission_group_grants')
            ->where('permission_key', 'fiscal.matriz_tributaria')
            ->delete();
    }
};
