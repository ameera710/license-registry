#!/usr/bin/env bash
set -euo pipefail

FABRIC="${FABRIC_NETWORK_DIR:-$HOME/IT670/license-network}"

if [ ! -d "$FABRIC" ]; then
    echo "ERROR: Fabric network directory not found: $FABRIC"
    exit 1
fi

export DOCKER_SOCK="${DOCKER_SOCK:-$HOME/.docker/run/docker.sock}"

echo "Stopping Hyperledger Fabric containers..."

cd "$FABRIC"

docker compose \
  -f compose/compose-test-net.yaml \
  -f compose/docker/docker-compose-test-net.yaml \
  -f addOrg3/compose/compose-org3.yaml \
  -f addOrg3/compose/docker/docker-compose-org3.yaml \
  stop

echo "Fabric containers stopped. Ledger volumes preserved."
