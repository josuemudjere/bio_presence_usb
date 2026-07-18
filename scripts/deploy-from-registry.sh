#!/usr/bin/env bash
set -euo pipefail

# Déploiement sur un serveur distant à partir des images GitHub Container Registry
# Usage: ./scripts/deploy-from-registry.sh <registry-host> <org> <mysql-root-password>

REGISTRY_HOST=${1:?registry host required}
REGISTRY_ORG=${2:?registry org required}
MYSQL_ROOT_PASSWORD=${3:?mysql root password required}

export REGISTRY_HOST
export REGISTRY_ORG
export MYSQL_ROOT_PASSWORD

cd "$(dirname "$0")/.."

docker compose -f docker/docker-compose.registry.yml pull

docker compose -f docker/docker-compose.registry.yml up -d

echo "Déploiement terminé. Frontend: http://localhost, Backend: http://localhost:8080"