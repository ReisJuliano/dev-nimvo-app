<?php

namespace Tests\Unit;

use App\Services\Tenant\TenantSettingsService;
use PHPUnit\Framework\TestCase;

class TenantSettingsServiceTest extends TestCase
{
    public function test_service_preset_enables_expected_modules_and_capabilities(): void
    {
        $service = new TenantSettingsService();
        $preset = collect($service->businessPresets())->firstWhere('key', TenantSettingsService::SERVICE_PRESET);

        $this->assertNotNull($preset);
        $this->assertTrue($preset['modules']['comandas']);
        $this->assertTrue($preset['modules']['pdv_avancado']);
        $this->assertTrue($preset['modules']['mesas']);
        $this->assertTrue($preset['modules']['delivery']);

        $capabilities = $service->moduleCapabilities($preset['modules']);

        $this->assertTrue($capabilities['pdv']);
        $this->assertTrue($capabilities['pedidos']);
        $this->assertTrue($capabilities['caixa']);
        $this->assertFalse($capabilities['prazo']);
        $this->assertFalse($capabilities['crediario']);
    }

    public function test_direct_sales_preset_enables_expected_modules(): void
    {
        $service = new TenantSettingsService();
        $preset = collect($service->businessPresets())->firstWhere('key', TenantSettingsService::DIRECT_SALES_PRESET);

        $this->assertNotNull($preset);
        $this->assertTrue($preset['modules']['pdv_simples']);
        $this->assertFalse($preset['modules']['pdv_avancado']);
        $this->assertTrue($preset['modules']['estoque']);
        $this->assertTrue($preset['modules']['prazo']);
        $this->assertTrue($preset['modules']['controle_validade']);
        $this->assertFalse($preset['modules']['comandas']);
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
        $this->assertFalse($merged['modules']['prazo']);
        $this->assertTrue($merged['modules']['estoque']);
        $this->assertFalse($merged['modules']['fornecedores']);
    }

    public function test_normalize_modules_maps_legacy_aliases(): void
    {
        $service = new TenantSettingsService();
        $normalizeModules = \Closure::bind(
            fn (array $modules) => $this->normalizeModules($modules),
            $service,
            TenantSettingsService::class,
        );

        $normalized = $normalizeModules([
            'pdv_restaurante' => true,
            'fiado' => false,
            'comandas' => false,
            'mesas' => true,
        ]);

        $this->assertTrue($normalized['pdv_avancado']);
        $this->assertFalse($normalized['prazo']);
        $this->assertFalse($normalized['comandas']);
        $this->assertFalse($normalized['mesas']);
    }

    public function test_normalize_preset_maps_legacy_keys(): void
    {
        $service = new TenantSettingsService();
        $normalizePreset = \Closure::bind(
            fn (?string $preset) => $this->normalizePreset($preset),
            $service,
            TenantSettingsService::class,
        );

        $this->assertSame(TenantSettingsService::SERVICE_PRESET, $normalizePreset('restaurante'));
        $this->assertSame(TenantSettingsService::DIRECT_SALES_PRESET, $normalizePreset('mercearia'));
    }
}
