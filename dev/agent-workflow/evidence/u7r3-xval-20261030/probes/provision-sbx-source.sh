#!/usr/bin/env bash
# provision-sbx-source.sh — u7-g4r3-20261028 precedent (SETUP-NOTES): the
# trust gate of host-sandbox-assets only roots at the TASK WORKTREE itself +
# the shared baseline (which carries no built assets here), so a fresh
# worktree cannot auto-provision from the main checkout. Compliant resolution:
# a byte-identical HARDLINK copy (cp -al, same filesystem) of the main
# checkout's runtime tree (verified pinned + porcelain-empty first) into the
# worktree's gitignored .artifacts/tmp/xval-sbx-source, used as
# DSH_TEAM_SANDBOX_ASSET_SOURCE. Zero byte drift is impossible; the
# provisioner still runs its own three-stage digest verification.
# $1 = worktree root
set -euo pipefail
WT="$1"
SRC=/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use
PIN=639ed015397290b3745d163aafe02ffee4aa3f84
D="$WT/.artifacts/tmp/xval-sbx-source"
[ "$(git -C "$SRC" rev-parse HEAD)" = "$PIN" ] || { echo "FATAL: main test-use not pinned"; exit 3; }
[ -z "$(git -C "$SRC" status --porcelain)" ] || { echo "FATAL: main test-use porcelain not empty"; exit 3; }
if [ -f "$D/native/system/packages/linux-x64/bin/landlock-run" ]; then
  echo "already present: $D"
else
  mkdir -p "$WT/.artifacts/tmp"
  t0=$(date +%s)
  cp -al "$SRC" "$D"
  echo "cp -al done in $(( $(date +%s) - t0 ))s"
fi
sha256sum "$D/native/system/packages/linux-x64/bin/landlock-run" "$D/native/system/packages/linux-x64/bin/glibc/system.node"
