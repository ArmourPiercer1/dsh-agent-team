#!/usr/bin/env bash
# RED controls for scripts/ci-pr-gate.mjs — the deliberate-bite runs.
#
# A gate that has never been observed refusing anything is an untested gate. Each control plants
# one defect, runs ONE leg (or the grader, for the two cheap synthetic cases), captures the
# transcript, and reverts — `set -e` is deliberately absent: a RED control that aborts the script
# on its own expected failure would never reach its own revert.
#
# Usage: bash dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/red-control.sh <A|B|C|D|E>
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
WT=/home/user/dsh-plugins/dsh-agent-team/.worktrees/ci-a4-pr-gate
EV=dev/agent-workflow/evidence/a4-pr7/ci-gate
STORE=/home/user/dsh-plugins/dsh-agent-team/.pnpm-store
cd "$WT" || exit 2
mkdir -p "$EV/transcripts"

stamp() { date -u +%FT%TZ; }
head_line() { echo "head=$(git rev-parse --short HEAD) porcelain=$(git status --porcelain | wc -l)"; }

case "${1:-}" in
  # ── A. a TypeScript error in a TEST file: the 27-errors-at-merge incident, made reproducible.
  # build does not typecheck tests and vitest strips types, so nothing else in this repository
  # looks at this file until the gate does.
  A)
    f=packages/testkit/test/ci-gate-red-control-a.test.ts
    {
      echo "=== RED CONTROL A — a TypeScript error in a test file ==="
      echo "start $(stamp)"; head_line
      echo "planted: $f (never committed; removed by this script's revert)"
      printf "export const probe = 1\nconst wrongType: number = 'this is a string, and tsc must say so'\nexport const probe2 = wrongType\n" > "$f"
      git status --porcelain
      node scripts/ci-pr-gate.mjs --only typecheck --store-dir "$STORE"
      echo "[gate exit $?]"
      rm -f "$f"
      echo "reverted; porcelain now: $(git status --porcelain | wc -l)"
      echo "end $(stamp)"
    } > "$EV/transcripts/RED-A-typescript-error-in-test.txt" 2>&1
    echo "wrote $EV/transcripts/RED-A-typescript-error-in-test.txt (exit $?)"
    ;;

  # ── B. the graph.yaml that ACTUALLY reached master through PR #195, byte for byte.
  B)
    {
      echo "=== RED CONTROL B — the unparsable graph.yaml that landed on master twice ==="
      echo "start $(stamp)"; head_line
      echo "source of the planted bytes: git show 34ef63ed:dev/agent-workflow/graph.yaml"
      echo "  (34ef63ed = merge of PR #195; the defect is the 5-space sequence indent under"
      echo "   alpha4_governance_20261007.post_alpha4_backlog, repaired in fed9ac91)"
      git show 34ef63ed:dev/agent-workflow/graph.yaml > dev/agent-workflow/graph.yaml
      echo "planted bytes sha256: $(sha256sum dev/agent-workflow/graph.yaml | cut -c1-16)…"
      echo "and the defect line, from the tree now:"
      grep -n '^     - "compatibility-authority race' dev/agent-workflow/graph.yaml | head -1
      node scripts/ci-pr-gate.mjs --only graph-parse
      echo "[gate exit $?]"
      echo "--- second half: the local guard and this gate must agree ---"
      # The hook is run DIRECTLY, with the bad bytes staged, instead of via `git commit`: a probe
      # commit on this branch would touch real history to prove a point that costs nothing to prove
      # by calling the script the same way git does.
      HOOK="$(git rev-parse --git-common-dir)/hooks/pre-commit"
      echo "installed hook: $HOOK"
      ls -l "$HOOK" 2>&1 | head -1
      if git add dev/agent-workflow/graph.yaml; then
        if bash "$HOOK"; then
          echo "HOOK RESULT: the commit hook ACCEPTED the unparsable index — the guard did not fire"
        else
          echo "HOOK RESULT: the hook EXITED NON-ZERO — with a staged unparsable graph.yaml, git would have refused the commit"
        fi
      else
        echo "HOOK RESULT: could not stage the probe bytes (no probe run)"
      fi
      git restore --staged --worktree dev/agent-workflow/graph.yaml
      echo "reverted; graph.yaml sha256 now: $(sha256sum dev/agent-workflow/graph.yaml | cut -c1-16)…"
      node scripts/ci-pr-gate.mjs --only graph-parse
      echo "[post-revert gate exit $? — must be 0]"
      echo "end $(stamp)"
    } > "$EV/transcripts/RED-B-unparsable-graph-yaml.txt" 2>&1
    echo "wrote $EV/transcripts/RED-B-unparsable-graph-yaml.txt (exit $?)"
    ;;

  # ── C. a NEW red leg identity, injected into a file that ALREADY carries baseline debt, so the
  # control also shows the diff is per-identity and not per-file or per-count.
  C)
    f=packages/domain/test/t2-blueprint-hash.test.ts
    {
      echo "=== RED CONTROL C — a NEW red leg identity, added inside a file the baseline already lists as red ==="
      echo "start $(stamp)"; head_line
      echo "baseline: dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md"
      echo "  that document already carries this file as debt:"
      grep -n "t2-blueprint-hash" dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md | sed 's/^/    /'
      echo "why this file: a gate that compares PER FILE or PER COUNT would see an already-red file go"
      echo "  red and call the tree unchanged. Only a per-IDENTITY diff can see one more red in a"
      echo "  already-red file, which is the whole reason §7.6 says identity sets and not counts."
      echo "planted: one top-level it() that asserts 1 === 2, appended to $f (tracked file; reverted below)"
      cp "$f" "$EV/scratch/red-C-original.ts"
      printf "\nit('CI-GATE RED CONTROL C a new red identity inside an already-red file', () => {\n  expect(1).toBe(2)\n})\n" >> "$f"
      git --no-pager diff --stat -- "$f"
      echo
      echo "\$ node scripts/ci-pr-gate.mjs --only census --census-captures 1"
      node scripts/ci-pr-gate.mjs --only census --census-captures 1 --store-dir "$STORE"
      echo "[gate exit $? — must be 1, naming the planted identity under NEW RED(S)]"
      echo
      echo "--- the machine-readable comparison the leg wrote ---"
      latest=$(ls -t "$EV"/scratch/census-comparison-*.json | head -1)
      echo "  $latest"
      python3 -c "
import json,sys
d=json.load(open('$latest'))
c=d['comparison']
print('  verdict       :', c['verdict'])
print('  newReds       :', len(c['newReds']))
for x in c['newReds']: print('    +', x)
print('  resolved      :', len(c['resolved']))
for x in c['resolved']: print('    -', x)
print('  escalations   :', len(c['escalations']))
print('  counts moved? :', c['totals']['moved'], '(files', c['totals']['files'], 'vs baseline-declared', (c['totals']['declared'] or {}).get('files'), ')')
"
      cp "$EV/scratch/red-C-original.ts" "$f"
      rm -f "$EV/scratch/red-C-original.ts"
      echo "reverted: $(git status --porcelain -- "$f" | wc -l) modified path(s) remain for $f"
      echo "end $(stamp)"
    } > "$EV/transcripts/RED-C-new-red-identity.txt" 2>&1
    echo "wrote $EV/transcripts/RED-C-new-red-identity.txt (exit $?)"
    ;;

  # ── D. the case a count-based gate gets backwards: a titled red that VANISHES into a collection
  # error. A real census report is mutated so the count goes DOWN, and the grader must call it an
  # escalation. The report is the closure lane's own capture, not a hand-made fixture.
  D)
    {
      echo "=== RED CONTROL D — 'the count moved but the set did not', and its evil twin ==="
      echo "start $(stamp)"; head_line
      echo "D1: counts move, identity set identical  => PASS, and the leg says the counts moved"
      echo "D2: a baseline titled red disappears AND its file becomes a collection error"
      echo "    => the red count goes DOWN and the leg must FAIL: an escalation, not a decrease"
      node scripts/ci-pr-gate.mjs --self-test
      echo "[self-test exit $?]"
      src=dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/root-census-after-1.json
      echo "D1/D2 subject: $src (a real nine-root capture: 502 files / 6277 legs / 22 ids,"
      echo "   whose counts differ from the baseline document's own 505 / 6285)"
      node scripts/ci-pr-gate.mjs --only census --census-json "$src"
      echo "[D1 gate exit $? — must be 0, with COUNTS MOVED, SET DID NOT in the detail]"
      python3 - "$src" "$EV/scratch/red-D-escalated.json" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
r = json.load(open(src))
target = 'packages/domain/test/t2-blueprint-hash.test.ts'
for f in r['testResults']:
    if f['name'].endswith(target):
        # The one titled red this file carries disappears…
        f['assertionResults'] = [a for a in f['assertionResults'] if a.get('status') != 'failed']
        # …because the file no longer collects at all.
        f['status'] = 'failed'
json.dump(r, open(dst, 'w'))
print(f'wrote {dst}: {target} now reports a collection error and zero titled reds')
PY
      node scripts/ci-pr-gate.mjs --only census --census-json "$EV/scratch/red-D-escalated.json"
      echo "[D2 gate exit $? — must be 1, naming the file as an ESCALATION]"
      # NOT deleted: the transcript hands the reader this path as the input to a command they can
      # re-run in 0.2 s. A cleanup reflex here would have left the transcript citing nothing.
      echo "end $(stamp)"
    } > "$EV/transcripts/RED-D-escalation-not-a-decrease.txt" 2>&1
    echo "wrote $EV/transcripts/RED-D-escalation-not-a-decrease.txt (exit $?)"
    ;;

  # ── E. the verdict-channel rule itself: a run that never printed a token is a FAIL. E1 is a real
  # transcript with its last line removed; E2 grades a complete transcript, to show the checker is
  # not simply always-fail.
  E)
    {
      echo "=== RED CONTROL E — the verdict channel: a missing DSH-CI-VERDICT is a failure, never \"not run\" ==="
      echo "start $(stamp)"; head_line
      echo "E1 is a real transcript of a real run with one line deleted; E2 shows the same checker"
      echo "accepting a complete one, so E1's failure is not just an always-fail instrument."
      echo
      echo "--- E2 first: a complete, honest, PASSING transcript (three cheap legs, run for real) ---"
      node scripts/ci-pr-gate.mjs --only graph-parse,install,blueprint-fence --store-dir "$STORE" > "$EV/scratch/E2-complete.txt" 2>&1
      echo "  its token: $(grep '^DSH-CI-VERDICT' "$EV/scratch/E2-complete.txt")"
      node scripts/ci-pr-gate.mjs --check-transcript "$EV/scratch/E2-complete.txt"
      echo "[E2 exit $? — must be 0, class=ok]"
      echo
      echo "--- E1: the SAME kind of transcript with its DSH-CI-VERDICT line removed ---"
      grep -v '^DSH-CI-VERDICT ' "$EV/scratch/E2-complete.txt" > "$EV/scratch/E1-token-stripped.txt"
      echo "  leg lines surviving: $(grep -c '^DSH-CI-LEG ' "$EV/scratch/E1-token-stripped.txt")"
      node scripts/ci-pr-gate.mjs --check-transcript "$EV/scratch/E1-token-stripped.txt"
      echo "[E1 exit $? — must be 1, class=missing-token]"
      echo
      echo "--- E3: a transcript that stopped mid-run (the run was killed after leg 2 of 3) ---"
      grep -E '^(DSH-CI-LEG|DSH-CI-VERDICT)' "$EV/scratch/E2-complete.txt" | head -n 2 > "$EV/scratch/E3-truncated.txt"
      grep '^DSH-CI-VERDICT' "$EV/scratch/E2-complete.txt" >> "$EV/scratch/E3-truncated.txt"
      echo "  leg lines surviving: $(grep -c '^DSH-CI-LEG ' "$EV/scratch/E3-truncated.txt"), token still claims 3"
      node scripts/ci-pr-gate.mjs --check-transcript "$EV/scratch/E3-truncated.txt"
      echo "[E3 exit $? — must be 1, class=truncated]"
      echo
      echo "--- E4: a real RED run's transcript, graded for what it is ---"
      red="$EV/transcripts-red-F-undisclosed-timing-red/RED-F-full-run-refused-the-tip.txt"
      node scripts/ci-pr-gate.mjs --check-transcript "$red"
      echo "[E4 exit $? — 1, because the gate said fail; class=red-run says the instrument worked]"
      rm -f "$EV/scratch/E1-token-stripped.txt" "$EV/scratch/E2-complete.txt" "$EV/scratch/E3-truncated.txt"
      echo "end $(stamp)"
    } > "$EV/transcripts/RED-E-missing-verdict-token.txt" 2>&1
    echo "wrote $EV/transcripts/RED-E-missing-verdict-token.txt (exit $?)"
    ;;

  *) echo "usage: $0 <A|B|C|D|E>"; exit 2 ;;
esac
