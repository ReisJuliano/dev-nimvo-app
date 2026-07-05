<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Till;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class TillService
{
    public function activeTills(): Collection
    {
        return Till::query()->where('active', true)->orderBy('name')->get();
    }

    public function resolveForOpening(?int $requestedTillId): Till
    {
        if ($requestedTillId) {
            return Till::query()->where('active', true)->findOrFail($requestedTillId);
        }

        $active = $this->activeTills();

        if ($active->count() === 1) {
            return $active->first();
        }

        throw ValidationException::withMessages([
            'till_id' => 'Selecione qual caixa (terminal) deseja abrir.',
        ]);
    }
}
