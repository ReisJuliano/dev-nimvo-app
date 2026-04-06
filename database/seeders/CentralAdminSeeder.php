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

        $username = trim((string) env('CENTRAL_ADMIN_USERNAME', 'admin')) ?: 'admin';
        $password = (string) env('CENTRAL_ADMIN_PASSWORD', '123456');
        $name = trim((string) env('CENTRAL_ADMIN_NAME', 'Administrador Central')) ?: 'Administrador Central';

        AdminUser::query()->firstOrCreate(
            ['username' => $username],
            [
                'name' => $name,
                'password' => Hash::make($password),
                'active' => true,
            ],
        );
    }
}
