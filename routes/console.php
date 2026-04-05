<?php

use App\Models\Central\LocalAgent;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use App\Services\Central\LocalAgentBootstrapService;
use App\Services\Central\LocalFiscalAgentRunner;
use App\Services\Tenant\Fiscal\FiscalDocumentService;
use App\Services\Tenant\PosService;
use App\Support\LocalAgentReceiptPrinter;
use App\Support\Pkcs12CertificateReader;
use App\Support\SpedNfeNfceEmitter;
use App\Support\Tenant\TenantContext;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

$readCertificateSubject = function (?string $path, string $password): array {
    if (!$path || !file_exists($path)) {
        return [];
    }

    try {
        $inspection = app(Pkcs12CertificateReader::class)->inspect($path, $password);
    } catch (Throwable) {
        return [];
    }

    return array_merge(
        $inspection['subject'] ?? [],
        ['serialNumber' => $inspection['cnpj'] ?? null],
    );
};

$resolveOutputPath = function (string $path): string {
    if (preg_match('/^[A-Za-z]:\\\\/', $path) === 1 || str_starts_with($path, '\\\\')) {
        return $path;
    }

    return base_path($path);
};

$loadJsonFile = function (string $path): array {
    if (!file_exists($path)) {
        throw new RuntimeException("Arquivo nao encontrado: {$path}");
    }

    $content = file_get_contents($path);

    if ($content === false) {
        throw new RuntimeException("Nao foi possivel ler o arquivo: {$path}");
    }

    $decoded = json_decode($content, true);

    if (!is_array($decoded)) {
        throw new RuntimeException("JSON invalido em: {$path}");
    }

    return $decoded;
};

