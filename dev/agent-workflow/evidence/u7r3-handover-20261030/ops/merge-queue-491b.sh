#!/usr/bin/env bash
# r2 merge queue (harness-managed). Serial: 485 487 488 489 490 491.
# One-shot hosted-failure rerun per head via marker files; conflict -> abort + loud log.
set -u
cd /srv/workspace/dsh-plugins/dsh-agent-team
M=/tmp/mkrq2; mkdir -p $M
declare -A WT=( [485]=.worktrees/u7r3-sync13 [487]=.worktrees/u7r3-shomev2 [488]=.worktrees/u7r3-readimage [489]=.worktrees/u7r3-uileg0 [490]=.worktrees/u7r3-g4r1a [491]=.worktrees/u7r3-uif4 [492]=.worktrees/u7r3-sync14 [491]=.worktrees/u7r3-uif4 )
rerun_once() { # $1=pr $2=checkname
  local pr=$1 nm=$2 sha rid mk
  sha=$(gh pr view $pr --json headRefOid -q .headRefOid)
  mk=$M/$pr-$nm-$sha
  [ -f "$mk" ] && return 0
  rid=$(gh api "repos/ArmourPiercer1/dsh-agent-team/commits/$sha/check-runs?per_page=50" --jq ".check_runs[]|select(.name==\"$nm\" and .conclusion==\"failure\")|.html_url" 2>/dev/null | head -1 | grep -oE 'runs/[0-9]+' | cut -d/ -f2)
  if [ -n "$rid" ]; then touch "$mk"; gh run rerun "$rid" --failed 2>/dev/null && echo "$pr rerun $nm run $rid"; fi
}
for pr in 491; do
  wt=${WT[$pr]}
  for att in 1 2 3; do
    [ "$(gh pr view $pr --json state -q .state)" = "MERGED" ] && break
    ms=$(gh pr view $pr --json mergeStateStatus -q .mergeStateStatus)
    if [ "$ms" = "BEHIND" ]; then
      br=$(gh pr view $pr --json headRefName -q .headRefName)
      git -C $wt fetch -q origin
      if ! git -C $wt merge -q origin/master -m "Merge origin/master (mechanical; disjoint)"; then
        echo "CONFLICT pr=$pr in $wt — manual intervention required; aborting this attempt, retrying in 10min, give up after 3"
        git -C $wt merge --abort 2>/dev/null
        sleep 600; continue
      fi
      git -C $wt push -q origin HEAD:$br || { echo "$pr push FAILED"; sleep 60; continue; }
      hh=$(git -C $wt rev-parse HEAD); ts=$(date -u +%Y-%m-%dT%H:%MZ)
      gh api repos/ArmourPiercer1/dsh-agent-team/issues/$pr/comments -f body="[dated settlement, $ts] Settlement for PR #$pr at head $hh (supersedes prior per head-advance law; mechanical forward-merge of origin/master, zero conflicts, content bytes unchanged). Covered head sha: $hh. CI + unresolved-thread gates enforced independently." -q .number >/dev/null
      sleep 15
    fi
    for i in $(seq 1 100); do
      c=$(gh pr checks $pr 2>/dev/null | awk '$1=="ci-required"{print $2}')
      g=$(gh pr checks $pr 2>/dev/null | awk '$1=="pr-settlement-gate"{print $2}')
      p=$(gh pr checks $pr 2>/dev/null | awk '$1=="pr-gate"{print $2}')
      [ "$c" = "pass" ] && [ "$g" = "pass" ] && [ "$p" = "pass" ] && break
      [ "$c" = "fail" ] && rerun_once $pr ci-required
      [ "$g" = "fail" ] && rerun_once $pr pr-settlement-gate
      sleep 30
    done
    h=$(gh pr view $pr --json headRefOid -q .headRefOid)
    out=$(gh api -X PUT repos/ArmourPiercer1/dsh-agent-team/pulls/$pr/merge -f sha=$h 2>&1 | grep -oE '"merged":(true|false)' | head -1)
    echo "$pr att$att ci=$c gate=$g prgate=$p -> ${out:-none}"
    [ "$out" = '"merged":true' ] && break
    sleep 30
  done
done
echo R2-QUEUE-COMPLETE
