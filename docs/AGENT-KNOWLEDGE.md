# Agent Knowledge

Arquivo vivo para contexto util que agentes devem manter atualizado. Adicione
somente fatos estaveis, decisoes tomadas, comandos validados e armadilhas reais.

## Visao do produto

Nimvo e um SaaS multi-tenant para operacao comercial. O painel central gerencia
clientes, tenants, licencas e agentes fiscais. Cada tenant acessa recursos como
PDV, caixa, produtos, comandas, pedidos, delivery, compras, contas a pagar,
relatorios, modulos operacionais e fiscal.

## Mapa rapido

- `routes/central.php`: rotas do painel central e API dos agentes locais.
- `routes/tenant.php`: rotas autenticadas e publicas do tenant.
- `bootstrap/app.php`: registro das rotas centrais por dominio e rotas tenant
  com middleware de tenancy.
- `config/tenancy.php`: dominios centrais, base de dominio tenant, modo
  single/multi database e parametros de migracao tenant.
- `app/Services/Central`: provisionamento, licencas, fiscal profile e agente
  local no contexto central.
- `app/Services/Tenant`: regras de negocio do tenant.
- `app/Services/Tenant/Fiscal`: emissao, contingencia, cancelamento,
  inutilizacao, consulta e armazenamento fiscal.
- `resources/js/Pages`: paginas Inertia/React.
- `resources/js/Components`: componentes compartilhados de UI e dominio.
- `nimvo_app/`: scaffold Flutter do app mobile gerencial para proprietarios e
  gerentes, consumindo `mobile-api/v1` no contexto tenant.
- `local-agent/go-agent`: agente local em Go.
- `local-agent/php-bridge`: bridge PHP usada pelo agente local.
- `scripts/post-pull-deploy.sh`: rotina de deploy no VPS.

## Tenancy

O ambiente local usa `TENANT_DEV_SINGLE_DATABASE=true` por padrao no
`.env.example`. Nesse modo, os dados de tenants ficam no mesmo banco, o que
simplifica desenvolvimento. Para producao ou testes de isolamento real, use
`TENANT_DEV_SINGLE_DATABASE=false` e rode tambem `php artisan tenants:migrate`.

Tenant novo nasce no preset interno `venda_direta`, exibido na UI como
`Balcao simples`/Nimvo Balcao. Esse preset deixa visiveis PDV simples, caixa,
produtos, estoque simples, fiado, clientes, fornecedores, validade e resumo;
comandas, delivery, compras com NF-e, fiscal avancado, relatorios avancados,
vendas online e moda ficam desligados por padrao.

## Credenciais padrao

O `.env.example` contem credenciais de desenvolvimento para facilitar setup
local. Antes de qualquer ambiente real, trocar:

- `APP_KEY`
- senha do banco
- `CENTRAL_ADMIN_PASSWORD`
- usuarios seedados com senha `123456`
- tokens CSC/certificados fiscais

## Fiscal e agente local

As rotas de agente local em `routes/central.php` dispensam CSRF e usam headers
`X-Agent-Key` e `X-Agent-Secret` autenticados por
`App\Http\Middleware\Central\AuthenticateLocalAgent`.

Os binarios do agente estao versionados em:

- `local-agent/bin/nimvo-fiscal-agent.exe`
- `local-agent/bin/nimvo-fiscal-bridge.zip`
- `local-agent/go-agent/nimvo-fiscal-agent.exe`

Se alterar o codigo Go ou o bridge PHP, verificar se os binarios precisam ser
regerados antes de publicar.

## Comandos validados

2026-06-12:

```bash
php artisan test --filter=LocalFiscalAgentRunnerTest
php artisan test --filter=OperationsOverviewServiceTest
B:\Tools\Node\node-v24.16.0-win-x64\npm.cmd run build
```

Resultado: os dois testes unitarios passam. O build frontend passa, mas emite
avisos de `lightningcss` para at-rules de Tailwind/HeroUI como `@theme`,
`@utility`, `@apply`, `@source` e `@custom-variant`.

