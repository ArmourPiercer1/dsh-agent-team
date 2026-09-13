# A2C-3 — team_inspect_config exposes the real Operation Permission

**Status: GREEN — all gates pass (modulo documented pre-existing baseline failures).**

- Branch: `task/a2c-3-inspect-operation-permission` (worktree `.worktrees/a2c-3`)
- Base: `4cf23ec` (INT_W3 @ `48cf8c3` + A2C-1/2/4/5/7 merges)
- Contract: plan §10.1–10.5 + §14 (file boundary); code-review ruling §3 (additive field,
  final vocabulary one-shot, pure resolver).

## 1. What changed

| File | Change |
| --- | --- |
| `packages/runtime/admission/types.ts` | Added `OperationPermissionRuleView` + `OperationPermissionView` types; `config-inspected` union member gains REQUIRED `operationPermissions: OperationPermissionView` (single producer); new builder `operationPermissionView(template)` importing `PERMISSION_TOOL_NAMES` / `PERMISSION_RESOURCE_KINDS` from `../../domain/blueprint/src/index.js` (value constants — no hardcoded vocabulary). |
| `packages/runtime/action-router/effects.ts` | New `boundTemplateOf(blueprint, target)` (leader by reserved `LEADER_INSTANCE_ID`, member by `templateId`, fail-closed `internalInvariant` on dangling ref); `INSPECT_CONFIG` now returns `operationPermissions: operationPermissionView(boundTemplateOf(ctx.blueprint, target))`. Pure read — the effect phase writes nothing. |
| `packages/tools/src/tools.ts` | Description-only: `effective` = legacy generic capability policy view (its `permissions` cell is NOT the alpha.2 authority); `operationPermissions` = the actual static parameter-aware policy (`mode: "absent"` when undeclared). |
| `packages/runtime/test/a2c3-inspect-operation-permission.test.ts` | NEW — 11 tests: R1/R2 RED probes + T1–T9 legs (see §4). |

**Not changed:** policy authority (TemplatePermissionPolicy → pre-execute adapter untouched),
`effective` producer (byte-compatible), remote layer (effect passes as opaque `RemoteSafeJsonValue`),
any UI, any permission CRUD, any upstream/`references/` content.

## 2. RED (pre-fix) evidence

- `red-run.log` — full pre-fix vitest run on base `4cf23ec`: **8 failed / 3 passed (11)**.
  Failures = R1, R2, T1–T6, all on the pre-fix fact (`operationPermissions` absent → `undefined`).
  Passes = T7 (pure-read), T8 (remote round-trip), T9 (effective unregressed) — invariants that
  hold on BOTH sides.
  Protocol note recorded in the log: `git stash push` at RED time reported "No local changes to
  save" (zero tracked edits — GREEN not yet written; the untracked test file stays) → the run IS
  the pre-fix tree; pop is a no-op; porcelain verified.
- `run-tests-base-baseline.log` — same file under the plain-node shim runner on the pre-fix
  tree: `a2c3-inspect-operation-permission.test.ts` FAIL (8/11) — identical RED signature.
- `payload-before.json` (dumped at `4cf23ec` via `dump-payload.mts`, tracked src stashed) —
  effect keys = `[effective, kind]`; NO `operationPermissions`; the generic `permissions` cell
  already carries `legacy-generic-permission-item` (the human-override fixture) — proving the
  semantic split: the generic cell is non-empty and DIFFERENT from the bound static policy.

## 3. GREEN (post-fix) evidence

- `payload-after.json` — effect keys = `[effective, kind, operationPermissions]`;
  worker → `mode:'static'` with the rules AS STORED (declaration order) + `managedTools`
  (7 tools incl. `pwsh`) + `resourceKinds` (`exact`/`subtree`/`any`); leader → `mode:'static'`
  (default `deny`, ask `pwsh any`, deny `bash any`); scout → exactly `{ mode: 'absent' }`.
- **`effective` byte-identical before/after** (verified by `dump-payload` comparison) —
  zero old-field breakage.
- **Deterministic order**: `worker` vs `workerAgain` (same target re-driven) — effects
  byte-equal (`deterministicOrder.byteEqual: true`); T6 pins the exact tool-order arrays.
- **Pure-read**: seam `writeCount` 15 → 15, write log unchanged, and every repository listing
  (memberInstances / overrides / ledger / operations) deep-equal before/after the four drives
  (`pureRead` block). The effect phase of `inspect-config` performs zero durable writes.
- `green-full-vitest.log` — full root suite (286 files): **11 failed files / 21 failed tests**
  = baseline **10 files / 20 tests** + the expected p4t6 scanner delta (see §6). Per-file
  breakdown identical to baseline (`baseline.md`).
- `run-tests-runtime-tools.log` — plain-node shim runner: `a2c3…` PASS (11 tests); the run
  aborts at `d5-instance-contract.test.ts` on `toHaveLength is not a function` — a PRE-EXISTING
  shim-surface gap (`toHaveLength` is outside the audited matcher surface; the file is
  unmodified at base — verified via `git show 4cf23ec` + empty `git diff`), reproduced
  identically in `run-tests-base-baseline.log`.

## 4. Leg matrix (11 tests, §10.5 requires ≥9)

