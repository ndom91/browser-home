#!/bin/sh
# Installs (or reinstalls) the launchd agent that keeps the server running.
set -eu

LABEL="com.ndom91.browser-home"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
sed "s|__REPO_DIR__|$REPO_DIR|" "$REPO_DIR/launchd/$LABEL.plist" > "$TARGET"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$TARGET"

echo "Installed $TARGET (repo: $REPO_DIR)"
echo "Logs: ~/Library/Logs/browser-home.log"
