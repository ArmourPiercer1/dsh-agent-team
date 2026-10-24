#!/usr/bin/env bash
# test-human-protection.sh — positive/negative spec for the human-world deletion
# protections (root 00:57Z closure). Runs the REAL rollback entrypoint against a
# scratch CANDIDATE_BASE; never touches the live tests/homes state.
#   PASS P1 positive : recorded automation worlds ARE deleted by --uninstall
#   PASS N1 negative : a candidate-human-* name in the record -> refusal, NOTHING deleted
#   PASS N2 negative : a .CANDIDATE-HUMAN-USE sentinel in a recorded world -> refusal, NOTHING deleted
#   PASS N3 report   : unrecorded human world survives and appears in sweep-list humanPresent
set -uo pipefail
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
RUN="$PKG_DIR/runs/human-guard-$STAMP"; mkdir -p "$RUN"
# fixture scratch (stub worlds, planted links) lives OUTSIDE the package tree —
# a committed fixture body/symlink once broke master's wording-lint walker
# (dangling statSync). Only small .out/JSON receipts are copied back into $RUN.
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/a5-human-guard-$STAMP.XXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
copyout () { # copyout <file...> — pull small receipts from scratch into $RUN
  local f; for f in "$@"; do [ -e "$f" ] && cp "$f" "$RUN/$(basename "$f")" 2>/dev/null; done; true
}
PASS=0; FAIL=0
check () { # check <id> <desc> <cond:true|false> <detail>
  if [ "$3" = true ]; then echo "PASS $1 — $2 [$4]"; PASS=$((PASS+1)); else echo "FAIL $1 — $2 [$4]"; FAIL=$((FAIL+1)); fi
}
mk_scratch () { # mk_scratch <root> — recorded install+src+lock dirs, recorded state, a human world
  local R="$1"; mkdir -p "$R/homes"
  for w in candidate-install-fake candidate-src-fake; do mkdir -p "$R/homes/$w/deployment" "$R/homes/$w/profiles/web/node_modules/dsh-agent-team"; echo x > "$R/homes/$w/deployment/landlock-prelauncher.py"; echo '{"name":"dsh-agent-team","version":"0"}' > "$R/homes/$w/profiles/web/node_modules/dsh-agent-team/package.json"; done
  : > "$R/homes/candidate-install-fake.lock"
  mkdir -p "$R/homes/candidate-human-keep"
  printf 'human retained\n' > "$R/homes/candidate-human-keep/.CANDIDATE-HUMAN-USE"
  node -e '
    const [R]=process.argv.slice(1); const fs=require("fs")
    const j={schema:1,sha:"d5de74974b0320b191b310ead82407d478477ed7",installHome:R+"/homes/candidate-install-fake",srcHome:R+"/homes/candidate-src-fake",storeDir:R+"/homes/.pnpm-store-fake",launcher:{sha256:"x",bytes:1},testUseHead:"639ed015397290b3745d163aafe02ffee4aa3f84"}
    fs.writeFileSync(R+"/homes/candidate-INSTALLED.json",JSON.stringify(j,null,2))
  ' "$R"
}

# ── N1a: candidate-human-* as the CURRENT recorded world -> earliest gate refuses ──
R1="$SCRATCH/n1"; mk_scratch "$R1"
node -e 'const fs=require("fs");const p=process.argv[1]+"/homes/candidate-INSTALLED.json";const j=JSON.parse(fs.readFileSync(p));j.installHome=process.argv[1]+"/homes/candidate-human-keep";fs.writeFileSync(p,JSON.stringify(j))' "$R1"
out="$(CANDIDATE_BASE="$R1/homes" EVIDENCE_DIR="$R1/ev" "$PKG_DIR/rollback-candidate.sh" --uninstall 2>&1)"; rc=$?
check N1a "human name as current record refused at the shape gate (fail-closed)" "$([ $rc -ne 0 ] && [ -d "$R1/homes/candidate-src-fake" ] && echo true || echo false)" "rc=$rc gate=$(echo "$out" | grep -c 'name shape')"

# ── N1b: human name arriving through the HISTORY record -> the sweep PREFIX GATE ──
R1b="$SCRATCH/n1b"; mk_scratch "$R1b"
node -e 'const fs=require("fs");const A=process.argv[1];const j=JSON.parse(fs.readFileSync(A+"/homes/candidate-INSTALLED.json"));j.installHome=A+"/homes/candidate-human-keep";fs.writeFileSync(A+"/homes/candidate-INSTALLED.history.jsonl",JSON.stringify(j)+"\n")' "$R1b"
out="$(CANDIDATE_BASE="$R1b/homes" EVIDENCE_DIR="$R1b/ev" "$PKG_DIR/rollback-candidate.sh" --uninstall 2>&1)"; rc=$?
check N1b "human name via history hits the sweep negative gate (nothing deleted)" "$([ $rc -ne 0 ] && [ -d "$R1b/homes/candidate-human-keep" ] && [ -d "$R1b/homes/candidate-install-fake" ] && echo true || echo false)" "rc=$rc gate=$(echo "$out" | grep -c 'human-retained')"

