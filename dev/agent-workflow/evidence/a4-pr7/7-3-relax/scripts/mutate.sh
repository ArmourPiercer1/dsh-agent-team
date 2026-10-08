#!/usr/bin/env bash
# usage: mutate.sh <apply|revert> <M1-gate|M2-hashomit>
#
# A4-PR7 §7.3 non-vacuity mutations. Every mutation is ONE line, and this script's
# contract is that the tree is restored from git, never "patched back":
#   1. `revert` ALWAYS runs `git checkout HEAD -- <path>` first, so a previous half-applied
#      mutation can never be silently re-applied (the decision record's failure #4:
#      "git checkout <file> restored the previous probe, not the base").
#   2. the anchor must match EXACTLY once, or the script stops before touching anything.
#
# M1-gate   — REVERT one relaxed production gate (scope-requirements.ts) to
#             `if (blueprint.schemaVersion === 2)`. A v3 document then declares the grammar,
#             pays identity for it, and gets no enforcement: this is exactly the state
#             Option A exists to remove, restored on purpose.
# M2-hashomit — the decision record's mutation M1: `toHashableBlueprint` silently omits
#             teamRequirements when schemaVersion === 3. The dossier measured 0 of 562
#             repo tests noticing; the twins must go red.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
ACTION="$1"; WHICH="${2:-none}"

SR=packages/runtime/requirements/scope-requirements.ts
VT=packages/domain/blueprint/src/validate.ts

restore_first() {
  git checkout HEAD -- "$SR" "$VT"
}

apply_m1() {
  local n
  n=$(grep -c '^  {$' "$SR")
  if [ "$n" -ne 1 ]; then echo "M1 anchor '^  {\$' count=$n (want 1) — ABORT"; return 3; fi
  python3 - "$SR" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = "  {\n    const templateEntries:"
new = "  if (blueprint.schemaVersion === 2) {\n    const templateEntries:"
assert s.count(old) == 1, f"anchor count {s.count(old)}"
open(p, "w").write(s.replace(old, new))
print("M1-gate APPLIED: scope-requirements.ts gate restored to `=== 2`")
PY
}

apply_m2() {
  python3 - "$VT" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = "    ...(core.teamRequirements !== undefined\n      ? {"
new = "    ...(core.teamRequirements !== undefined && core.schemaVersion !== 3\n      ? {"
assert s.count(old) == 1, f"anchor count {s.count(old)}"
open(p, "w").write(s.replace(old, new))
print("M2-hashomit APPLIED: toHashableBlueprint omits teamRequirements at v3")
PY
}

case "$ACTION" in
  revert) restore_first; echo "reverted: $SR $VT restored from HEAD"; git status --porcelain -- "$SR" "$VT" | sed 's/^/  dirty: /' ;;
  apply)
    restore_first
    case "$WHICH" in
      M1-gate) apply_m1 ;;
      M2-hashomit) apply_m2 ;;
      *) echo "unknown mutation $WHICH"; exit 2 ;;
    esac
    echo "--- tree state under mutation ---"
    git status --porcelain
    ;;
  *) echo "usage: mutate.sh <apply|revert> <M1-gate|M2-hashomit>"; exit 2 ;;
esac
