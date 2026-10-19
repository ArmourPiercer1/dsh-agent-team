#!/usr/bin/env bash
# install-candidate.sh — SHA-PINNED install of the Alpha.5 candidate package.
#
# PRE-ASSEMBLED (root 22:39Z order): install + rollback docs are prepared ahead
# of the final assembly; every final receipt/SHA placeholder is marked {{...}}.
#
# LAW OF THIS SCRIPT (do not soften):
#  * CANDIDATE_SHA env is REQUIRED, a full 40-hex commit. There is NO default.
#    "latest master" / "just install master" semantics are FORBIDDEN — leaving
#    CANDIDATE_SHA unset aborts with an error, it never installs a moving ref.
#  * Two-source SHA verification (same discipline as a5ie-r5 H1b / a5glob-off):
#    (1) `git ls-remote <repo> refs/heads/master` measured OUTSIDE the clone,
#    (2) `git rev-parse HEAD` of the fresh clone after `checkout --detach
#    $CANDIDATE_SHA`. CANDIDATE_SHA must EQUAL the live master tip by default;
#    if master moved, only CANDIDATE_ALLOW_ANCESTOR=1 accepts it as an
#    ANCESTOR of the live tip (recorded, never silent).
#  * Install face = the host's OWN public package face (docs/INSTALL.md §2,
#    TEST_METHODS §2 chain, same command graded GREEN by a5ie-r5 I1 / r1):
#      DSH_HOME=<world> node <test-use>/apps/cli/lib/bin.js plugin --profile web add 'github:ArmourPiercer1/dsh-agent-team#<SHA>'
#    no file: paths, no manual assembly units, no upstream patches.
#  * Three-zero install-face verification (missing=0 / extra=0 / sha≠=0 against
#    the declared `files:` face recounted at the exact SHA) via face-check.mjs.
#  * Everything lands under tests/homes/ with candidate-* names (TEST_METHODS
#    §7), workspace-local pnpm storeDir (profile pnpm-workspace.yaml channel);
#    the stable :3080 instance is probed read-only, never touched.
#  * Writes tests/homes/candidate-INSTALLED.json (single current state) and
#    appends the previous state to tests/homes/candidate-INSTALLED.history.jsonl
#    — rollback-candidate.sh reads EXACTLY these files, nothing else.
#
# Usage:
#   CANDIDATE_SHA=<full-40-hex> ./install-candidate.sh
# Optional env:
#   CANDIDATE_ALLOW_ANCESTOR=1   accept CANDIDATE_SHA as an ancestor of live master
#   REPO_CLONE_URL=<url>         clone URL (default: this checkout's origin)
#   CANDIDATE_BASE=<dir>         worlds root (default: <toplevel>/tests/homes)
#   STORE_DIR=<dir>              pnpm store (default: <toplevel>/.pnpm-store-candidate)
#   TEST_USE=<dir>               pristine host tree (default: <toplevel>/tests/deepseek-harness-test-use)
#   BOOTSTRAP_TEST_USE=1         if the host tree is missing, build it per TEST_METHODS §1
#                                (needs DSH_BASELINE_TREE=<read-only baseline checkout>)
#   EVIDENCE_DIR=<dir>           receipts root (default: <toplevel>/dev/agent-workflow/evidence/alpha5/candidate-package/runs)
set -euo pipefail

# ── 0a. human persistent-world subcommands (root 00:57Z closure; no install) ──
# These run WITHOUT CANDIDATE_SHA — they operate on the already-verified state.
HW_TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
HW_PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HW_HOMES="${CANDIDATE_BASE:-${HW_TOP:-$HW_PKG/../../../..}/tests/homes}"
case "${1:-}" in
  --init-human-world)
    exec node "$HW_PKG/human-world.mjs" init --state "$HW_HOMES/candidate-INSTALLED.json" \
      --homes "$HW_HOMES" --template "$HW_PKG/human-config-template.yml" ;;
  --check-config)
    exec node "$HW_PKG/human-world.mjs" check --state "$HW_HOMES/candidate-INSTALLED.json" "${2:?usage: --check-config <human-world-dir>}" ;;
esac

