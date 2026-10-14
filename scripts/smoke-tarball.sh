#!/bin/sh
# Packs the package exactly as npm would publish it, installs the tarball in an empty
# project, imports it and runs the bin. Catches a missing `files` entry or a broken
# `exports` map before a version is on the registry.
set -eu
root=$(pwd)
name=$(node -p "require('./package.json').name")
bin=$(node -p "Object.keys(require('./package.json').bin || {})[0] || ''")
tgz=$(npm pack --silent 2>/dev/null | tail -1)
dir=$(mktemp -d)
cd "$dir"
npm init -y >/dev/null
npm install --silent --ignore-scripts "$root/$tgz"
node --input-type=module -e "import('$name').then(m => { const k = Object.keys(m); if (!k.length) throw new Error('no exports'); console.log('exports:', k.join(', ')); })"
# `--` keeps npx from reading --help as its own option (npm 11 then exits 0 for a missing bin), and the
# explicit exit is needed because a failing command on the left of `&&` does not trip `set -e`: until
# 2026-10-14 this line printed nothing and the script still exited 0 when the bin path was broken.
if [ -n "$bin" ]; then
  npx --no -- "$bin" --help >/dev/null || { echo "bin failed: $bin --help" >&2; exit 1; }
  echo "bin ok: $bin --help"
fi
cd "$root" && rm -rf "$dir" "$tgz"
