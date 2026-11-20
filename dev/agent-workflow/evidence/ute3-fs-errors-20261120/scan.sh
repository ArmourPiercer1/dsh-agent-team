#!/usr/bin/env bash
# Raw consumer scan for the UTE-3 FS error-protocol slice (2026-11-20).
# Scope: packages/**, tests/**, scripts/**, docs/** in this worktree.
# Excluded: dist/ (build output), node_modules/, .git/.
# The pattern set is the OLD FS refusal representation:
#   FS_SANDBOX_DENIED                     the host sandbox code the old/next path would share
#   outside every allow subtree           legacy lane-denial prose (measured)
#   has not been read                     legacy observation-contract prose (measured)
#   changed since it was read             legacy stale-edit prose (measured)
#   read the file, then retry             legacy remedy prose (measured)
#   IO_READ_DENIED / IO_WRITE_DENIED      legacy guard typed lane-denial codes
#   IO_ASK_REQUIRES_APPROVAL              legacy ask-lane code
#   IO_WRITE_REQUIRES_READ                legacy observation-contract typed code
#   IO_POLICY_UNSUPPORTED                 legacy policy-compilation code
PAT='FS_SANDBOX_DENIED|outside every allow subtree|has not been read|changed since it was read|read the file, then retry|IO_READ_DENIED|IO_WRITE_DENIED|IO_ASK_REQUIRES_APPROVAL|IO_WRITE_REQUIRES_READ|IO_POLICY_UNSUPPORTED'
# Trailing whitespace is trimmed from the RECORDED row so this artifact can be
# committed diff-clean (`git diff --check`); the match itself is unchanged.
grep -rnE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.git "$PAT" packages tests scripts docs 2>/dev/null | sed -e 's/[[:space:]]\+$//'
