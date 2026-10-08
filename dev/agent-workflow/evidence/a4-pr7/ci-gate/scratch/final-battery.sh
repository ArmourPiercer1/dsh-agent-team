#!/usr/bin/env bash
# The final battery, run end-to-end against the DELIVERED build of scripts/ci-pr-gate.mjs, so every
# transcript committed beside it was produced by the code it claims to test.
#
# One gate at a time: a census capture racing a second run is how GREEN-full-run-1 got superseded
# (FINDINGS F3). Nothing here runs in parallel, and nothing here edits tracked source -- the RED
# controls plant and revert their own files inside their own transcripts.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
EV=dev/agent-workflow/evidence/a4-pr7/ci-gate
STORE=/home/user/dsh-plugins/dsh-agent-team/.pnpm-store
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
mkdir -p "$XDG_CACHE_HOME"

echo "### battery start $(date -u +%FT%TZ)  head=$(git rev-parse --short HEAD)  load=$(cut -d' ' -f1-3 /proc/loadavg)"

echo "--- self-test ---"
node scripts/ci-pr-gate.mjs --self-test | tail -1
echo "  [exit ${PIPESTATUS[0]}]"

echo "--- eslint on the gate ---"
npx --no-install eslint scripts/ci-pr-gate.mjs && echo "  eslint clean [exit 0]"

echo "--- GREEN: full gate, two census captures, the clock disclosed ---"
# The previous occupant of this filename is kept beside it under a name that says why it is not
# canonical. Nothing is deleted; nothing silently keeps a trustworthy-looking name.
if [[ -f "$EV/transcripts/GREEN-full-run.txt" ]]; then
  mv "$EV/transcripts/GREEN-full-run.txt" "$EV/transcripts/GREEN-full-run-before-final-build.txt"
  echo "  (previous GREEN-full-run.txt -> GREEN-full-run-before-final-build.txt)"
fi
GREEN="$EV/transcripts/GREEN-full-run.txt"
{
  echo '=== GREEN RUN — the full gate on the unmodified tip, run by the DELIVERED build ==='
  echo 'Two earlier occupants of this filename are kept beside it, each named for why it is not'
  echo 'canonical: GREEN-full-run-1-self-interference.txt (an import side effect in this lane ran a'
  echo 'second gate inside the first -- FINDINGS F3) and GREEN-full-run-before-final-build.txt (the'
  echo 'same command under an earlier build of the script, before the evidence-naming fix F9).'
  echo
  date -u '+start %FT%TZ'
  echo "load: $(cut -d' ' -f1-3 /proc/loadavg)  cores: $(nproc)  node: $(node -v)  CI=$CI"
  echo "head: $(git rev-parse HEAD)"
  echo "dirty at start: $(git status --porcelain | wc -l) paths -- this lane's own files only"
  echo
  echo '$ node scripts/ci-pr-gate.mjs --full --census-captures 2 --census-test-timeout 20000 \'
  echo '    --store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store --transcript-dir <this dir>'
  node scripts/ci-pr-gate.mjs --full --census-captures 2 --census-test-timeout 20000 \
    --store-dir "$STORE" --transcript-dir "$EV/transcripts"
  echo "[gate exit $?]"
  echo "load at end: $(cut -d' ' -f1-3 /proc/loadavg)"
  echo "dirty at end: $(git status --porcelain | wc -l) paths"
  date -u '+end %FT%TZ'
} > "$GREEN" 2>&1
echo "  [green run exit $?]"
grep -E '^DSH-CI-(RUN|LEG|VERDICT)' "$GREEN" | cut -c1-118

for control in A B C D E; do
  echo "--- RED control $control ---"
  bash "$EV/scratch/red-control.sh" "$control"
  echo "  porcelain now: $(git status --porcelain | wc -l) paths"
done

echo "--- tree after the battery (must be this lane's own files only) ---"
git status --porcelain
echo "### battery end $(date -u +%FT%TZ)  load=$(cut -d' ' -f1-3 /proc/loadavg)"
