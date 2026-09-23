#!/bin/sh
set -eu

# Usage: AINALYM_DEPLOY_ENV_FILE=/path/to/keychain-built.env scripts/deploy/hetzner.sh <ipv4>
# The environment file is copied only to /etc/ainalym.env on the host.
ip=${1:-}
case "$ip" in
  *[!0-9.]*|""|.*|*.) printf 'Expected an IPv4 address.\n' >&2; exit 2 ;;
esac
old_ifs=$IFS
IFS=.
set -- $ip
IFS=$old_ifs
if [ "$#" -ne 4 ]; then printf 'Expected an IPv4 address.\n' >&2; exit 2; fi
for octet do
  if [ -z "$octet" ] || [ "$octet" -gt 255 ] 2>/dev/null; then printf 'Invalid IPv4 address.\n' >&2; exit 2; fi
done
: "${AINALYM_DEPLOY_ENV_FILE:?Point to the Keychain-built environment file}"
test -r "$AINALYM_DEPLOY_ENV_FILE"
awk -F= '
  /^[[:space:]]*(#|$)/ { next }
  {
    name=$1
    value=substr($0, index($0, "=") + 1)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
    present=(value != "" && value != "\"\"" && value != "\047\047")
    if (name !~ /^(DEMO_ACCESS_CODE|DEMO_DAILY_LIVE_CALLS|OPENAI_API_KEY|AI_GATEWAY_API_KEY|TYPESAFE_API_KEY|OPENAI_MODEL|AI_PROVIDER|AINALYM_FEED_AUTOPLAY)$/) bad=1
    if (name == "DEMO_ACCESS_CODE" && present) access=1
    if (name == "OPENAI_API_KEY" && present) openai=1
    if (name == "AI_GATEWAY_API_KEY" && present) gateway=1
  }
  END { exit (bad || !access || !openai || !gateway) }
' "$AINALYM_DEPLOY_ENV_FILE" || { printf 'Deployment environment is missing required names or contains an unexpected name.\n' >&2; exit 2; }
test -f package-lock.json
if [ -n "$(git status --porcelain)" ]; then printf 'Commit the release before deployment.\n' >&2; exit 2; fi
command -v rsync >/dev/null
command -v ssh >/dev/null

release=$(git rev-parse --short=12 HEAD)
domain=${AINALYM_DOMAIN:-$ip.sslip.io}
case "$domain" in *[!a-zA-Z0-9.-]*|""|.*|*.) printf 'Invalid domain.\n' >&2; exit 2 ;; esac
ssh_key=${AINALYM_HOST_SSH_KEY:-$HOME/.ssh/ainalym_demo}
test -r "$ssh_key"
ssh_opts="-i $ssh_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
remote="root@$ip"

# Build in a clean directory so .env.local and all credentials stay out of the bundle.
stage=$(mktemp -d /tmp/ainalym-deploy.XXXXXX)
trap 'if [ -d "$stage" ]; then rm -r "$stage"; fi' EXIT INT TERM
rsync -a --exclude='.env*' --exclude='.git' --exclude='node_modules' --exclude='.next' \
  package.json package-lock.json next.config.ts tsconfig.json src public fixtures scripts "$stage/"
