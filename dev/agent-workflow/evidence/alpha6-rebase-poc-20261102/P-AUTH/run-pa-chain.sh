#!/usr/bin/env bash
# P-AUTH-L2 driver: base / role-only / delegation. The two patches are
# THROWAWAY probes; trap always restores the tree.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../../../.." && pwd)"
cd "$root"
patch="$here/prototype.patch"
delegation="$here/delegation.patch"
cleanup() { git checkout -- packages/runtime/control/service.ts packages/runtime/operation-permission/pa-control-bridge.ts 2>/dev/null || true; }
trap cleanup EXIT

run() {
  local mode="$1"; shift
  A6_PAUTH_CHAIN_MODE="$mode" npx vitest run \
    --config dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/vitest.poc.config.ts \
    dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/P-AUTH/pa-chain.test.ts "$@"
}

cleanup
run base

git apply "$patch"
run role-only

git apply "$delegation"
run delegation
