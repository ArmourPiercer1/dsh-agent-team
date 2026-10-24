#!/usr/bin/env bash
# negative-controls.sh — CHECK-INSTALL-MANIFEST audited-URL-handler negative controls
# (root 20:46 ruling, feat/a5m2-checkinstall-handlers).
#
# Controls (each prints PASS/FAIL + RC; suite exits 0 iff every control behaves as expected):
#   A1 surface-own   base surface: checker with the two new handlers over THIS worktree's full
#                    dist surface => RC=0, zero rejected lines, S1..S8 notes intact (a).
#   A2 surface-int   same checker over the integration worktree surface READ-ONLY (skipped as
#                    SKIP if .worktrees/a5-m2-int is absent here; never written).
#   F0 fixture-clean SMALL whitelist fixture (only the two audited files + one stub module +
#                    fixture package.json, no lock => lock leg SKIPPED) => RC=0, S7+S8 consumed.
#   B1 mutate-s8    mutate one byte in a COPY of destination-envelope.js (hash mismatch)
#                    => that site RED (rejected line present, S8 note absent) (b).
#   B2 mutate-s7    same for a COPY of g1-surface-adapters.mjs => that site RED (b).
#   C  twoarg-url   rewrite `new URL(href)` -> `new URL(href, 'http://x')` in a copy
#                    => that site RED (usage change) (c).
#   D  move-path    move destination-envelope.js to a different path in the copy
#                    => RED at the moved path (d).
#   E1 third-site   add a THIRD computed new URL site in a separate scanned file
#                    => still rejected (no handler); S7+S8 still consumed (e).
#   E2 second-site  add a second computed new URL site inside the audited g1 file copy
#                    => both sites in that file rejected, S7 note absent (e).
# Fixtures are built fresh under this evidence dir (.nc-runs/); nothing outside this dir and
# the repo's own tree is read or written; the int worktree is only ever read.
set -u
EV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
W="$(git -C "$EV" rev-parse --show-toplevel)"
SCRIPT="$W/scripts/check-install-manifest.mjs"
INT="$W/../a5-m2-int"
G1_REL="packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/g1-surface-adapters.mjs"
ENV_REL="packages/runtime/dist/packages/runtime/web-gateway/src/destination-envelope.js"
G1_SHA=43f7fbd2cf8cb6d02207a66c4df6f3c09f19ec8f4951067b4e1390b5173c8d69
ENV_SHA=ce2387c3193d057531b1d679125e26a9931a4efecd3aeb22d5bb78630e34681e
RUNS="$EV/.nc-runs"
rm -rf "$RUNS"   # suite-owned scratch only (recreated every run; never repo or pack content)
mkdir -p "$RUNS"
SUITE_RC=0

ok()   { echo "PASS  $1"; }
bad()  { echo "FAIL  $1"; SUITE_RC=1; }
has()  { grep -qF -- "$2" "$1"; }           # has <file> <fixed-string>
hasnt(){ ! grep -qF -- "$2" "$1"; }

# build_fixture <case-dir> — two audited files at exact paths, stub for g1's one relative
# import, fixture manifest exporting them (host graph), no pnpm-lock (lock leg SKIPPED).
build_fixture() {
  local D="$1"; mkdir -p "$D/$(dirname "$G1_REL")" "$D/$(dirname "$ENV_REL")" \
    "$D/packages/runtime/dist/packages/domain/tool-governance/src"
  cp "$W/$G1_REL" "$D/$G1_REL"
  cp "$W/$ENV_REL" "$D/$ENV_REL"
  printf 'export const stub = 1\n' > "$D/packages/runtime/dist/packages/domain/tool-governance/src/index.js"
  cat > "$D/package.json" <<'JSON'
{
  "name": "a5m2-checkinstall-nc-fixture",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./packages/runtime/dist/packages/runtime/web-gateway/src/destination-envelope.js",
    "./g1": "./packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/g1-surface-adapters.mjs"
  },
  "peerDependencies": { "@deepseek-ai/dsh": "0.2.0-rc.2" }
}
JSON
}
runchk() { # runchk <case-dir-name> [root-of-surface] ; writes $RUNS/<name>.out/.rc
  local name="$1" root="${2:-$RUNS/$1}"
  node "$SCRIPT" "$root" > "$RUNS/$name.out" 2>&1; echo $? > "$RUNS/$name.rc"
}