# ── 0. CANDIDATE_SHA: required, 40-hex, NEVER defaulted ───────────────────────
if [ -z "${CANDIDATE_SHA:-}" ]; then
  echo "FATAL: CANDIDATE_SHA is REQUIRED (full 40-hex commit to install)." >&2
  echo "       This script refuses to install 'latest master' or any moving ref." >&2
  echo "       Example: CANDIDATE_SHA=0123456789abcdef0123456789abcdef01234567 ./install-candidate.sh" >&2
  exit 1
fi
case "$CANDIDATE_SHA" in
  *[!0-9a-f]*|'') echo "FATAL: CANDIDATE_SHA must be full lowercase hex (40 chars), got: $CANDIDATE_SHA" >&2; exit 1 ;;
esac
if [ "${#CANDIDATE_SHA}" -ne 40 ]; then
  echo "FATAL: CANDIDATE_SHA must be a FULL 40-char SHA (short SHAs are refused): $CANDIDATE_SHA" >&2
  exit 1
fi

Toplevel="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$Toplevel" ] && [ -f "$Toplevel/tests/paths.mjs" ] || { echo "FATAL: run this from inside a dsh-agent-team checkout (tests/paths.mjs must exist)" >&2; exit 1; }
PKG_DIR="$Toplevel/dev/agent-workflow/evidence/alpha5/candidate-package"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
BASE="${CANDIDATE_BASE:-$Toplevel/tests/homes}"
INSTALL_HOME="$BASE/candidate-install-$STAMP"
SRC_HOME="$BASE/candidate-src-$STAMP"
STORE_DIR="${STORE_DIR:-$Toplevel/.pnpm-store-candidate}"
TEST_USE="${TEST_USE:-$Toplevel/tests/deepseek-harness-test-use}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$PKG_DIR/runs}/install-$STAMP"
STATE_JSON="$BASE/candidate-INSTALLED.json"
HISTORY_JSONL="$BASE/candidate-INSTALLED.history.jsonl"
REPO_CLONE_URL="${REPO_CLONE_URL:-$(git -C "$Toplevel" remote get-url origin)}"
# source 1 always measures the PUBLISH url (a mirror transport never votes):
LS_REMOTE_URL="${LS_REMOTE_URL:-$REPO_CLONE_URL}"
INSTALL_SPEC="github:ArmourPiercer1/dsh-agent-team#${CANDIDATE_SHA}"
mkdir -p "$EVIDENCE_DIR" "$BASE"
log () { printf '[install-candidate %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
fail () { echo "FATAL: $*" >&2; exit 1; }

# ── 1. environment (TEST_METHODS §2/§5 + README prerequisites) ───────────────
command -v git >/dev/null || fail "git missing"
command -v tar >/dev/null || fail "tar missing"
command -v python3 >/dev/null || fail "python3 missing (Landlock launcher ABI probe)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
{ [ "$NODE_MAJOR" -ge 24 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -ge 19 ]; }; } || fail "node must be ^22.19 or >=24 (repo engines), got $(node --version)"
command -v pnpm >/dev/null || fail "pnpm missing (repo packageManager pin is 11.7.0; README §prereq)"
log "node=$(node --version) pnpm=$(pnpm --version) git=$(git --version | cut -d' ' -f3)"
STABLE_PROBE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3080/ 2>/dev/null || echo unreachable)"
log "stable :3080 read-only probe = ${STABLE_PROBE} (never touched by this script)"

# ── 2. two-source SHA verification (no 'latest master' semantics) ────────────
log "source 1: git ls-remote refs/heads/master (outside the clone)"
LS1="$(git ls-remote "$LS_REMOTE_URL" refs/heads/master | cut -f1)"
[ -n "$LS1" ] || fail "ls-remote did not answer (network? wrong remote?)"
if [ "$CANDIDATE_SHA" != "$LS1" ]; then
  if [ "${CANDIDATE_ALLOW_ANCESTOR:-0}" = "1" ]; then
    log "NOTE: CANDIDATE_SHA != live master ($LS1); CANDIDATE_ALLOW_ANCESTOR=1 → ancestor check after clone"
  else
    fail "CANDIDATE_SHA ($CANDIDATE_SHA) is not the live master tip ($LS1). Refusing either guess: re-pin the package to the final SHA, or set CANDIDATE_ALLOW_ANCESTOR=1 ONLY when knowingly installing an earlier verified commit."
  fi
