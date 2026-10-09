#!/usr/bin/env bash
# Regenerate every LOCAL verification behind .github/workflows/census-runtime.yml, into this
# directory. Nothing here spends a hosted run, touches port 3080, or runs the ~4-minute census
# (pass `--with-census` for that).
#
#   bash dev/agent-workflow/evidence/a4-pr7/census-runtime/run-local-verifications.sh [--with-census]
#
# Order is deliberate: offline lint first, then the verbatim step dry runs, then the negative
# controls that carry the job's claims. Every block writes its exit code, because "the command ran"
# is not a result — and that standard applies to the CONTROLS as much as to the gate: a control that
# cannot fail is decoration, so each one is run against a case where it must say no.
#
# Steps are extracted with extract-step.py, which emits the step's `env:` alongside its script:
# running a `run:` block without the env the runner composes around it tests a different program.
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../../.." && pwd)
cd "$REPO" || exit 1
WF=.github/workflows/census-runtime.yml
PRGATE=.github/workflows/pr-gate.yml
GATE=scripts/ci-pr-gate.mjs
HOST_DIR=tests/deepseek-harness-test-use
SCRATCH=$REPO/.tmp-verify
RT=$SCRATCH/runner-temp
export CI=true
export XDG_CACHE_HOME=$SCRATCH/xdg-cache
export DSH_CI_STORE_DIR=$REPO/.pnpm-store
export RUNNER_TEMP=$RT
export GITHUB_ENV=$SCRATCH/github.env
mkdir -p "$XDG_CACHE_HOME" "$SCRATCH/steps" "$RT"
: > "$GITHUB_ENV"
rm -f "$HERE/OFFLINE-LINT.txt" "$HERE/ARGV-PROBE.txt" "$HERE/LOCAL-STEP-DRYRUNS.txt" \
      "$HERE/LOCAL-TRANSCRIPT-REGRADE.txt" "$HERE/LOCAL-NEGATIVE-CONTROL-MISSING-HOST.txt" \
      "$HERE/PROVISION-PROBE.txt"
# LOCAL-CENSUS-LEG.txt is deliberately NOT deleted: it is an expensive real measurement and a
# placeholder must never overwrite it.

say() { printf '%s\n' "$*"; }
extract() { python3 "$HERE/extract-step.py" "$WF" census-runtime "$1" "$2" "$RT"; }
runstep() { # $1 = prefix; $2 = cwd (optional)
  local pre=$1 dir=${2:-$REPO}
  ( cd "$dir" && export RUNNER_TEMP=$RT GITHUB_ENV=$SCRATCH/github.env GITHUB_WORKSPACE=$REPO && \
    # shellcheck disable=SC1090
    . "$pre.env" && bash "$pre.sh" )
}

# The real linter, if present. `command -v actionlint` is EMPTY in this sandbox, but github.com is
# reachable, so the binary can be fetched — 4 MB, no install, never committed:
#   curl -sSLo a.tgz https://github.com/rhysd/actionlint/releases/download/v1.7.7/actionlint_1.7.7_linux_amd64.tar.gz
#   tar -xzf a.tgz -C .tmp-verify/bin actionlint
ACTIONLINT=${ACTIONLINT:-$REPO/.tmp-verify/bin/actionlint}

