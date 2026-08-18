#!/usr/bin/env bash
set -euo pipefail

# Cria usuário/banco PostgreSQL local na VPS.
# Execute como usuário postgres:
#   sudo -u postgres bash scripts/setup-postgres-eventosomega.sh

APP_DB="${APP_DB:-eventos_omega}"
APP_USER="${APP_USER:-eventos_app}"
APP_PASSWORD="${APP_PASSWORD:-}"

if [[ -z "${APP_PASSWORD}" ]]; then
  echo "Erro: defina APP_PASSWORD antes de rodar."
  echo "Exemplo:"
  echo "  APP_PASSWORD='SENHA_FORTE' sudo -u postgres bash scripts/setup-postgres-eventosomega.sh"
  exit 1
fi

psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_USER}') THEN
    CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}';
  ELSE
    ALTER ROLE ${APP_USER} WITH LOGIN PASSWORD '${APP_PASSWORD}';
  END IF;
END
\$\$;
SQL

if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname='${APP_DB}'" | grep -q 1; then
  createdb "${APP_DB}" -O "${APP_USER}"
fi

psql -d "${APP_DB}" -c "GRANT ALL PRIVILEGES ON DATABASE ${APP_DB} TO ${APP_USER};"

echo
echo "Banco PostgreSQL pronto."
echo "Use no .env.production:"
echo "DATABASE_URL=postgresql://${APP_USER}:${APP_PASSWORD}@127.0.0.1:5432/${APP_DB}?schema=public"
echo "DIRECT_URL=postgresql://${APP_USER}:${APP_PASSWORD}@127.0.0.1:5432/${APP_DB}?schema=public"
