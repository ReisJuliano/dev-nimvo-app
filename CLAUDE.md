# CLAUDE.md

Notas pra sessoes futuras do Claude Code neste repo. Leia primeiro
`AGENTS.md` (guia geral) e `docs/AGENT-KNOWLEDGE.md` (memoria tecnica viva,
atualizada por data) — este arquivo so complementa com o que e especifico
de trabalhar aqui via Claude Code.

## O que e o Nimvo

SaaS multi-tenant de gestao comercial pra papelaria, mercado/mercearia e
varejo de pequeno/medio porte no Brasil. Meta: substituir o combo
"caderno + planilha + PDV solto" por um sistema unico cobrindo a rotina real
da loja de ponta a ponta — nao so vender, mas operar.

Modulos principais (todos dentro do contexto tenant):

- **PDV**: venda no balcao, atalhos de teclado, sangria/suprimento, sugestao
  de combo, emissao de NFC-e/cupom fiscal.
- **Estoque**: cadastro de produto, entrada de mercadoria vinculada a
  fornecedor/boleto/contas a pagar, ajuste com motivo e trilha, controle de
  validade e venda por peso (balanca), inventario com contagem cega e curva ABC.
- **Financeiro**: caixa (abertura/fechamento com conferencia por forma de
  pagamento), contas a pagar, fiado/condicional/entregas ("A receber"), DRE
  simplificado, fluxo de caixa projetado.
- **Promocoes**: ofertas avulsas e tabloides (campanhas com varias ofertas e
  periodo de validade), aplicadas automaticamente no PDV.
- **Gestao**: usuarios/permissoes por grupo (Dono/Gerente/Operador), auditoria,
  etiquetas (com deteccao de preco desatualizado), relatorios gerenciais
  (faturamento, ticket medio, margem, quebra, giro, dias de estoque).
- **Fiscal**: emissao NFC-e/NF-e, contingencia, cancelamento, inutilizacao de
  numeracao — via agente local (certificado A1) integrado ao Laravel central.
- **Central (admin Nimvo)**: cadastro de tenants, licencas, perfil fiscal por
  cliente, deploy e monitoramento do agente local de cada loja.

Publico-alvo real: dono de loja pequena, pouca familiaridade tecnica, caixa
que precisa ser rapido com fila de cliente esperando. Isso pesa nas decisoes
de UX (ex.: por que atalho de teclado sem modificador quebra digitacao —
achado 4.1 do relatorio de 2026-07-11) e de confiabilidade (um bug que trava
"registrar entrada" ou "finalizar venda" para a operacao real de uma loja em
poucos dias — nao e so um detalhe cosmetico).

Detalhes completos de stack/arquitetura: ver `README.md`.

## Stack, remotos, deploy

Ver `AGENTS.md` e `docs/VPS-GIT-DEPLOY.md` pros detalhes completos. Resumo:

- Laravel 13/PHP 8.3 (backend) + Inertia/React/Vite (frontend), multi-tenant
  com `stancl/tenancy`.
- `origin` = GitHub, `vps` = bare repo em produção (`ssh://root@.../srv/git/nimvo.git`).
- Deploy = `git push vps main`. O hook `post-receive` la faz `git pull --ff-only`
  em `/var/www/nimvo`, dispara `post-merge` -> `scripts/post-pull-deploy.sh`.
  Sem passo manual adicional — push jah deploya.
- Sempre `git push origin main` junto (nao deixar os remotos divergirem).

## Testes — como rodar aqui

```bash
php artisan test                    # suíte completa (~60s)
php artisan test --filter=Nome      # focado
npm run build                       # frontend (Vite)
```

- Feature tests (DB) precisam de MariaDB local ativo em `127.0.0.1:3306`.
  Se não tiver, `composer test`/feature tests falham por conexão, não pelo
  código — não confundir com regressão real.
- `tests/Unit/LabelPayloadServiceTest.php` tem 4 testes falhando **pré-existentes**
  (`LabelPayloadService::build()` espera `LabelTemplate`, teste passa `string`).
  Não é algo que eu quebrei em 2026-07-11 — não tente "consertar" reflexivamente
  se aparecer numa rodada de testes; é bug represado, separado do que estiver
  sendo trabalhado.
