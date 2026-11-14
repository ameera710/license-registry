#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FABRIC="${FABRIC_NETWORK_DIR:-$ROOT/network/fabric}"

# Use Fabric binaries installed on the host.
# Optionally set FABRIC_BIN_DIR to their location.
if [ -n "${FABRIC_BIN_DIR:-}" ]; then
    export PATH="$FABRIC_BIN_DIR:$PATH"
fi

for tool in docker peer cryptogen configtxgen configtxlator jq; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "ERROR: Required tool not found: $tool"
        exit 1
    fi
done
export DOCKER_SOCK="${DOCKER_SOCK:-$HOME/.docker/run/docker.sock}"

cd "$FABRIC"

if [ "${1:-}" = "--fresh" ]; then
    echo "Checking for existing Fabric containers..."

    if docker ps -a --format '{{.Names}}' |
       grep -Eq '^(orderer\.example\.com|peer0\.org[123]\.example\.com)$'; then
        echo "ERROR: Existing Fabric containers detected."
        echo "Fresh initialization cancelled to protect existing data."
        exit 1
    fi

    if [ -d organizations/peerOrganizations ] ||
       [ -d organizations/ordererOrganizations ]; then
        echo "ERROR: Existing Fabric certificates detected."
        echo "Fresh initialization cancelled."
        exit 1
    fi

    echo "Creating Fabric network and channel..."
    ./network.sh up
    ./network.sh createChannel -c licensechannel

    echo "Adding MOHMSP..."
    (
        cd addOrg3
        ./addOrg3.sh up -c licensechannel
    )

    echo "Deploying license-registry chaincode..."
    ./network.sh deployCC

else
    echo "Starting existing Fabric network..."

    docker compose \
        -f compose/compose-test-net.yaml \
        -f compose/docker/docker-compose-test-net.yaml \
        -f addOrg3/compose/compose-org3.yaml \
        -f addOrg3/compose/docker/docker-compose-org3.yaml \
        start
fi

echo "Fabric startup procedure completed."
