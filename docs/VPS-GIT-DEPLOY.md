# Deploy Git No VPS

## Fluxo

1. No Windows, faca suas alteracoes e commit:

```powershell
git add .
git commit -m "sua alteracao"
```

2. Envie para o remoto do VPS:

```powershell
git push vps main
```

3. O hook `post-receive` do repositorio bare em `/srv/git/nimvo.git` atualiza
   automaticamente o checkout em `/var/www/nimvo` com:

```bash
git pull vps main
```

Normalmente nao e mais necessario entrar na VPS para puxar manualmente. Se o
hook falhar, consulte `/var/log/nimvo-post-receive.log` e
`/var/log/nimvo-post-pull.log`.

## O que acontece depois do `git pull`

O hook `post-merge` do VPS executa automaticamente:

- `php artisan optimize:clear`
- `composer install --no-dev --optimize-autoloader --no-interaction` quando necessario
- `npm ci` quando necessario
- `npm run build` quando necessario
- `php artisan migrate --force`
- `php artisan tenants:migrate --force` quando o ambiente estiver em tenancy
  multi-database
- `php artisan config:cache`
- `php artisan queue:restart`

## Script usado pelo VPS

O hook chama este arquivo versionado no projeto:

```bash
scripts/post-pull-deploy.sh
```

Se algum dia voce quiser rodar o deploy manualmente no servidor:

```bash
cd /var/www/nimvo
bash scripts/post-pull-deploy.sh
```
