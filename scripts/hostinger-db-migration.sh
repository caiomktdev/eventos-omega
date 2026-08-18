#!/usr/bin/env bash
set -euo pipefail

# Migração de banco para Hostinger PostgreSQL
# Uso:
# 1) Preencha as variáveis abaixo (ou exporte no shell)
# 2) Rode: bash scripts/hostinger-db-migration.sh

SOURCE_DB_URL="${SOURCE_DB_URL:-postgresql://caiohenrique@localhost:5432/eventos_omega}"
TARGET_DB_URL="${TARGET_DB_URL:-}"
BACKUP_SQL_PATH="${BACKUP_SQL_PATH:-backup_eventosomega.sql}"

if [[ -z "${TARGET_DB_URL}" ]]; then
  echo "Erro: defina TARGET_DB_URL com a URL do PostgreSQL da Hostinger."
  echo "Exemplo:"
  echo "  export TARGET_DB_URL='postgresql://USER:PASS@HOST:5432/DBNAME'"
  exit 1
fi

echo "1) Exportando backup SQL de origem..."
pg_dump "${SOURCE_DB_URL}" > "${BACKUP_SQL_PATH}"
echo "   Backup criado em: ${BACKUP_SQL_PATH}"

echo "2) Validando conexão com banco de destino..."
psql "${TARGET_DB_URL}" -c "SELECT 1;" > /dev/null
echo "   Conexão OK."

echo "3) Restaurando backup no banco da Hostinger..."
psql "${TARGET_DB_URL}" < "${BACKUP_SQL_PATH}"
echo "   Restore concluído."

echo "4) Banco migrado. Próximos passos:"
echo "   - Configurar DATABASE_URL e DIRECT_URL na Hostinger"
echo "   - Rodar deploy da aplicação"
