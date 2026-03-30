<?php

namespace Database\Seeders;

use App\Models\Central\AdminUser;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class CentralAdminSeeder extends Seeder
{
    public function run(): void
    {
        if (!Schema::hasTable('central_admins')) {
            return;
        }

        AdminUser::query()->firstOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Administrador Central',
                'password' => Hash::make('123456'),
                'active' => true,
            ],
        );
    }
}