# ── 1. offline lint, both files, plus controls on the linters themselves ──────────────────────
{
  if [ -x "$ACTIONLINT" ]; then
    say "\$ $("$ACTIONLINT" -version | head -1) -no-color $WF $PRGATE"
    "$ACTIONLINT" -no-color "$WF" "$PRGATE"
    say "[actionlint exit $? — expected 0; zero findings on BOTH files]"
  else
    say "# actionlint NOT on PATH and \$ACTIONLINT=$ACTIONLINT does not exist."
    say "# The fallback checks below are then ALL that ran; fetch the binary (header of this file)"
    say "# before trusting a hosted run."
  fi
  say "# (\`command -v actionlint\` here: $(command -v actionlint || echo 'nothing on PATH'))"
  say "\$ python3 offline-lint-workflow.py <worktree> $WF $PRGATE"
  python3 "$HERE/offline-lint-workflow.py" "$REPO" "$WF" "$PRGATE"
  say "[fallback lint exit $?]"
  say
  say "## CONTROL on the linters: one fixture carrying all three known incident classes —"
  say '## \`runner\` in jobs.<id>.env (the four job-less runs), a # inside a backslash'
  say "## continuation (run 37801019804), and a shell syntax error. Both linters must reject it."
  mkdir -p "$SCRATCH/negctl"
  cat > "$SCRATCH/negctl/bad.yml" <<'EOF'
name: bad
on: push
jobs:
  bad:
    runs-on: ubuntu-latest
    env:
      XDG_CACHE_HOME: ${{ runner.temp }}/xdg-cache
    steps:
      - run: |
          node gate.mjs --full \
            # a comment that eats the rest
            --allow-refused census \
            | tee log
      - run: |
          if [ 1 -eq 1 ; then echo x
EOF
  python3 "$HERE/offline-lint-workflow.py" "$REPO" "$SCRATCH/negctl/bad.yml"
  say "[fallback-lint control exit $? — expected 1]"
  if [ -x "$ACTIONLINT" ]; then
    say "\$ $ACTIONLINT -no-color $SCRATCH/negctl/bad.yml"
    "$ACTIONLINT" -no-color "$SCRATCH/negctl/bad.yml"
    say "[actionlint control exit $? — expected 1]"
  fi
} > "$HERE/OFFLINE-LINT.txt" 2>&1

# ── 2. the argv the census step will actually receive ─────────────────────────────────────────
{
  extract 4 "$SCRATCH/steps/census"
  say "# printf-introspection: the census run: block with the gate command replaced by"
  say '# \`printf \"<%s>\"\`, executed for real. This is how run 37801019804 — a # comment between'
  say "# backslash-continued lines that ate four flags while the log echoed them — is checked for"
  say "# BEFORE a runner ever sees the file."
  sed 's|node scripts/ci-pr-gate.mjs|printf "<%s>\\n" scripts/ci-pr-gate.mjs|' "$SCRATCH/steps/census.sh" > "$SCRATCH/steps/census-argv.sh"
  say "--- the block under test, after the substitution ---"
  cat "$SCRATCH/steps/census-argv.sh"
  say "--- argv as the step will actually hand it to node ---"
  mkdir -p "$RT"
  ( . "$SCRATCH/steps/census.env"; export DSH_CI_STORE_DIR=$RT/pnpm-store; bash "$SCRATCH/steps/census-argv.sh" )
  say "[probe exit $? — expected 0, i.e. the whole block parsed and ran, not just the printf]"
  say "# count the flags: --full --only census --census-captures 2 --census-test-timeout 20000"
  say "# --store-dir <runner store> --transcript-dir <runner temp>/census-transcripts = 12 argv"
  say "# entries, and NO --allow-refused anywhere."
} > "$HERE/ARGV-PROBE.txt" 2>&1

# ── 3. the provisioning steps, verbatim, in order ─────────────────────────────────────────────
{
  for i in 0 1 2 5; do extract "$i" "$SCRATCH/steps/s$i"; done
  say "# Every block here was extracted from the YAML BY PARSING IT (extract-step.py, which also"
  say "# emits the step's env:), then executed. Nothing below is retyped."
  say
  say "## STEP 1 'Resolve the pinned pristine host from tests/paths.mjs'"
  . "$SCRATCH/steps/s0.env"; bash "$SCRATCH/steps/s0.sh"; say "[exit $? — expected 0]"
  say "--- what it appended to \$GITHUB_ENV (the contract every later step reads) ---"
  cat "$GITHUB_ENV"
  say
  say "## CONTROL: the same step against a paths.mjs whose pin is not 40 hex must REFUSE."
  mkdir -p "$SCRATCH/negctl/tests"
  sed 's/639ed015397290b3745d163aafe02ffee4aa3f84/639ed015397290b3/' tests/paths.mjs > "$SCRATCH/negctl/tests/paths.mjs"
  ( cd "$SCRATCH/negctl" && GITHUB_ENV=$SCRATCH/negctl/github.env bash "$SCRATCH/steps/s0.sh" )
  say "[control exit $? — expected 1]"
  say
  say "## What the runner does BETWEEN steps: publishes \$GITHUB_ENV into the next step's"
  say "## environment. Mirrored here, because a step's own shell variables do not cross over —"
  say "## the first draft of step 3 echoed \$HEAD_SHA for exactly that reason and printed nothing."
  set -a; . "$GITHUB_ENV"; set +a
  say "## STEP 2 'Provision the pinned pristine test host' (fresh directory, real network)"
  rm -rf "$SCRATCH/provision"; mkdir -p "$SCRATCH/provision"
  ( cd "$SCRATCH/provision" && GITHUB_ENV=$GITHUB_ENV . "$SCRATCH/steps/s1.env" && bash "$SCRATCH/steps/s1.sh" \
      && git -C tests/deepseek-harness-test-use rev-parse HEAD \
      && say "porcelain=$(git -C tests/deepseek-harness-test-use status --porcelain | wc -l) shallow=$(git -C tests/deepseek-harness-test-use rev-parse --is-shallow-repository) size=$(du -sh tests/deepseek-harness-test-use | cut -f1)" )
  say "[exit $? — expected 0]"
  say
  say "## CONTROL: a pin the fetched object does not satisfy must FAIL with the drift message,"
  say "## even though the branch-tip fallback found a perfectly good host. This is the control"
  say "## that makes 'we test a PINNED host' a claim and not a wish."
  rm -rf "$SCRATCH/drift"; mkdir -p "$SCRATCH/drift"
  ( cd "$SCRATCH/drift" && . "$SCRATCH/steps/s1.env" && TEST_USE_SHA=0000000000000000000000000000000000000000 GITHUB_ENV=$GITHUB_ENV bash "$SCRATCH/steps/s1.sh" ) 2>&1
  say "[control exit $? — expected 1]"
  say
  say "## STEP 3 'Build the pristine host' is NOT run here: it costs ~4 minutes and"
  say "## e2e-provision-run.sh runs it in sequence against the directory STEP 2 just made, which"
  say '## is the only place its own \`cd\` and its bin.js assertion can be tested honestly.'
} > "$HERE/LOCAL-STEP-DRYRUNS.txt" 2>&1

# ── 4. the second reader: the transcript re-grade ─────────────────────────────────────────────
{
  say "# The SECOND reader, verbatim from the YAML, over a real transcript and a doctored one."
  if [ -f "$HERE/LOCAL-CENSUS-LEG.txt" ]; then
    cp "$HERE/LOCAL-CENSUS-LEG.txt" "$RT/census-run.txt"
  else
    say "(no LOCAL-CENSUS-LEG.txt yet — run --with-census; a synthetic transcript is used instead)"
    printf 'DSH-CI-LEG leg=census verdict=pass seconds=0 detail=placeholder\nDSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1 refused=0 refusedlegs=none seconds=0\n' > "$RT/census-run.txt"
  fi
. "$SCRATCH/steps/s5.env"; bash "$SCRATCH/steps/s5.sh"; say "[exit $? — expected 0]"
  say
  say "## the same transcript with its DSH-CI-VERDICT line removed (a run killed before its token)"
  grep -v DSH-CI-VERDICT "$RT/census-run.txt" > "$RT/no-token.txt"
  node "$GATE" --check-transcript "$RT/no-token.txt"; say "[exit $? — expected 1]"
  say
  say "## and a refusal that was NEVER declared: the shape of 'the host vanished and nobody"
  say "## noticed'. checkTranscript refuses it in both directions, so a token that hides a"
  say "## refusal and a token that lies about one are both failures."
  printf 'DSH-CI-LEG leg=census verdict=refused seconds=0 detail=missing-test-use-checkout\nDSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1 refused=0 refusedlegs=none seconds=0\n' > "$RT/hidden-refusal.txt"
  node "$GATE" --check-transcript "$RT/hidden-refusal.txt"; say "[exit $? — expected 1: undeclared refusal]"
  printf 'DSH-CI-LEG leg=census verdict=pass seconds=0 detail=ok\nDSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1 refused=1 refusedlegs=census seconds=0\n' > "$RT/phantom-refusal.txt"
  node "$GATE" --check-transcript "$RT/phantom-refusal.txt"; say "[exit $? — expected 1: a declared refusal that never refused]"
  say
  say "## WHAT THE RE-GRADER DOES NOT DO, stated because the first draft of this control got it"
  say "## wrong: a transcript whose leg refused AND whose token declares refusedlegs=census is"
  say "## INTERNALLY CONSISTENT and passes checkTranscript — grading consistency is that step's"
  say "## whole job. A declared refusal can only be produced by passing --allow-refused, and this"
  say "## job never passes it: the exemption stays reviewable in the diff of the workflow, which"
  say "## is the design pr-gate states for itself. So the guarantee here is 'no undeclared"
  say "## refusal, and no exemption unless someone edits this file', not 'no refusal at any cost'."
  printf 'DSH-CI-LEG leg=census verdict=refused seconds=0 detail=missing-test-use-checkout\nDSH-CI-VERDICT fail pass=0 fail=1 skip=0 skipped=none legs=1 refused=0 refusedlegs=none seconds=0\n' > "$RT/what-this-job-produces.txt"
  node "$GATE" --check-transcript "$RT/what-this-job-produces.txt"; say "[exit $? — expected 1: the verdict this job actually emits on a missing host is fail, and fail is fail]"
} > "$HERE/LOCAL-TRANSCRIPT-REGRADE.txt" 2>&1

# ── 5. THE control: no host + no exemption must be RED, not green ─────────────────────────────
{
  say "# The deliverable in one block. pr-gate is green with refusedlegs=census because it DECLARES"
  say "# the exemption. This job withholds it, so the same missing host must come back fail."
  say "# If this block ever prints pass, the second green is a lie."
  if [ ! -L "$HOST_DIR" ]; then
    say "SKIPPED: $HOST_DIR is not a symlink — refusing to touch a real directory."
  else
    TARGET=$(readlink "$HOST_DIR")
    trap 'ln -sfn "$TARGET" "$HOST_DIR"' EXIT
    rm "$HOST_DIR"
    say "\$ node $GATE --full --only census --census-captures 2 --census-test-timeout 20000 … (NO --allow-refused)"
    node "$GATE" --full --only census --census-captures 2 --census-test-timeout 20000 \
      --store-dir "$DSH_CI_STORE_DIR" --transcript-dir "$SCRATCH/transcripts-neg" \
      > "$SCRATCH/no-host.txt" 2>&1
    say "[gate exit $? — expected 1]"
    grep -E '^DSH-CI-(RUN|LEG|VERDICT)' "$SCRATCH/no-host.txt" | cut -c1-420
    say
    say "## and the re-grade step over that transcript"
    node "$GATE" --check-transcript "$SCRATCH/no-host.txt"; say "[exit $? — expected 1]"
    ln -sfn "$TARGET" "$HOST_DIR"
    trap - EXIT
    say "restored: $(ls -ld "$HOST_DIR" | sed 's/.* -> /link -> /')"
  fi
} > "$HERE/LOCAL-NEGATIVE-CONTROL-MISSING-HOST.txt" 2>&1

# ── 6. the provisioning probe the workflow header cites ───────────────────────────────────────
{
  say "# The claim: the pinned pristine host is provisionable from a runner with NO secret."
  say "\$ git ls-remote https://github.com/ArmourPiercer1/deepseek-harness stable-3-0.2.0-rc.2"
  git ls-remote https://github.com/ArmourPiercer1/deepseek-harness stable-3-0.2.0-rc.2
  say "[exit $?]"
  say "\$ node -e \"import('./tests/paths.mjs')…\"   # the pin this job must fetch"
  node -e "import('./tests/paths.mjs').then((m) => console.log(m.TEST_USE_BASELINE_SHA, m.DSH_BASELINE_VERSION, m.CLIENT_COMMIT_HASH))"
  say
  say "# GitHub answers a shallow fetch of the PINNED OBJECT, not merely of a branch, which is why"
  say "# the pin cannot be quietly replaced by a moved tip. Executed end to end in"
  say "# LOCAL-STEP-DRYRUNS.txt (STEP 2) and again inside E2E-PROVISION-THEN-CENSUS.txt."
} > "$HERE/PROVISION-PROBE.txt" 2>&1

# ── 7. optional: the census itself ────────────────────────────────────────────────────────────
if [ "${1:-}" = "--with-census" ]; then
  say "# running the census (~4 min)…"
  set -o pipefail
  node "$GATE" --full --only census --census-captures 2 --census-test-timeout 20000 \
    --store-dir "$DSH_CI_STORE_DIR" --transcript-dir "$SCRATCH/transcripts" \
    > "$HERE/LOCAL-CENSUS-LEG.txt" 2>&1
  say "[census gate exit $?]" >> "$HERE/LOCAL-CENSUS-LEG.txt"
fi

echo "wrote $(ls "$HERE"/*.txt 2>/dev/null | wc -l) evidence files to $HERE"