# Standalone is a build-only setting. Keep the tracked Next config unchanged.
node - "$stage/next.config.ts" <<'STANDALONE_CONFIG'
const fs = require("node:fs");
const path = process.argv[2];
const source = fs.readFileSync(path, "utf8");
const marker = /const nextConfig:\s*NextConfig\s*=\s*\{/;
if (!marker.test(source)) throw new Error("Cannot set standalone output in staged config");
fs.writeFileSync(path, source.replace(marker, (match) => `${match}\n  output: "standalone",`));
STANDALONE_CONFIG
(
  cd "$stage"
  npm ci
  env -u OPENAI_API_KEY -u AI_GATEWAY_API_KEY -u TYPESAFE_API_KEY -u NVIDIA_API_KEY -u DEMO_ACCESS_CODE npm run build
)

# Install the runtime and reverse proxy once. The remote box never runs next build.
# shellcheck disable=SC2086
ssh $ssh_opts "$remote" bash -s -- "$release" <<'REMOTE_BOOTSTRAP'
set -eu
release=$1
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg rsync
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -ne 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/ainalym-node-setup.sh
  bash /tmp/ainalym-node-setup.sh
  rm -f /tmp/ainalym-node-setup.sh
  apt-get install -y -qq nodejs
fi
if ! command -v caddy >/dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi
id ainalym >/dev/null 2>&1 || useradd --system --home /var/lib/ainalym --shell /usr/sbin/nologin ainalym
install -d -o ainalym -g ainalym -m 750 /var/lib/ainalym
install -d -m 755 /opt/ainalym/releases/"$release"
REMOTE_BOOTSTRAP

# rsync's source list is explicit: no .env files, git data, or local database.
# shellcheck disable=SC2086
rsync -az --delete -e "ssh $ssh_opts" "$stage/.next/standalone/" "$remote:/opt/ainalym/releases/$release/"
# shellcheck disable=SC2086
rsync -az -e "ssh $ssh_opts" "$stage/.next/static/" "$remote:/opt/ainalym/releases/$release/.next/static/"
# shellcheck disable=SC2086
rsync -az -e "ssh $ssh_opts" "$stage/public" "$stage/src" "$stage/fixtures" "$stage/scripts" \
  "$stage/package.json" "$stage/package-lock.json" "$remote:/opt/ainalym/releases/$release/"
# The receiving file is created with mode 600 before any secret bytes arrive.
# shellcheck disable=SC2086
ssh $ssh_opts "$remote" 'install -o root -g root -m 600 /dev/null /etc/ainalym.env.new && cat > /etc/ainalym.env.new' < "$AINALYM_DEPLOY_ENV_FILE"

# shellcheck disable=SC2086
ssh $ssh_opts "$remote" bash -s -- "$release" "$domain" <<'REMOTE_ACTIVATE'
set -eu
release=$1
domain=$2
app=/opt/ainalym
cd "$app/releases/$release"
npm ci --include=dev
chown -R ainalym:ainalym "$app/releases/$release"
previous=$(readlink "$app/current" || true)
had_env=0
if [ -f /etc/ainalym.env ]; then cp -p /etc/ainalym.env /etc/ainalym.env.previous; had_env=1; fi
if [ -f /etc/caddy/Caddyfile ]; then cp -p /etc/caddy/Caddyfile /etc/caddy/Caddyfile.previous; fi
if [ -f /etc/systemd/system/ainalym.service ]; then cp -p /etc/systemd/system/ainalym.service /etc/systemd/system/ainalym.service.previous; fi
healthy=0
rollback() {
  if [ "$had_env" -eq 1 ]; then cp -p /etc/ainalym.env.previous /etc/ainalym.env; else rm -f /etc/ainalym.env; fi
  if [ -f /etc/caddy/Caddyfile.previous ]; then cp -p /etc/caddy/Caddyfile.previous /etc/caddy/Caddyfile; fi
  if [ -f /etc/systemd/system/ainalym.service.previous ]; then cp -p /etc/systemd/system/ainalym.service.previous /etc/systemd/system/ainalym.service; fi
  if [ -n "$previous" ]; then
    ln -sfn "$previous" "$app/current.new"
    mv -Tf "$app/current.new" "$app/current"
    systemctl daemon-reload
    systemctl restart ainalym || true
  else
    systemctl stop ainalym || true
  fi
  systemctl restart caddy || true
}
trap 'if [ "$healthy" -ne 1 ]; then rollback; fi' EXIT
install -o root -g root -m 600 /etc/ainalym.env.new /etc/ainalym.env
rm -f /etc/ainalym.env.new
ln -sfn "$app/releases/$release" "$app/current.new"
mv -Tf "$app/current.new" "$app/current"
cat >/etc/systemd/system/ainalym.service <<'UNIT'
[Unit]
Description=Ainalym hosted demo
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ainalym
Group=ainalym
WorkingDirectory=/opt/ainalym/current
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_PATH=/var/lib/ainalym/ainalym.db
Environment=AINALYM_MODE=live
Environment=AINALYM_WORKER=1
EnvironmentFile=/etc/ainalym.env
ExecStartPre=/opt/ainalym/current/scripts/deploy/first_etl.sh
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/ainalym /opt/ainalym/current/.next

[Install]
WantedBy=multi-user.target
UNIT
printf '%s {\n    reverse_proxy 127.0.0.1:3000\n}\n' "$domain" >/etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now ainalym caddy
systemctl restart ainalym caddy

for _attempt in $(seq 1 24); do
  if curl -fsS "https://$domain/api/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 5
done
if [ "$healthy" -ne 1 ]; then
  printf 'Deployment health failed; previous release restored when available.\n' >&2
  exit 1
fi
printf 'Demo HTTPS health is ready. Give the owner the URL and access code through the platform only.\n'
REMOTE_ACTIVATE
