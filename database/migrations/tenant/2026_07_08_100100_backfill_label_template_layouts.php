<?php

use App\Models\Tenant\LabelTemplate;
use App\Support\Labels\LegacyLabelLayoutSynthesizer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $synthesizer = new LegacyLabelLayoutSynthesizer();

        DB::table('label_templates')->whereNull('layout')->get()->each(function ($row) use ($synthesizer) {
            $template = new LabelTemplate((array) $row);

            DB::table('label_templates')->where('id', $row->id)->update([
                'layout' => json_encode($synthesizer->fromTemplate($template)),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        // Não reverte: layout sintetizado é reconstruível a qualquer momento a partir das colunas legadas.
    }
};
