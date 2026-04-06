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

3. No VPS, atualize o sistema:

```bash
cd /var/www/nimvo
git pull vps main
```

## O que acontece depois do `git pull`

O hook `post-merge` do VPS executa automaticamente:

- `php artisan optimize:clear`
- `composer install --no-dev --optimize-autoloader --no-interaction` quando necessario
- `npm ci` quando necessario
- `npm run build` quando necessario
- `php artisan migrate --force`
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
