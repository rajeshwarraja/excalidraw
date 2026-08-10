#!/usr/bin/env bash
# Build and push the Excalidraw Docker image to registry.rajeshwarraja.co.in.
#
# Usage:
#   ./scripts/docker-build-push.sh [version]
#
# If [version] is omitted, a semver is derived from the latest git tag
# (e.g. v0.18.1 -> 0.18.1, or v0.18.0-384-g0b09e772 -> 0.18.0-384-g0b09e772
# for commits that aren't exactly on a tag).
#
# Environment variables:
#   REGISTRY   - registry host (default: registry.rajeshwarraja.co.in)
#   IMAGE_NAME - image name (default: excalidraw)
#   PLATFORMS  - target platforms (default: linux/amd64,linux/arm64)
#   PUSH       - set to "false" to build only, without pushing (default: true)

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

REGISTRY="${REGISTRY:-registry.rajeshwarraja.co.in}"
IMAGE_NAME="${IMAGE_NAME:-excalidraw}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
PUSH="${PUSH:-true}"

VERSION="${1:-}"
if [ -z "${VERSION}" ]; then
  VERSION="$(git describe --tags --always | sed 's/^v//')"
fi

IMAGE="${REGISTRY}/${IMAGE_NAME}"
TAG_VERSION="${IMAGE}:${VERSION}"
TAG_LATEST="${IMAGE}:latest"

echo "Building ${TAG_VERSION} (platforms: ${PLATFORMS})"

BUILDX_ARGS=(
  --build-arg "BUILD_VERSION=${VERSION}"
  --tag "${TAG_VERSION}"
  --tag "${TAG_LATEST}"
  --platform "${PLATFORMS}"
)

if [ "${PUSH}" = "true" ]; then
  BUILDX_ARGS+=(--push)
else
  BUILDX_ARGS+=(--load)
fi

docker buildx build "${BUILDX_ARGS[@]}" .

echo "Done: ${TAG_VERSION}"
