#!/usr/bin/env bash
# eb3-red-baseline.sh — the RED half of EB3 (U7-2 step 2), against the EXISTING gate.
#
# Question answered: on the current tree, does the CI that already runs (pr-gate's
# docs:sync --check + docs:probe + the graph-parse/state-freshness legs, plus the
# ARC-A fitness suite that rides the census) DETECT each of the four mutations the
# plan names? A mutation the existing gate does not detect is the RED this task
# exists to close.
#
# Each mutation is applied to THIS worktree's files, graded, and reverted with
# `git checkout -- <path>` before the next one; the script refuses to start on a
# dirty tracked tree so a revert can never eat someone's work. Nothing outside the
# worktree is touched; no host is booted.
#
#   bash tests/checks/eb3-red-baseline.sh <out-file>              (step 2: existing gate only)
#   WITH_EB3=1 bash tests/checks/eb3-red-baseline.sh <out-file>   (step 4: + EB3 enforcement)
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
OUT=${1:?usage: eb3-red-baseline.sh <out-file>}
cd "$REPO"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "REFUSED: tracked files are dirty; this script reverts with git checkout and will not risk them" >&2
  git status --porcelain --untracked-files=no >&2
  exit 2
fi
exec > >(tee "$OUT") 2>&1
echo "# eb3-red-baseline head=$(git rev-parse --short HEAD) at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# C4 column: the EB3 enforcement, on the SAME on-disk mutation. Only meaningful once the
# enforcement exists (step 3); before that every call exits non-zero for "module absent",
# which is why step 2 recorded the existing-gate column alone.
eb3_gate() { # $1 = label
  local label=$1 r=0 t=0 d=0 b=0
  node scripts/eb3-ci-required.mjs >/dev/null 2>&1; r=$?
  node scripts/eb3-trusted-sources.mjs >/dev/null 2>&1; t=$?
  node scripts/eb3-family-definitions.mjs >/dev/null 2>&1; d=$?
  node scripts/eb3-family-boundaries.mjs >/dev/null 2>&1; b=$?
  echo "  [$label] eb3: ci-required=$r trusted-sources=$t family-definitions=$d family-boundaries=$b"
  if [ "$label" = baseline ]; then
    if [ $r -eq 0 ] && [ $t -eq 0 ] && [ $d -eq 0 ] && [ $b -eq 0 ]; then
      echo "  OK   [baseline] EB3 enforcement green on the unmutated tree"
    else
      echo "  ABORT [baseline] EB3 enforcement not green on the unmutated tree"
    fi
  elif [ $r -ne 0 ] || [ $t -ne 0 ] || [ $d -ne 0 ] || [ $b -ne 0 ]; then
    echo "  GREEN [$label] DETECTED by EB3 enforcement (non-zero above)"
  else
    echo "  STILL-RED [$label] NOT detected by EB3 enforcement either"
  fi
}
WITH_EB3=${WITH_EB3:-0}
both() { existing_gate "$1"; [ "$WITH_EB3" = 1 ] && eb3_gate "$1"; return 0; }

existing_gate() { # $1 = label
  local label=$1 s1 s2 s3 s4
  node scripts/docs-sync.mjs --check >/dev/null 2>&1; s1=$?
  node scripts/docs-probe.mjs --worktree-only >/dev/null 2>&1; s2=$?
  node scripts/ci-pr-gate.mjs --only graph-parse --only state-freshness >/dev/null 2>&1; s3=$?
  pnpm exec vitest run packages/runtime/test/u6-arc-a-fitness.test.ts >/dev/null 2>&1; s4=$?
  echo "  [$label] docs:sync=$s1 docs:probe=$s2 pr-gate(graph,state)=$s3 arc-a-fitness=$s4"
  if [ "$label" = baseline ]; then
    if [ $s1 -eq 0 ] && [ $s2 -eq 0 ] && [ $s3 -eq 0 ] && [ $s4 -eq 0 ]; then
      echo "  OK   [baseline] existing gate green on the unmutated tree (precondition met)"
    else
      echo "  ABORT [baseline] existing gate is not green on the unmutated tree; mutations below are not interpretable"
    fi
  elif [ $s1 -eq 0 ] && [ $s2 -eq 0 ] && [ $s3 -eq 0 ] && [ $s4 -eq 0 ]; then
    echo "  RED  [$label] NOT DETECTED by the existing gate (every check exit 0)"
  else
    echo "  NOTE [$label] detected by an existing check (non-zero above) — recorded, not hidden"
  fi
}

echo "== baseline (no mutation): the existing gate must be green here"
both baseline

echo "== M1 required CI job removed: delete the census-runtime job block"
python3 - <<'PY'
# Remove the `  census-runtime:` job key AND its body, leaving the rest of the file
# byte-intact. The workflow stays parseable YAML with an empty jobs map, which is the
# point: the mutation must be a QUIET one, not a syntax error the parser would catch.
p = '.github/workflows/census-runtime.yml'
lines = open(p).read().split('\n')
start = lines.index('  census-runtime:')
end = len(lines)
for i in range(start + 1, len(lines)):
    if lines[i].startswith('  ') and not lines[i].startswith('   ') and lines[i].rstrip().endswith(':'):
        end = i
        break
open(p, 'w').write('\n'.join(lines[:start] + lines[end:]))
PY
both M1
git checkout -- .github/workflows/census-runtime.yml

echo "== M1b REQUIRED layer job removed: delete the ci-full job block (exists from step 3 on)"
if [ -f .github/workflows/ci-full.yml ]; then
  python3 -c "
p = '.github/workflows/ci-full.yml'
lines = open(p).read().split(chr(10))
start = lines.index('  ci-full:')
open(p, 'w').write(chr(10).join(lines[:start]) + chr(10))
"
  both M1b
  git checkout -- .github/workflows/ci-full.yml
else
  echo "  N/A  [M1b] .github/workflows/ci-full.yml does not exist on this tree (step 2: no layers yet)"
fi

echo "== M2 unknown MCP tool introduced into product source"
# assembled at runtime so this (scanned) script never carries the planted literal itself
PLANTED="mcp""__injected_server__exfiltrate_everything"
printf '\n// planted: %s\n' "$PLANTED" >> packages/runtime/src/plugin/live/team-tool-plane.mjs
both M2
git checkout -- packages/runtime/src/plugin/live/team-tool-plane.mjs

echo "== M3a execution Definition replaced: via family-body -> named-bridge (search-family)"
sed -i "s/via: 'family-body'/via: 'named-bridge'/" packages/tools/search-family/src/search-contribution.mjs
both M3a
git checkout -- packages/tools/search-family/src/search-contribution.mjs

echo "== M3c execution Definition replaced: nativeNames made unreadable (fs-family)"
sed -i 's/nativeNames: \[definition.name\]/nativeNames: [computeNameAtRuntime()]/' packages/tools/fs-family/src/fs-read-contribution.mjs
both M3c
git checkout -- packages/tools/fs-family/src/fs-read-contribution.mjs

echo "== M4 cross-family influence: search-family reaches into fs-family internals"
sed -i "s#from '../../fs-family/src/index.mjs'#from '../../fs-family/src/fs-mechanics.mjs'#" packages/tools/search-family/src/search-mechanics.mjs
both M4
git checkout -- packages/tools/search-family/src/search-mechanics.mjs

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "REVERT FAILED: tracked tree is dirty after the run" ; git status --porcelain --untracked-files=no ; exit 1
fi
echo "# reverted: tracked tree clean"
