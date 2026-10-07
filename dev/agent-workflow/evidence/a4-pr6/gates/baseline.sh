#!/bin/bash
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr6
rm -rf packages/testkit/test/.tmp-fault/
npx vitest run --reporter=json --outputFile=.tmp-a4pr6/root-base-run1.json > .tmp-a4pr6/root-base-run1.log 2>&1
node scripts/fail-set.mjs capture .tmp-a4pr6/root-base-run1.json --out .tmp-a4pr6/identities-base-run1.txt
rm -rf packages/testkit/test/.tmp-fault/
npx vitest run --reporter=json --outputFile=.tmp-a4pr6/root-base-run2.json > .tmp-a4pr6/root-base-run2.log 2>&1
node scripts/fail-set.mjs capture .tmp-a4pr6/root-base-run2.json --out .tmp-a4pr6/identities-base-run2.txt
echo BASELINE_DONE