fi

log "clone --branch master @ CANDIDATE_SHA → $SRC_HOME"
git clone --branch master --quiet "$REPO_CLONE_URL" "$SRC_HOME"
git -C "$SRC_HOME" checkout --quiet --detach "$CANDIDATE_SHA" 2>/dev/null || fail "CANDIDATE_SHA $CANDIDATE_SHA does not exist on master (checkout refused)"
HEAD2="$(git -C "$SRC_HOME" rev-parse HEAD)"
[ "$HEAD2" = "$CANDIDATE_SHA" ] || fail "clone HEAD $HEAD2 != CANDIDATE_SHA (nothing spliced in)"
if git -C "$SRC_HOME" merge-base --is-ancestor "$CANDIDATE_SHA" origin/master 2>/dev/null; then
  log "reachability: CANDIDATE_SHA is an ancestor-or-equal of the cloned origin/master"
elif [ "$REPO_CLONE_URL" = "$LS_REMOTE_URL" ]; then
  fail "CANDIDATE_SHA is not reachable from origin/master at the publish url"
else
  log "NOTE: mirror transport — ancestor check rides the strict tip equality above (source 1 = $LS_REMOTE_URL)"
fi
log "source 2: rev-parse in the clone = $HEAD2 (== CANDIDATE_SHA; ls-remote tip = $LS1)"

# ── 3. test-use host per TEST_METHODS §2 (pristine runtime) ──────────────────
BASELINE_SHA="$(node -e 'import(process.argv[1]).then(m=>console.log(m.TEST_USE_BASELINE_SHA))' "$SRC_HOME/tests/paths.mjs")"
CLIENT_HASH="$(node -e 'import(process.argv[1]).then(m=>console.log(m.CLIENT_COMMIT_HASH))' "$SRC_HOME/tests/paths.mjs")"
if [ ! -f "$TEST_USE/apps/cli/lib/bin.js" ]; then
  if [ "${BOOTSTRAP_TEST_USE:-0}" = "1" ]; then
    # TEST_METHODS §1 fresh-worktree flow: cross-device-safe clone from the
    # READ-ONLY baseline tree, detach to the pin, install + build.
    [ -d "${DSH_BASELINE_TREE:-}" ] || fail "BOOTSTRAP_TEST_USE=1 needs DSH_BASELINE_TREE=<read-only baseline checkout>"
    log "bootstrap: clone --local --no-hardlinks $DSH_BASELINE_TREE → $TEST_USE"
    git clone --local --no-hardlinks --quiet "$DSH_BASELINE_TREE" "$TEST_USE"
    git -C "$TEST_USE" checkout --quiet --detach "$BASELINE_SHA"
    ( cd "$TEST_USE" && pnpm install --ignore-scripts --frozen-lockfile )
    ( cd "$TEST_USE" && DSH_CLIENT_COMMIT_HASH="$CLIENT_HASH" ESBUILD_WORKER_THREADS=1 pnpm run build )
  else
    fail "test-use host $TEST_USE has no apps/cli/lib/bin.js — build it per TEST_METHODS §2 or pass BOOTSTRAP_TEST_USE=1 + DSH_BASELINE_TREE"
  fi
fi
TU_HEAD="$(git -C "$TEST_USE" rev-parse HEAD)"
TU_PORCELAIN="$(git -C "$TEST_USE" status --porcelain)"
[ "$TU_HEAD" = "$BASELINE_SHA" ] || fail "test-use HEAD $TU_HEAD != pinned baseline $BASELINE_SHA"
[ -z "$TU_PORCELAIN" ] || fail "test-use working tree is dirty (porcelain != 0) — pristine host required"
HOST_BIN="$TEST_USE/apps/cli/lib/bin.js"
log "host = $TEST_USE @ $(echo "$TU_HEAD" | cut -c1-10) porcelain 0"

