<?php

namespace App\Services\Tenant;

use App\Models\Tenant\AppSetting;
use Illuminate\Support\Facades\Schema;

class FashionModuleSettingsService
{
    public function catalogDefaults(): array
    {
        return [
            'title' => 'Catalogo online',
            'subtitle' => 'Colecoes e produtos publicados para vitrine digital.',
            'featured_collection' => '',
            'show_prices' => true,
        ];
    }

    public function whatsappDefaults(): array
    {
        return [
            'phone' => '',
            'greeting' => 'Oi! Quero fechar este pedido.',
            'checkout_template' => "Pedido: {{items}}\nTotal: {{total}}\nCliente: {{customer}}",
            'business_hours' => 'Seg a Sab 09:00 as 18:00',
        ];
    }

    public function getCatalog(): array
    {
        return $this->getSetting('fashion.catalog', $this->catalogDefaults());
    }

    public function updateCatalog(array $payload): array
    {
        return $this->updateSetting('fashion.catalog', $this->catalogDefaults(), $payload);
    }

    public function getWhatsApp(): array
    {
        return $this->getSetting('fashion.whatsapp', $this->whatsappDefaults());
    }

    public function updateWhatsApp(array $payload): array
    {
        return $this->updateSetting('fashion.whatsapp', $this->whatsappDefaults(), $payload);
    }

    protected function getSetting(string $key, array $defaults): array
    {
        if (!$this->settingsTableExists()) {
            return $defaults;
        }

        $payload = AppSetting::query()->where('key', $key)->value('payload');

        return array_replace($defaults, is_array($payload) ? $payload : []);
    }

    protected function updateSetting(string $key, array $defaults, array $payload): array
    {
        $nextPayload = array_replace($defaults, $payload);

        if (!$this->settingsTableExists()) {
            return $nextPayload;
        }

        AppSetting::query()->updateOrCreate(
            ['key' => $key],
            ['payload' => $nextPayload],
        );

        return $nextPayload;
    }

    protected function settingsTableExists(): bool
    {
        return Schema::connection((new AppSetting())->getConnectionName())->hasTable('app_settings');
    }
}
