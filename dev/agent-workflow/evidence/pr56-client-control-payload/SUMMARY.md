# PR #56 — client control subject/payload/display fix — evidence summary

Task branch: `task/pre-alpha3-pr56-client-panel` (base `1385f1ee060830bb0f550860d4bd81901c319063`).
All commands run in `.worktrees/pr56-client-panel`.

## TDD (RED → GREEN)

- RED (model layer, adapter spec, before implementation): 24 tests → 21 failed / 3 passed
  (the 3 passing controls: golden digest pairing, broken-identity skip, instance-abandon
  pre-ruling byte-stability). RED (render layer, panel spec, before UI implementation):
  14 tests → 13 failed / 1 passed. Captured and reported to the coordinator at the time
  (raw texts not retained across the session checkpoint; the final GREEN runs + the
  stock-master defect RED below are this record's durable evidence).
- Stock-master base-defect RED (rule B.1, uniform abandon): `02-red-stock-instance-abandon.txt`
  — the same spec run with all PR#56 source changes STASHED (tree = stock 1385f1ee):
  7 failed / 1 passed (the 1 passing is the deliberate durable-fact-only negative).
- Source proof (rule B.1a): `01-source-proof-abandon-at-1385f1ee.txt` —
  `git grep -n -i abandon 1385f1ee -- packages/client/src` → zero hits (exit 1).

## Full client suite (packages/client: `npx vitest run`)

- STOCK baseline @1385f1ee (changes stashed): `04-baseline-stock-full-suite.txt` —
  51 files / 780 tests → 777 passed / 3 failed. The 3 failures (pre-existing, out of scope):
  1. `test/team-creation-panel.client.spec.tsx > TeamCreationPanel > selecting a blueprint loads the detail block and fires the persona-fact probe (S5-A, UI §6/§7)`
  2. `test/team-creation-panel.client.spec.tsx > TeamCreationPanel > switching the runtime preset re-runs the probe with the new persona fact (UI §7.3)`
  3. `test/team-governance.client.spec.tsx > TeamGovernance > an override reset targets the member instance (scope instance) and pulls once on success`
- WITH PR#56 changes: `03-full-suite-with-changes.txt` —
  53 files / 830 tests → 825 passed / 3 failed / 2 skipped. ZERO NEW FAILURES
  (identical 3 test ids; the 2 skips are the DECLARED-UNKNOWN-#1 PENDING USER DECISION
  (options A/B) tests in `pr56-control-subject-payload.test.ts` and
  `pr56-control-panel-payload.client.spec.tsx`).
- New specs: `pr56-control-subject-payload.test.ts` 31 passed / 1 skipped;
  `pr56-control-panel-payload.client.spec.tsx` 17 passed / 1 skipped.

## Golden pairing (test-only, no product-side hash)

`pr56-control-subject-payload.test.ts` pairs the hand-modeled non-sensitive S9 review
payload against the FROZEN WIRE digest
`sha256:6b3a9145e46f1b2a2cfa7b195256536eccc9514b38fbfec21b6f567d02d32d41`
using `canonicalJsonStringify` imported from `packages/contracts/src/remote-safe.ts`
+ node:crypto `createHash` in the TEST only. The evidence JSON file itself was read via
`git show` and hand-modeled; it was never staged/committed.

## Build / dist coherence

- `pnpm build` → exit 0 (`05-build-composition.txt`).
- `pnpm build:composition` → regenerates `packages/client/composition-shim/client-bundle.js`
  (1170251 B, 91 modules); `check-artifacts-committed` reports the regenerated bundle as
  content-drift to be staged — the regenerated bundle IS committed in the same commit as
  the source (the commit-then-check passes).
- `pnpm smoke:composition` → FAILS IDENTICALLY ON STOCK 1385f1ee (pre-existing, not caused
  by this PR): `06-smoke-composition.txt`.
- Typecheck `packages/client` (`tsc -p tsconfig.json`) → exit 0. ESLint on all changed
  files → exit 0.

## Live things NOT run (task law: no host/browser/live anything)

- No `:3080` / `:3180` interaction; no `tests/deepseek-harness-test-use` host boot; no
  DSH_HOME world; no real browser UI acceptance (stage-2 pending).
- No push to master; no force-push; single forward push of this task branch (authorized).
