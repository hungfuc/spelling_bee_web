#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
CONFIG_FILE=${CONFIG_FILE:-${SCRIPT_DIR}/backend/config.json}
UPLOAD_TOKEN=${UPLOAD_TOKEN:-}
TEST_TOKEN=${TEST_TOKEN:-}

usage() {
  cat <<'EOF'
Usage: ./setup-config.sh [upload-token] [test-token]

If a token is omitted, the script prompts for it. Leave a prompt blank to
generate a secure random token. For unattended use, set UPLOAD_TOKEN and
TEST_TOKEN or allow the script to generate any missing values.
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

UPLOAD_TOKEN=${UPLOAD_TOKEN:-${1:-}}
TEST_TOKEN=${TEST_TOKEN:-${2:-}}

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate secure tokens."
  exit 1
fi

generate_token() {
  openssl rand -hex 32
}

if [ -t 0 ]; then
  if [ -z "${UPLOAD_TOKEN}" ]; then
    read -r -s -p "Upload token (leave blank to generate one): " UPLOAD_TOKEN
    echo
  fi

  if [ -z "${TEST_TOKEN}" ]; then
    read -r -s -p "Test token (leave blank to generate one): " TEST_TOKEN
    echo
  fi
fi

if [ -z "${UPLOAD_TOKEN}" ]; then
  UPLOAD_TOKEN=$(generate_token)
fi

if [ -z "${TEST_TOKEN}" ]; then
  TEST_TOKEN=$(generate_token)
fi

# Restrict tokens to characters that are safe in JSON and HTTP headers.
if [[ ! "${UPLOAD_TOKEN}" =~ ^[A-Za-z0-9._~-]+$ ]]; then
  echo "Upload token may contain only letters, numbers, '.', '_', '~', and '-'."
  exit 1
fi

if [[ ! "${TEST_TOKEN}" =~ ^[A-Za-z0-9._~-]+$ ]]; then
  echo "Test token may contain only letters, numbers, '.', '_', '~', and '-'."
  exit 1
fi

if [ -e "${CONFIG_FILE}" ]; then
  if [ "${FORCE:-0}" != "1" ]; then
    if [ ! -t 0 ]; then
      echo "${CONFIG_FILE} already exists. Set FORCE=1 to replace it."
      exit 1
    fi

    read -r -p "${CONFIG_FILE} already exists. Replace it? [y/N] " CONFIRM
    case "${CONFIRM}" in
      y|Y|yes|YES) ;;
      *) echo "Configuration was not changed."; exit 0 ;;
    esac
  fi

  BACKUP_FILE="${CONFIG_FILE}.$(date +%Y%m%d%H%M%S).bak"
  cp "${CONFIG_FILE}" "${BACKUP_FILE}"
  chmod 600 "${BACKUP_FILE}"
  echo "Backed up the existing configuration to ${BACKUP_FILE}"
fi

mkdir -p "$(dirname -- "${CONFIG_FILE}")"
umask 077
TEMP_FILE=$(mktemp "${CONFIG_FILE}.tmp.XXXXXX")
trap 'rm -f "${TEMP_FILE}"' EXIT

tee "${TEMP_FILE}" >/dev/null <<EOF
{
  "uploadToken": "${UPLOAD_TOKEN}",
  "testToken": "${TEST_TOKEN}",
  "ttsRequestTimeoutMs": 300000,
  "ttsRetryWindowMs": 330000,
  "ttsRetryDelayMs": 1500,
  "ttsShortRetryWindowMs": 4000
}
EOF

mv "${TEMP_FILE}" "${CONFIG_FILE}"
trap - EXIT
chmod 600 "${CONFIG_FILE}"

cat <<EOF
Created ${CONFIG_FILE}

Upload token: ${UPLOAD_TOKEN}
Test token:   ${TEST_TOKEN}

Keep these tokens private. For production, rebuild the backend with:
docker compose -f docker-compose.prod.yml -p spelling_bee_prod up -d --build backend
EOF
