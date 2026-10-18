#!/usr/bin/env bash
# rollback-candidate.sh — rollback / full uninstall of the candidate install.
#
# LAW: every removal is by EXACT RECORDED NAME only, read from
#   tests/homes/candidate-INSTALLED.json          (current state)
#   tests/homes/candidate-INSTALLED.history.jsonl (previous states, one JSON per line)
# BROAD GLOBS ARE FORBIDDEN (repo law: gitignore does not protect tracked files
# and a wildcard sweep once burned this program three times). Anything under
# tests/homes that is NOT exactly named by the state files is REPORTED, never
# deleted — it belongs to someone else's world.
#
# Modes:
#   --to-last      Roll back to the previous INSTALLED state: reinstall the
#                  previous recorded CANDIDATE_SHA through the same public
#                  package face (precedent: ROLLBACK-AND-TRIAL §2 "回退法 =
#                  同一安装命令换 #<旧全量 SHA>"; deployment launcher input
#                  follows the same commit automatically), then sweep the
#                  current world + src clone by exact name. The reinstall
#                  re-runs the full three-zero face check — a rollback that
#                  cannot prove three zeros is not a completed rollback.
#   --uninstall    Full uninstall: sweep install home + src clone + lock by
#                  exact recorded names; move the state files into the
#                  evidence dir as receipts. Worlds are gone; the pnpm store
#                  STAYS unless --purge-store (exact name, operator eyes).
#
# Rehearsal record: {{ROLLBACK_REHEARSAL_RECEIPT}} (README「演练记录」— to be
# filled at final assembly together with the final install receipt; the
# rehearsal must be re-run against the FINAL SHA, not the pre-assembly pin).
set -euo pipefail

MODE="${1:-}"
shift || true
Toplevel="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$Toplevel" ] || { echo "FATAL: run from inside a dsh-agent-team checkout" >&2; exit 1; }
BASE="${CANDIDATE_BASE:-$Toplevel/tests/homes}"
STATE_JSON="$BASE/candidate-INSTALLED.json"
HISTORY_JSONL="$BASE/candidate-INSTALLED.history.jsonl"
PKG_DIR="$Toplevel/dev/agent-workflow/evidence/alpha5/candidate-package"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
EVIDENCE_DIR="${EVIDENCE_DIR:-$PKG_DIR/runs}/rollback-$STAMP"
mkdir -p "$EVIDENCE_DIR"
PURGE_STORE=0
for a in "$@"; do case "$a" in --purge-store) PURGE_STORE=1 ;; *) echo "FATAL: unknown arg: $a" >&2; exit 1 ;; esac; done
log () { printf '[rollback-candidate %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
fail () { echo "FATAL: $*" >&2; exit 1; }
[ "$MODE" = "--to-last" ] || [ "$MODE" = "--uninstall" ] || fail "usage: rollback-candidate.sh --to-last | --uninstall [--purge-store]"
[ -f "$STATE_JSON" ] || fail "no current state at $STATE_JSON — nothing this package installed (refusing to touch anything else)"

# exact names recorded by install-candidate.sh (no glob deletes anywhere)
CURRENT_STATE="$(cat "$STATE_JSON")"
CUR_HOME="$(node -e 'console.log(JSON.parse(process.argv[1]).installHome)' "$CURRENT_STATE")"
CUR_SRC="$(node -e 'console.log(JSON.parse(process.argv[1]).srcHome)' "$CURRENT_STATE")"
CUR_STORE="$(node -e 'console.log(JSON.parse(process.argv[1]).storeDir)' "$CURRENT_STATE")"
CUR_SHA="$(node -e 'console.log(JSON.parse(process.argv[1]).sha)' "$CURRENT_STATE")"
case "$CUR_HOME$CUR_SRC" in
  *tests/homes/candidate-install-*|*candidate-install-*) : ;;
  *) fail "recorded installHome does not match the candidate-install-* name shape ($CUR_HOME) — refusing" ;;
esac

