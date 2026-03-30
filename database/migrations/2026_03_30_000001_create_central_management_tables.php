<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('central_admins')) {
            Schema::create('central_admins', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('username')->unique();
                $table->string('password');
                $table->boolean('active')->default(true);
                $table->rememberToken();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('tenants')) {
            Schema::create('tenants', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('name')->nullable();
                $table->string('email')->nullable();
                $table->timestamps();
                $table->json('data')->nullable();
            });
        } else {
            $this->ensureTenantColumns();
        }

        if (!Schema::hasTable('domains')) {
            Schema::create('domains', function (Blueprint $table) {
                $table->increments('id');
                $table->string('domain', 255)->unique();
                $table->string('tenant_id');
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            });
        }

        if (!Schema::hasTable('clients')) {
            Schema::create('clients', function (Blueprint $table) {
                $table->id();
                $table->string('tenant_id')->unique();
                $table->string('name');
                $table->string('email')->nullable();
                $table->string('document', 30)->nullable();
                $table->string('domain')->unique();
                $table->boolean('active')->default(true);
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            });
        }

        if (!Schema::hasTable('tenant_settings')) {
            Schema::create('tenant_settings', function (Blueprint $table) {
                $table->id();
                $table->string('tenant_id')->unique();
                $table->json('payload')->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_settings');
        Schema::dropIfExists('central_admins');
    }

    protected function ensureTenantColumns(): void
    {
        $columns = Schema::getColumnListing('tenants');

        Schema::table('tenants', function (Blueprint $table) use ($columns) {
            if (!in_array('name', $columns, true)) {
                $table->string('name')->nullable()->after('id');
            }

            if (!in_array('email', $columns, true)) {
                $table->string('email')->nullable()->after('name');
            }

            if (!in_array('created_at', $columns, true)) {
                $table->timestamp('created_at')->nullable();
            }

            if (!in_array('updated_at', $columns, true)) {
                $table->timestamp('updated_at')->nullable();
            }

            if (!in_array('data', $columns, true)) {
                $table->json('data')->nullable();
            }
        });
    }
};