| Leg | Assertion | RED | GREEN |
| --- | --- | --- | --- |
| R1 | payload carries `operationPermissions` for all 3 targets | FAIL (pre-fix fact) | PASS |
| R2 | semantic split: generic cell = override item ≠ `operationPermissions` = static view | FAIL | PASS |
| T1 | member static policy: exact/any/subtree rules lossless, declaration order | FAIL | PASS |
| T2 | leader (reserved id) maps to bound LeaderTemplate policy | FAIL | PASS |
| T3 | no capabilities → exactly `{ mode: 'absent' }` | FAIL | PASS |
| T4 | `managedTools` = FINAL vocabulary incl. `pwsh` (constant, not literal) | FAIL | PASS |
| T5 | `resourceKinds` = FINAL vocabulary incl. `subtree` (constant, not literal) | FAIL | PASS |
| T6 | deterministic order: re-drive byte-equal + pinned tool-order arrays | FAIL | PASS |
| T7 | pure read: seam log + all repository listings unchanged | PASS (invariant) | PASS |
| T8 | remote round-trip lossless incl. new field; read effect → `effectSequence: null` | PASS (invariant) | PASS |
| T9 | `effective` five-cell view byte-identical to pre-fix producer | PASS (invariant) | PASS |

Runner constraints honored: module-level top-level await drives; `it` bodies are pure sync
assertions on captured plain data; matchers restricted to `toBe` / `toEqual`; world destroyed
inside the module-level block (p6t2 pattern — no live handle crosses into assertions).
Self-cleanliness: the file contains ZERO legacy Team SessionEvent denylist vocabulary (the
p4t6 scan leg "zero violations outside the frozen quarantine set" passes).

Fixture note: the generic `permissions` cell is granted a legacy permission name via a
team-scoped HUMAN override (invariant 34: human overrides are not envelope-checked — the only
way a generic cell can carry an item in this world; autonomy overlays fail envelope admission
because the v1 blueprint carries no per-capability envelope).

## 5. Gate table

| Gate | Result |
| --- | --- |
| Focused vitest (new file + p6t2-actions + a2c1/a2c5/a2c7 + p6t6-actions + p8t3-round-trip) | PASS — 126 pass / 1 fail = known baseline `p6t6-actions ×1` (messaging `deliveredToSessionId`, pre-existing) |
| Full root `pnpm test` vs baseline (10 files/20 tests) | PASS — 11 files/21 tests; per-file identical to baseline + expected p4t6 delta |
| `node scripts/run-tests.mjs runtime tools` | a2c3 PASS (GREEN) / FAIL 8-11 (base) — RED→GREEN; run aborts at pre-existing `d5` shim gap (identical on base — documented, not a regression) |
| Client suite (`packages/client && pnpm test`) | PASS — 1 failed file / 1 failed test = exactly TCM-M4 baseline (`team-creation-panel.client.spec.tsx:453`, pending user ruling, NOT fixed per contract) |
| Client typecheck | PASS (exit 0) |
| Typecheck (runtime / tools / remote / domain / client) | PASS (all exit 0) |
| `pnpm build` | PASS (exit 0); `packages/runtime/dist` + `packages/client/composition-shim` reverted via `git checkout --` before commit |
| `verify-zero-core.mjs --host tests/deepseek-harness-test-use` | PASS — 0 findings |
| Private-import check | PASS — zero `@deepseek-ai/*` specifiers in all touched files; cross-package import uses the established `../../domain/blueprint/src/index.js` pattern (same as activation/*, root-binding) |
| CORE PATCH BUDGET | 0 — no upstream/`references/` touches |
| Policy authority | unchanged — resolver + adapter untouched; only a new READ view |

## 6. p4t6 scanner delta (expected vs actual)

- Expected delta: **+1 file** (one new `.test.ts`) → 696 → **697**.
- Actual (`p4t6-delta.log`): `filesScanned` = **697** vs pin 696 → exactly +1; the single
  failing assertion is the pin itself. All other 9 scanner tests pass, including
  "zero denylist violations outside the frozen quarantine set" (my file is clean).
- The pin file (`packages/testkit/test/p4t6-session-event-scan.test.ts`) is single-writer
  (plan §2.3) and was NOT touched. The pin advance is the main-agent's job at the next merge.

## 7. Commits

- `5607f9f` — A2C-3: config-inspected payload gains independent
  operationPermissions (the real static policy) [3 source files]
- (this evidence commit) — A2C-3: RED/GREEN test matrix + gate evidence
  [1 new test file + evidence dir]

src + tests + evidence paths only — no dist, no `.tmp*`, no graph.yaml, no
SESSION_ROUTER_LOG.md, no p4t6 pin, no package.json/lockfile. No push.

## 8. Deviations / open risks

1. **`run-tests.mjs` abort (pre-existing, documented):** the plain-node shim lacks `toHaveLength`
   (audited surface = toBe/toEqual/toBeGreaterThan/toThrow) and `d5-instance-contract.test.ts`
   uses it (2×, unmodified at base) → the runner crashes there on base AND on this branch.
   Vitest (the authoritative runner) runs that file fine. No action taken per contract
   (single-writer/shim surface is not in A2C-3's file boundary).
2. **`.tmp-t12a-b2-home/` scratch leak:** the pre-existing file-level-failing
   `t12a-b2-child-identity` test leaves a scratch DSH_HOME dir during full-suite runs (created
   during this round's gates; removed from the worktree — it is untracked and never committed).
3. **`operationPermissions` is REQUIRED** on the `config-inspected` union member: justified by
   single-producer (effects.ts INSPECT_CONFIG is the only writer) + remote treats effects as
   opaque JSON (p8t3 EFX_TABLE `config-inspected` row stays green — verified in the focused
   run). Any future second producer must supply the field (type-enforced).
4. The evidence driver `dump-payload.mts` imports the test module (re-running its world) and is
   part of the evidence artifact set, not a test file (no `it`/`describe` of its own; it is
   under `dev/` so the p4t6 scanner never sees it).