- Serviços que injetam `AuditLogService` (ou outras deps novas) via construtor:
  se algum teste faz `new NomeDoServico(...)` manualmente (fora do container),
  o teste quebra ao adicionar parâmetro novo. Sempre `grep -rn "new NomeService("`
  em `tests/` antes de mudar assinatura de construtor.

## Padrões de UI que já foram bug real neste app (cuidado ao repetir)

- **Grid CSS com colunas fixas + elemento condicional sem coluna reservada**:
  em `resources/js/Pages/Pos/pos.css` a linha do carrinho (`.pos-item-row`) usa
  `grid-template-columns` fixo. Qualquer `<span>` condicional novo dentro da
  linha precisa de coluna própria reservada no template (mesmo que vazia/oculta
  quando não aplicável) — senão desalinha tudo depois dele.
- **Input numérico com `autoFocus` + valor pré-preenchido**: cursor cai no fim
  do texto existente; digitar concatena em vez de substituir (ex.: ajuste de
  estoque mostrando o valor atual). Sempre por `onFocus={(e) => e.target.select()}`
  nesses campos.
- **Atalho de teclado global por `Shift+Letra`**: digitar uma letra MAIÚSCULA
  num campo de texto qualquer produz fisicamente `Shift+Letra`. Handler global
  de atalho (`Pos/Index.jsx`, `handleShortcuts`) precisa checar se o foco atual
  é um campo editável (`INPUT`/`TEXTAREA`/`SELECT`/`contentEditable`) antes de
  disparar, senão captura a primeira letra digitada em qualquer busca.
- **PDV: desconto de promoção precisa estar refletido no total do carrinho
  ANTES de enviar pro backend.** `resources/js/Pages/Orders/orderUtils.js`
  `resolvePricing(items, config, selectedItem, promotionInfo)` recebe
  `promotionInfo` (vindo de `/api/pdv/promotions/evaluate`) e usa
  `Math.max(descontoManual, descontoPromocao)` por linha — mesma lógica que o
  backend (`PosService::finalize`) usa pra decidir `usesPromotion`. Se um dia
  alguém remover esse 4º parâmetro ou parar de repassar `promotionInfo`, volta
  o bug "O desconto total não confere com os descontos aplicados nos itens"
  pra qualquer produto com promoção ativa (não só tabloide vencido).
- **Tabloide/campanha de promoção**: `Promotion.end_at`/`start_at` são copiados
  do `PromotionCampaign` só na criação (`bulkAddProducts`). Editar o período do
  tabloide depois (`PromotionCampaignService::update`) precisa cascatear pra
  `$campaign->promotions()->update(...)`, senão oferta fica "presa" ativa mesmo
  com tabloide encerrado. `PromotionEngine::activePromotions()` e
  `Promotion::statusLabel()` também checam o status da campanha-mãe como defesa
  extra.
- **"Tela abre vazia até clicar em Filtrar"**: isso é padrão DELIBERADO em
  algumas telas (ex.: Contas a Pagar — ver `docs/AGENT-KNOWLEDGE.md` 2026-07-01)
  por custo de carregar tudo. Em 2026-07-11 troquei esse comportamento em
  Produtos (`ProductsPageController`) e Estoque (`StockEntry/Index.jsx`) porque
  QA reportou como bug nessas duas telas especificamente. Não generalizar pra
  outras telas sem confirmar que é bug e não decisão de performance.

## Auditoria (`AuditLogService`)

Várias constantes em `App\Support\Tenant\AuditActions` existiam **definidas
mas nunca chamadas** (`PRODUCT_PRICE_CHANGED`, `PRODUCT_COST_CHANGED`,
`STOCK_MANUAL_ADJUSTMENT`) até 2026-07-11. Se for adicionar uma ação nova de
auditoria, não basta declarar a constante — tem que efetivamente chamar
`$this->auditLogService->record(...)` no serviço certo e idealmente rodar uma
query manual na tabela `audit_logs` pra confirmar que gravou.

## Fluxo de trabalho nesta sessão

Quando o pedido for "corrija os achados de um relatório de QA/teste", tratar
como lista de itens independentes: criar todo por achado, investigar causa
raiz de verdade antes de aplicar fix (não só suprimir sintoma), rodar
`php artisan test` no final pra pegar regressão. Ver commit
`fix: corrige achados criticos, altos e medios do relatorio de testes` (2026-07-11)
como referência de escopo/estilo pra esse tipo de tarefa.