`composer test` passa nos unitarios, mas as features ficam bloqueadas quando o
MariaDB local nao esta ativo em `127.0.0.1:3306` para o banco `nimvo_central`.

`go test ./...` nao foi executado nesta maquina porque `go.exe` nao foi
encontrado no PATH nem nos locais inspecionados.

2026-06-13:

```bash
php artisan route:list --name=mobile
php artisan test --filter=MobileApiConfigurationTest
php artisan test --filter=TenantRoutesMiddlewareTest
php artisan test --filter=TenantUserAuthenticationTest
```

Resultado: rotas mobile registradas e testes focados passaram.

Ainda em 2026-06-13, o Flutter SDK foi instalado em
`B:\Tools\Flutter\flutter`, o Android SDK em `B:\Tools\Android\sdk` e o JDK 17
via Microsoft OpenJDK. O projeto `nimvo_app/` foi materializado com
`flutter create . --org br.com.nimvo --platforms android,ios`. Validacoes
executadas:

```bash
flutter analyze
flutter test
flutter build apk --debug
```

Resultado: analyze e teste passam, e o APK debug e gerado em
`nimvo_app/build/app/outputs/flutter-apk/app-debug.apk`. `flutter doctor`
passa para Flutter e Android toolchain; segue apontando ausencia de Chrome e
Visual Studio, que so afetam builds Web/Windows desktop.

## Historico de contexto

- 2026-06-12: Criado este arquivo para ser a memoria tecnica viva dos agentes.
  Revisao inicial registrada em `docs/SYSTEM-REVIEW.md`.
- 2026-06-23: No painel central de clientes, o modal de licenca depende das
  props recarregadas por Inertia apos alterar fatura. Ao mexer nesse fluxo,
  mantenha o `licenseTenant` sincronizado com `tenants`, como ja ocorre nos
  modais fiscal e de agente local.
- 2026-06-23: A entrada simples de mercadoria do tenant ja possui endpoint
  `POST /api/stock/quick-receive`, atendido por
  `StockEntryPageController::quickReceive`; use esse fluxo para entradas
  manuais sem NF em vez de criar rota nova.
- 2026-06-23: O menu tenant separa `categorias`, `consultas_fiscais` e
  `entrada_estoque_avancado` como flags proprias. O preset `venda_direta`
  mantem as tres desligadas, inclusive ao normalizar configuracoes antigas
  que ainda nao tenham essas chaves salvas.
- 2026-06-23: Os utilitarios visuais compartilhados do frontend ficam em
  `resources/js/styles/nimvo-system.css`, importado por `resources/css/app.css`.
- 2026-07-03: As paginas separadas `/ajuste-estoque` e `/movimentacao-estoque`
  (workspace `StockMovementsWorkspace`) foram removidas. Ajuste de estoque e
  historico de movimentacao agora vivem dentro de `/estoque`
  (`StockEntry/Index.jsx`): buscar produto, clicar no resultado abre o painel
  lateral com movimentacoes e o botao "Ajustar" para registrar um ajuste,
  ambos usando as APIs ja existentes (`api/stock/quick-adjust` e
  `api/stock/products/{id}/movements`) em `StockEntryPageController`.
- 2026-07-01: Em contas a pagar, a tela deve abrir sem registros nem contadores
  carregados; o carregamento acontece apenas apos o usuario clicar em Filtrar.
- 2026-07-01: Compras/entrada de estoque e contas a pagar usam
  `confirm_amount_mismatch` para exigir uma segunda confirmacao quando o valor
  informado fica muito acima da referencia historica ou do custo dos itens.
- 2026-07-02: A impressao local do PDV usa comandos centrais
  `local_agent_commands`; o backend so cria comando de comprovante quando
  `LocalAgentBridgeService::isOnline()` confirma heartbeat recente. Comandos
  travados em `processing` expiram por
  `nimvo:fail-stale-local-agent-commands`, e o PDV acompanha/reenvia falhas via
  `/api/pdv/local-agent/commands/{command}`.
