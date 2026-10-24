#!/bin/sh
# A5M2-G5 lane-local targeted-test entry (root 02:20 bounded permission).
# This lane's DSH_TEST_USE_ROOT is pinned HERE, in the lane's own entry only:
# the verified read-only 639-pinned base at the repo root. NOT a global vitest
# default, NOT any other family's configuration; every other world resolves
# paths.mjs unchanged (env unset = byte-identical legacy behavior).
# Future G5 verification uses ONLY this entry.
#   base HEAD verified 639ed015397290b3745d163aafe02ffee4aa3f84, porcelain 0.
# No boot, no install, no new tree.
DSH_TEST_USE_ROOT=/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use \
exec npx vitest run "$@"
