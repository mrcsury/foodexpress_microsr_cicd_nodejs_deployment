#!/usr/bin/env bash
# Install nginx on Amazon Linux 2023 and reverse-proxy port 80 -> 3000
# for bharathonlineshopping.com.
# Usage: sudo bash deploy/nginx_installation.sh
set -euo pipefail

DOMAIN="bharathonlineshopping.com"
APP_PORT=3000
CONF="/etc/nginx/conf.d/${DOMAIN}.conf"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

echo "==> Installing nginx"
dnf update -y
dnf install -y nginx

echo "==> Writing ${CONF}"
cat > "${CONF}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

echo "==> Testing config"
nginx -t

echo "==> Enabling and restarting nginx"
systemctl enable nginx
systemctl restart nginx
systemctl status nginx --no-pager

# Allow nginx to connect to the upstream app if SELinux is enforcing
if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" == "Enforcing" ]]; then
  setsebool -P httpd_can_network_connect 1
fi

echo "==> Verifying"
curl -sI -H "Host: ${DOMAIN}" http://localhost | head -n 1 || true

cat <<MSG

Done. Port 80 now proxies to 127.0.0.1:${APP_PORT}.
Make sure: the Node app is running on ${APP_PORT}, the security group allows TCP 80,
and the DNS A record for ${DOMAIN} points to this server.

Optional HTTPS:
  dnf install -y certbot python3-certbot-nginx
  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}
MSG
