<?php

namespace Tests\Feature;

use App\Models\Tenant as TenantModel;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalDocumentEvent;
use App\Models\Tenant\FiscalNumberInutilization;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use App\Services\Tenant\Fiscal\AccountantExportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;
use ZipArchive;

class AccountantExportServiceTest extends TestCase
{
    use RefreshDatabase;

    protected TenantModel $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate', [
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
        ])->run();

        $this->withoutMiddleware([
            InitializeTenancyByDomain::class,
            PreventAccessFromCentralDomains::class,
        ]);

        $this->tenant = TenantModel::query()->create([
            'id' => 'tenant-accountant-export',
            'name' => 'Loja Contador',
            'email' => 'contador-export@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_it_builds_a_zip_with_authorized_cancelled_and_summary_csv(): void
    {
        Storage::fake('local');

        $user = User::query()->create([
            'name' => 'Dono',
            'username' => 'dono_export',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);

        $cashRegister = CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $product = Product::query()->create([
            'code' => 'PROD-EXPORT',
            'barcode' => '7891234500055',
            'name' => 'Produto Export',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $authorizedSale = Sale::query()->create([
            'sale_number' => 'VND-EXPORT-0001',
            'user_id' => $user->id,
            'cash_register_id' => $cashRegister->id,
            'subtotal' => 20,
            'discount' => 0,
            'total' => 20,
            'cost_total' => 10,
            'profit' => 10,
            'payment_method' => 'cash',
            'status' => 'finalized',
        ]);

        $authorizedSale->items()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_cost' => 10,
            'unit_price' => 20,
            'total' => 20,
            'profit' => 10,
        ]);

        $authorizedSale->payments()->create(['payment_method' => 'cash', 'amount' => 20]);

        $authorizedAt = now()->startOfMonth()->addDays(2);

        FiscalDocument::query()->create([
            'sale_id' => $authorizedSale->id,
            'type' => 'nfce',
            'status' => 'authorized',
            'idempotency_key' => 'sale:'.$authorizedSale->id.':nfce',
            'environment' => 2,
            'series' => 1,
            'number' => 10,
            'access_key' => '35260412345678000123650010000000010000000010',
            'payload' => ['sale' => ['total' => 20], 'consumer' => ['name' => 'Cliente Autorizado']],
            'authorized_xml' => '<nfeProc>authorized-1</nfeProc>',
            'authorized_at' => $authorizedAt,
        ]);

        $cancelledDocument = FiscalDocument::query()->create([
            'type' => 'nfce',
            'status' => 'cancelled',
            'idempotency_key' => 'sale:cancelled:nfce',
            'environment' => 2,
            'series' => 1,
            'number' => 11,
            'access_key' => '35260412345678000123650010000000011000000011',
            'payload' => ['sale' => ['total' => 15], 'consumer' => ['name' => 'Cliente Cancelado']],
            'authorized_xml' => '<nfeProc>authorized-2</nfeProc>',
            'cancelled_xml' => '<nfeProcEvento>cancelled-2</nfeProcEvento>',
            'cancelled_at' => now()->startOfMonth()->addDays(3),
        ]);

        // Documento fora do período: não deve entrar no zip.
        FiscalDocument::query()->create([
            'type' => 'nfce',
            'status' => 'authorized',
            'idempotency_key' => 'sale:outside:nfce',
            'environment' => 2,
            'series' => 1,
            'number' => 99,
            'access_key' => '35260412345678000123650010000000099000000099',
            'payload' => ['sale' => ['total' => 999]],
            'authorized_xml' => '<nfeProc>outside</nfeProc>',
            'authorized_at' => now()->startOfMonth()->subMonth(),
        ]);

        FiscalNumberInutilization::query()->create([
            'status' => 'processed',
            'environment' => 2,
            'document_model' => '65',
            'series' => 1,
            'number_start' => 200,
            'number_end' => 205,
            'justification' => 'Numeracao pulada por falha de impressora.',
            'request_xml' => '<inutNFe>request</inutNFe>',
            'response_xml' => '<retInutNFe>response</retInutNFe>',
            'processed_at' => now()->startOfMonth()->addDays(4),
        ]);

        $correctionDocument = FiscalDocument::query()->create([
            'type' => 'nfe',
            'status' => 'authorized',
            'idempotency_key' => 'sale:correction:nfe',
            'environment' => 2,
            'series' => 1,
            'number' => 12,
            'access_key' => '35260412345678000123550010000000012000000012',
            'payload' => ['flags' => ['document_model' => '55']],
            'authorized_xml' => '<nfeProc>authorized-3</nfeProc>',
            'authorized_at' => now()->startOfMonth()->addDays(1),
        ]);

        FiscalDocumentEvent::query()->create([
            'fiscal_document_id' => $correctionDocument->id,
            'status' => 'correction_registered',
            'source' => 'agent',
            'message' => 'Carta de correção registrada na SEFAZ.',
            'payload' => ['sequence' => 1, 'text' => 'Correção de endereço.'],
            'created_at' => now()->startOfMonth()->addDays(5),
        ]);

        Storage::disk('local')->put(
            sprintf('fiscal-documents/%s/sales/%s/document-%s/correction-1-request.xml', $this->tenant->id, '', $correctionDocument->id),
            '<envEvento>correction-request</envEvento>',
        );
        Storage::disk('local')->put(
            sprintf('fiscal-documents/%s/sales/%s/document-%s/correction-1-response.xml', $this->tenant->id, '', $correctionDocument->id),
            '<retEnvEvento>correction-response</retEnvEvento>',
        );

        $service = app(AccountantExportService::class);
        $zipPath = $service->buildZip((int) $authorizedAt->format('Y'), (int) $authorizedAt->format('n'));

        Storage::disk('local')->assertExists($zipPath);

        $zip = new ZipArchive();
        $zip->open(Storage::disk('local')->path($zipPath));

        $this->assertNotFalse($zip->locateName('Autorizadas/35260412345678000123650010000000010000000010.xml'));
        $this->assertNotFalse($zip->locateName('Canceladas/35260412345678000123650010000000011000000011.xml'));
        $this->assertNotFalse($zip->locateName(sprintf('Inutilizacoes/inutilizacao-%d-pedido.xml', FiscalNumberInutilization::query()->first()->id)));
        $this->assertNotFalse($zip->locateName(sprintf('Eventos/carta-correcao-documento-%d-seq-1-pedido.xml', $correctionDocument->id)));
        $this->assertNotFalse($zip->locateName('resumo.csv'));
        $this->assertNotFalse($zip->locateName('fechamento.pdf'));
        $this->assertFalse($zip->locateName('Autorizadas/35260412345678000123650010000000099000000099.xml'));

        $summary = $zip->getFromName('resumo.csv');
        $this->assertStringContainsString('Cliente Autorizado', $summary);
        $this->assertStringContainsString('Cliente Cancelado', $summary);
        $this->assertStringNotContainsString('999', $summary);

        $zip->close();
    }
}
