#!/usr/bin/env bash
set -euo pipefail

# Script à exécuter sur le serveur distant après un git pull.
# Il démarre les services à partir des images publiées sur GHCR.

# Attendre que les variables d'environnement nécessaires soient configurées.
: "${REGISTRY_HOST:?REGISTRY_HOST is required}"
: "${REGISTRY_ORG:?REGISTRY_ORG is required}"
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"

cd "$(dirname "$0")/.."

# Mettre à jour les images depuis le registre.
docker compose -f docker/docker-compose.registry.yml pull

docker compose -f docker/docker-compose.registry.yml up -d

echo "Déploiement distant terminé."