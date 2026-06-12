# AGENTS.md

Guia rapido para agentes e desenvolvedores que forem trabalhar no Nimvo.

## Leitura obrigatoria

Antes de alterar codigo, leia:

- `README.md` para entender o produto e a arquitetura geral.
- `docs/AGENT-KNOWLEDGE.md` para contexto vivo acumulado.
- `docs/SYSTEM-REVIEW.md` para riscos, prioridades e estado da revisao.
- `docs/VPS-GIT-DEPLOY.md` quando a tarefa envolver deploy.

Atualize `docs/AGENT-KNOWLEDGE.md` sempre que descobrir uma informacao estavel
que facilite manutencoes futuras.

## Stack e fronteiras

- Backend em Laravel 13/PHP 8.3+.
- Frontend em React/Inertia/Vite.
- Tenancy por dominio com `stancl/tenancy`.
- Contexto central em `routes/central.php`.
- Contexto tenant em `routes/tenant.php`.
- Agente fiscal local em `local-agent/`.

Evite misturar regras do painel central com regras do tenant. Em especial, dados
operacionais de vendas, estoque, caixa e fiscal pertencem ao tenant.

## Comandos de verificacao

Use o conjunto mais relevante para a mudanca:

```bash
composer test
npm run build
cd local-agent/go-agent && go test ./...
```

Para ajustes PHP pequenos, rode ao menos os testes relacionados. Para mudancas
em React/CSS, rode `npm run build`. Para mudancas no agente local, rode os
testes Go.

## Padroes de edicao

- Prefira servicos existentes em `app/Services` a regra pesada em controller.
- Mantenha requests dedicados em `app/Http/Requests` para validacao.
- Preserve a separacao entre modelos centrais e modelos tenant.
- Nao commitar `.env`, certificados fiscais, dumps, backups ou arquivos gerados
  por build local.
- Documente somente decisoes que ajudem manutencao futura; evite comentarios
  obvios no codigo.

## Git e deploy

O remoto `origin` aponta para GitHub e o remoto `vps` aponta para o servidor de
deploy. O fluxo operacional atual e:

```bash
git push origin main
git push vps main
```

No VPS, o hook deve executar `scripts/post-pull-deploy.sh`. Quando publicar,
confirme antes o escopo do diff e nunca inclua arquivos sensiveis.
