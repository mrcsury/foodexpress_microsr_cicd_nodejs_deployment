#!/usr/bin/env bash
# FoodExpress - CodeDeploy "ValidateService" hook.
# Exits non-zero (which fails the deployment) if the app does not answer /health.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/foodexpress}"
SERVICE_NAME="${SERVICE_NAME:-foodexpress}"

# Read the port from the app's .env file (default 3000).
PORT="$(grep -E '^PORT=' "$APP_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2 || true)"
PORT="$(printf '%s' "$PORT" | tr -d '[:space:]"')"
PORT="${PORT:-3000}"

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "FoodExpress is healthy on port ${PORT}."
    exit 0
  fi
  sleep 1
done

echo "ERROR: FoodExpress did not answer http://127.0.0.1:${PORT}/health" >&2
journalctl -u "$SERVICE_NAME" -n 30 --no-pager >&2 || true
exit 1