# every name the state files record (current + all history objects) — ours, deletable
RECORDED_NAMES_JSONL="${EVIDENCE_DIR}/recorded-names.jsonl"
RECORDED_BASENAMES_TXT="${EVIDENCE_DIR}/recorded-basenames.txt"
extract_states () { # pretty-JSON objects back-to-back (or compact jsonl) → one JSON per line
  node -e '
    const t = require("fs").readFileSync(process.argv[1], "utf8")
    let depth = 0, start = -1
    for (let i = 0; i < t.length; i += 1) {
      const c = t[i]
      if (c === "{") { if (depth === 0) start = i; depth += 1 }
      else if (c === "}") { depth -= 1; if (depth === 0 && start >= 0) { process.stdout.write(t.slice(start, i + 1).replace(/\s+/g, " ") + "\n"); start = -1 } }
    }
  ' "$1"
}
recompute_recorded () { # rebuild the recorded-names list from history (as on disk NOW) + the state JSON in $1
  local state_json="$1"
  if [ -f "$HISTORY_JSONL" ]; then extract_states "$HISTORY_JSONL" > "$RECORDED_NAMES_JSONL"; else : > "$RECORDED_NAMES_JSONL"; fi
  printf '%s\n' "$state_json" | tr -d '\n' >> "$RECORDED_NAMES_JSONL"
  echo >> "$RECORDED_NAMES_JSONL"
  node -e '
  const lines = require("fs").readFileSync(process.argv[1], "utf8").split("\n").filter((l) => l.trim() !== "")
  const names = new Set()
  for (const l of lines) {
    let o = null; try { o = JSON.parse(l) } catch { continue }
    for (const k of ["installHome", "srcHome"]) {
      if (typeof o[k] === "string" && o[k] !== "") { const b = o[k].split("/").pop(); names.add(b); names.add(b + ".lock") }
    }
  }
  process.stdout.write([...names].join("\n"))
' "$RECORDED_NAMES_JSONL" > "$RECORDED_BASENAMES_TXT"
  RECORDED_BASENAMES="$(cat "$RECORDED_BASENAMES_TXT")"
}
recompute_recorded "$CURRENT_STATE"

sweep_exact () { # $@ = exact paths; removals are EXACT names only (repo law: NO glob deletes)
  local swept=() p
  for p in "$@"; do
    if [ -e "$p" ]; then
      case "$p" in
        */candidate-install-*|*/candidate-src-*|*/candidate-*.lock) rm -rf -- "$p" && swept+=("$(basename "$p")") ;;
        *) fail "refusing to sweep non-candidate path: $p" ;;
      esac
    fi
  done
  # LIST (never delete) whatever candidate-* still exists, so leftovers stay visible
  node -e '
    const [parent, recordedFile, ...swept] = process.argv.slice(1)
    const { existsSync, readdirSync, readFileSync } = require("fs")
    const recorded = existsSync(recordedFile) ? readFileSync(recordedFile, "utf8").split("\n") : []
    const ours = existsSync(parent) ? readdirSync(parent).filter((n) => n.startsWith("candidate-install-") || n.startsWith("candidate-src-") || (n.startsWith("candidate-") && n.endsWith(".lock"))) : []
    const left = ours.filter((n) => !swept.includes(n))
    console.log(JSON.stringify({ parent, swept, leftButRecorded: left.filter((n) => recorded.includes(n)), foreign: left.filter((n) => !recorded.includes(n)), policy: "exact recorded names only — NO glob deletes" }))
  ' "$BASE" "$RECORDED_BASENAMES_TXT" ${swept[@]+"${swept[@]}"} | tee "$EVIDENCE_DIR/sweep-list.json"
  LEFT_LIST="$(node -e '
    const [parent, recordedFile, ...swept] = process.argv.slice(1)
    const { existsSync, readdirSync, readFileSync } = require("fs")
    const recorded = existsSync(recordedFile) ? readFileSync(recordedFile, "utf8").split("\n") : []
    const ours = existsSync(parent) ? readdirSync(parent).filter((n) => n.startsWith("candidate-install-") || n.startsWith("candidate-src-") || (n.startsWith("candidate-") && n.endsWith(".lock"))) : []
    console.log(ours.filter((n) => !swept.includes(n) && !recorded.includes(n)).join(","))
  ' "$BASE" "$RECORDED_BASENAMES_TXT" ${swept[@]+"${swept[@]}"})"
  [ -z "$LEFT_LIST" ] || fail "leftover candidate-* entries NOT recorded by the state files were NOT deleted: $LEFT_LIST (investigate by exact name)"
}

