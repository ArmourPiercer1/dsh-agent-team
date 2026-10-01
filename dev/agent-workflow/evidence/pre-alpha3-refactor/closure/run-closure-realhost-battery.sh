#!/bin/bash
# Closure real-host battery — post-#50-merge tree (DoD #20 "full host/browser/dual-team/
# concurrency/zero-core gates" floor re-run on the final merged product tree).
#
# METHOD (user directive 2026-10-01): the DoD #20 exit gate must not be marked deferred
# while the committed real-host kits are executable in the authorized workspace. The
# closure head 59b619c6's product tree (packages/ + pnpm-lock.yaml) is BYTE-IDENTICAL to
# merged master c19af195 (identity proof: post-merge-identity-proof.txt), so these kit
# runs ON THIS TREE are the merged-tree real-host evidence.
#
# SCOPE (the necessary bounded set — the plan F.6 20-scenario floor + the per-PR real-host
# gates of the 5 fix PRs that landed after the last real-host triple):
#   [1] pr-f-closure-smoke        = prf G1-G9 (20-scenario floor incl. G8 browser data
#                                   surface [HTTP, the plan's scenario-18 check], G2
#                                   governance mutation+restart, G4 multi-MCP, G9 fail-closed)
#   [2] pr-e-requirement-recovery = E.12 16/16 (S1-S14/S16: consent, template disable,
#                                   team-level outage recovery, dual-team isolation,
#                                   concurrency, restart x8, persona)
#   [3] f15-mcp-live-loss-smoke   = F15 10/10 (MCP live-loss headline finding; #50 area)
#   [4] pr-d-control-real-host    = 40/40 control real-host gate (#49 area; DoD #18)
#   [5] pr-c-mcp-isolation-smoke  = per-server MCP isolation (#50/#48 area; DoD #9)
#   [6] pr-b-effective-policy-smoke = BLOCKED (recorded): seed blueprint world
#       (tests/homes/mpr-2026-09-27T08-35-52, machine path /home/user/...) never committed,
#       kit path machine-coupled — concrete technical blocker, not time cost.
#       Coverage fallback: #47 tree-era real-host evidence (committed) + merged-tree suite
#       policy tests (green in the 4865P full run) + verified non-interaction: the post-#47
#       product deltas (#48: root.ts+types.ts; #50: host.ts+agent-bindings.mjs+root.ts)
#       touch NO policy/effective file.
#
# ZERO-CORE bookends: test-use pristine (rev-parse + porcelain) before AND after +
# ports 3180-family (NEVER 3080/3180 — stable instance observed, never touched) +
# suite-level private-import check already inside the merged-tree full run (p4t5).
#
# Ports: each kit's own ruling-fixed/candidate ports (3182-3186 hosts, 3491-3498 mini-MCP/mock,
# 3506) — all verified free pre-battery. Sequential runs (no port contention).
# Homes: the kits create their own ephemeral worlds under the MAIN repo tests/homes/
# (gitignored, workspace-internal per TEST_METHODS §7) and clean per their PASS protocol.
#
# Provenance: each section = CMD-first + complete stdout + true EXIT last + HEAD label +
# porcelain. Kit run dirs: dev/agent-workflow/evidence/<line>/<stamp>/ (their own format).
set -o pipefail
cd /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/handoff-closure
E=dev/agent-workflow/evidence/pre-alpha3-refactor/closure
B=$E/realhost-battery-post-merge
mkdir -p "$B"
HEAD=$(git rev-parse HEAD)
MAIN=/srv/workspace/dsh-plugins/dsh-agent-team
TESTUSE=$MAIN/tests/deepseek-harness-test-use
PORC=$(git status --porcelain)

section() {
  n="$1"; shift
  L="$B/$n.log"
  {
    echo "== $n (closure real-host battery @ post-#50-merge) =="
    echo "HEAD: $HEAD (closure head; product tree byte-identical to merged master c19af1954239c6b3933e708fd9bdb0d50dbe1ea4 — see post-merge-identity-proof.txt)"
    echo "date: $(date -u +%FT%TZ)"
    echo "git status --porcelain:"
    echo "$PORC"
  } > "$L"
}

kit_run() {
  n="$1"; kit="$2"
  section "$n"
  {
    echo "\$ node tests/kits/$kit/$kit.mjs"
    echo "(kit run dir: dev/agent-workflow/evidence/.../$kit/<stamp>/ — the kit's own captures)"
  } >> "$B/$n.log"
  node "tests/kits/$kit/$kit.mjs" >> "$B/$n.log" 2>&1
  ec=$?
  echo "${n^^}_EXIT=$ec" >> "$B/$n.log"
  echo "=== $n EXIT=$ec ==="
  sleep 5
}

