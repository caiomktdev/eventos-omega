#!/usr/bin/env bash
set -euo pipefail

# Deploy incremental para VPS Hostinger (usuário eventos).
# Uso:
#   bash scripts/vps-deploy.sh
#
# Pré-requisitos:
# - repositório já clonado em /home/eventos/apps/eventos-omega
# - .env.production preenchido
# - unit systemd eventos-omega.service instalada

APP_DIR="${APP_DIR:-/home/eventos/apps/eventos-omega}"
BRANCH="${BRANCH:-cursor/reservation-expiry-mp-stability}"

echo "[1/7] Entrando em ${APP_DIR}..."
cd "${APP_DIR}"

echo "[2/7] Atualizando código..."
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[3/7] Instalando dependências..."
npm ci

echo "[4/7] Gerando Prisma Client..."
npx prisma generate

echo "[5/7] Aplicando migrations de produção..."
set -a
source .env.production
set +a
npx prisma migrate deploy

echo "[6/7] Build de produção..."
npm run build

echo "[7/7] Reiniciando serviço..."
sudo systemctl daemon-reload
sudo systemctl restart eventos-omega
sudo systemctl status eventos-omega --no-pager

echo
echo "Deploy concluído."