reject_line() { echo "computed new URL() target rejected at $1"; }

# ---- A1: base surface (own worktree, full graph) => RC=0, no rejections ----
runchk surface-own "$W"
if [ "$(cat "$RUNS/surface-own.rc")" = 0 ] \
   && has "$RUNS/surface-own.out" "audited site S7 consumed" \
   && has "$RUNS/surface-own.out" "audited site S8 consumed" \
   && hasnt "$RUNS/surface-own.out" "target rejected"; then
  ok "A1 surface-own (RC=$(cat "$RUNS/surface-own.rc"); both sites audited-pass; issue list otherwise unchanged) RC=$(cat "$RUNS/surface-own.rc")"
else
  bad "A1 surface-own (RC=$(cat "$RUNS/surface-own.rc"))"
fi

# ---- A2: integration surface (read-only) ----
if [ -d "$INT/package.json" ] || [ -f "$INT/package.json" ]; then
  runchk surface-int "$INT"
  if [ "$(cat "$RUNS/surface-int.rc")" = 0 ] && hasnt "$RUNS/surface-int.out" "target rejected"; then
    ok "A2 surface-int (RC=0; read-only run against integration dist surface) RC=0"
  else
    bad "A2 surface-int (RC=$(cat "$RUNS/surface-int.rc"))"
  fi
else
  echo "SKIP  A2 surface-int (integration worktree not present in this environment)"
fi

# ---- F0: clean fixture => both sites consumed, lock leg SKIPPED ----
build_fixture "$RUNS/fixture-clean"
runchk fixture-clean
if [ "$(cat "$RUNS/fixture-clean.rc")" = 0 ] \
   && has "$RUNS/fixture-clean.out" "audited site S7 consumed" \
   && has "$RUNS/fixture-clean.out" "audited site S8 consumed" \
   && has "$RUNS/fixture-clean.out" "lock leg: SKIPPED"; then
  ok "F0 fixture-clean (RC=0; S7+S8 consumed at fixture root; lock leg SKIPPED not faked) RC=0"
else
  bad "F0 fixture-clean (RC=$(cat "$RUNS/fixture-clean.rc"))"
fi

# ---- B1: hash drift in destination-envelope copy => S8 site RED ----
build_fixture "$RUNS/mutate-s8"
sed -i 's/authority host/authority hoist/' "$RUNS/mutate-s8/$ENV_REL"
if [ "$(sha256sum "$RUNS/mutate-s8/$ENV_REL" | cut -d' ' -f1)" = "$ENV_SHA" ]; then bad "B1 mutate-s8 (mutation did not change the file) RC=n/a"; else
runchk mutate-s8
if [ "$(cat "$RUNS/mutate-s8.rc")" = 1 ] \
   && has "$RUNS/mutate-s8.out" "$(reject_line "$ENV_REL")" \
   && hasnt "$RUNS/mutate-s8.out" "audited site S8 consumed" \
   && has "$RUNS/mutate-s8.out" "audited site S7 consumed"; then
  ok "B1 mutate-s8 (hash mismatch => site RED, S7 untouched) RC=$(cat "$RUNS/mutate-s8.rc")"
else
  bad "B1 mutate-s8 (RC=$(cat "$RUNS/mutate-s8.rc"))"
fi; fi

# ---- B2: hash drift in g1 copy => S7 site RED ----
build_fixture "$RUNS/mutate-s7"
sed -i 's/REAL registry parse/REAL registry parses/' "$RUNS/mutate-s7/$G1_REL"
if [ "$(sha256sum "$RUNS/mutate-s7/$G1_REL" | cut -d' ' -f1)" = "$G1_SHA" ]; then bad "B2 mutate-s7 (mutation did not change the file) RC=n/a"; else
runchk mutate-s7
if [ "$(cat "$RUNS/mutate-s7.rc")" = 1 ] \
   && has "$RUNS/mutate-s7.out" "$(reject_line "$G1_REL")" \
   && hasnt "$RUNS/mutate-s7.out" "audited site S7 consumed" \
   && has "$RUNS/mutate-s7.out" "audited site S8 consumed"; then
  ok "B2 mutate-s7 (hash mismatch => site RED, S8 untouched) RC=$(cat "$RUNS/mutate-s7.rc")"
