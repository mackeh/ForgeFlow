#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/release-version.sh [patch|minor|major] [--dry-run]

Examples:
  scripts/release-version.sh patch
  scripts/release-version.sh minor --dry-run
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

BUMP_TYPE="${1}"
DRY_RUN="${2:-}"

if [[ "${BUMP_TYPE}" != "patch" && "${BUMP_TYPE}" != "minor" && "${BUMP_TYPE}" != "major" ]]; then
  echo "Unsupported bump type: ${BUMP_TYPE}"
  usage
  exit 1
fi

if [[ "${DRY_RUN}" != "" && "${DRY_RUN}" != "--dry-run" ]]; then
  echo "Unsupported option: ${DRY_RUN}"
  usage
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "This script must run inside a git repository."
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [[ "${BRANCH}" != "main" ]]; then
  echo "Release tags must be created from main. Current branch: ${BRANCH}"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before tagging."
  exit 1
fi

if ! git fetch origin main --tags >/dev/null 2>&1; then
  echo "Warning: could not refresh origin/main or tags. Using local refs."
fi

read -r BEHIND AHEAD < <(git rev-list --left-right --count origin/main...HEAD)
if [[ "${BEHIND}" != "0" || "${AHEAD}" != "0" ]]; then
  echo "Local main is not in sync with origin/main (behind=${BEHIND}, ahead=${AHEAD})."
  echo "Pull/push first, then retry."
  exit 1
fi

LATEST_TAG="$(git tag -l 'v*.*.*' | sort -V | tail -n 1)"
if [[ -z "${LATEST_TAG}" ]]; then
  LATEST_TAG="v0.0.0"
fi

VERSION_PART="${LATEST_TAG#v}"
IFS='.' read -r MAJOR MINOR PATCH <<<"${VERSION_PART}"

case "${BUMP_TYPE}" in
  patch)
    PATCH=$((PATCH + 1))
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
esac

NEXT_TAG="v${MAJOR}.${MINOR}.${PATCH}"

if git rev-parse "${NEXT_TAG}" >/dev/null 2>&1; then
  echo "Tag already exists: ${NEXT_TAG}"
  exit 1
fi

echo "Latest tag: ${LATEST_TAG}"
echo "Next tag:   ${NEXT_TAG}"

if [[ "${DRY_RUN}" == "--dry-run" ]]; then
  echo "Dry run only. No tag created."
  exit 0
fi

git tag -a "${NEXT_TAG}" -m "Release ${NEXT_TAG}"
git push origin "${NEXT_TAG}"

echo "Tag pushed: ${NEXT_TAG}"
echo "Release workflow will publish the release automatically."