# ── N2: sentinel inside a recorded world -> refusal, nothing deleted ──────────
R2="$SCRATCH/n2"; mk_scratch "$R2"
printf 'sentinel\n' > "$R2/homes/candidate-install-fake/.CANDIDATE-HUMAN-USE"
out="$(CANDIDATE_BASE="$R2/homes" EVIDENCE_DIR="$R2/ev" "$PKG_DIR/rollback-candidate.sh" --uninstall 2>&1)"; rc=$?
check N2 "recorded world with .CANDIDATE-HUMAN-USE is refused" "$([ $rc -ne 0 ] && [ -d "$R2/homes/candidate-src-fake" ] && echo true || echo false)" "rc=$rc sentinel_gate=$(echo "$out" | grep -c 'sentinel-protected')"

# ── P1 + N3: clean state -> recorded worlds swept, human world survives/reported
R3="$SCRATCH/n3"; mk_scratch "$R3"
out="$(CANDIDATE_BASE="$R3/homes" EVIDENCE_DIR="$R3/ev" "$PKG_DIR/rollback-candidate.sh" --uninstall 2>&1)"; rc=$?
human_survives=$([ -d "$R3/homes/candidate-human-keep" ] && echo true || echo false)
SL="$(ls "$R3"/ev/rollback-*/sweep-list.json 2>/dev/null | head -1)"; human_listed=$(grep -c 'candidate-human-keep' "$SL" 2>/dev/null || echo 0)
check P1 "recorded automation worlds deleted on --uninstall (rc=0)" "$([ $rc -eq 0 ] && [ ! -e "$R3/homes/candidate-install-fake" ] && [ ! -e "$R3/homes/candidate-src-fake" ] && echo true || echo false)" "rc=$rc"
check N3 "human world survives uninstall AND is reported (humanPresent)" "$([ "$human_survives" = true ] && [ "$human_listed" -ge 1 ] && echo true || echo false)" "sentinel_intact=$([ -f "$R3/homes/candidate-human-keep/.CANDIDATE-HUMAN-USE" ] && echo true) humanPresent_listed=$human_listed"

# ── N4: launcher-less world is REFUSED by the three-path verify (root 01:33Z ①;
#    permanent regression for the `bad(...) | pass` boolean hole — red/green pair
#    lives at runs/human-boolfix-*/ on the real check path; this pins the shared verify3) ──
R4="$SCRATCH/n4"; mk_scratch "$R4"
LAUNCH_SHA4=$(sha256sum "$R4/homes/candidate-install-fake/deployment/landlock-prelauncher.py" | cut -d' ' -f1)
node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));j.launcher.sha256=process.argv[2];fs.writeFileSync(p,JSON.stringify(j))' "$R4/homes/candidate-INSTALLED.json" "$LAUNCH_SHA4"
rm -f "$R4/homes/candidate-install-fake/deployment/landlock-prelauncher.py"
out="$(node "$PKG_DIR/human-world.mjs" init --state "$R4/homes/candidate-INSTALLED.json" --homes "$R4/homes" --template "$PKG_DIR/human-config-template.yml" 2>&1)"; rc=$?
echo "$out" > "$RUN/n4-init.out"
check N4 "launcher-less world refused by verify3 (rc!=0, launcherPath named) — boolean-hole regression" "$([ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'launcherPath missing' && echo true || echo false)" "rc=$rc"

