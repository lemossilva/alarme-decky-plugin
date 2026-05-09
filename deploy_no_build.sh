#!/bin/bash
# Deploy script for AlarMe Decky Plugin (no local build step)
# Usage: ./deploy_no_build.sh [DECK_IP]

PLUGIN_NAME="alarme-decky-plugin"
DECK_USER="deck"
DECK_IP="${1:-${DECK_IP:-192.168.1.100}}"
PLUGIN_PATH="/home/deck/homebrew/plugins/${PLUGIN_NAME}"
TMP_PATH="/home/deck/tmp/${PLUGIN_NAME}"

SSH_OPTS="-o ControlMaster=auto -o ControlPath=/tmp/ssh_alarme_%h -o ControlPersist=60"

echo "=== AlarMe Deployment Script (no build) ==="
echo "Target: ${DECK_USER}@${DECK_IP}"
echo ""

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
ssh $SSH_OPTS -t ${DECK_USER}@${DECK_IP} "sudo mkdir -p ${PLUGIN_PATH} && sudo rsync -av --delete ${TMP_PATH}/ ${PLUGIN_PATH}/ && sudo chmod -R 755 ${PLUGIN_PATH} && sudo chown -R root:root ${PLUGIN_PATH} && rm -rf ${TMP_PATH}"

if [ $? -ne 0 ]; then
    echo "Installation failed!"
    exit 1
fi

echo "Restarting Decky Loader..."
ssh $SSH_OPTS -t ${DECK_USER}@${DECK_IP} "sudo systemctl restart plugin_loader"

ssh -O exit -o ControlPath=/tmp/ssh_alarme_%h ${DECK_USER}@${DECK_IP} 2>/dev/null

echo ""
echo "AlarMe deployment complete."
