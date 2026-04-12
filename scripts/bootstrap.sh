#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG="${NAIRON_SKILLS_REPO:-Nairon-AI/skills}"
REPO_REF="${NAIRON_SKILLS_REF:-main}"
TARBALL_URL="${NAIRON_SKILLS_TARBALL_URL:-https://codeload.github.com/${REPO_SLUG}/tar.gz/refs/heads/${REPO_REF}}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_zig() {
  if command -v zig >/dev/null 2>&1; then
    return
  fi

  if [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    echo "Zig not found. Installing Zig via Homebrew..."
    brew install zig
    return
  fi

  cat >&2 <<'EOF'
Zig 0.15+ is required to launch the Nairon Skills CLI.
Install Zig, then rerun this command.
EOF
  exit 1
}

require_cmd curl
require_cmd tar
require_cmd npx
ensure_zig

launch_dir="$(pwd -P)"
tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

echo "Downloading ${REPO_SLUG}@${REPO_REF}..."
curl -fsSL "${TARBALL_URL}" | tar -xzf - -C "${tmp_dir}"

repo_dir="${tmp_dir}/skills-${REPO_REF}"
if [[ ! -d "${repo_dir}/cli" ]]; then
  echo "Expected CLI directory at ${repo_dir}/cli" >&2
  exit 1
fi

cd "${repo_dir}/cli"

if [[ $# -eq 0 ]]; then
  if [[ -r /dev/tty ]]; then
    cat >/dev/tty <<'EOF'
Nairon Skills

1. Install all skills + starter AGENTS.md (recommended)
2. Choose specific skills interactively + starter AGENTS.md

EOF
    read -r -p "Select [1/2]: " choice </dev/tty
    case "${choice:-1}" in
      2)
        set -- install "${launch_dir}" --choose
        ;;
      *)
        set -- install "${launch_dir}" --all
        ;;
    esac
  else
    set -- install "${launch_dir}" --all
  fi
fi

if [[ -r /dev/tty ]]; then
  zig build run -- "$@" </dev/tty
else
  zig build run -- "$@"
fi
