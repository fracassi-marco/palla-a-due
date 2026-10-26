#!/usr/bin/env bash
# Pubblica il server sul VPS: build, rsync, npm ci, installazione delle unità systemd e riavvio dell'API.
# Uso (dalla cartella server/): ./deploy.sh fraca@<ip-del-vps>
set -euo pipefail

TARGET="${1:?uso: ./deploy.sh utente@host}"
APP=/opt/palla-a-due/app

cd "$(dirname "$0")"
npm ci
npm run build

# node_modules resta sul server (si aggiorna con npm ci), il resto è specchiato.
rsync -az --delete --exclude node_modules dist/ package.json package-lock.json "$TARGET:$APP/"
rsync -az --delete systemd/ "$TARGET:$APP/systemd/"

ssh -t "$TARGET" "set -e
cd $APP && npm ci --omit=dev
sudo cp $APP/systemd/palla-a-due-sync@* $APP/systemd/palla-a-due-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now palla-a-due-sync@{lnp-a2,lnp-b,lba,euroleague,nba,wnba}.timer
sudo systemctl enable palla-a-due-api.service
sudo systemctl restart palla-a-due-api.service
systemctl list-timers 'palla-a-due-*' --no-pager
systemctl is-active palla-a-due-api.service"
