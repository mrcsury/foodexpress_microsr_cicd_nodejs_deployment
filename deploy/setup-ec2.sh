#!/usr/bin/env bash
# FoodExpress - setup script for Amazon Linux 2023 (run on the EC2 instance).
#
# What it does (safe to re-run):
#   1. Installs Node.js 20+ (if not already installed)
#   2. Copies the app to APP_DIR and installs production dependencies
#   3. Creates a .env file from .env.example ONLY if one does not exist (never overwrites it, never prints it)
#   4. Creates + enables a systemd service (starts on boot, restarts on failure)
#
# Usage (from the project folder you cloned/uploaded to the server):
#   sudo ./deploy/setup-ec2.sh
#   sudo APP_DIR=/srv/foodexpress APP_PORT=8080 ./deploy/setup-ec2.sh
#
# Settings (environment variables, all optional):
#   APP_DIR       where the app is installed          (default /opt/foodexpress)
#   APP_PORT      port written to a NEW .env file     (default 3000)
#   APP_USER      Linux user that runs the service    (default foodexpress)
#   SERVICE_NAME  systemd service name                (default foodexpress)

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/foodexpress}"
APP_PORT="${APP_PORT:-3000}"
APP_USER="${APP_USER:-foodexpress}"
SERVICE_NAME="${SERVICE_NAME:-foodexpress}"
NODE_MAJOR_REQUIRED=20

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log()  { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Please run with sudo:  sudo $0"
[[ "$APP_PORT" =~ ^[0-9]+$ ]] && (( APP_PORT >= 1 && APP_PORT <= 65535 )) || fail "APP_PORT must be a number from 1 to 65535"
[[ "$APP_DIR" == /* ]] || fail "APP_DIR must be an absolute path"
[[ "$APP_DIR" != "/" ]] || fail "APP_DIR cannot be /"
[[ "$SRC_DIR" != "$APP_DIR" || -f "$APP_DIR/server.js" ]] || fail "server.js not found in $SRC_DIR"
[[ -f "$SRC_DIR/package.json" ]] || fail "package.json not found in $SRC_DIR - run this script from the project folder"

node_major() { command -v node >/dev/null 2>&1 && node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

# ---------- 1. Node.js ----------
log "Checking Node.js (need $NODE_MAJOR_REQUIRED+)"
if (( $(node_major) < NODE_MAJOR_REQUIRED )); then
  log "Installing Node.js $NODE_MAJOR_REQUIRED from the Amazon Linux repositories"
  dnf install -y "nodejs${NODE_MAJOR_REQUIRED}" "nodejs${NODE_MAJOR_REQUIRED}-npm" || true
fi
if (( $(node_major) < NODE_MAJOR_REQUIRED )); then
  log "Falling back to the NodeSource repository"
  curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR_REQUIRED}.x" | bash -
  dnf install -y nodejs
fi
(( $(node_major) >= NODE_MAJOR_REQUIRED )) || fail "Could not install Node.js $NODE_MAJOR_REQUIRED or newer"
NODE_BIN="$(command -v node)"
echo "Using $NODE_BIN ($(node -v)), npm $(npm -v)"

# ---------- 2. User + files ----------
if ! id "$APP_USER" >/dev/null 2>&1; then
  log "Creating system user $APP_USER"
  useradd --system --home-dir "$APP_DIR" --shell /sbin/nologin "$APP_USER"
fi

log "Installing application files into $APP_DIR"
mkdir -p "$APP_DIR"
if [[ "$SRC_DIR" != "$APP_DIR" ]]; then
  # Copy everything except secrets, git data and installed modules. An existing .env in APP_DIR is untouched.
  tar -C "$SRC_DIR" --exclude='./.git' --exclude='./node_modules' --exclude='./.env' -cf - . | tar -C "$APP_DIR" -xf -
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

log "Installing production dependencies"
if [[ -f "$APP_DIR/package-lock.json" ]]; then
  runuser -u "$APP_USER" -- bash -c "cd '$APP_DIR' && npm ci --omit=dev"
else
  runuser -u "$APP_USER" -- bash -c "cd '$APP_DIR' && npm install --omit=dev"
fi

# ---------- 3. .env (never overwritten, never printed) ----------
ENV_FILE="$APP_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  log "$ENV_FILE already exists - leaving it unchanged"
else
  log "Creating $ENV_FILE from .env.example"
  cp "$APP_DIR/.env.example" "$ENV_FILE"
  sed -i "s/^PORT=.*/PORT=${APP_PORT}/" "$ENV_FILE"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ---------- 4. systemd service ----------
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
log "Writing $UNIT_FILE"
cat > "$UNIT_FILE" <<EOF
[Unit]
Description=FoodExpress monolithic food ordering app
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
# Settings such as SMTP_* and PORT are read from ${ENV_FILE} by the app (dotenv).
Environment=NODE_ENV=production
ExecStart=${NODE_BIN} server.js
Restart=on-failure
RestartSec=5
# Basic hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
systemctl restart "$SERVICE_NAME"

# ---------- 5. Check ----------
PORT_IN_USE="$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2 | tr -d '[:space:]"' || true)"
PORT_IN_USE="${PORT_IN_USE:-3000}"
log "Waiting for the app to answer on port ${PORT_IN_USE}"
healthy=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${PORT_IN_USE}/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 1
done

if (( healthy )); then
  echo "FoodExpress is running."
else
  echo "The service did not answer /health yet. Check: sudo journalctl -u ${SERVICE_NAME} -n 50 --no-pager" >&2
fi

cat <<EOF

--------------------------------------------------------------
 Done. Useful commands:
   sudo systemctl status ${SERVICE_NAME}
   sudo journalctl -u ${SERVICE_NAME} -f
   curl http://127.0.0.1:${PORT_IN_USE}/health

 Configure email (SMTP) - the .env file was NOT printed:
   sudo nano ${ENV_FILE}        # fill in SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM
   sudo systemctl restart ${SERVICE_NAME}

 Open the port in the EC2 Security Group (see README) and browse to:
   http://<your-ec2-public-ip>:${PORT_IN_USE}
--------------------------------------------------------------
EOF
