#!/bin/bash

# Copies the built plugin (dist/) into the running BBB Docker container, at the same path the
# debian package installs it to, so it is served at /plugins/bbb-plugin-smart-slide-link/.
# Usage:  ./scripts/copy-plugin-to-container.sh [containerName]
#
# containerName defaults to $LOCAL_CONTAINER_NAME from .env when omitted.

set -e

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
PLUGIN_ROOT="$SCRIPT_DIR/.."

# Load .env from the plugin root
ENV_FILE="$PLUGIN_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  set -o allexport
  source "$ENV_FILE"
  set +o allexport
fi

PLUGIN_NAME="bbb-plugin-smart-slide-link"
CONTAINER_NAME=${1:-$LOCAL_CONTAINER_NAME}

if [ -z "$CONTAINER_NAME" ]; then
  echo "Container name is not provided. Pass it as an argument or set LOCAL_CONTAINER_NAME in .env."
  exit 1
fi

PLUGIN_CONTAINER_PATH="/var/www/bigbluebutton-default/assets/plugins/$PLUGIN_NAME"

if ! docker ps -q --filter "name=$CONTAINER_NAME" | grep -q .; then
  echo "Container '$CONTAINER_NAME' is not running. Exiting."
  exit 1
fi

if [ ! -d "$PLUGIN_ROOT/dist" ]; then
  echo "dist/ folder not found. Run 'npm run build-bundle' first."
  exit 1
fi

docker exec "$CONTAINER_NAME" rm -rf "$PLUGIN_CONTAINER_PATH"
docker exec "$CONTAINER_NAME" mkdir -p "$PLUGIN_CONTAINER_PATH"
docker cp "$PLUGIN_ROOT/dist/." "$CONTAINER_NAME:$PLUGIN_CONTAINER_PATH"

echo "Done. Plugin deployed to $CONTAINER_NAME at $PLUGIN_CONTAINER_PATH"
