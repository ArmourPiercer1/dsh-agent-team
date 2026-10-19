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
R1="$RUN/n1"; mk_scratch "$R1"
node -e 'const fs=require("fs");const p=process.argv[1]+"/homes/candidate-INSTALLED.json";const j=JSON.parse(fs.readFileSync(p));j.installHome=process.argv[1]+"/homes/candidate-human-keep";fs.writeFileSync(p,JSON.stringify(j))' "$R1"
out="$(CANDIDATE_BASE="$R1/homes" EVIDENCE_DIR="$R1/ev" "$PKG_DIR/rollback-candidate.sh" --uninstall 2>&1)"; rc=$?
check N1a "human name as current record refused at the shape gate (fail-closed)" "$([ $rc -ne 0 ] && [ -d "$R1/homes/candidate-src-fake" ] && echo true || echo false)" "rc=$rc gate=$(echo "$out" | grep -c 'name shape')"

# ── N1b: human name arriving through the HISTORY record -> the sweep PREFIX GATE ──
R1b="$RUN/n1b"; mk_scratch "$R1b"
node -e 'const fs=require("fs");const A=process.argv[1];const j=JSON.parse(fs.readFileSync(A+"/homes/candidate-INSTALLED.json"));j.installHome=A+"/homes/candidate-human-keep";fs.writeFileSync(A+"/homes/candidate-INSTALLED.history.jsonl",JSON.stringify(j)+"\n")' "$R1b"
out="$(CANDIDATE_BASE="$R1b/homes" EVIDENCE_DIR="$R1b/ev" "$PKG_DIR/rollback-candidate.sh" --uninstall 2>&1)"; rc=$?
check N1b "human name via history hits the sweep negative gate (nothing deleted)" "$([ $rc -ne 0 ] && [ -d "$R1b/homes/candidate-human-keep" ] && [ -d "$R1b/homes/candidate-install-fake" ] && echo true || echo false)" "rc=$rc gate=$(echo "$out" | grep -c 'human-retained')"

# ── N2: sentinel inside a recorded world -> refusal, nothing deleted ──────────
R2="$RUN/n2"; mk_scratch "$R2"
printf 'sentinel\n' > "$R2/homes/candidate-install-fake/.CANDIDATE-HUMAN-USE"
out="$(CANDIDATE_BASE="$R2/homes" EVIDENCE_DIR="$R2/ev" "$PKG_DIR/rollback-candidate.sh" --uninstall 2>&1)"; rc=$?
check N2 "recorded world with .CANDIDATE-HUMAN-USE is refused" "$([ $rc -ne 0 ] && [ -d "$R2/homes/candidate-src-fake" ] && echo true || echo false)" "rc=$rc sentinel_gate=$(echo "$out" | grep -c 'sentinel-protected')"

# ── P1 + N3: clean state -> recorded worlds swept, human world survives/reported
R3="$RUN/n3"; mk_scratch "$R3"
out="$(CANDIDATE_BASE="$R3/homes" EVIDENCE_DIR="$R3/ev" "$PKG_DIR/rollback-candidate.sh" --uninstall 2>&1)"; rc=$?
human_survives=$([ -d "$R3/homes/candidate-human-keep" ] && echo true || echo false)
SL="$(ls "$R3"/ev/rollback-*/sweep-list.json 2>/dev/null | head -1)"; human_listed=$(grep -c 'candidate-human-keep' "$SL" 2>/dev/null || echo 0)
check P1 "recorded automation worlds deleted on --uninstall (rc=0)" "$([ $rc -eq 0 ] && [ ! -e "$R3/homes/candidate-install-fake" ] && [ ! -e "$R3/homes/candidate-src-fake" ] && echo true || echo false)" "rc=$rc"
check N3 "human world survives uninstall AND is reported (humanPresent)" "$([ "$human_survives" = true ] && [ "$human_listed" -ge 1 ] && echo true || echo false)" "sentinel_intact=$([ -f "$R3/homes/candidate-human-keep/.CANDIDATE-HUMAN-USE" ] && echo true) humanPresent_listed=$human_listed"

echo "SUMMARY pass=$PASS fail=$FAIL (evidence: runs/human-guard-$STAMP)"
cp "$SL" "$RUN/n3-sweep-list.json" 2>/dev/null || true
[ $FAIL -eq 0 ] || exit 2; exit 0
