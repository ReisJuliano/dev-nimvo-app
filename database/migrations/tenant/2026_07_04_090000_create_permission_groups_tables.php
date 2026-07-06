<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('permission_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('base_role')->nullable();
            $table->timestamps();
        });

        Schema::create('permission_group_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('permission_group_id')->constrained('permission_groups')->cascadeOnDelete();
            $table->string('permission_key');
            $table->timestamp('created_at')->nullable();

            $table->unique(['permission_group_id', 'permission_key'], 'permission_group_grants_group_key_unique');
        });

        Schema::create('user_permission_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('permission_key');
            $table->boolean('granted');
            $table->timestamps();

            $table->unique(['user_id', 'permission_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_permission_overrides');
        Schema::dropIfExists('permission_group_grants');
        Schema::dropIfExists('permission_groups');
    }
};