# ── N5: init dereferences planted symlinks — no live link into cleanup territory ──
R5="$SCRATCH/n5"; mk_scratch "$R5"
LAUNCH_SHA=$(sha256sum "$R5/homes/candidate-install-fake/deployment/landlock-prelauncher.py" | cut -d' ' -f1)
node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));j.launcher.sha256=process.argv[2];fs.writeFileSync(p,JSON.stringify(j))' "$R5/homes/candidate-INSTALLED.json" "$LAUNCH_SHA"
ln -s "$R5/homes/candidate-src-fake" "$R5/homes/candidate-install-fake/link-abs-into-cleanup-face"
ln -s "$R5/homes/candidate-install-fake/deployment/landlock-prelauncher.py" "$R5/homes/candidate-install-fake/link-file-abs"
out="$(node "$PKG_DIR/human-world.mjs" init --state "$R5/homes/candidate-INSTALLED.json" --homes "$R5/homes" --template "$PKG_DIR/human-config-template.yml" 2>&1)"; rc=$?
H5="$(printf '%s\n' "$out" | awk -F= '/^WORLD=/{print $2}')"
nlinks=$([ -d "$H5" ] && find "$H5" -type l | wc -l || echo -1)
deref_logged=$(printf '%s' "$out" | grep -c 'dereferenced symlink -> bytes')
content_ok=false; [ -f "$H5/link-file-abs" ] && grep -q x "$H5/link-file-abs" && content_ok=true
echo "$out" > "$RUN/n5-init.out"
check N5 "init dereferences ALL symlinks (no live link into cleanup territory; ③ WORLD= capture works)" "$([ -d "$H5" ] && [ "$nlinks" -eq 0 ] && [ "$deref_logged" -ge 2 ] && [ "$content_ok" = true ] && echo true || echo false)" "links=$nlinks derefed=$deref_logged content=$content_ok rc=$rc"

# ── N6: relative and absolute invocations of --check-config give the SAME verdict
#    (doc-trail order ②; uses the retained configured human world if present —
#    environment-conditional like the live-smoke runs, skipped-not-failed if absent) ──
ROOT4="$(cd "$PKG_DIR/../../../../.." && pwd)"   # up to the checkout root
HW="$(ls -d "$ROOT4"/tests/homes/candidate-human-* 2>/dev/null | tail -1)"
if [ -n "$HW" ] && [ -f "$ROOT4/tests/homes/candidate-INSTALLED.json" ]; then
  node "$PKG_DIR/human-world.mjs" check --state "$ROOT4/tests/homes/candidate-INSTALLED.json" "$HW" > "$RUN/n6-abs.out" 2>&1; rca=$?
  ( cd "$ROOT4" && node "dev/agent-workflow/evidence/alpha5/candidate-package/human-world.mjs" check --state "tests/homes/candidate-INSTALLED.json" "${HW#"$ROOT4"/}" > "$RUN/n6-rel.out" 2>&1 ); rcb=$?
  check N6 "rel==abs same verdict on the same world (both rc=$rca/$rcb)" "$([ $rca -eq $rcb ] && echo true || echo false)" "abs=$rca rel=$rcb"
else
  echo "SKIP N6 — no retained human world in this environment (env-conditional, like live-smoke)"
fi

# ── N7: dangling symlink at init -> fail-closed AND the half-created world is
#    removed by us (doc-trail order ④) ──
R7="$SCRATCH/n7"; mk_scratch "$R7"
LAUNCH_SHA7=$(sha256sum "$R7/homes/candidate-install-fake/deployment/landlock-prelauncher.py" | cut -d' ' -f1)
node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));j.launcher.sha25256=undefined;j.launcher.sha256=process.argv[2];fs.writeFileSync(p,JSON.stringify(j))' "$R7/homes/candidate-INSTALLED.json" "$LAUNCH_SHA7"
ln -s "$R7/homes/nowhere-dangling" "$R7/homes/candidate-install-fake/dangling-link"
out="$(node "$PKG_DIR/human-world.mjs" init --state "$R7/homes/candidate-INSTALLED.json" --homes "$R7/homes" --template "$PKG_DIR/human-config-template.yml" 2>&1)"; rc=$?
echo "$out" > "$RUN/n7-init.out"
partial_left="$(ls -d "$R7"/homes/candidate-human-* 2>/dev/null | grep -v -- "-keep$" | wc -l)"   # the -keep fixture is mk_scratch's, not a partial init
check N7 "dangling link refuses init (rc!=0) and partial world is cleaned by init itself" "$([ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'dangling symlink' && [ "$partial_left" -eq 0 ] && echo true || echo false)" "rc=$rc partial_left=$partial_left"

# ── N8 (gate): the package evidence tree must contain NO symlinks and NO fixture
#    worlds ever (recurrence-red order ③) ──
nlinks="$(find "$PKG_DIR/runs" -type l | wc -l)"
nhomes="$(find "$PKG_DIR/runs" -path '*/n*/homes*' | wc -l)"
check N8 "package runs/ tree: zero symlinks, zero fixture-world paths (anti-recurrence gate)" "$([ "$nlinks" -eq 0 ] && [ "$nhomes" -eq 0 ] && echo true || echo false)" "links=$nlinks fixture_paths=$nhomes"

echo "SUMMARY pass=$PASS fail=$FAIL (evidence: runs/human-guard-$STAMP; fixture scratch: /tmp, reproduced and discarded by this run)"


copyout "$SL"
[ $FAIL -eq 0 ] || exit 2; exit 0
