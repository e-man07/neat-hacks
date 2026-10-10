#!/usr/bin/env bash
# Runs on the VM as root: installs the API (uv + FastAPI) behind Caddy with automatic HTTPS (sslip.io).
set -euo pipefail
IP=${1:?public ip}
HOST="api.${IP//./-}.sslip.io"
REPO=${REPO:-https://github.com/e-man07/neat-hacks.git}
BRANCH=${BRANCH:-main}

apt-get update -qq
apt-get install -y -qq git curl debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
id nightshift >/dev/null 2>&1 || useradd -m -s /bin/bash nightshift
sudo -u nightshift bash -c 'command -v ~/.local/bin/uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh'

if [ ! -d /opt/nightshift/.git ]; then git clone -q --branch "$BRANCH" "$REPO" /opt/nightshift; fi
git -C /opt/nightshift fetch -q origin "$BRANCH" && git -C /opt/nightshift reset -q --hard "origin/$BRANCH"
git -C /opt/nightshift fetch -q origin '+refs/heads/_entire/*:refs/entire/*' || true
install -m 600 -o nightshift /tmp/api.env /opt/nightshift/.env
grep -q '^PUBLIC_API_URL=' /opt/nightshift/.env || echo "PUBLIC_API_URL=https://$HOST" >> /opt/nightshift/.env
chown -R nightshift /opt/nightshift
sudo -u nightshift bash -c 'cd /opt/nightshift/backend && ~/.local/bin/uv sync -q'

cat > /etc/systemd/system/nightshift-api.service <<UNIT
[Unit]
Description=Night Shift API
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
systemctl daemon-reload
systemctl enable --now nightshift-api
systemctl restart nightshift-api caddy
sleep 4
curl -fsS "https://$HOST/api/health" && echo && echo "Night Shift API is live at https://$HOST"