# ── [0] preflight ────────────────────────────────────────────────────────────────
section battery-00-preflight
{
  echo "\$ git -C $TESTUSE rev-parse HEAD   (expect 46a7f68b0922371ce7144b668b90e377d8e799f4 = 0.1.7-rc.1)"
  git -C "$TESTUSE" rev-parse HEAD
  echo "TESTUSE_REV_EXIT=$?"
  echo "\$ git -C $TESTUSE status --porcelain   (expect EMPTY = pristine)"
  git -C "$TESTUSE" status --porcelain
  echo "TESTUSE_PORCELAIN_EXIT=$?"
  echo "\$ ls -la $TESTUSE/apps/cli/lib/bin.js   (prebuilt host entry)"
  ls -la "$TESTUSE/apps/cli/lib/bin.js"
  echo "LS_BIN_EXIT=$?"
  echo "\$ ss -ltn | grep -E ':(318[0-6]|349[1-8]|350[0-6])'   (expect: no kit-port listeners)"
  ss -ltn | grep -E ':(318[0-6]|349[1-8]|350[0-6])'
  echo "SS_KITPORTS_EXIT=$?  (1 = none free-confirmed)"
  echo "\$ ss -ltn | grep :3080   (STABLE instance — OBSERVED ONLY, NEVER TOUCHED)"
  ss -ltn | grep :3080
  echo "SS_3080_EXIT=$?  (stable listener expected; read-only observation)"
} >> "$B/battery-00-preflight.log" 2>&1
echo "=== preflight done ==="

# ── [1..5] the battery (sequential) ─────────────────────────────────────────────
kit_run battery-01-prf-closure       pr-f-closure-smoke
kit_run battery-02-ereq-recovery     pr-e-requirement-recovery-smoke
kit_run battery-03-f15-mcp-liveloss  f15-mcp-live-loss-smoke
kit_run battery-04-prd-control       pr-d-control-real-host
kit_run battery-05-prc-mcp-isolation pr-c-mcp-isolation-smoke

# ── [6] pr-b BLOCKED record ──────────────────────────────────────────────────────
cat > "$B/battery-06-prb-blocked.md" <<'MB'
# pr-b-effective-policy-smoke — BLOCKED (2026-10-01, post-#50-merge closure battery)

**Verdict: BLOCKED — concrete technical blocker (kit environment coupling + missing seed data), NOT time cost.**

- The kit hardcodes `SEED_BLUEPRINT_DIR = '/home/user/dsh-plugins/dsh-agent-team/tests/homes/mpr-2026-09-27T08-35-52/blueprints'` (line 93) — a machine-absolute path on the original machine (this environment's workspace root is /srv/workspace, not /home/user).
- The seed world `tests/homes/mpr-2026-09-27T08-35-52` (an ephemeral home, gitignored per TEST_METHODS §7) was NEVER committed: its blueprint YAMLs exist nowhere in the repo (searched: no blueprint files in the model-pref-kit-mpr-2026-09-27T08-35-52 evidence dir — only run captures; no matching committed blueprints dir anywhere under dev/agent-workflow/evidence/).
- Reconstructing the seed world from captures would be fabricating test input — not done.
- Fixing the kit's path would modify a tracked test file (the closure branch is docs/evidence-only per the user directive) — not done silently.
**Coverage fallback (recorded, not a claim of re-run):** #47's tree-era real-host run (committed under dev/agent-workflow/evidence/fix-effective-policy-reset-fallback/) + the merged-tree suite effective-policy tests (green in the 4865P full run at the product-identical tree) + verified non-interaction: the post-#47 product deltas are #48 (packages/runtime/src/plugin/root.ts, types.ts) and #50 (packages/runtime/src/plugin/host.ts, live/agent-bindings.mjs, root.ts) — ZERO policy/effective files touched (git diff name-only filtered, 2026-10-01).
MB
echo "=== battery-06 pr-b BLOCKED record written ==="

# ── [7] post hygiene ─────────────────────────────────────────────────────────────
section battery-99-post
{
  echo "\$ git -C $TESTUSE rev-parse HEAD   (expect unchanged 46a7f68b0922371ce7144b668b90e377d8e799f4)"
  git -C "$TESTUSE" rev-parse HEAD
  echo "TESTUSE_REV_EXIT=$?"
  echo "\$ git -C $TESTUSE status --porcelain   (expect EMPTY = still pristine = zero-core hold)"
  git -C "$TESTUSE" status --porcelain
  echo "TESTUSE_PORCELAIN_EXIT=$?"
  echo "\$ ss -ltn | grep -E ':(318[0-6]|349[1-8]|350[0-6])'   (expect: no lingering kit ports)"
  ss -ltn | grep -E ':(318[0-6]|349[1-8]|350[0-6])'
  echo "SS_POST_EXIT=$?  (1 = all kit ports freed)"
  echo "\$ ss -ltn | grep :3080   (stable still present, untouched)"
  ss -ltn | grep :3080
  echo "SS_3080_POST_EXIT=$?"
  echo "\$ ls $MAIN/tests/homes/   (worlds left behind, if any)"
  ls "$MAIN/tests/homes/" 2>&1
  echo "LS_HOMES_EXIT=$?"
} >> "$B/battery-99-post.log" 2>&1
echo "=== battery done ==="
