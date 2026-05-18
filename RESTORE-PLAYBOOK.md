# Restore Playbook

Referencia para restauracao futura deste ambiente e dos backups pessoais.

## Codigo

- GitHub owner: `ReisJuliano`
- GitHub repo: `https://github.com/ReisJuliano/dev-nimvo-app.git`
- Branch principal: `main`
- Commit validado em `2026-05-18`: `3dd1463`
- Remote VPS git: `ssh://root@186.202.209.239/srv/git/nimvo.git`

## VPS

- Host: `186.202.209.239`
- Usuario: `root`
- App atual: `/var/www/nimvo`
- Chave SSH local usada neste PC: `C:\Users\PC-RESERVA\.ssh\id_rsa`

## Backup do Sistema

- Backup local principal: `d:\dev-nimvo-app\dev-nimvo-app\backups\20260518-165931`
- Backup local compactado: `d:\dev-nimvo-app\dev-nimvo-app\backups\local-machine-backup-20260518-165931.tgz`
- Backup unico local: `d:\dev-nimvo-app\dev-nimvo-app\backups\local-unique-backup-20260518-165931.tgz`
- Backup no VPS: `/root/nimvo-backups/20260518-165931`

Arquivos importantes no VPS:

- `server-code-main.bundle`
- `server-databases.sql.gz`
- `server-db-list.txt`
- `server.env`
- `server-storage-app.tgz`
- `server-public-storage.tgz`
- `local-machine/local-unique-backup-20260518-165931.tgz`

Bancos incluidos no dump do VPS:

- `nimvo_central`
- `nimvo_tenant_teste`

Conteudo do backup unico da maquina local:

- `.env` local
- dump `nimvo_local.sql`
- `tenant-dev.sqlite`
- `storage/app`
- `storage/logs`
- `public/storage`

## Save do Jogo

- Jogo: `Subnautica Below Zero`
- Pasta do jogo: `E:\Jogos\Subnautica-Below-Zero-SteamRIP.com\Subnautica Below Zero`
- Save real identificado em: `E:\Jogos\Subnautica-Below-Zero-SteamRIP.com\Subnautica Below Zero\SNAppData\SavedGames\slot0000`
- Logs do jogo: `C:\Users\PC-RESERVA\AppData\LocalLow\Unknown Worlds\Subnautica Below Zero`

Backups do save:

- Pasta local: `d:\dev-nimvo-app\dev-nimvo-app\backups\game-saves\20260518-171435`
- Arquivo local do save: `subnautica-below-zero-snappdata.zip`
- Arquivo local dos logs: `subnautica-below-zero-logs.tgz`
- Pasta no VPS: `/root/nimvo-backups/game-saves/20260518-171435`

Conteudo relevante do slot:

- `gameinfo.json`
- `global-objects.bin`
- `scene-objects.bin`
- `screenshot.jpg`
- pasta `CellsCache`

## Como Puxar os Backups

Do GitHub:

- `git clone https://github.com/ReisJuliano/dev-nimvo-app.git`

Do VPS para a maquina:

- `scp -i C:\Users\PC-RESERVA\.ssh\id_rsa root@186.202.209.239:/root/nimvo-backups/20260518-165931/server-databases.sql.gz .`
- `scp -i C:\Users\PC-RESERVA\.ssh\id_rsa root@186.202.209.239:/root/nimvo-backups/20260518-165931/server.env .`
- `scp -i C:\Users\PC-RESERVA\.ssh\id_rsa root@186.202.209.239:/root/nimvo-backups/20260518-165931/server-storage-app.tgz .`
- `scp -i C:\Users\PC-RESERVA\.ssh\id_rsa root@186.202.209.239:/root/nimvo-backups/20260518-165931/server-public-storage.tgz .`
- `scp -i C:\Users\PC-RESERVA\.ssh\id_rsa root@186.202.209.239:/root/nimvo-backups/20260518-165931/local-machine/local-unique-backup-20260518-165931.tgz .`
- `scp -i C:\Users\PC-RESERVA\.ssh\id_rsa root@186.202.209.239:/root/nimvo-backups/game-saves/20260518-171435/subnautica-below-zero-snappdata.zip .`
- `scp -i C:\Users\PC-RESERVA\.ssh\id_rsa root@186.202.209.239:/root/nimvo-backups/game-saves/20260518-171435/subnautica-below-zero-logs.tgz .`

## Como Restaurar o Sistema

1. Clonar o repo e entrar na pasta.
2. Copiar o `.env` certo para a raiz do projeto.
3. Rodar `composer install`.
4. Rodar `npm install`.
5. Rodar `php artisan key:generate` apenas se estiver criando um ambiente novo sem `.env` restaurado.
6. Importar o banco adequado.
7. Restaurar `storage/app` e `public/storage`.
8. Rodar `php artisan migrate --force` se necessario.
9. Rodar `npm run build`.

Comandos uteis de restauracao:

- `gunzip -c server-databases.sql.gz | mysql -uUSUARIO -p`
- `tar -xzf server-storage-app.tgz`
- `tar -xzf server-public-storage.tgz`
- `tar -xzf local-unique-backup-20260518-165931.tgz`

## Como Restaurar o Save do Below Zero

1. Garantir que a pasta do jogo exista em `E:\Jogos\Subnautica-Below-Zero-SteamRIP.com\Subnautica Below Zero`.
2. Fechar o jogo antes de copiar qualquer save.
3. Fazer backup da pasta atual `SNAppData` antes de sobrescrever.
4. Extrair `subnautica-below-zero-snappdata.zip`.
5. Copiar a pasta `SNAppData` restaurada para dentro da pasta do jogo.
6. Se quiser diagnostico, extrair tambem `subnautica-below-zero-logs.tgz`.

## Regras para uma Restauracao Futura

- Nao confiar so no clone do GitHub para restaurar dados.
- Os segredos ficam dentro dos arquivos `.env` salvos nos backups, nao neste documento.
- A pasta `backups/` esta ignorada no git para evitar commit acidental de binarios.
- Quando me pedir ajuda depois, me passe este arquivo primeiro.
