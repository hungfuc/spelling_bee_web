#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}
PROJECT_NAME=${PROJECT_NAME:-spelling_bee_prod}
DOWNLOAD_URL=${DICTIONARY_DOWNLOAD_URL:-https://kaikki.org/dictionary/English/words/kaikki.org-dictionary-English-words.jsonl.gz}
DATA_DIR=${DATA_DIR:-backend/data}
GZ_FILE=${GZ_FILE:-${DATA_DIR}/kaikki-en.jsonl.gz}
JSONL_FILE=${JSONL_FILE:-${DATA_DIR}/kaikki-en.jsonl}
FORCE_DOWNLOAD=${FORCE_DOWNLOAD:-0}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is required but not available."
  exit 1
fi

mkdir -p "${DATA_DIR}"

if [ "${FORCE_DOWNLOAD}" = "1" ] || [ ! -f "${JSONL_FILE}" ]; then
  echo "Downloading dictionary from: ${DOWNLOAD_URL}"
  if command -v curl >/dev/null 2>&1; then
    curl -fL "${DOWNLOAD_URL}" -o "${GZ_FILE}"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "${GZ_FILE}" "${DOWNLOAD_URL}"
  else
    echo "Neither curl nor wget is available for download."
    exit 1
  fi

  echo "Extracting ${GZ_FILE} -> ${JSONL_FILE}"
  gunzip -f "${GZ_FILE}"
else
  echo "Dictionary file already exists at ${JSONL_FILE}. Skipping download."
  echo "Set FORCE_DOWNLOAD=1 to download a fresh copy."
fi

echo "Ensuring required services are running..."
docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" up -d mysql backend

echo "Importing dictionary into MySQL..."
docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" exec backend npm run import:dictionary

echo "Verifying dictionary row count..."
docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" exec -T mysql \
  mysql -uroot -ppassword -D spelling_bee -e "SELECT COUNT(*) AS dictionary_count FROM dictionary_entries;"

echo "Dictionary setup complete."
