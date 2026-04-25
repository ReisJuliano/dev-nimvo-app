<?php

namespace Tests\Feature;

use App\Models\Tenant as TenantModel;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\IncomingNfeBookEntry;
use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\IncomingNfeTaxCredit;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\Purchases\IncomingNfeSefazGateway;
use App\Services\Tenant\Purchases\IncomingNfeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class IncomingNfePurchasesTest extends TestCase
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
            'id' => 'tenant-incoming-nfe',
            'name' => 'Loja Entrada Fiscal',
            'email' => 'entrada@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_importing_incoming_nfe_xml_creates_document_and_matches_existing_product(): void
    {
        $this->makeFiscalProfile();
        $product = $this->makeProduct([
            'code' => 'PRD-001',
            'name' => 'Produto teste NF-e',
            'cost_price' => 9,
            'ncm' => '22030000',
            'cfop' => '1102',
        ]);

        $service = app(IncomingNfeService::class);

        $document = $service->importXml($this->sampleXml());
        $serialized = $service->serializeDocument($document);

        $this->assertSame('ready', $serialized['status']);
        $this->assertSame(1, $serialized['validation']['matched_items']);
        $this->assertSame(0, $serialized['validation']['pending_items']);
        $this->assertSame($product->id, $serialized['items'][0]['product_id']);
        $this->assertSame('code', $serialized['items'][0]['match_type']);
        $this->assertSame(1, $serialized['validation']['price_changes']);
        $this->assertSame('authorized', $serialized['fiscal_status']);
        $this->assertSame('55', $serialized['document_model']);
        $this->assertSame(9.0, $serialized['items'][0]['icms_amount']);
        $this->assertSame(2.0, $serialized['items'][0]['ipi_amount']);
        $this->assertCount(4, $serialized['bookkeeping']['entries']);
        $this->assertSame(4, count($serialized['tax_credits']));
        $this->assertDatabaseHas('incoming_nfe_documents', [
            'access_key' => '35260499888777000166550010000015231000015236',
        ]);
        $this->assertSame(4, IncomingNfeBookEntry::query()->count());
        $this->assertSame(4, IncomingNfeTaxCredit::query()->count());
    }

    public function test_quick_create_supplier_links_document_by_cnpj(): void
    {
        $this->makeFiscalProfile();
        $service = app(IncomingNfeService::class);

        $document = $service->importXml($this->sampleXml());
        $linked = $service->quickCreateSupplier($document);

        $this->assertNotNull($linked->supplier_id);
        $this->assertDatabaseHas('suppliers', [
            'id' => $linked->supplier_id,
            'document' => '11222333000144',
            'name' => 'Fornecedor XYZ LTDA',
        ]);
    }

    public function test_confirming_incoming_nfe_creates_purchase_updates_stock_and_cost(): void
    {
        $this->makeFiscalProfile();
        $user = $this->makeUser();
        $product = $this->makeProduct([
            'code' => 'PRD-001',
            'name' => 'Produto teste NF-e',
            'stock_quantity' => 2,
            'cost_price' => 9,
            'ncm' => '22030000',
            'cfop' => '1102',
        ]);

        $service = app(IncomingNfeService::class);
        $document = $service->importXml($this->sampleXml());
        $confirmed = $service->confirm($document, ['cost_method' => 'last_cost'], $user->id);

        $this->assertSame('processed', $confirmed->fresh()->status);
        $this->assertNotNull($confirmed->purchase_id);
        $this->assertSame(7.0, (float) $product->fresh()->stock_quantity);
        $this->assertSame(11.4, (float) $product->fresh()->cost_price);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'purchase',
        ]);
        $this->assertSame(1, InventoryMovement::query()->count());
    }

    public function test_confirm_can_auto_create_missing_products(): void
    {
        $this->makeFiscalProfile();
        $user = $this->makeUser();
        $service = app(IncomingNfeService::class);

        $document = $service->importXml($this->sampleXml([
            'supplierCode' => 'NEW-100',
            'description' => 'Produto sem cadastro',
        ]));

        $this->assertSame('pending_products', $document->status);

        $confirmed = $service->confirm($document, [
            'cost_method' => 'last_cost',
            'auto_create_missing' => true,
        ], $user->id);

        $createdProduct = Product::query()->where('name', 'Produto sem cadastro')->first();

        $this->assertNotNull($createdProduct);
        $this->assertSame('processed', $confirmed->fresh()->status);
        $this->assertSame(5.0, (float) $createdProduct->fresh()->stock_quantity);
        $this->assertSame('22030000', $createdProduct->ncm);
        $this->assertSame('1102', $createdProduct->cfop);
    }

    public function test_linking_purchase_and_confirming_preserves_fiscal_audit_and_updates_receipt(): void
    {
        $this->makeFiscalProfile();
        $user = $this->makeUser();
        $supplier = Supplier::query()->create([
            'name' => 'Fornecedor XYZ LTDA',
            'document' => '11222333000144',
            'document_type' => 'cnpj',
            'active' => true,
        ]);
        $product = $this->makeProduct([
            'code' => 'PRD-001',
            'name' => 'Produto teste NF-e',
            'stock_quantity' => 1,
            'cost_price' => 8.5,
            'ncm' => '22030000',
            'cfop' => '1102',
            'supplier_id' => $supplier->id,
        ]);
        $purchase = Purchase::query()->create([
            'supplier_id' => $supplier->id,
            'user_id' => $user->id,
            'code' => 'CMP-TESTE-001',
            'status' => 'ordered',
            'expected_at' => '2026-04-02',
            'subtotal' => 50,
            'freight' => 5,
            'total' => 57,
        ]);
        $purchase->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 5,
            'unit_cost' => 10,
            'total' => 50,
        ]);

        $service = app(IncomingNfeService::class);
        $document = $service->importXml($this->sampleXml());
        $document = $service->updateMappings($document, [
            'supplier_id' => $supplier->id,
            'purchase_id' => $purchase->id,
        ]);
        $confirmed = $service->confirm($document, [
            'purchase_id' => $purchase->id,
            'received_at' => '2026-04-02 11:00:00',
        ], $user->id);
        $serialized = $service->serializeDocument($confirmed->fresh());

        $this->assertSame($purchase->id, $confirmed->purchase_id);
        $this->assertSame('confirmed', $serialized['physical_receipt_status']);
        $this->assertSame('review_required', $serialized['bookkeeping_status']);
        $this->assertSame('matched', data_get($serialized, 'matching.three_way_match.status'));
        $this->assertSame(6.0, (float) $product->fresh()->stock_quantity);
        $this->assertSame(11.4, (float) $product->fresh()->cost_price);
        $this->assertNotEmpty(data_get($confirmed->fresh()->metadata, 'linked_purchase_before_receipt'));
    }

    public function test_validate_with_sefaz_and_manifestation_are_registered(): void
    {
        $this->makeFiscalProfile();
        $service = app(IncomingNfeService::class);
        $document = $service->quickCreateSupplier($service->importXml($this->sampleXml()));

        $this->mock(IncomingNfeSefazGateway::class, function (MockInterface $mock): void {
            $mock->shouldReceive('consultAccessKey')
                ->once()
                ->andReturn([
                    'status_code' => '100',
                    'reason' => 'Autorizado o uso da NF-e',
                    'protocol' => '135260000000001',
                    'access_key' => '35260499888777000166550010000015231000015236',
                    'received_at' => '2026-04-02T10:05:00-03:00',
                ]);

            $mock->shouldReceive('manifest')
                ->once()
                ->andReturn([
                    'status_code' => '135',
                    'reason' => 'Evento registrado e vinculado a NF-e',
                    'protocol' => '135260000000099',
                    'registered_at' => '2026-04-02T11:00:00-03:00',
                    'sequence' => '1',
                    'request_xml' => '<xml/>',
                    'response_xml' => '<xml/>',
                ]);
        });

        $validated = app(IncomingNfeService::class)->validateWithSefaz($document);
        $manifested = app(IncomingNfeService::class)->manifest($validated, [
            'event' => 'science',
        ]);

        $this->assertSame('verified', $manifested->fresh()->authenticity_status);
        $this->assertSame('science', $manifested->fresh()->manifest_status);
        $this->assertDatabaseHas('incoming_nfe_manifestations', [
            'document_id' => $document->id,
            'event_type' => 'science',
            'sefaz_status_code' => '135',
        ]);
    }

    protected function makeFiscalProfile(): FiscalProfile
    {
        return FiscalProfile::query()->create([
            'active' => true,
            'environment' => 2,
            'invoice_model' => '55',
            'operation_nature' => 'COMPRA DE MERCADORIA',
            'series' => 1,
            'next_number' => 1,
            'company_name' => 'Loja Teste LTDA',
            'trade_name' => 'Loja Teste',
            'cnpj' => '99888777000166',
            'ie' => '123456789',
            'crt' => '1',
            'street' => 'Rua A',
            'number' => '100',
            'district' => 'Centro',
            'city_code' => '3550308',
            'city_name' => 'Sao Paulo',
            'state' => 'SP',
            'zip_code' => '01001000',
        ]);
    }

    protected function makeUser(): User
    {
        return User::query()->create([
            'name' => 'Operador Teste',
            'username' => 'operador_'.str()->random(6),
            'password' => bcrypt('secret'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);
    }

    protected function makeProduct(array $attributes = []): Product
    {
        return Product::query()->create(array_merge([
            'code' => 'PRD-'.str()->random(6),
            'barcode' => null,
            'ncm' => null,
            'cfop' => null,
            'cest' => null,
            'origin_code' => '0',
            'icms_csosn' => '102',
            'pis_cst' => '49',
            'cofins_cst' => '49',
            'fiscal_enabled' => true,
            'name' => 'Produto teste',
            'description' => null,
            'category_id' => null,
            'supplier_id' => null,
            'unit' => 'UN',
            'commercial_unit' => 'UN',
            'taxable_unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 0,
            'min_stock' => 0,
            'active' => true,
        ], $attributes));
    }

    protected function sampleXml(array $overrides = []): string
    {
        $accessKey = $overrides['access_key'] ?? '35260499888777000166550010000015231000015236';
        $supplierCode = $overrides['supplierCode'] ?? 'PRD-001';
        $description = $overrides['description'] ?? 'Produto teste NF-e';

        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe{$accessKey}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <tpAmb>2</tpAmb>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>1523</nNF>
        <dhEmi>2026-04-02T10:00:00-03:00</dhEmi>
        <natOp>COMPRA DE MERCADORIA</natOp>
      </ide>
      <emit>
        <CNPJ>11222333000144</CNPJ>
        <xNome>Fornecedor XYZ LTDA</xNome>
        <xFant>Fornecedor XYZ</xFant>
        <IE>123456789</IE>
        <enderEmit>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
        </enderEmit>
      </emit>
      <dest>
        <CNPJ>99888777000166</CNPJ>
        <xNome>Loja Teste LTDA</xNome>
        <enderDest>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
        </enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>{$supplierCode}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>{$description}</xProd>
          <NCM>22030000</NCM>
          <CFOP>1102</CFOP>
          <uCom>UN</uCom>
          <qCom>5.000</qCom>
          <vUnCom>10.00</vUnCom>
          <vProd>50.00</vProd>
          <xPed>PO-123</xPed>
          <nItemPed>1</nItemPed>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <vBC>50.00</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>9.00</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <IPITrib>
              <CST>50</CST>
              <vBC>50.00</vBC>
              <pIPI>4.00</pIPI>
              <vIPI>2.00</vIPI>
            </IPITrib>
          </IPI>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vBC>50.00</vBC>
              <pPIS>1.65</pPIS>
              <vPIS>0.83</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vBC>50.00</vBC>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>3.80</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>50.00</vBC>
          <vICMS>9.00</vICMS>
          <vProd>50.00</vProd>
          <vFrete>5.00</vFrete>
          <vIPI>2.00</vIPI>
          <vPIS>0.83</vPIS>
          <vCOFINS>3.80</vCOFINS>
          <vNF>57.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>{$accessKey}</chNFe>
      <nProt>135260000000001</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
      <dhRecbto>2026-04-02T10:05:00-03:00</dhRecbto>
    </infProt>
  </protNFe>
</nfeProc>
XML;
    }
}
