#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}
PROJECT_NAME=${PROJECT_NAME:-spelling_bee_prod}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is required but not available."
  exit 1
fi

echo "Deploying with ${COMPOSE_FILE} (project: ${PROJECT_NAME})"
docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" up -d --build

echo "Deployment complete. Current service status:"
docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" ps

echo
echo "Checking dictionary data status..."
DICT_COUNT=$(docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" exec -T mysql \
  mysql -N -uroot -ppassword -D spelling_bee -e "SELECT COUNT(*) FROM dictionary_entries;" 2>/dev/null || echo "0")

if [ "${DICT_COUNT}" = "0" ]; then
  cat <<'WARN'
WARNING: dictionary_entries is empty, so uploaded words will not get meanings/pronunciations yet.

Load dictionary data with:
1) Download Kaikki dictionary to backend/data:
   curl -L "https://kaikki.org/dictionary/English/words/kaikki.org-dictionary-English-words.jsonl.gz" -o backend/data/kaikki-en.jsonl.gz
   gunzip -f backend/data/kaikki-en.jsonl.gz

2) Import into MySQL:
   docker compose -f docker-compose.prod.yml -p spelling_bee_prod exec backend npm run import:dictionary
WARN
else
  echo "Dictionary entries available: ${DICT_COUNT}"
fi
