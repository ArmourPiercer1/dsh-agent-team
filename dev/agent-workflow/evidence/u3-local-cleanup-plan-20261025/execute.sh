#!/usr/bin/env bash
# execute.sh — U3-B local cleanup plan executor (repo: dsh-agent-team)
# DRY-RUN by DEFAULT. Nothing is modified without --execute.
# Implements exactly: dev/agent-workflow/evidence/u3-local-cleanup-plan-20261025/*.tsv
# Safety model:
#  - per-item explicit paths only (read from plan TSVs; no globs anywhere)
#  - every rm target guarded: absolute, starts with $ROOT, never $ROOT itself, no '..',
#    inside the category's allowed parent ($ROOT/.worktrees, $ROOT/tests/homes, or a
#    single-component direct child of $ROOT), never a KEEP item
#  - salvage copied with cp -a --parents and sha256-verified BEFORE the worktree is removed
#  - tracked-mods patch via `git -C <wt> diff HEAD` (evidence paths excluded — those are
#    deletions the plan explicitly does not salvage; content lives in git) saved pre-removal
#  - every move is `mv -n` (never overwrites) followed by existence checks
#  - every action logged to .artifacts/evidence/cleanup-log-<UTC>.tsv; df -B1 before/after
set -euo pipefail

MODE=dry-run
case "${1:-}" in
  ""|--dry-run) MODE=dry-run ;;
  --execute)    MODE=execute ;;
  *) echo "usage: $0 [--dry-run|--execute]" >&2; exit 2 ;;