case "$MODE" in
  --to-last)
    [ -f "$HISTORY_JSONL" ] || fail "no rollback history ($HISTORY_JSONL missing) — there is no previous INSTALLED state to return to"
    # history may hold pretty-printed JSON objects back-to-back; take the LAST
    # top-level object (balanced-brace scan, works for compact .jsonl too)
    PREV="$(node -e '
      const t = require("fs").readFileSync(process.argv[1], "utf8")
      const objs = []; let depth = 0, start = -1
      for (let i = 0; i < t.length; i += 1) {
        const c = t[i]
        if (c === "{") { if (depth === 0) start = i; depth += 1 }
        else if (c === "}") { depth -= 1; if (depth === 0 && start >= 0) { objs.push(t.slice(start, i + 1)); start = -1 } }
      }
      process.stdout.write(objs.length > 0 ? objs[objs.length - 1] : "")
    ' "$HISTORY_JSONL")"
    [ -n "$PREV" ] || fail "rollback history holds no JSON state object"
    PREV_SHA="$(node -e 'console.log(JSON.parse(process.argv[1]).sha)' "$PREV")"
    case "$PREV_SHA" in *[!0-9a-f]*|"") fail "recorded previous sha is not 40-hex: $PREV_SHA" ;; esac
    [ "${#PREV_SHA}" -eq 40 ] || fail "previous sha is not a full 40-char SHA: $PREV_SHA"
    log "rolling back: current=$CUR_SHA → previous=$PREV_SHA (public-face reinstall, same command other SHA)"
    # The reinstall runs the FULL install law again (two-source pin via ALLOW_ANCESTOR
    # because the previous SHA is an ancestor of today's master, never a guess),
    # records a NEW INSTALLED.json and appends the current one to the history.
    CANDIDATE_SHA="$PREV_SHA" CANDIDATE_ALLOW_ANCESTOR=1 EVIDENCE_DIR="${EVIDENCE_DIR%/*}/reinstall-$STAMP" \
      "$PKG_DIR/install-candidate.sh" 2>&1 | tee "$EVIDENCE_DIR/rollback-reinstall.log"
    RC="${PIPESTATUS[0]}"; [ "$RC" -eq 0 ] || fail "rollback reinstall exited $RC — the candidate at $PREV_SHA did not re-verify; NOTHING was swept"
    # sweep the OLD world/src by exact name (the new install wrote fresh names);
    # recompute the recorded set first: history + the NEW INSTALLED.json now define "ours"
    recompute_recorded "$(cat "$STATE_JSON")"
    sweep_exact "$CUR_HOME" "$CUR_SRC" "$CUR_HOME.lock" "$CUR_SRC.lock"
    node -e '
      const [ev, curSha, prevSha] = process.argv.slice(1)
      require("fs").writeFileSync(ev + "/ROLLBACK-RECEIPT.json", JSON.stringify({
        at: new Date().toISOString(), mode: "to-last", fromSha: curSha, toSha: prevSha,
        note: "public-face reinstall of the previous recorded SHA; three-zero re-graded by install-candidate.sh",
        rehearsalPlaceholder: "{{ROLLBACK_REHEARSAL_RECEIPT}}",
      }, null, 2) + "\n")
    ' "$EVIDENCE_DIR" "$CUR_SHA" "$PREV_SHA"
    log "rollback complete: INSTALLED.json now points at $PREV_SHA (receipt: $EVIDENCE_DIR)"
    ;;
  --uninstall)
    log "uninstalling: current=$CUR_SHA; sweeping ALL recorded names (current + history) + moving state files to receipts"
    ALL_RECORDED_PATHS=()
    while IFS= read -r n; do [ -n "$n" ] && ALL_RECORDED_PATHS+=("$BASE/$n"); done <<< "$RECORDED_BASENAMES"
    sweep_exact ${ALL_RECORDED_PATHS[@]+"${ALL_RECORDED_PATHS[@]}"}
    if [ "$PURGE_STORE" -eq 1 ]; then
      case "$CUR_STORE" in
        */.pnpm-store-candidate|*/.pnpm-store-*) log "purging store by exact name: $CUR_STORE"; rm -rf -- "$CUR_STORE" ;;
        *) fail "refusing to purge non-pnpm-store path: $CUR_STORE" ;;
      esac
    else
      log "pnpm store kept (operator deletes by exact name if wanted): $CUR_STORE"
    fi
    mv "$STATE_JSON" "$EVIDENCE_DIR/candidate-INSTALLED.uninstalled.json"
    [ -f "$HISTORY_JSONL" ] && mv "$HISTORY_JSONL" "$EVIDENCE_DIR/candidate-INSTALLED.history.uninstalled.jsonl" || true
    node -e '
      const [ev, cur] = process.argv.slice(1)
      require("fs").writeFileSync(ev + "/UNINSTALL-RECEIPT.json", JSON.stringify({
        at: new Date().toISOString(), mode: "uninstall", lastSha: JSON.parse(cur).sha,
        stateFilesMoved: true,
        rehearsalPlaceholder: "{{ROLLBACK_REHEARSAL_RECEIPT}}",
      }, null, 2) + "\n")
    ' "$EVIDENCE_DIR" "$CURRENT_STATE"
    log "uninstall complete (receipts: $EVIDENCE_DIR)"
    ;;
esac