- 2026-07-02: O agente Go continua em `local-agent/go-agent` e o fluxo
  self-service em Configuracoes serve um ZIP gerado pelo Laravel a partir de
  `local-agent/bin/nimvo-fiscal-agent.exe` (fallback:
  `local-agent/go-agent/nimvo-fiscal-agent.exe`), incluindo `nimvo-agent.json`
  e `instalar.bat`. Nesta maquina o Go foi instalado em
  `B:\Tools\Go\go\bin`; use esse caminho ou adicione-o ao PATH da sessao para
  rodar `gofmt`, `go test ./...` e builds do agente.
- 2026-07-02: Tenants criados por `ProvisionTenantService` passam a receber um
  agente local central padrao automaticamente quando a tabela `local_agents`
  existe. A migration `2026_07_02_000200_ensure_default_local_agents_for_tenants`
  faz backfill para tenants antigos sem duplicar agentes ja existentes.
- 2026-07-02: No app Flutter `nimvo_app/`, a aba `Avisos` usa o mesmo payload
  de `/mobile-api/v1/dashboard` via `dashboardProvider` para destacar venda do
  dia, variacao de movimento, produtos abaixo do minimo e contas vencidas. Os
  launcher icons sao gerados por `flutter_launcher_icons` a partir de
  `assets/branding/nimvo-logo-512.png`, com iOS habilitado e alpha removido.
- 2026-07-02: O remoto bare da VPS em `/srv/git/nimvo.git` tem hook
  `post-receive` para a branch `main`. Ao receber push, ele entra em
  `/var/www/nimvo` e executa `git pull --ff-only vps main`, o que dispara o
  hook `post-merge` existente e o `scripts/post-pull-deploy.sh`. O hook limpa
  `GIT_DIR`/`GIT_WORK_TREE` antes do pull porque hooks do bare repo herdam esse
  ambiente. Logs: `/var/log/nimvo-post-receive.log` e
  `/var/log/nimvo-post-pull.log`.
- 2026-07-02: A busca mobile de produtos em `/mobile-api/v1/products/search`
  tambem atende a consulta rapida de estoque do app. O retorno inclui codigo,
  codigo de barras, categoria, custo, preco, estoque, minimo, media diaria dos
  ultimos 30 dias e ultima venda. O app usa `mobile_scanner`, portanto Android
  precisa de permissao `CAMERA` e iOS de `NSCameraUsageDescription`.
- 2026-07-02: No app Flutter, o scanner de codigo de barras ficou fixado em
  `mobile_scanner` 6.0.10 apos erro nativo na linha 7.x em Android. O launcher
  Android usa o recurso `@mipmap/nimvo_launcher` para evitar cache do antigo
  `ic_launcher`/Flutter em instalacoes diretas por APK.
- 2026-07-03: A tela tenant `resources/js/Pages/StockEntry/Entrada.jsx` passou
  a registrar entrada de mercadoria pelo endpoint
  `/api/operations/entrada-estoque/records`, em vez de criar entradas manuais
  por produto e uma conta avulsa. Isso preserva `purchase_id` nos `payables` e
  permite multiplos boletos vinculados a mesma entrada.
- 2026-07-03: Pagamentos do PDV aceitam detalhes opcionais em
  `sale_payments.payment_details` para cartao (bandeira, parcelas, NSU,
  autorizacao) e cheque (banco, agencia, conta, numero, emitente, documento e
  data de deposito). `PaymentMethod::CHECK` tambem entra no fechamento de caixa.
- 2026-07-06: `ProductService::activeCatalog()`/`fullCatalog()` usam um select
  defensivo via `productSelectColumns()` e depois normalizam o payload em
  `mapCatalogProduct()`. Ao adicionar colunas de produto consumidas por telas
  tenant (ex.: pesaveis, validade, etiquetas), atualize os dois pontos para a
  UI nao perder valores ao abrir/editar registros.
- 2026-07-06: Custo de produto agora depende da permissao
  `produtos.ver_custo`. Catalogos de produto, APIs de produtos, busca do PDV e
  busca mobile devem omitir `cost_price` para usuarios sem essa permissao; em
  updates, `ProductService` preserva o custo existente quando o campo nao vem no
  payload.
