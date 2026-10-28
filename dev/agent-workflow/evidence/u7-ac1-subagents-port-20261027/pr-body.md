## Summary
AC-1 judge correction for boot 8 `ac:fork-positive`, C1 regression coverage, offline re-grade evidence, and ledger promotion. CORE PATCH BUDGET = 0; no upstream/core edits; no new live boot; do not merge.

## Truthful boot history (1–8)
- Boots 1–6: earlier C2 attempts recorded in `c2-verdicts-boot1.json` through `c2-verdicts-boot6.json`; failures/voids and native output-schema defects are preserved in those raw records.
- Boot 7: explicitly voided before drive effects after the runner TDZ defect; `host-boot7.log` and `c2-verdicts-boot7.json` remain unchanged.
- Boot 8: authorized final live boot, raw record `c2-verdicts-boot8.json`; 9/10 PASS, with only `ac:fork-positive` FAIL because its readBack began with unrelated `unknown tool \"subagent_fork\"` noise before the actual positive result.
- Main-agent ruling: this is a judge defect, not product behavior. The positive fork evidence is present: the second readBack is non-error and contains `U7AC1_FORK_SAW_TOKEN`; `forkChildRequestCarriedToken=true`, one RAN witness, and one human ALLOW.

## Fix and C1
- `run-c2.mjs` now finds the first non-error readBack containing the expected token, independent of earlier error entries.
- C1 adds pure-function coverage for positive-first, positive-not-first, and no-token cases.
- Focused C1: **25/25 PASS** (lane, registry, native schema, and new judge case).

## Offline re-grade and ledger
- `c2/fork-regraded-boot8.json` records raw FAIL, defect rationale, exact correction, evidence, and re-graded PASS without modifying raw boot-8 evidence.
- Ledger promotes `subagent_fork` L4 using the re-grade + boot-8 record combination; `subagent` and `list_agents` remain backed by their valid PASS cases. `list_subagent_models` is **DISCLOSED**, not L4: boot 8 listed a provider while Tier A authority was empty, so that positive exceeded caller authority. The judge now asserts every listed provider is within caller authority; C1 covers the valid injected-authority positive and the default `(no LLM providers)` rendering.

## Gates
- `pnpm typecheck`: PASS.
- `node scripts/check-artifacts-committed.mjs`: PASS (no dist touched).
- EB3 family boundaries/definitions: PASS.
- `node scripts/gen-family-index.mjs --check`: PASS.
- `node scripts/eb3-tool-acceptance.mjs`: PASS (honesty gate; 31 tools, 17 L4 PROVEN, 13 DISCLOSED, 1 NOT_VERIFIED).
- `node scripts/eb3-evidence-guard.mjs --new-since origin/master`: PASS; evidence files remain under 1 MiB.
- `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store`: PASS (7 pass, 0 fail, 1 named opt-in census skip).

## Integration / status
Fetched origin and merged origin/master (no rebase/force-push). Plain push only. PR is ready for review. CI checks were requested and are being awaited. Do not merge.
