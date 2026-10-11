#!/usr/bin/env bash
# Runs on the VM as root: installs the API (uv + FastAPI) behind Caddy with automatic HTTPS (sslip.io).
set -euo pipefail
MD=http://metadata.google.internal/computeMetadata/v1
md() { curl -fsS -H "Metadata-Flavor: Google" "$MD/$1" 2>/dev/null || true; }
IP=${1:-$(md instance/network-interfaces/0/access-configs/0/external-ip)}
[ -n "$IP" ] || { echo "no public ip"; exit 1; }
# env: /tmp/api.env (scp) or the ns-env metadata attribute (startup script); kept on disk after first boot
[ -f /tmp/api.env ] || md instance/attributes/ns-env > /tmp/api.env
HOST="api.${IP//./-}.sslip.io"
REPO=${REPO:-https://github.com/e-man07/nightly.git}
BRANCH=${BRANCH:-main}

apt-get update -qq
apt-get install -y -qq git curl >/dev/null
if ! command -v caddy >/dev/null; then
  # static binary (the cloudsmith apt repo can be unavailable)
  curl -fsSL https://github.com/caddyserver/caddy/releases/download/v2.10.2/caddy_2.10.2_linux_amd64.tar.gz | tar -xz -C /usr/local/bin caddy
  chmod +x /usr/local/bin/caddy
  id caddy >/dev/null 2>&1 || useradd --system --home /var/lib/caddy --create-home --shell /usr/sbin/nologin caddy
  mkdir -p /etc/caddy
  cat > /etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=Caddy
After=network-online.target
[Service]
User=caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
fi
id nightshift >/dev/null 2>&1 || useradd -m -s /bin/bash nightshift
sudo -u nightshift bash -c 'command -v ~/.local/bin/uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh'

git config --system --add safe.directory /opt/nightshift  # the checkout is owned by the nightshift user
if [ ! -d /opt/nightshift/.git ]; then git clone -q --branch "$BRANCH" "$REPO" /opt/nightshift; fi
git -C /opt/nightshift remote set-url origin "$REPO"
git -C /opt/nightshift fetch -q origin "$BRANCH" && git -C /opt/nightshift reset -q --hard "origin/$BRANCH"
git -C /opt/nightshift fetch -q origin '+refs/heads/_entire/*:refs/entire/*' || true
if [ -s /tmp/api.env ]; then install -m 600 -o nightshift /tmp/api.env /opt/nightshift/.env; fi
rm -f /tmp/api.env
# ns-env-patch metadata: non-secret KEY=VALUE lines that replace those keys in the kept .env (e.g. a new web domain)
PATCH=$(md instance/attributes/ns-env-patch)
if [ -n "$PATCH" ]; then
  while IFS= read -r line; do
    k=${line%%=*}
    [[ "$k" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    sed -i "/^$k=/d" /opt/nightshift/.env
    printf '%s\n' "$line" >> /opt/nightshift/.env
  done <<< "$PATCH"
fi
grep -q '^PUBLIC_API_URL=' /opt/nightshift/.env || echo "PUBLIC_API_URL=https://$HOST" >> /opt/nightshift/.env
chown -R nightshift /opt/nightshift
sudo -u nightshift bash -c 'cd /opt/nightshift/backend && ~/.local/bin/uv sync -q'

cat > /etc/systemd/system/nightshift-api.service <<UNIT
[Unit]
Description=Nightly API
After=network-online.target
[Service]
User=nightshift
WorkingDirectory=/opt/nightshift/backend
EnvironmentFile=/opt/nightshift/.env
ExecStart=/opt/nightshift/backend/.venv/bin/uvicorn api.server:app --host 127.0.0.1 --port 8000 --proxy-headers
Restart=always
[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
  encode gzip
  reverse_proxy 127.0.0.1:8000 {
    flush_interval -1
  }
}
CADDY
# Optional: run the Scout sample agent (needs scout-env metadata on first boot: NIGHTLY_AGENT_TOKEN, SCOUT_RATE)
md instance/attributes/scout-env > /tmp/scout.env
if [ -s /tmp/scout.env ]; then
  { cat /tmp/scout.env; echo "NIGHTLY_API_URL=http://127.0.0.1:8000"; } > /opt/nightshift/scout.env
  chown nightshift /opt/nightshift/scout.env; chmod 600 /opt/nightshift/scout.env
fi
rm -f /tmp/scout.env
if [ -f /opt/nightshift/scout.env ]; then
  cat > /etc/systemd/system/nightshift-scout.service <<UNIT
[Unit]
Description=Scout sample agent (Lumen docs assistant)
After=nightshift-api.service
[Service]
User=nightshift
WorkingDirectory=/opt/nightshift/agents/scout
EnvironmentFile=/opt/nightshift/.env
EnvironmentFile=/opt/nightshift/scout.env
ExecStart=/bin/bash -c 'exec /opt/nightshift/backend/.venv/bin/python scout.py serve --rate \${SCOUT_RATE:-0.5}'
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
UNIT
  SCOUT=1
fi
systemctl daemon-reload
systemctl enable --now nightshift-api caddy
systemctl restart nightshift-api caddy
# scout-enabled=false metadata pauses the sample agent (it spends LLM budget); the API stays up
if [ "$(md instance/attributes/scout-enabled)" = "false" ]; then
  systemctl disable --now nightshift-scout 2>/dev/null || true
elif [ -n "${SCOUT:-}" ]; then systemctl enable nightshift-scout; systemctl restart nightshift-scout; fi
sleep 4
for i in $(seq 1 30); do curl -fsS "https://$HOST/api/health" >/dev/null 2>&1 && break; sleep 5; done
curl -fsS "https://$HOST/api/health" && echo && echo "NIGHTSHIFT_READY https://$HOST"
