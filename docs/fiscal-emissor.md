# Emissor Fiscal

## Stack adotada

- Emissao NFC-e modelo 65 com `nfephp-org/sped-nfe`
- DANFE/PDF com `nfephp-org/sped-da`
- Impressao termica com `nfephp-org/sped-pos` + `mike42/escpos-php`
- Fila assíncrona via queue do Laravel

## Arquitetura

1. O tenant finaliza a venda e chama `POST /api/fiscal/documents`.
2. O backend reserva o numero fiscal no `fiscal_profiles.next_number`.
3. O documento e persistido em `fiscal_documents` com `idempotency_key` unico.
4. Um job unico por documento cria um comando para o agente local em `local_agent_commands`.
5. O agente local faz `poll`, emite a NFC-e com o certificado que fica somente no PC do cliente e devolve o XML autorizado.
6. O backend atualiza o documento fiscal, historico de eventos e status final.

## Seguranca

- Multi-tenant por banco isolado em producao e tenant id em todos os comandos centrais.
- Credencial do agente local armazenada com hash bcrypt em `local_agents.secret_hash`.
- Payload do comando e resultado armazenados com cast `encrypted:array`.
- Certificado A1 e senha nao ficam no backend; ficam apenas no arquivo local do agente.
- O backend usa HTTPS entre sistema e agente local.

## Entidades novas

- `fiscal_profiles`: configuracao fiscal por tenant.
- `fiscal_documents`: rastreio da emissao, XML, protocolo, chave e erros.
- `fiscal_document_events`: trilha operacional.
- `local_agents`: agentes autorizados por tenant.
- `local_agent_commands`: fila central para agentes locais.

## Campos fiscais minimos do produto

Os produtos ganharam:

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

2. Gerar o arquivo de bootstrap do agente a partir do template em `local-agent/config.example.json`.

3. Rodar o agente:

```bash
php artisan fiscal:agent:run C:\caminho\agent-config.json
```

Para teste unitario de um ciclo:

```bash
php artisan fiscal:agent:run C:\caminho\agent-config.json --once
```

## Instalador Windows do agente

Para gerar um `.exe` instalavel do agente local:

1. Crie a configuracao base do tenant:

```bash
php artisan fiscal:agent:create tenant-fiscal "PDV Loja 1" --write-config=storage/app/fiscal-agent/tenant-fiscal.json
```

2. Monte o instalador:

```powershell
powershell -ExecutionPolicy Bypass -File .\local-agent\build-installer.ps1 -SeedConfigPath .\storage\app\fiscal-agent\tenant-fiscal.json
```

O script recompila `local-agent/bin/nimvo-fiscal-agent.exe` e gera um `setup.exe` em `local-agent/dist/`. Esse pacote instala o agente em `%LOCALAPPDATA%\NimvoFiscalAgent`, registra inicializacao automatica no Windows, usa o JSON bootstrap do tenant e coleta durante a instalacao os dados locais da maquina, como certificado A1, impressora, logo do cupom e API local.

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

- O projeto esta pronto para usar a fila atual do Laravel. Hoje ele funciona com `database` e pode ser trocado para `redis` sem alterar codigo.
- O lock principal esta em tres camadas: `idempotency_key` unico, reserva transacional de numero fiscal e job unico por documento.
- O bootstrap local do agente guarda apenas o necessario para a maquina cliente, como certificado A1, impressora, logo do cupom e API local.
- O `/admin` central passa a cuidar apenas do bootstrap, do status do agente e do polling. As configuracoes da maquina nao devem mais ser editadas manualmente ali.
- A configuracao local do agente e sincronizada com o Nimvo via `local_agents.metadata`, evitando editar JSON por cliente depois da instalacao.
- O agente local atual foi implementado como wrapper Windows para rodar `php artisan fiscal:agent:run`, mantendo o certificado e a impressora apenas no PC do cliente.