Artisan::command('fiscal:agent:create {tenantId} {name} {--backend-url=} {--cert-path=C:\\Users\\PC-RESERVA\\Downloads\\certificado-a1-homologacao.pfx} {--cert-password=123456} {--connector=windows} {--printer-name=POS-58} {--write-config=}', function (string $tenantId, string $name) use ($resolveOutputPath) {
    $pollInterval = (int) config('fiscal.agents.poll_interval_seconds', 3);
    $runtimePrinter = [
        'enabled' => true,
        'connector' => $this->option('connector'),
        'name' => $this->option('printer-name'),
        'host' => '127.0.0.1',
        'port' => 9100,
        'logo_path' => '',
    ];
    $agent = app(LocalAgentBootstrapService::class)->upsertForTenant($tenantId, [
        'name' => $name,
        'active' => true,
        'backend_url' => $this->option('backend-url') ?: config('app.url'),
        'runtime_config' => [
            'poll_interval_seconds' => $pollInterval,
            'printer' => $runtimePrinter,
        ],
    ]);
    $secret = app(LocalAgentBootstrapService::class)->secret($agent);

    $this->line('Agente local criado com sucesso.');
    $this->newLine();
    $this->line('Credenciais:');
    $this->line("agent_key: {$agent->agent_key}");
    $this->line("agent_secret: {$secret}");
    $this->newLine();
    $this->line('Config JSON base:');
    $config = [
        'backend' => [
            'base_url' => $this->option('backend-url') ?: config('app.url'),
            'timeout_seconds' => 30,
            'retry_times' => 3,
            'retry_sleep_ms' => 500,
        ],
        'agent' => [
            'key' => $agent->agent_key,
            'secret' => $secret,
            'poll_interval_seconds' => $pollInterval,
        ],
        'certificate' => [
            'path' => '',
            'password' => '',
        ],
        'printer' => $runtimePrinter,
    ];
    $this->line(json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    $writeConfig = trim((string) $this->option('write-config'));

    if ($writeConfig !== '') {
        $outputPath = $resolveOutputPath($writeConfig);
        File::ensureDirectoryExists(dirname($outputPath));
        File::put($outputPath, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $this->newLine();
        $this->info("Arquivo de configuracao salvo em: {$outputPath}");
    }
})->purpose('Cria um agente local fiscal para um tenant');

Artisan::command('fiscal:agent:run {config} {--once}', function (string $config) {
    $runner = app(LocalFiscalAgentRunner::class);

    return $runner->run($config, (bool) $this->option('once'), function (string $level, string $message) {
        if ($level === 'error') {
            $this->error($message);

            return;
        }

        $this->info($message);
    });
})->purpose('Executa o worker do agente local fiscal');

Artisan::command('fiscal:agent:process-payload {config} {payloadFile} {--local-test}', function (string $config, string $payloadFile) use ($resolveOutputPath, $loadJsonFile) {
    $configPath = $resolveOutputPath($config);
    $payloadPath = $resolveOutputPath($payloadFile);
    $agentConfig = $loadJsonFile($configPath);
    $payload = $loadJsonFile($payloadPath);
    $emitter = app(SpedNfeNfceEmitter::class);

    $result = $this->option('local-test')
        ? $emitter->emitLocalTest($payload, $agentConfig)
        : $emitter->emit($payload, $agentConfig);

    $this->line(json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
})->purpose('Processa um payload fiscal usando a configuracao do agente local');

Artisan::command('fiscal:agent:print-test {config} {--store-name=Nimvo} {--message=}', function (string $config) use ($resolveOutputPath, $loadJsonFile) {
    $configPath = $resolveOutputPath($config);
    $agentConfig = $loadJsonFile($configPath);

    app(LocalAgentReceiptPrinter::class)->printTest(
        (array) ($agentConfig['printer'] ?? []),
        [
            'store_name' => (string) $this->option('store-name'),
            'message' => (string) $this->option('message'),
            'issued_at' => now()->toIso8601String(),
        ],
    );

    $this->line(json_encode([
        'status' => 'printed',
        'type' => 'test',
        'printed_at' => now()->toIso8601String(),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
})->purpose('Imprime um cupom de teste usando a configuracao local do agente');

Artisan::command('fiscal:agent:print-payment {config} {payloadFile}', function (string $config, string $payloadFile) use ($resolveOutputPath, $loadJsonFile) {
    $configPath = $resolveOutputPath($config);
    $payloadPath = $resolveOutputPath($payloadFile);
    $agentConfig = $loadJsonFile($configPath);
    $payload = $loadJsonFile($payloadPath);

    app(LocalAgentReceiptPrinter::class)->printPaymentReceipt(
        $payload,
        (array) ($agentConfig['printer'] ?? []),
    );

    $this->line(json_encode([
        'status' => 'printed',
        'type' => 'payment_receipt',
        'printed_at' => now()->toIso8601String(),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
})->purpose('Imprime um comprovante termico via agente local a partir de um JSON');

Artisan::command('fiscal:profile:sample {tenantId} {--cert-path=} {--cert-password=123456} {--cnpj=} {--ie=123456789} {--company-name=Empresa Homologacao LTDA} {--trade-name=Empresa Homologacao} {--state=SP} {--city-code=3550308} {--city-name=Sao Paulo} {--zip-code=01001000} {--street=Rua de Homologacao} {--number=100} {--district=Centro} {--csc-id=} {--csc-token=}', function (string $tenantId) use ($readCertificateSubject) {
    $subject = $readCertificateSubject(
        $this->option('cert-path') ?: null,
        (string) $this->option('cert-password'),
    );

    $cnpj = preg_replace('/\D+/', '', (string) ($this->option('cnpj') ?: ($subject['serialNumber'] ?? '12345678000199')));

    app(TenantContext::class)->run($tenantId, function () use ($cnpj) {
        FiscalProfile::query()->updateOrCreate(
            ['invoice_model' => '65'],
            [
                'active' => true,
                'environment' => 2,
                'operation_nature' => 'VENDA NFC-E',
                'series' => 1,
                'next_number' => 1,
                'company_name' => $this->option('company-name'),
                'trade_name' => $this->option('trade-name'),
                'cnpj' => $cnpj,
                'ie' => $this->option('ie'),
                'im' => null,
                'cnae' => '4781400',
                'crt' => '1',
                'phone' => '11999999999',
                'street' => $this->option('street'),
                'number' => $this->option('number'),
                'complement' => null,
                'district' => $this->option('district'),
                'city_code' => $this->option('city-code'),
                'city_name' => $this->option('city-name'),
                'state' => $this->option('state'),
                'zip_code' => $this->option('zip-code'),
                'csc_id' => $this->option('csc-id') ?: null,
                'csc_token' => $this->option('csc-token') ?: null,
            ],
        );
    });

    $this->info('Perfil fiscal de exemplo criado ou atualizado no tenant.');
    $this->line("CNPJ configurado: {$cnpj}");
    if (!$this->option('csc-id') || !$this->option('csc-token')) {
        $this->warn('CSC ID e CSC Token ainda nao foram informados. Sem esses dados a NFC-e nao deve ser emitida na SEFAZ.');
    }
})->purpose('Cria um perfil fiscal base para homologacao');

Artisan::command('fiscal:sale:homologation {tenantId} {--price=9.90} {--user-id=} {--issue}', function (string $tenantId) {
    $sale = app(TenantContext::class)->run($tenantId, function () {
        $price = round((float) $this->option('price'), 2);
        $userId = $this->option('user-id');

        $user = User::query()
            ->when($userId, fn ($query) => $query->whereKey((int) $userId))
            ->where('active', true)
            ->orderBy('id')
            ->first();

        if (!$user) {
            throw new RuntimeException('Nenhum usuario ativo foi encontrado para criar a venda de homologacao.');
        }

        $cashRegister = CashRegister::query()
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        if (!$cashRegister) {
            CashRegister::query()->create([
                'user_id' => $user->id,
                'status' => 'open',
                'opening_amount' => 0,
                'opened_at' => now(),
            ]);
        }

        $product = Product::query()->updateOrCreate(
            ['code' => 'HOMOLOG-NFCE'],
            [
                'barcode' => '7891234567895',
                'name' => 'Camiseta Homologacao NFC-e',
                'description' => 'Produto isolado para testes de emissao fiscal.',
                'unit' => 'UN',
                'cost_price' => round($price / 2, 2),
                'sale_price' => $price,
                'stock_quantity' => 999,
                'min_stock' => 0,
                'active' => true,
                'ncm' => '61091000',
                'cfop' => '5102',
                'cest' => null,
                'origin_code' => '0',
                'icms_csosn' => '102',
                'pis_cst' => '49',
                'cofins_cst' => '49',
            ],
        );

        return app(PosService::class)->finalize([
            'discount' => 0,
            'notes' => 'Venda criada automaticamente para homologacao NFC-e.',
            'items' => [
                [
                    'id' => $product->id,
                    'qty' => 1,
                    'discount' => 0,
                ],
            ],
            'payments' => [
                [
                    'method' => 'cash',
                    'amount' => $price,
                ],
            ],
        ], $user->id);
    });

    $this->info('Venda de homologacao criada com sucesso.');
    $this->line("sale_id: {$sale['sale_id']}");
    $this->line("sale_number: {$sale['sale_number']}");
    $this->line("total: {$sale['total']}");

    if ($this->option('issue')) {
        $document = app(TenantContext::class)->run($tenantId, function () use ($sale) {
            return app(FiscalDocumentService::class)->issueFromSale(
                (int) $sale['sale_id'],
            );
        });

        $this->line("document_id: {$document->id}");
        $this->line("document_status: {$document->status}");
    }
})->purpose('Cria uma venda isolada para homologacao NFC-e');

Artisan::command('fiscal:sale:local-test {tenantId} {saleId} {config} {--save-dir=storage/app/fiscal-local-tests} {--skip-print}', function (string $tenantId, int $saleId, string $config) use ($resolveOutputPath) {
    $configPath = $resolveOutputPath($config);
    $saveDir = rtrim($resolveOutputPath((string) $this->option('save-dir')), '\\/');
    $agentConfig = json_decode((string) file_get_contents($configPath), true);

    if (!is_array($agentConfig)) {
        throw new RuntimeException('Arquivo de configuracao do agente invalido para ensaio local.');
    }

    if ($this->option('skip-print')) {
        $agentConfig['printer']['enabled'] = false;
    }

    $payload = app(TenantContext::class)->run($tenantId, function () use ($saleId) {
        return app(FiscalDocumentService::class)->buildLocalTestPayload($saleId);
    });

    $result = app(SpedNfeNfceEmitter::class)->emitLocalTest($payload, $agentConfig);
    $targetDir = $saveDir.DIRECTORY_SEPARATOR.$tenantId.DIRECTORY_SEPARATOR.'sale-'.$saleId;

    File::ensureDirectoryExists($targetDir);
    File::put($targetDir.DIRECTORY_SEPARATOR.'payload.json', json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    File::put($targetDir.DIRECTORY_SEPARATOR.'request.xml', (string) $result['request_xml']);
    File::put($targetDir.DIRECTORY_SEPARATOR.'signed.xml', (string) $result['signed_xml']);
    File::put($targetDir.DIRECTORY_SEPARATOR.'result.json', json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

    $this->info('Ensaio local da NFC-e concluido.');
    $this->line("sale_id: {$saleId}");
    $this->line("access_key: ".($result['access_key'] ?? ''));
    $this->line("printed_at: ".($result['printed_at'] ?? 'nao impresso'));
    $this->line("artefatos: {$targetDir}");
})->purpose('Assina e imprime um ensaio local da NFC-e sem transmitir para a SEFAZ');

Artisan::command('fiscal:sale:issue {tenantId} {saleId} {--mode=auto}', function (string $tenantId, int $saleId) {
    $mode = (string) $this->option('mode');

    $document = app(TenantContext::class)->run($tenantId, function () use ($saleId, $mode) {
        return app(FiscalDocumentService::class)->issueFromSale(
            $saleId,
            null,
            $mode,
        );
    });

    $this->info('Documento fiscal criado para a venda.');
    $this->line("document_id: {$document->id}");
    $this->line("status: {$document->status}");
    $this->line("type: {$document->type}");
    $this->line("mode: ".data_get($document->payload, 'flags.mode'));
    $this->line("series: {$document->series}");
    $this->line("number: {$document->number}");
    $this->line('Agora execute o agente local para concluir a emissao e impressao.');
})->purpose('Cria um documento fiscal a partir de uma venda');

Artisan::command('fiscal:cert:inspect {path} {--password=123456}', function (string $path) {
    if (!file_exists($path)) {
        $this->error('Arquivo PFX nao encontrado.');

        return 1;
    }

    try {
        $inspection = app(Pkcs12CertificateReader::class)->inspect($path, (string) $this->option('password'));
    } catch (Throwable) {
        $this->error('Nao foi possivel abrir o PFX com a senha informada.');

        return 1;
    }

    $this->info('Certificado lido com sucesso.');
    $this->line('Requerente: '.json_encode($inspection['subject'] ?? [], JSON_UNESCAPED_SLASHES));
    $this->line('Empresa: '.($inspection['company_name'] ?? ''));
    $this->line('CNPJ: '.($inspection['cnpj'] ?? ''));
    $this->line('Valido de: '.($inspection['valid_from'] ?? ''));
    $this->line('Valido ate: '.($inspection['valid_to'] ?? ''));

    return 0;
})->purpose('Inspeciona um certificado PFX para homologacao');
