<?php

namespace Database\Seeders;

use App\Models\Tenant\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TenantDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->firstOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Administrador',
                'password' => Hash::make('123456'),
                'role' => 'admin',
                'active' => true,
                'must_change_password' => true,
            ],
        );
    }
}
