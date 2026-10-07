#!/usr/bin/env bash
# Mutation harness for the composition gate (scratch, evidence only).
# Snapshot by sha256 + cp, restore by cp — NEVER `git checkout --`, which
# destroyed uncommitted work twice this session.
set -u
RAW="$(cd "$(dirname "$0")" && pwd)"
REPO="$RAW"
while [ "$REPO" != "/" ] && [ ! -f "$REPO/pnpm-workspace.yaml" ]; do REPO="$(dirname "$REPO")"; done
[ -f "$REPO/pnpm-workspace.yaml" ] || { echo "no repo root above $RAW"; exit 1; }
cd "$REPO" || exit 1

CLIENT_ENTRY=packages/client/dist/packages/client/src/plugin/client.js
SHIM_BUNDLE=packages/client/composition-shim/client-bundle.js

mutate() { # mutate <name> <file> <applier>
  local name="$1" file="$2" applier="$3"
  local snap="$RAW/snap-$name"
  if [ ! -f "$file" ]; then echo "ABORT $name: $file does not exist"; return 1; fi
  mkdir -p "$snap"
  sha256sum "$file" >"$snap/before.sha256"
  cp "$file" "$snap/before" || { echo "ABORT $name: snapshot failed"; return 1; }
  "$applier" "$file" || { echo "ABORT $name: mutation failed"; cp "$snap/before" "$file"; return 1; }
  { echo "$ [mutation: $name applied to $file]"; node scripts/composition-smoke.mjs 2>/dev/null; echo "[exit $?]"; } >"$RAW/mut-$name.txt"
  cp "$snap/before" "$file"
  sha256sum "$file" >"$snap/after.sha256"
  if diff -q "$snap/before.sha256" "$snap/after.sha256" >/dev/null; then
    echo "restored $file (sha256 identical to the snapshot)"
  else
    echo "RESTORE-FAILED $file"
  fi
  echo "--- $RAW/mut-$name.txt (head, verdict, exit)"
  sed -n '1,3p' "$RAW/mut-$name.txt"
  grep -E '^(FAIL|PASS composition-smoke|SKIP|\[exit)' "$RAW/mut-$name.txt" | tail -4
  echo
}

applier_ownbare() { printf '\nimport { nope } from "@a4-skip-fails/not-installed"\nexport const ownBare = nope\n' >>"$1"; }
applier_dangling() { printf '\nimport { gone } from "./no-such-chunk.js"\nexport const ownDangling = gone\n' >>"$1"; }
applier_rename() {
  python3 - "$1" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
needle = "const name = 'dsh-agent-team-client'"
assert s.count(needle) == 1, f'expected exactly one name declaration, found {s.count(needle)}'
open(p, 'w').write(s.replace(needle, "const name = 'dsh-agent-team-clientx'"))
PY
}

case "${1:-all}" in
  ownbare)  mutate own-bare-import "$CLIENT_ENTRY" applier_ownbare ;;
  dangling) mutate dangling-relative-import "$CLIENT_ENTRY" applier_dangling ;;
  rename)   mutate renamed-plugin-name "$SHIM_BUNDLE" applier_rename ;;
  all)
    mutate own-bare-import "$CLIENT_ENTRY" applier_ownbare
    mutate dangling-relative-import "$CLIENT_ENTRY" applier_dangling
    mutate renamed-plugin-name "$SHIM_BUNDLE" applier_rename
    ;;
  *) echo "usage: mutate.sh [ownbare|dangling|rename|all]"; exit 2 ;;
esac
echo "--- git status --porcelain (must list only this evidence dir)"
git status --porcelain
