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
- 2026-07-01: A workspace tenant de movimentacao/historico de estoque usa a
  chave ASCII `movimentacao-estoque` vinda do backend. No React, comparar com
  uma variante acentuada impede a tela de renderizar e deixa a pagina em branco.
- 2026-07-01: Em contas a pagar, a tela deve abrir sem registros nem contadores
  carregados; o carregamento acontece apenas apos o usuario clicar em Filtrar.