else
  bad "B2 mutate-s7 (RC=$(cat "$RUNS/mutate-s7.rc"))"
fi; fi

# ---- C: usage change new URL(href) -> new URL(href, 'http://x') => RED ----
build_fixture "$RUNS/twoarg-url"
sed -i "s|new URL(href)|new URL(href, 'http://x')|" "$RUNS/twoarg-url/$G1_REL"
runchk twoarg-url
if [ "$(cat "$RUNS/twoarg-url.rc")" = 1 ] \
   && has "$RUNS/twoarg-url.out" "$(reject_line "$G1_REL:397 expr=\"href\"")" \
   && hasnt "$RUNS/twoarg-url.out" "audited site S7 consumed"; then
  ok "C twoarg-url (two-arg usage change => RED; hash gate AND verbatim-expression gate both violated) RC=$(cat "$RUNS/twoarg-url.rc")"
else
  bad "C twoarg-url (RC=$(cat "$RUNS/twoarg-url.rc"))"
fi

# ---- D: audited file moved to another path => RED ----
D_DIR="$RUNS/move-path"; build_fixture "$D_DIR"
MOV_REL="packages/runtime/dist/packages/runtime/web-gateway/src/inner/destination-envelope.js"
mkdir -p "$D_DIR/$(dirname "$MOV_REL")"
mv "$D_DIR/$ENV_REL" "$D_DIR/$MOV_REL"
sed -i "s|./packages/runtime/dist/packages/runtime/web-gateway/src/destination-envelope.js|./$MOV_REL|" "$D_DIR/package.json"
runchk move-path
if [ "$(cat "$RUNS/move-path.rc")" = 1 ] \
   && has "$RUNS/move-path.out" "$(reject_line "$MOV_REL")" \
   && hasnt "$RUNS/move-path.out" "audited site S8 consumed" \
   && has "$RUNS/move-path.out" "audited site S7 consumed"; then
  ok "D move-path (same bytes, moved path => RED, handler path-pinned) RC=$(cat "$RUNS/move-path.rc")"
else
  bad "D move-path (RC=$(cat "$RUNS/move-path.rc"))"
fi

# ---- E1: third computed new URL site elsewhere => still rejected, audited pair intact ----
build_fixture "$RUNS/third-site"
printf 'export function parseExtra(input) {\n  return new URL(input);\n}\n' > "$RUNS/third-site/extra-site.mjs"
sed -i 's|"./g1":|"./extra": "./extra-site.mjs",\n    "./g1":|' "$RUNS/third-site/package.json"
runchk third-site
if [ "$(cat "$RUNS/third-site.rc")" = 1 ] \
   && has "$RUNS/third-site.out" "$(reject_line "extra-site.mjs:2 expr=\"input\"")" \
   && has "$RUNS/third-site.out" "audited site S7 consumed" \
   && has "$RUNS/third-site.out" "audited site S8 consumed"; then
  ok "E1 third-site (unknown computed new URL still rejected; no blanket skip) RC=$(cat "$RUNS/third-site.rc")"
else
  bad "E1 third-site (RC=$(cat "$RUNS/third-site.rc"))"
fi

# ---- E2: second computed new URL site inside the audited g1 file => file fully RED ----
build_fixture "$RUNS/second-site"
sed -i "s|    const url = new URL(href)|    const url = new URL(href)\n    const url2 = new URL(href)|" "$RUNS/second-site/$G1_REL"
runchk second-site
n=$(grep -cF -- "$(reject_line "$G1_REL")" "$RUNS/second-site.out")
if [ "$(cat "$RUNS/second-site.rc")" = 1 ] && [ "$n" = 2 ] \
   && hasnt "$RUNS/second-site.out" "audited site S7 consumed" \
   && has "$RUNS/second-site.out" "audited site S8 consumed"; then
  ok "E2 second-site (added site breaks hash AND unique-count; both sites RED) RC=$(cat "$RUNS/second-site.rc")"
else
  bad "E2 second-site (RC=$(cat "$RUNS/second-site.rc"), rejected-lines=$n)"
fi

echo "----"
echo "negative-controls suite RC=$SUITE_RC (0 = every control behaved as specified)"
exit $SUITE_RC
