#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
tmp_dir="$(mktemp -d)"

mkdir -p "${tmp_dir}/skills"

link_skill_dir() {
  local skill_dir="$1"
  local skill_name
  skill_name="$(basename "${skill_dir}")"

  if [[ -e "${tmp_dir}/skills/${skill_name}" ]]; then
    echo "Duplicate skill name detected: ${skill_name}" >&2
    exit 1
  fi

  cp -R "${skill_dir}" "${tmp_dir}/skills/${skill_name}"
}

for category in context planning engineering security writing frontend marketing; do
  category_dir="${repo_root}/${category}"
  [[ -d "${category_dir}" ]] || continue

  while IFS= read -r -d '' skill_md; do
    link_skill_dir "$(dirname "${skill_md}")"
  done < <(find "${category_dir}" -mindepth 1 -maxdepth 3 -type f -name SKILL.md -print0 | sort -z)
done

printf '%s\n' "${tmp_dir}"
