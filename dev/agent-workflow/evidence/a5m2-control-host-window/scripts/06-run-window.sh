#!/usr/bin/env bash
# A5M2 CONTROL window — bounded execution wrapper (root-pinned fixed inputs).
# EXECUTES ONLY with A5M2_CONTROL_WINDOW=GRANTED (root GO); otherwise the
# runner fail-closes NOT_RUN rc3 without touching the fixture. NO auto boot,
# NO install/clone/chmod, NO candidate switching, NO foreign-port kills.
#   driver  = this worktree's HEAD (recorded in runner-identity.json)
#   product = 37646ac2 pack in INSTALL_DIR (triple-pinned inside the runner:
#             file: pointer + name/dir-prefix + sha256 3652b2ce..5fd7c; lock
#             7685317f..c659)
#   host    = tests/deepseek-harness-test-use (639)  ports 3184 + mock 3499
#   HOME    = tests/homes/a5m2-ctl-hw-<UTC>Z fresh, explicit, NEVER deleted
set -euo pipefail
REPO_WT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_WT"
RUNNER=dev/agent-workflow/evidence/a5m2-control-host-window/scripts/05-control-window-runner.mjs
TS=$(date -u +%Y%m%dT%H-%M-%SZ)
OUT=dev/agent-workflow/evidence/a5m2-control-host-window/window-${TS}
mkdir -p "$OUT"
exec > >(tee -a "$OUT/wrapper.log") 2>&1
echo "control window wrapper ${TS}"
# driver law: refuse a dirty runner (bytes must equal the committed driver)
if ! git diff --quiet -- "$RUNNER"; then echo "WRAPPER VERDICT: DRIVER-DIRTY (refuse)"; exit 3; fi
echo "driver HEAD=$(git rev-parse HEAD) runner-sha256=$(sha256sum "$RUNNER" | cut -d' ' -f1)"
exec node "$RUNNER"
