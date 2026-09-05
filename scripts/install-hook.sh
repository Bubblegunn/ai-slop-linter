#!/bin/sh
# Installs the commit-msg hook into the current repository.
#   curl -fsSL https://raw.githubusercontent.com/Bubblegunn/ai-slop-linter/main/scripts/install-hook.sh | sh
set -eu

root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not inside a git repository" >&2; exit 1; }
hooks="$(git config core.hooksPath || true)"
[ -n "$hooks" ] || hooks="$root/.git/hooks"
case "$hooks" in /*) ;; *) hooks="$root/$hooks" ;; esac
mkdir -p "$hooks"
target="$hooks/commit-msg"

if [ -f "$target" ] && ! grep -q "ai-slop-linter" "$target"; then
  echo "a commit-msg hook already exists at $target; add this line to it instead:" >&2
  echo '  npx --yes ai-slop-linter --commit-msg "$1"' >&2
  exit 1
fi

here="$(cd "$(dirname "$0")" 2>/dev/null && pwd || true)"
if [ -n "$here" ] && [ -f "$here/commit-msg" ]; then
  cp "$here/commit-msg" "$target"
else
  curl -fsSL https://raw.githubusercontent.com/Bubblegunn/ai-slop-linter/main/scripts/commit-msg -o "$target"
fi
chmod +x "$target"
echo "installed $target"
echo "every commit message is now linted; skip once with git commit --no-verify"
