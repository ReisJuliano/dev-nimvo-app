<?php

namespace Tests\Feature;

use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\Purchases\IncomingNfeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IncomingNfePurchasesTest extends TestCase
{
    use RefreshDatabase;

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
        $this->assertDatabaseHas('incoming_nfe_documents', [
            'access_key' => '35260499888777000166550010000015231000015231',
        ]);
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
        $this->assertSame(10.0, (float) $product->fresh()->cost_price);
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
        $accessKey = $overrides['access_key'] ?? '35260499888777000166550010000015231000015231';
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
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vProd>50.00</vProd>
          <vFrete>5.00</vFrete>
          <vNF>55.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>{$accessKey}</chNFe>
      <dhRecbto>2026-04-02T10:05:00-03:00</dhRecbto>
    </infProt>
  </protNFe>
</nfeProc>
XML;
    }
}