esac
if [[ $# -gt 0 ]]; then shift; fi
if [[ $# -gt 0 ]]; then echo "unexpected args: $*" >&2; exit 2; fi

ROOT="/srv/workspace/dsh-plugins/dsh-agent-team"
PLAN_DIR="$ROOT/dev/agent-workflow/evidence/u3-local-cleanup-plan-20261025"
STORE_DIR="$ROOT/.artifacts/evidence"     # relocation store (user ruling 2026-10-25T10:17Z)
TS="$PLAN_DIR"
for f in salvage.tsv worktree-remove.tsv branches.tsv root-scratch.tsv homes.tsv; do
  [[ -f "$TS/$f" ]] || { echo "FATAL: missing plan input $TS/$f" >&2; exit 3; }
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$STORE_DIR/cleanup-log-$STAMP.tsv"
STAGING="$STORE_DIR/.staging-$STAMP"

# Defense-in-depth KEEP lists (the TSVs already exclude these)
KEEP_WTS=$'.worktrees/s2-authority-iso-20261025\n.worktrees/u1-audit-master\n.worktrees/eb-e0-e1\n.worktrees/pr363-docs-review\n.worktrees/a5-m2-int'
KEEP_HOMES=$'.playwright-browsers\na5m2-c2-r15-20261023T14-24-17Z\na5m2-todo-c2-r3-20261023T10-16-39Z\ns1-census-20261025T011533Z\ns1-h0-m1-20261024T222400Z\ns1-h0-m1-noext-20261024T225300Z\ns1-h0-m2-2026-10-24T23-26-02Z\ns1-h0-m3-2026-10-25T00-18-09Z'
# root DELETE deny-list (never rm -rf any of these, whatever a TSV says)
DENY_ROOT='.artifacts tests tests/homes tests/deepseek-homes references node_modules .pnpm-store .worktrees dev packages docs .git recovery'

fail(){ printf 'ABORT\t%s\t%s\n' "$1" "${2:-}" >&2; log ABORT "$1" "${2:-}"; exit 1; }
log(){ local line
  line="$(printf '%s\t%s\t%s\t%s' "$(date -u +%FT%TZ)" "$1" "$2" "${3:-}")"
  echo "$line"
  if [[ "$MODE" == execute ]]; then printf '%s\n' "$line" >> "$LOG"; fi; }
act(){ if [[ "$MODE" == execute ]]; then "$@"; else log DRY "$*" "-"; fi; }

sha_f(){ sha256sum -- "$1" | cut -d' ' -f1; }
# dir manifest sha256, byte-identical to the planner:
# regular: '<sha>  ./<rel>' ; symlink: 'L <target> ./<rel>' ; LC_ALL=C sorted by path
manifest_dir(){ ( cd "$1" && find . \( -type f -o -type l \) -print0 2>/dev/null \
  | LC_ALL=C sort -z \
  | while IFS= read -r -d '' f; do
      if [[ -L "$f" ]]; then printf 'L %s %s\n' "$(readlink "$f")" "$f"
      else printf '%s  %s\n' "$(sha256sum < "$f" | cut -d' ' -f1)" "$f"; fi
    done | sha256sum | cut -d' ' -f1 ); }
in_list(){ printf '%s\n' "$2" | grep -qxF "$1"; }

# ---------- guards ----------
guard_in_root(){ local p="$1"
  [[ "$p" == "$ROOT"/* ]] || fail "path not under repo root" "$p"
  [[ "$p" != "$ROOT" ]]   || fail "path is repo root" "$p"
  [[ "$p" != *".."* ]]    || fail "path contains .." "$p"; }
guard_parent(){ guard_in_root "$1"; [[ "$1" == "$2"/* ]] || fail "path outside allowed parent $2" "$1"; }
guard_single(){ [[ "$1" != *"/"* && "$1" != "." && "$1" != ".." ]] || fail "not a single name" "$1"; }

# ---------- phase 1: worktrees (salvage+verify first, then remove) ----------
phase_wts(){
  local rel _br _head _cls _s1 _s2 _lo _cov _ns _sb _after
  while IFS=$'\t' read -r rel _br _head _cls _s1 _s2 _lo _cov _ns _sb _after; do
    [[ "$rel" == ".worktrees/"?* ]] || continue
    in_list "$rel" "$KEEP_WTS" && fail "KEEP worktree in remove TSV" "$rel"
    local wtname="${rel#.worktrees/}" wtabs="$ROOT/$rel"
    guard_parent "$wtabs" "$ROOT/.worktrees"
    [[ "$wtname" != *"/"* ]] || true   # nested allowed (pack-int/...); guard_parent covers
    if [[ ! -d "$wtabs" ]]; then log SKIP-WT "$rel" "directory already absent"; continue; fi
    # 1a) tracked-mods patch, saved before removal
    local patch_dst
    patch_dst="$(awk -F'\t' -v w="$rel" '$5=="patch" && $6==w {print $2; exit}' "$TS/salvage.tsv")"
    if [[ -n "$patch_dst" ]]; then
      local patch_fin="$ROOT/$patch_dst"
      if [[ "$MODE" == execute ]]; then
        mkdir -p "$STAGING/patch/$wtname" "$(dirname "$patch_fin")"
        git -C "$wtabs" diff HEAD --binary -- . ':(exclude)dev/agent-workflow/evidence' \
          > "$STAGING/patch/$wtname/tracked-mods.patch"
        [[ -f "$STAGING/patch/$wtname/tracked-mods.patch" ]] || fail "patch not created" "$rel"
        mv -n -- "$STAGING/patch/$wtname/tracked-mods.patch" "$patch_fin" || true
        if [[ -f "$STAGING/patch/$wtname/tracked-mods.patch" ]]; then
          fail "mv -n refused (destination exists)" "$patch_fin"
        fi
        [[ -f "$patch_fin" ]] || fail "patch missing after move" "$patch_fin"
        log PATCHED "$rel" "-> $patch_dst sha=$(sha_f "$patch_fin")"
      else
        log DRY "git -C '$wtabs' diff HEAD --binary (excl evidence) -> $patch_dst" "-"
      fi
    fi
    # 1b) salvage items: copy (cp -a --parents) -> verify sha256 -> stage-move into store
    local src dst bytes sha kind wtr
    while IFS=$'\t' read -r src dst bytes sha kind wtr; do
      [[ "$wtr" == "$rel" ]] || continue
      case "$kind" in file|file-mod|dir|dir-perm) ;; *) continue ;; esac
      local srcabs="$ROOT/$src"
      [[ -e "$srcabs" || -L "$srcabs" ]] || { log SKIP-MISSING "$src" "planned item absent"; continue; }
      [[ "$src" == ".worktrees/$wtname/"?* ]] || fail "salvage src outside its worktree" "$src"
      guard_parent "$srcabs" "$wtabs"
      local relsrc="${src#".worktrees/$wtname/"}"
      local finpath="$ROOT/$dst" tmpdst="$STAGING/$wtname/$relsrc"
      if [[ "$MODE" != execute ]]; then
        log DRY "cp -a --parents '$relsrc' (in $wtabs) && verify && mv -n -> $dst" "bytes=$bytes sha=$sha"
        continue
      fi
      if [[ -e "$finpath" || -L "$finpath" ]]; then log SKIP-SALVAGED "$src" "destination exists (verified in an earlier run)"; continue; fi
      if [[ "$kind" == dir-perm ]]; then chmod -R u+rwX -- "$srcabs" 2>/dev/null || true; fi
      mkdir -p "$(dirname "$tmpdst")"
      ( cd "$wtabs" && cp -a --parents -- "$relsrc" "$STAGING/$wtname" )
      if [[ "$kind" == dir ]]; then
        [[ "$(manifest_dir "$tmpdst")" == "$sha" ]] || fail "dir sha mismatch after copy" "$src"
      elif [[ "$kind" == dir-perm ]]; then
        [[ "$(manifest_dir "$tmpdst")" == "$(manifest_dir "$srcabs")" ]] \
          || fail "dir-perm copy mismatch" "$src"
      else
        [[ "$(sha_f "$tmpdst")" == "$sha" ]] || fail "file sha mismatch after copy" "$src"
      fi
      mkdir -p "$(dirname "$finpath")"
      mv -n -- "$tmpdst" "$finpath" || true
      if [[ -e "$tmpdst" ]]; then fail "mv -n refused (destination exists)" "$finpath"; fi
      [[ -e "$finpath" || -L "$finpath" ]] || fail "salvage missing after move" "$dst"
      log SALVED "$src" "-> $dst bytes=$bytes"
    done < "$TS/salvage.tsv"
    # 1c) remove worktree (all salvage for it verified above)
    if [[ "$MODE" == execute ]]; then
      chmod -R u+rwX -- "$wtabs" 2>/dev/null || true   # read-only install dirs (added after first run failed: Permission denied)
      git -C "$ROOT" worktree remove --force "$wtabs"
      [[ ! -e "$wtabs" ]] || fail "worktree still present" "$rel"
    fi
    log WT-REMOVED "$rel" "salvage_items=$_ns"
  done < <(tail -n +2 "$TS/worktree-remove.tsv")
}

# ---------- phase 2: root untracked (MOVE then DELETE) ----------
phase_root(){
  local p cls action bytes_u1a live bytes_live dst
  while IFS=$'\t' read -r p cls action bytes_u1a live bytes_live dst; do
    local srcabs="$ROOT/$p"
    if [[ "$action" == MOVE ]]; then
      local fin="$ROOT/$dst"
      [[ "$dst" == ".artifacts/evidence/root-untracked/"* || "$dst" == ".artifacts/evidence/unknown/"* ]] \
        || fail "bad move destination" "$dst"
      guard_in_root "$srcabs"
      guard_parent "$fin" "$STORE_DIR"
      if [[ ! -e "$srcabs" && ! -L "$srcabs" ]]; then log SKIP-MISSING "$p" "root item absent"; continue; fi
      if [[ "$MODE" == execute ]]; then
        mkdir -p "$(dirname "$fin")"
        mv -n -- "$srcabs" "$fin" || true
        if [[ -e "$srcabs" || -L "$srcabs" ]]; then fail "move source still present (or mv -n skipped)" "$p"; fi
        [[ -e "$fin" || -L "$fin" ]] || fail "move target missing" "$dst"
        log MOVED "$p" "-> $dst class=$cls bytes=$bytes_live"
      else
        log DRY "mv -n '$srcabs' '$fin'" "class=$cls bytes=$bytes_live"
      fi
    elif [[ "$action" == DELETE ]]; then
      guard_single "$p"
      guard_parent "$srcabs" "$ROOT"
      [[ " $DENY_ROOT " != *" $p "* ]] || fail "DELETE of denied root item" "$p"
      if [[ ! -e "$srcabs" && ! -L "$srcabs" ]]; then log SKIP-MISSING "$p" "root item absent"; continue; fi
      if [[ "$MODE" == execute ]]; then
        if [[ -d "$srcabs" && ! -L "$srcabs" ]]; then
          rm -rf -- "$srcabs" 2>/dev/null || { chmod -R u+rwX -- "$srcabs" 2>/dev/null || true; rm -rf -- "$srcabs"; }
        else
          rm -f -- "$srcabs"
        fi
        [[ ! -e "$srcabs" ]] || fail "scratch still present" "$p"
        log DELETED-SCRATCH "$p" "bytes=$bytes_live"
      else
        log DRY "rm -rf '$srcabs'" "bytes=$bytes_live"
      fi
    fi
  done < <(tail -n +2 "$TS/root-scratch.tsv")
}

# ---------- phase 3: homes ----------
phase_homes(){
  local name kind cls action rest
  while IFS=$'\t' read -r name kind cls action rest; do
    case "$action" in DELETE|DELETE-LOCK|DELETE-LOCK-ORPHAN) ;; *) continue ;; esac
    guard_single "$name"
    ( in_list "$name" "$KEEP_HOMES" ) && fail "DELETE of KEEP home" "$name"
    local p="$ROOT/tests/homes/$name"
    guard_parent "$p" "$ROOT/tests/homes"
    if [[ ! -e "$p" && ! -L "$p" ]]; then log SKIP-MISSING "tests/homes/$name" "absent"; continue; fi
    if [[ "$MODE" == execute ]]; then
      if [[ -d "$p" && ! -L "$p" ]]; then
        rm -rf -- "$p" 2>/dev/null || { chmod -R u+rwX -- "$p" 2>/dev/null || true; rm -rf -- "$p"; }
      else
        rm -f -- "$p"
      fi
      [[ ! -e "$p" ]] || fail "home still present" "$name"
      log DELETED-HOME "tests/homes/$name" "kind=$kind action=$action"
    else
      log DRY "rm -rf '$p'" "kind=$kind action=$action"
    fi
  done < <(tail -n +2 "$TS/homes.tsv")
}

# ---------- main ----------
log BEGIN "mode=$MODE" "plan=$TS"
log DF-BEFORE "-" "$(df -B1 --output=source,size,used,avail "$ROOT" | tail -1 | tr -s ' ')"
if [[ "$MODE" == execute ]]; then mkdir -p "$STORE_DIR" "$STAGING"; fi

phase_wts
phase_root
phase_homes

if [[ "$MODE" == execute && -d "$STAGING" ]]; then
  rm -rf -- "$STAGING"   # staging is inside the store; only leftovers can be here
fi
log DF-AFTER "-" "$(df -B1 --output=source,size,used,avail "$ROOT" | tail -1 | tr -s ' ')"
log END "mode=$MODE" "log=$LOG"
