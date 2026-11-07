#!/usr/bin/env bash
# P-AUTH prototype runner — applies the throwaway case-scoped patch, runs the
# probe, and ALWAYS reverts the working tree. Nothing here is mergeable.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../../../.." && pwd)"
cd "$root"
if ! git diff --quiet -- packages/runtime/control/service.ts; then
  echo "refusing: packages/runtime/control/service.ts is already dirty" >&2
  exit 2
fi
git apply "$here/prototype.patch"
trap 'git checkout -- packages/runtime/control/service.ts' EXIT
A6_PAUTH_PROTOTYPE=1 npx vitest run \
  --config dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/vitest.poc.config.ts \
  dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/P-AUTH/pauth.test.ts
