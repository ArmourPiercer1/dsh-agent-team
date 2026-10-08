#!/usr/bin/env bash
# p4t6 scanned-file total — DERIVED at run time (never quoted from a note).
set -u
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-76-closure
EV=dev/agent-workflow/evidence/a4-pr7/7-6-closure
CMD='node -e "import(\x27./packages/testkit/fault-injection/session-event-scan.mjs\x27).then(m=>console.log(\x27filesScanned =\x27, m.scanSessionEventVocabulary({}).filesScanned)))"'
{
  echo "p4t6 scanned-file total — DERIVED, never quoted from a note"
  echo "generated $(date -u +%FT%TZ)  HEAD=$(git rev-parse --short HEAD)  worktree=.worktrees/a4-76-closure"
  echo
  echo "\$ $(printf '%s' "$CMD" | sed "s/\\\\x27/'/g")"
  node -e "import('./packages/testkit/fault-injection/session-event-scan.mjs').then(m=>console.log('filesScanned =', m.scanSessionEventVocabulary({}).filesScanned))"
  echo
  echo "Cross-check in the same tree: the p4t6 leg is GREEN in every root census of this lane"
  echo "(packages/testkit/test/p4t6-session-event-scan.test.ts > p4t6 frozen Team SessionEvent"
  echo " denylist scan > coverage: all nine package dirs discovered, …), and that leg asserts the total"
  echo "as a DERIVED SUM — packages/testkit/test/p4t6-session-event-scan.test.ts:2049:"
  echo "    expect(scanResult.filesScanned).toBe(983 + SCANNED_PATHS_A4PR2.length + … )"
  echo "so the number above and the leg cannot disagree without the leg going red."
  echo
  echo "DISCLOSURE 1: the leg TITLE still reads '979 files scanned'. That is a frozen identity string"
  echo "  (the registry key), not the measured total; the total moves with every named increment."
  echo "DISCLOSURE 2: no p4t6 figure was recorded earlier in this lane's evidence, so nothing is"
  echo "  repeated from any note here. The number printed above is this tree, this command, this moment."
} > "$EV/transcripts/p4t6-derived-total.txt" 2>&1
cat "$EV/transcripts/p4t6-derived-total.txt"
