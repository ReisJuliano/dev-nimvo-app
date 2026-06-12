# Nimvo

Nimvo e um sistema SaaS multi-tenant para operacoes comerciais, PDV, vendas,
estoque, compras, fiscal e gestao administrativa. O projeto combina Laravel,
Inertia.js e React em uma arquitetura com painel central e areas isoladas por
tenant.

## O que o sistema entrega

- Painel central para administracao de clientes, tenants, licencas e agente
  fiscal local.
- Aplicacao tenant com PDV, caixa, produtos, comandas, pedidos, delivery,
  vendas condicionais, consultas fiscais, compras, contas a pagar, relatorios e
  configuracoes.
- Modulos operacionais reaproveitaveis para clientes, fornecedores, categorias,
  estoque, usuarios e visoes gerenciais.
- Emissao e acompanhamento fiscal com suporte a NFC-e/NF-e, contingencia,
  cancelamentos, inutilizacao e armazenamento de XML.
- Agente local em Go/PHP bridge para comunicacao com impressoras, certificados
  A1 e rotinas fiscais locais.
- Deploy por Git em VPS com script versionado de pos-pull.

## Stack

- Backend: PHP 8.3+, Laravel 13, stancl/tenancy.
- Frontend: React 19, Inertia.js 3, Vite 8, Tailwind CSS 4.
- Fiscal/impressoes: nfephp, sped-da, sped-pos e escpos-php.
- Agente local: Go, bridge PHP e instalador Windows.
- Banco: MariaDB/MySQL, com modo single-database para desenvolvimento e modo
  multi-database para producao.

## Arquitetura

O projeto separa dois contextos principais:

- Central: rotas em `routes/central.php`, banco central, administradores,
  tenants, licencas e agentes locais.
- Tenant: rotas em `routes/tenant.php`, autenticacao propria, dados comerciais,
  operacionais e fiscais isolados por tenant.

A inicializacao do tenant e feita por dominio em `bootstrap/app.php` usando
`Stancl\Tenancy\Middleware\InitializeTenancyByDomain`. As opcoes principais de
tenancy ficam em `config/tenancy.php`.

## Primeiros passos

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm run build
```

Depois ajuste o `.env` para o dominio central, banco e modo de tenancy desejado.
Em desenvolvimento, `TENANT_DEV_SINGLE_DATABASE=true` simplifica o ambiente.
Para isolamento real por banco de tenant, use `TENANT_DEV_SINGLE_DATABASE=false`
e configure prefixo/sufixo dos bancos em `TENANT_DB_PREFIX` e
`TENANT_DB_SUFFIX`.

## Comandos uteis

```bash
composer test
npm run build
npm run dev
php artisan migrate --force
php artisan tenants:migrate --force
```

Para o agente local:

```bash
cd local-agent/go-agent
go test ./...
```

## Deploy

O deploy por Git esta documentado em `docs/VPS-GIT-DEPLOY.md`. O hook do VPS
deve chamar:

```bash
bash scripts/post-pull-deploy.sh
```

Esse script instala dependencias quando necessario, limpa caches, compila assets,
executa migracoes centrais e de tenants, cria o link de storage e reinicia filas.

## Documentacao interna

- `AGENTS.md`: guia rapido para agentes e desenvolvedores.
- `docs/AGENT-KNOWLEDGE.md`: arquivo vivo para registrar contexto util durante
  manutencoes futuras.
- `docs/SYSTEM-REVIEW.md`: revisao tecnica atual do sistema e proximas
  prioridades.
- `docs/fiscal-emissor.md`: contexto fiscal.
- `docs/VPS-GIT-DEPLOY.md`: rotina de deploy no VPS.

## Cuidados operacionais

- Nao versionar `.env`, certificados, chaves privadas, dumps ou backups.
- Trocar credenciais padrao antes de ambientes reais.
- Validar rotinas fiscais e de tenant com testes antes de deploy.
- Revisar binarios versionados do agente local quando houver alteracao no Go ou
  no bridge PHP.