# ── 4. REAL install through the host's public package face ───────────────────
mkdir -p "$INSTALL_HOME/workspace" "$INSTALL_HOME/profiles/web"
printf 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: %s\n' "$STORE_DIR" > "$INSTALL_HOME/profiles/web/pnpm-workspace.yaml"
log "install: node …/bin.js plugin --profile web add '$INSTALL_SPEC' (DSH_HOME=$INSTALL_HOME)"
T0=$(date +%s)
INSTALL_EXIT=0
( cd "$INSTALL_HOME/workspace" && DSH_HOME="$INSTALL_HOME" node "$HOST_BIN" plugin --profile web add "$INSTALL_SPEC" ) \
  > "$EVIDENCE_DIR/install-output.log" 2>&1 || INSTALL_EXIT=$?
log "install exit=$INSTALL_EXIT in $(( $(date +%s) - T0 ))s (full output: $EVIDENCE_DIR/install-output.log)"
[ "$INSTALL_EXIT" -eq 0 ] || fail "install exited $INSTALL_EXIT — see $EVIDENCE_DIR/install-output.log"

# ── 5. three-zero face verification (checklist: declared files: face) ────────
log "face-check (three zeros + launcher bytes + dump-config composition)"
FACE_EXIT=0
{ node "$PKG_DIR/face-check.mjs" --src "$SRC_HOME" --sha "$CANDIDATE_SHA" --world "$INSTALL_HOME" \
    --installed-dir "$INSTALL_HOME/profiles/web/node_modules/dsh-agent-team" --host-bin "$HOST_BIN" \
    --out "$EVIDENCE_DIR/face-check.json" | tee "$EVIDENCE_DIR/face-check.transcript.log"; } || FACE_EXIT=$?
[ "$FACE_EXIT" -eq 0 ] || fail "face-check RED/FATAL (exit $FACE_EXIT) — install refused: INSTALLED.json NOT written"

# ── 6. INSTALLED.json (current state) + history append (for rollback) ────────
if [ -f "$STATE_JSON" ]; then
  cat "$STATE_JSON" >> "$HISTORY_JSONL"; echo >> "$HISTORY_JSONL"
  log "previous state appended to $HISTORY_JSONL (rollback --to-last uses it)"
fi
STATE_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export INSTALL_SPEC INSTALL_HOME SRC_HOME STORE_DIR TEST_USE TU_HEAD PNPM_V
export PNPM_V="$(pnpm --version)"
node -e '
const fs = require("fs")
const [out, facePath, sha, ls1, at] = process.argv.slice(1)
const f = JSON.parse(fs.readFileSync(facePath, "utf8"))
const s = JSON.stringify({
  schema: "candidate-installed-v1", installedAt: at,
  sha, lsRemoteMasterAtVerify: ls1, allowAncestor: process.env.CANDIDATE_ALLOW_ANCESTOR === "1",
  installSpec: process.env.INSTALL_SPEC,
  installHome: process.env.INSTALL_HOME, srcHome: process.env.SRC_HOME,
  storeDir: process.env.STORE_DIR, testUse: process.env.TEST_USE, testUseHead: process.env.TU_HEAD,
  rootSha: f.face.rootSha,
  face: { expectedCount: f.face.expectedCount, actualCount: f.face.actualCount, missing: f.face.missing.length, extra: f.face.extra.length, shaMismatch: f.face.shaMismatch.length },
  launcher: { sha256: f.launcher.sha256, bytes: f.launcher.bytes, abi: f.launcher.abiProbe.kind, abiVersion: f.launcher.abiProbe.abiVersion },
  faceCheckExit: 0, nodeVersion: process.versions.node, pnpmVersion: (process.env.PNPM_V || ""),
}, null, 2)
fs.writeFileSync(out, s + "\n"); console.log(s)
' "$STATE_JSON" "$EVIDENCE_DIR/face-check.json" "$CANDIDATE_SHA" "$LS1" "$STATE_AT"
log "INSTALLED.json written → $STATE_JSON"
log "NEXT: ./try-candidate.sh --dry-run   then   ./try-candidate.sh  (full 3-leg chain, at final assembly with the final receipt)"
log "ROLLBACK: ./rollback-candidate.sh --to-last | --uninstall"
