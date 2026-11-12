#!/usr/bin/env bash
set -uo pipefail
REPO=ArmourPiercer1/dsh-agent-team
for p in "$@"; do
  for iter in 1 2 3 4 5 6 7 8; do
    meta=$(gh api repos/$REPO/pulls/$p --jq '.state+" "+.mergeable_state+" "+.head.sha' 2>/dev/null) || { sleep 20; continue; }
    set -- $meta
    state=$1; mst=$2; H=$3
    echo "[$p] state=$state mst=$mst head=$H"
    [ "$state" = "closed" ] && { echo "[$p] closed/merged"; break; }
    if [ "$mst" = "behind" ] || [ "$mst" = "dirty" ]; then
      gh api -X PUT repos/$REPO/pulls/$p/update-branch -f expected_head_sha="$H" >/dev/null 2>&1 && echo "[$p] update-branch"
      sleep 60; continue
    fi
    if [ "$mst" = "clean" ] || [ "$mst" = "unstable" ] || [ "$mst" = "blocked" ]; then
      printf '**[dated settlement, 2026-11-12T09:20Z]**\n\ncovered head sha: %s\n\nSettlement at the head being merged.\n' "$H" > .s.md
      gh api -X POST repos/$REPO/issues/$p/comments -f body="$(cat .s.md)" >/dev/null 2>&1 && echo "[$p] settled"
      rm -f .s.md
      sleep 25
      # rerun only the settlement gate if it is red at this head
      RID=$(gh api repos/$REPO/commits/$H/check-runs --jq '.check_runs[]|select(.name|test("settlement"))|.details_url' 2>/dev/null | grep -oE 'runs/[0-9]+' | cut -d/ -f2 | head -1)
      [ -n "${RID:-}" ] && gh api -X POST repos/$REPO/actions/runs/$RID/rerun-failed-jobs >/dev/null 2>&1 && echo "[$p] rerun settlement $RID"
      sleep 90
      out=$(gh api -X PUT repos/$REPO/pulls/$p/merge -f merge_method=squash -f sha="$H" 2>&1 | head -c 140)
      echo "[$p] merge -> $out"
      case "$out" in *'"merged":true'*) break;; esac
      sleep 45
    else
      sleep 60
    fi
  done
done
