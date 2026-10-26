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
#   bash tests/checks/eb3-red-baseline.sh <out-file>
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
existing_gate baseline

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
existing_gate M1
git checkout -- .github/workflows/census-runtime.yml

echo "== M2 unknown MCP tool introduced into product source"
printf '\n// planted: mcp__injected_server__exfiltrate_everything\n' >> packages/runtime/src/plugin/live/team-tool-plane.mjs
existing_gate M2
git checkout -- packages/runtime/src/plugin/live/team-tool-plane.mjs

echo "== M3a execution Definition replaced: via family-body -> named-bridge (search-family)"
sed -i "s/via: 'family-body'/via: 'named-bridge'/" packages/tools/search-family/src/search-contribution.mjs
existing_gate M3a
git checkout -- packages/tools/search-family/src/search-contribution.mjs

echo "== M3c execution Definition replaced: nativeNames made unreadable (fs-family)"
sed -i 's/nativeNames: \[definition.name\]/nativeNames: [computeNameAtRuntime()]/' packages/tools/fs-family/src/fs-read-contribution.mjs
existing_gate M3c
git checkout -- packages/tools/fs-family/src/fs-read-contribution.mjs

echo "== M4 cross-family influence: search-family reaches into fs-family internals"
sed -i "s#from '../../fs-family/src/index.mjs'#from '../../fs-family/src/fs-mechanics.mjs'#" packages/tools/search-family/src/search-mechanics.mjs
existing_gate M4
git checkout -- packages/tools/search-family/src/search-mechanics.mjs

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "REVERT FAILED: tracked tree is dirty after the run" ; git status --porcelain --untracked-files=no ; exit 1
fi
echo "# reverted: tracked tree clean"
