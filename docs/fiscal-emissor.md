# Emissor Fiscal

## Stack adotada

- Emissao NFC-e modelo 65 com `nfephp-org/sped-nfe`
- DANFE/PDF com `nfephp-org/sped-da`
- Impressao termica com `nfephp-org/sped-pos` + `mike42/escpos-php`
- Fila assincrona via queue do Laravel

## Arquitetura

1. O tenant finaliza a venda e chama `POST /api/fiscal/documents`.
2. O backend reserva o numero fiscal em `fiscal_profiles.next_number`.
3. O documento e persistido em `fiscal_documents` com `idempotency_key` unico.
4. Um job cria um comando para o agente local em `local_agent_commands`.
5. O agente local faz `poll` e informa apenas os `supported_types` realmente disponiveis na maquina.
6. Quando a ponte fiscal local estiver configurada com `project_root` e `php_path`, o agente Go executa emissao e cancelamento via runner PHP local.
7. O backend atualiza documento fiscal, eventos, XMLs e status final.

## Seguranca

- Multi-tenant por banco isolado em producao e `tenant_id` em todos os comandos centrais.
- Credencial do agente local armazenada com hash bcrypt em `local_agents.secret_hash`.
- Payload do comando e resultado armazenados com cast `encrypted:array`.
- Certificado A1 e senha nao ficam no backend; ficam apenas na maquina do cliente.
- O backend usa HTTPS entre sistema e agente local.

## Entidades

- `fiscal_profiles`: configuracao fiscal por tenant.
- `fiscal_documents`: rastreio da emissao, XML, protocolo, chave e erros.
- `fiscal_document_events`: trilha operacional.
- `local_agents`: agentes autorizados por tenant.
- `local_agent_commands`: fila central para agentes locais.

## Campos fiscais minimos do produto

Os produtos precisam de:

- `ncm`
- `cfop`
- `cest`
- `origin_code`
- `icms_csosn`
- `pis_cst`
- `cofins_cst`

Sem `ncm` e `cfop`, a emissao nao e enfileirada.

## Fluxo do agente local

1. Criar agente:

```bash
php artisan fiscal:agent:create tenant-fiscal "PDV Loja 1"
```

2. Gerar o bootstrap do agente local.

3. Rodar o agente:

```bash
php artisan fiscal:agent:run C:\caminho\agent-config.json
```

Para um ciclo unico:

```bash
php artisan fiscal:agent:run C:\caminho\agent-config.json --once
```

## Ponte fiscal local

O agente Go sempre consegue operar com:

- `print_payment_receipt`
- `print_test`

O agente Go so anuncia:

- `emit_nfce`
- `cancel_fiscal_document`

quando a configuracao local tiver uma ponte valida para o projeto Laravel:

- `software.project_root`: raiz local do projeto com arquivo `artisan`
- `software.php_path`: executavel do PHP usado para chamar `artisan`

O bridge executa:

```bash
php artisan fiscal:agent:execute-command <config> <type> <payload>
```

## Instalador Windows do agente

Para gerar um `.exe` instalavel:

1. Instale o Inno Setup 6:

```powershell
winget install JRSoftware.InnoSetup
```

2. Monte o instalador:

```powershell
powershell -ExecutionPolicy Bypass -File .\local-agent\build-installer.ps1
```

O pacote instala o agente em `%LOCALAPPDATA%\NimvoFiscalAgent`, registra inicializacao automatica no Windows, grava a configuracao local no registro e pode receber:

- URL do backend central do Nimvo
- codigo de ativacao do tenant
- polling em segundos
- impressora Windows, TCP ou preview em PDF
- `project_root` opcional
- `php_path` opcional

## Emissao via API tenant

Exemplo:

```json
POST /api/fiscal/documents
{
  "sale_id": 1,
  "idempotency_key": "sale-1-nfce"
}
```

## Observacoes de operacao

- O projeto funciona com a fila atual do Laravel e pode migrar de `database` para `redis` sem alterar a arquitetura fiscal.
- O lock principal esta em tres camadas: `idempotency_key` unico, reserva transacional de numero fiscal e job unico por documento.
- O instalador do agente usa o codigo de ativacao para trocar as credenciais diretamente com o backend central no primeiro setup.
- O `/admin` central cuida do bootstrap, do status do agente e do polling.
- A configuracao local do agente fica na propria maquina e e sincronizada com o Nimvo via `local_agents.metadata`.
- Sem `project_root` e `php_path`, o agente Go opera apenas com impressao e API local.
