<?php

namespace Tests\Unit;

use App\Services\Tenant\TenantSettingsService;
use PHPUnit\Framework\TestCase;

class TenantSettingsServiceTest extends TestCase
{
    public function test_restaurant_preset_enables_expected_modules_and_capabilities(): void
    {
        $service = new TenantSettingsService();
        $restaurantPreset = collect($service->businessPresets())->firstWhere('key', 'restaurante');

        $this->assertNotNull($restaurantPreset);
        $this->assertTrue($restaurantPreset['modules']['comandas']);
        $this->assertTrue($restaurantPreset['modules']['pdv_restaurante']);
        $this->assertTrue($restaurantPreset['modules']['mesas']);
        $this->assertTrue($restaurantPreset['modules']['fichas_tecnicas']);
        $this->assertTrue($restaurantPreset['modules']['cozinha']);
        $this->assertTrue($restaurantPreset['modules']['delivery']);
        $this->assertFalse($restaurantPreset['modules']['pesagem']);

        $capabilities = $service->moduleCapabilities($restaurantPreset['modules']);

        $this->assertTrue($capabilities['pdv']);
        $this->assertTrue($capabilities['pedidos']);
        $this->assertTrue($capabilities['caixa']);
        $this->assertTrue($capabilities['fichas_tecnicas']);
        $this->assertTrue($capabilities['cozinha']);
        $this->assertFalse($capabilities['crediario']);
    }

    public function test_clothing_store_preset_enables_variations_and_digital_modules(): void
    {
        $service = new TenantSettingsService();
        $clothingPreset = collect($service->businessPresets())->firstWhere('key', 'loja_roupas');

        $this->assertNotNull($clothingPreset);
        $this->assertTrue($clothingPreset['modules']['pdv_simples']);
        $this->assertTrue($clothingPreset['modules']['produtos_variacao']);
        $this->assertTrue($clothingPreset['modules']['trocas_devolucoes']);
        $this->assertTrue($clothingPreset['modules']['promocoes']);
        $this->assertTrue($clothingPreset['modules']['catalogo_online']);
        $this->assertTrue($clothingPreset['modules']['pedidos_online']);
        $this->assertTrue($clothingPreset['modules']['whatsapp_pedidos']);
        $this->assertFalse($clothingPreset['modules']['comandas']);

        $capabilities = $service->moduleCapabilities($clothingPreset['modules']);

        $this->assertTrue($capabilities['pdv']);
        $this->assertTrue($capabilities['trocas_devolucoes']);
        $this->assertTrue($capabilities['promocoes']);
        $this->assertTrue($capabilities['catalogo_online']);
        $this->assertTrue($capabilities['pedidos_online']);
        $this->assertTrue($capabilities['whatsapp_pedidos']);
        $this->assertFalse($capabilities['pedidos']);
    }

    public function test_merge_with_defaults_converts_legacy_settings_into_modular_flags(): void
    {
        $service = new TenantSettingsService();
        $mergeWithDefaults = \Closure::bind(
            fn (array $settings) => $this->mergeWithDefaults($settings),
            $service,
            TenantSettingsService::class,
        );

        $merged = $mergeWithDefaults([
            'cash_closing' => [
                'require_conference' => false,
            ],
            'modules' => [
                'pdv' => true,
                'pedidos' => false,
                'crediario' => false,
                'produtos' => true,
                'fornecedores' => false,
                'relatorios' => true,
            ],
        ]);

        $this->assertSame(TenantSettingsService::CUSTOM_PRESET, $merged['business']['preset']);
        $this->assertFalse($merged['cash_closing']['require_conference']);
        $this->assertTrue($merged['modules']['pdv_simples']);
        $this->assertFalse($merged['modules']['comandas']);
        $this->assertFalse($merged['modules']['mesas']);
        $this->assertFalse($merged['modules']['fiado']);
        $this->assertTrue($merged['modules']['estoque']);
        $this->assertFalse($merged['modules']['fornecedores']);
    }

    public function test_normalize_modules_turns_off_tables_when_comandas_are_disabled(): void
    {
        $service = new TenantSettingsService();
        $normalizeModules = \Closure::bind(
            fn (array $modules) => $this->normalizeModules($modules),
            $service,
            TenantSettingsService::class,
        );

        $normalized = $normalizeModules([
            'comandas' => false,
            'mesas' => true,
        ]);

        $this->assertFalse($normalized['comandas']);
        $this->assertFalse($normalized['mesas']);
    }
}
