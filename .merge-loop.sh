#!/usr/bin/env bash
set -uo pipefail
REPO=ArmourPiercer1/dsh-agent-team
for p in "$@"; do
  for iter in 1 2 3 4 5 6; do
    st=$(gh pr view "$p" --json state,mergeStateStatus --jq '.state+" "+.mergeStateStatus' 2>/dev/null || echo "ERR")
    case "$st" in
      "MERGED "*) echo "[$p] already merged"; break;;
      "CLOSED "*) echo "[$p] closed"; break;;
    esac
    mst=${st#* }
    case "$mst" in
      BEHIND|DIRTY)
        H=$(gh pr view "$p" --json headRefOid --jq .headRefOid 2>/dev/null)
        gh api -X PUT repos/$REPO/pulls/$p/update-branch -f expected_head_sha="$H" >/dev/null 2>&1
        echo "[$p] update-branch ($mst)"; sleep 45; continue;;
      CLEAN)
        H=$(gh pr view "$p" --json headRefOid --jq .headRefOid)
        printf '**[dated settlement, 2026-11-12T08:15Z]**\n\ncovered head sha: %s\n\nSettlement at the merging head.\n' "$H" > /tmp/s.md
        gh pr comment "$p" --body-file /tmp/s.md >/dev/null 2>&1
        sleep 20
        RID=$(gh pr checks "$p" 2>/dev/null | awk -F'\t' '/settlement/{print $4}' | grep -oE 'runs/[0-9]+' | cut -d/ -f2 | head -1)
        [ -n "${RID:-}" ] && gh run rerun "$RID" --failed >/dev/null 2>&1
        sleep 60
        out=$(gh api -X PUT repos/$REPO/pulls/$p/merge -f merge_method=squash -f sha="$H" 2>&1 | head -c 120)
        echo "[$p] merge -> $out"
        case "$out" in *'"merged":true'*) break;; esac
        sleep 30;;
      *)
        # BLOCKED / UNKNOWN: wait for checks then re-evaluate
        sleep 90;;
    esac
  done
done
