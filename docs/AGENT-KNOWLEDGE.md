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

Resultado: rotas mobile registradas e testes focados passaram. O Flutter SDK
nao esta instalado nesta maquina (`flutter` nao encontrado no PATH), entao o
app em `nimvo_app/` foi criado como scaffold de codigo; em uma maquina com SDK,
rodar `flutter create . --org br.com.nimvo --platforms android,ios` dentro de
`nimvo_app` antes de `flutter pub get`.

## Historico de contexto

- 2026-06-12: Criado este arquivo para ser a memoria tecnica viva dos agentes.
  Revisao inicial registrada em `docs/SYSTEM-REVIEW.md`.
