# Nimvo Multi-Tenant

Base SaaS multi-tenant em Laravel + Inertia.js + React com separação explícita entre:

- contexto central
- contexto tenant
- banco central para clientes e tenants
- banco isolado por tenant para dados operacionais, autenticação e sessões

## Arquitetura

### Banco central

O banco central deve usar o nome `nimvo-central` e guarda:

- `tenants`
- `domains`
- `clients`

Cada registro em `clients` aponta para um `tenant_id`.

### Banco do tenant

Cada tenant recebe:

- domínio próprio
- banco próprio
- tabelas próprias
- usuários próprios
- sessões próprias

Os dados do sistema nunca devem ser compartilhados entre tenants.

## Rotas

### Central

Arquivo: `routes/central.php`

- `/` no domínio central

### Tenant

Arquivo: `routes/tenant.php`

- `/`
- `/login`
- `/logout`
- `/change-password`
- `/dashboard`

Essas rotas usam inicialização de tenancy por domínio.

## Provisionamento

O serviço `App\Services\Central\ProvisionTenantService` é o ponto base para:

- criar o tenant
- registrar o domínio
- registrar o cliente no banco central

## Configuração local

Ajuste o `.env` com algo próximo de:

```env
APP_URL=http://app.nimvo.test

DB_CONNECTION=central

CENTRAL_DB_CONNECTION=central
CENTRAL_DB_DRIVER=mysql
CENTRAL_DB_HOST=127.0.0.1
CENTRAL_DB_PORT=3306
CENTRAL_DB_DATABASE=nimvo-central
CENTRAL_DB_USERNAME=root
CENTRAL_DB_PASSWORD=

TENANT_DB_TEMPLATE_CONNECTION=central
TENANT_DB_PREFIX=nimvo_tenant_
TENANT_DB_SUFFIX=
```

## Observações

- o domínio central deve ficar listado em `config/tenancy.php`
- cada domínio de tenant deve existir na tabela `domains`
- o login da aplicação continua sendo por tenant
- o seed do tenant cria um usuário inicial `admin`
