<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('kitchen_ticket_items', function (Blueprint $table) {
            $table->timestamp('done_at')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('kitchen_ticket_items', function (Blueprint $table) {
            $table->dropColumn('done_at');
        });
    }
};

