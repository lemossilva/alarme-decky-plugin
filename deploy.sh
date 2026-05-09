#!/bin/bash
# Deploy script for AlarMe Decky Plugin
# Usage: ./deploy.sh [DECK_IP]

PLUGIN_NAME="alarme-decky-plugin"
DECK_USER="deck"
DECK_IP="${1:-${DECK_IP:-192.168.1.100}}"
PLUGIN_PATH="/home/deck/homebrew/plugins/${PLUGIN_NAME}"
TMP_PATH="/home/deck/tmp/${PLUGIN_NAME}"

SSH_OPTS="-o ControlMaster=auto -o ControlPath=/tmp/ssh_alarme_%h -o ControlPersist=60"

echo "=== AlarMe Deployment Script ==="
echo "Target: ${DECK_USER}@${DECK_IP}"
echo ""

echo "Connecting to Deck..."
ssh $SSH_OPTS ${DECK_USER}@${DECK_IP} "echo Connected"
if [ $? -ne 0 ]; then
    echo "SSH connection failed!"
    exit 1
fi

echo "Building plugin..."
pnpm run build
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Preparing temporary directory on Deck..."
ssh $SSH_OPTS ${DECK_USER}@${DECK_IP} "mkdir -p ${TMP_PATH}"

echo "Copying files to temporary directory..."
rsync -avz --delete \
    -e "ssh $SSH_OPTS" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'out' \
    --exclude '.vscode' \
    --exclude '*.log' \
    ./ ${DECK_USER}@${DECK_IP}:${TMP_PATH}/

if [ $? -ne 0 ]; then
    echo "File transfer failed!"
    exit 1
fi

echo "Installing plugin..."
ssh $SSH_OPTS -t ${DECK_USER}@${DECK_IP} "
  sudo bash -c '
    mkdir -p ${PLUGIN_PATH} &&
    rsync -av --delete ${TMP_PATH}/ ${PLUGIN_PATH}/ &&
    chmod -R 755 ${PLUGIN_PATH} &&
    chown -R root:root ${PLUGIN_PATH} &&
    systemctl restart plugin_loader
  ' &&
  rm -rf ${TMP_PATH}
"

ssh -O exit -o ControlPath=/tmp/ssh_alarme_%h ${DECK_USER}@${DECK_IP} 2>/dev/null

echo ""
echo "AlarMe deployment complete."
