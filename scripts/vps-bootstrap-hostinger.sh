#!/usr/bin/env bash
set -euo pipefail

# Bootstrap inicial para Ubuntu/Debian em VPS Hostinger.
# Execute como root: sudo bash scripts/vps-bootstrap-hostinger.sh

echo "[1/6] Atualizando sistema..."
apt-get update -y
apt-get upgrade -y

echo "[2/6] Instalando pacotes base..."
apt-get install -y \
  curl \
  git \
  nginx \
  ufw \
  postgresql \
  postgresql-contrib \
  certbot \
  python3-certbot-nginx

echo "[3/6] Instalando Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "[4/6] Criando usuário de deploy 'eventos' (se necessário)..."
if ! id -u eventos >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" eventos
fi

echo "[5/6] Preparando diretório da aplicação..."
mkdir -p /home/eventos/apps
chown -R eventos:eventos /home/eventos/apps

echo "[6/6] Configurando firewall básico..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo
echo "Bootstrap concluído."
echo "Próximos passos:"
echo "1) sudo -u postgres bash scripts/setup-postgres-eventosomega.sh"
echo "2) Configurar app em /home/eventos/apps/eventos-omega"
echo "3) Publicar unit file systemd e config do nginx"
