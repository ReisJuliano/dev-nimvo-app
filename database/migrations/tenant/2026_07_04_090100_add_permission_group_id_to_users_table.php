<?php

use App\Support\Tenant\PermissionRegistry;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('permission_group_id')->nullable()->after('role')
                ->constrained('permission_groups')->nullOnDelete();
        });

        $groupIdsByBaseRole = [];

        foreach ([
            ['name' => 'Dono', 'base_role' => 'admin'],
            ['name' => 'Gerente', 'base_role' => 'manager'],
            ['name' => 'Operador', 'base_role' => 'operator'],
        ] as $defaultGroup) {
            $groupId = DB::table('permission_groups')->where('base_role', $defaultGroup['base_role'])->value('id');

            if (! $groupId) {
                $groupId = DB::table('permission_groups')->insertGetId([
                    'name' => $defaultGroup['name'],
                    'base_role' => $defaultGroup['base_role'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $grants = collect(PermissionRegistry::defaultGrantsForBaseRole($defaultGroup['base_role']))
                    ->map(fn (string $key) => [
                        'permission_group_id' => $groupId,
                        'permission_key' => $key,
                        'created_at' => now(),
                    ])
                    ->all();

                if ($grants !== []) {
                    DB::table('permission_group_grants')->insert($grants);
                }
            }

            $groupIdsByBaseRole[$defaultGroup['base_role']] = $groupId;
        }

        foreach ($groupIdsByBaseRole as $baseRole => $groupId) {
            DB::table('users')
                ->where('role', $baseRole)
                ->whereNull('permission_group_id')
                ->update(['permission_group_id' => $groupId]);
        }

        DB::table('users')
            ->whereNull('permission_group_id')
            ->update(['permission_group_id' => $groupIdsByBaseRole['operator']]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('permission_group_id');
        });
    }
};
