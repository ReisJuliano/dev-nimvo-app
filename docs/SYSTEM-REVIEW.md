# System Review

Revisao tecnica inicial feita em 2026-06-12.

## Sumario

O Nimvo esta organizado como um SaaS Laravel/Inertia/React com separacao clara
entre contexto central e contexto tenant. A base tem boa cobertura funcional:
PDV, caixa, pedidos, compras, fiscal, relatorios, licencas, agente local e
deploy automatizado por Git. A estrutura de servicos e requests ajuda a manter
controllers mais enxutos, e a arquitetura de tenancy esta concentrada em pontos
previsiveis.

## Pontos fortes

- Separacao explicita entre `routes/central.php` e `routes/tenant.php`.
- Configuracao de tenancy centralizada em `config/tenancy.php`.
- Regra de negocio majoritariamente em `app/Services`, nao espalhada apenas em
  controllers.
- Testes feature/unit cobrindo fluxos relevantes de tenant, fiscal, relatorios,
  PDV, pedidos e agente local.
- Deploy versionado em `scripts/post-pull-deploy.sh`, com instalacao condicional
  de dependencias, build de assets e migracoes.
- Agente local isolado em `local-agent/`, com bridge PHP e testes Go.

## Riscos e prioridades

1. Credenciais de exemplo parecem operacionais demais.
   `CENTRAL_ADMIN_PASSWORD=123456`, senha de banco no `.env.example` e seeds com
   senha `123456` sao uteis localmente, mas precisam de aviso forte e troca
   obrigatoria antes de ambientes reais.

2. Binarios do agente fiscal estao versionados.
   Isso pode ser intencional para distribuicao Windows, mas aumenta o repositorio
   e exige disciplina para manter `local-agent/bin` e `local-agent/go-agent`
   sincronizados com o codigo fonte.

3. Modo single-database vem habilitado no exemplo.
   Bom para desenvolvimento, mas pode mascarar problemas de isolamento tenant.
   Fluxos criticos devem ser testados tambem com `TENANT_DEV_SINGLE_DATABASE=false`.

4. API do agente local dispensa CSRF.
   A autenticacao por headers existe, mas esse fluxo deve continuar sendo
   tratado como superficie sensivel: validar rate limit, logs, rotacao de segredo
   e expiracao de codigos de ativacao.

5. Rotas tenant concentram muitos modulos em um arquivo.
   Esta funcional, mas futuras expansoes podem se beneficiar de arquivos por
   dominio, mantendo nomes de rota estaveis.

6. Documentacao operacional estava curta.
   O README foi expandido e este arquivo registra o estado atual; manter a
   documentacao viva evita perda de contexto em manutencoes futuras.

## Recomendacoes de proximo ciclo

- Rodar a suite completa antes de cada deploy: `composer test`, `npm run build`
  e `go test ./...` no agente.
- Criar uma etapa de checklist para troca de credenciais antes de producao.
- Avaliar se os binarios do agente devem continuar no Git ou migrar para
  releases/artifacts.
- Adicionar testes especificos para isolamento multi-database quando esse modo
  for usado em producao.
- Documentar processo de build do instalador Windows do agente local.
- Considerar rate limiting nas rotas `/api/local-agents/*`.

## Validacao executada

2026-06-12:

- `php artisan test --filter=LocalFiscalAgentRunnerTest`: passou.
- `php artisan test --filter=OperationsOverviewServiceTest`: passou.
- `composer test`: unitarios passaram, mas 83 testes feature falharam por
  `SQLSTATE[HY000] [2002]` porque o MariaDB local recusou conexao em
  `127.0.0.1:3306` para `nimvo_central`.
- `B:\Tools\Node\node-v24.16.0-win-x64\npm.cmd run build`: passou. O build
  emite avisos de `lightningcss` sobre at-rules de Tailwind/HeroUI.
- `go test ./...`: nao executado, `go.exe` nao encontrado.

## Arquivos revisados nesta passada

- `README.md`
- `.env.example`
- `.gitignore`
- `composer.json`
- `package.json`
- `routes/central.php`
- `routes/tenant.php`
- `bootstrap/app.php`
- `config/tenancy.php`
- `scripts/post-pull-deploy.sh`
- `database/seeders/CentralAdminSeeder.php`
- `database/seeders/TenantDatabaseSeeder.php`
