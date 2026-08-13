#!/usr/bin/env bash
set -euo pipefail

DOMAIN=${DOMAIN:-${1:-}}
UPSTREAM_PORT=${UPSTREAM_PORT:-8090}
CERTBOT_EMAIL=${CERTBOT_EMAIL:-${2:-}}
NGINX_SITES_AVAILABLE=${NGINX_SITES_AVAILABLE:-/etc/nginx/sites-available}
NGINX_SITES_ENABLED=${NGINX_SITES_ENABLED:-/etc/nginx/sites-enabled}
CERTBOT_WEBROOT=${CERTBOT_WEBROOT:-/var/www/certbot}

if [ "${EUID}" -ne 0 ]; then
  echo "Run this script as root (for example, with sudo)."
  exit 1
fi

if [ -z "${DOMAIN}" ]; then
  if [ ! -t 0 ]; then
    echo "DOMAIN is required when running non-interactively."
    exit 1
  fi

  read -r -p "Domain name (for example, spelling.link-dynamic.com): " DOMAIN
fi

if [ -z "${CERTBOT_EMAIL}" ]; then
  if [ ! -t 0 ]; then
    echo "CERTBOT_EMAIL is required when running non-interactively."
    exit 1
  fi

  read -r -p "Email for Let's Encrypt registration and expiry notices: " CERTBOT_EMAIL
fi

if [[ -z "${DOMAIN}" || ! "${DOMAIN}" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Invalid DOMAIN: ${DOMAIN}"
  exit 1
fi

if [[ ! "${CERTBOT_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Invalid CERTBOT_EMAIL: ${CERTBOT_EMAIL}"
  exit 1
fi

if [[ ! "${UPSTREAM_PORT}" =~ ^[0-9]+$ ]] ||
  [ "${UPSTREAM_PORT}" -lt 1 ] || [ "${UPSTREAM_PORT}" -gt 65535 ]; then
  echo "UPSTREAM_PORT must be a number from 1 through 65535."
  exit 1
fi

NEEDS_PACKAGES=0

if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx is not installed."
  NEEDS_PACKAGES=1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "Certbot is not installed."
  NEEDS_PACKAGES=1
elif ! certbot plugins 2>/dev/null | grep -q '^[[:space:]]*\* nginx'; then
  echo "The Certbot nginx plugin is not installed."
  NEEDS_PACKAGES=1
fi

if [ "${NEEDS_PACKAGES}" = "1" ]; then
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Install nginx, certbot, and the Certbot nginx plugin, then run this script again."
    exit 1
  fi

  echo "Installing nginx and Certbot's nginx integration..."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx
fi

mkdir -p "${NGINX_SITES_AVAILABLE}" "${NGINX_SITES_ENABLED}" "${CERTBOT_WEBROOT}"

SITE_CONFIG="${NGINX_SITES_AVAILABLE}/${DOMAIN}.conf"
SITE_LINK="${NGINX_SITES_ENABLED}/${DOMAIN}.conf"

if [ -e "${SITE_CONFIG}" ]; then
  BACKUP="${SITE_CONFIG}.$(date +%Y%m%d%H%M%S).bak"
  cp "${SITE_CONFIG}" "${BACKUP}"
  echo "Backed up the existing configuration to ${BACKUP}"
fi

# Start with HTTP only. Nginx cannot load the TLS configuration until Certbot
# has created the certificate files referenced by it.
tee "${SITE_CONFIG}" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 20m;

    location /.well-known/acme-challenge/ {
        root ${CERTBOT_WEBROOT};
    }

    location / {
        proxy_pass http://127.0.0.1:${UPSTREAM_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sfn "${SITE_CONFIG}" "${SITE_LINK}"
nginx -t

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now nginx
  systemctl reload nginx
else
  nginx -s reload
fi

echo "Requesting a Let's Encrypt certificate for ${DOMAIN}..."
CERTIFICATE_NAME=${DOMAIN}
CERTBOT_ARGS=(
  --nginx
  --domain "${DOMAIN}"
  --email "${CERTBOT_EMAIL}"
  --agree-tos
  --non-interactive
  --redirect
  --keep-until-expiring
)

if [ "${CERTBOT_STAGING:-0}" = "1" ]; then
  CERTIFICATE_NAME="${DOMAIN}-staging"
  CERTBOT_ARGS+=(--staging --cert-name "${CERTIFICATE_NAME}")
fi

if ! certbot "${CERTBOT_ARGS[@]}"; then
  echo "Certificate issuance failed. The HTTP site remains enabled."
  echo "Verify that ${DOMAIN} resolves to this server and ports 80/443 are open, then rerun the script."
  exit 1
fi

# The certificate now exists, so it is safe to enable TLS and redirect HTTP.
tee "${SITE_CONFIG}" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root ${CERTBOT_WEBROOT};
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN};
    client_max_body_size 20m;

    ssl_certificate /etc/letsencrypt/live/${CERTIFICATE_NAME}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${CERTIFICATE_NAME}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:${UPSTREAM_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

nginx -t
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx
else
  nginx -s reload
fi

echo "Domain enabled: https://${DOMAIN} -> http://127.0.0.1:${UPSTREAM_PORT}"
