# Hostinger VPS — Plano de Acao

Este guia centraliza o projeto EventosOmega inteiramente na Hostinger VPS:

- Frontend/API Next.js
- Banco PostgreSQL
- Reverse proxy Nginx com HTTPS
- Deploy reproducivel com rollback

## 1) Objetivo

Eliminar dependencia de banco externo e ambiente compartilhado, executando a stack inteira na VPS com isolamento, previsibilidade e controle operacional.

## 2) Premissas

- VPS Ubuntu/Debian com acesso SSH root
- Dominio `eventosomega.com.br` apontando para o IP da VPS
- Repositorio GitHub acessivel pela VPS

## 3) Artefatos criados no repositório

- `scripts/vps-bootstrap-hostinger.sh`: instala stack base da VPS.
- `scripts/setup-postgres-eventosomega.sh`: cria usuario/banco PostgreSQL local.
- `scripts/vps-deploy.sh`: deploy incremental (pull, install, prisma, build, restart).
- `infra/systemd/eventos-omega.service`: template do serviço app.
- `infra/nginx/eventosomega.com.br.conf`: virtual host Nginx.
- `.env.production.example`: referência de variáveis para produção.

## 4) Ordem de execução (runbook)

### 4.1 Provisionamento da VPS (root)

```bash
cd /caminho/do/repositorio
sudo bash scripts/vps-bootstrap-hostinger.sh
```

### 4.2 Banco PostgreSQL local

```bash
cd /caminho/do/repositorio
APP_PASSWORD='SENHA_FORTE' sudo -u postgres bash scripts/setup-postgres-eventosomega.sh
```

### 4.3 Aplicação e ambiente

```bash
sudo -u eventos mkdir -p /home/eventos/apps
sudo -u eventos git clone https://github.com/caiomktdev/eventos-omega.git /home/eventos/apps/eventos-omega
cd /home/eventos/apps/eventos-omega
cp .env.production.example .env.production
```

Preencher `.env.production` com valores reais (DB local, AUTH, MP, email etc.).

### 4.4 Instalar serviço systemd

```bash
sudo cp infra/systemd/eventos-omega.service /etc/systemd/system/eventos-omega.service
sudo systemctl daemon-reload
sudo systemctl enable eventos-omega
```

### 4.5 Nginx + dominio

```bash
sudo cp infra/nginx/eventosomega.com.br.conf /etc/nginx/sites-available/eventosomega.com.br
sudo ln -sf /etc/nginx/sites-available/eventosomega.com.br /etc/nginx/sites-enabled/eventosomega.com.br
sudo nginx -t
sudo systemctl reload nginx
```

### 4.6 HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d eventosomega.com.br -d www.eventosomega.com.br
```

### 4.7 Primeiro deploy

```bash
cd /home/eventos/apps/eventos-omega
sudo -u eventos bash scripts/vps-deploy.sh
```

## 5) Migração de dados

Se quiser levar dados atuais:

```bash
cd /home/eventos/apps/eventos-omega
psql "postgresql://eventos_app:SENHA_FORTE@127.0.0.1:5432/eventos_omega" < backup_eventosomega.sql
```

Depois, rode deploy novamente.

## 6) Verificações pós-deploy

- `systemctl status eventos-omega --no-pager`
- `journalctl -u eventos-omega -n 100 --no-pager`
- `curl -I https://eventosomega.com.br`
- Testar home, inscrição, checkout e webhook.

## 7) Rollback operacional

Se um deploy quebrar:

```bash
cd /home/eventos/apps/eventos-omega
git log --oneline -n 5
git checkout <commit_anterior_estavel>
npm ci
npx prisma generate
npm run build
sudo systemctl restart eventos-omega
```

## 8) Checklist de segurança

- `AUTH_SECRET` forte e único.
- PostgreSQL restrito a `127.0.0.1` (sem exposição pública).
- Firewall ativo (`ufw`).
- Backup diário de banco via `pg_dump`.
- Nunca versionar `.env.production`.
