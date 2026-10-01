# Fix report — effective-policy reset tombstone fallback (E) + override.get history-resurrection (G)

- **Branch**: `fix/effective-policy-reset-fallback` (worktree `.worktrees/fix-policy-reset`, sole writer)
- **Base**: `31ad828d06b5bcca858532f1930ac10c51c0f1bb` (= master at task start)
- **Commits** (no push):
  - **E**: `ae51385b` — fix(effective-policy): the instance reset tombstone no longer masks a still-effective TEAM human deny (E, P1)
  - **G**: `958e96a3` — fix(remote): override.get derives from the CURRENT LATEST slot winner only — no history resurrection (G, P2)
  - (bookkeeping commit: this evidence dir + SESSION_ROUTER_LOG.md entry)
- **Scope discipline**: ONLY findings E and G. No expansion. Zero counter-evidence encountered.

## Finding E (P1) — instance reset tombstone masks a still-effective TEAM deny (resets into allow)

- **Status**: RED confirmed → GREEN.
- **RED evidence** (`red-E-G.log`, pre-fix, true exit codes): the 3 new E legs failed —
  - repro: post-reset mcp cell resolved `{ kind: 'allow', items: ['srv/x'] }` (template) instead of the TEAM `{ kind: 'deny' }` ("a reset into ALLOW");
  - double-tombstone control: `humanOverride` was the instance tombstone record (`ovr-reset-inst-alpha-g1`) instead of absent;
  - reopened canonical read: same template-allow masking over the reopened durable domain.
- **Root cause**: `selectPolicyOverrides` (`packages/runtime/effective-policy/select.ts`) picked the LATEST humanInstance row even when it was a `values: {}` reset tombstone; the resolver then saw an (apparently) effective human cell with no values and fell through to the template/static ALLOW, masking the still-effective humanTeam DENY. Pre-PR-B (baseline e22c659a) reset deleted the instance slot, so the team record was correctly selected; the PR-B canonical read plane + PR-A tombstone reset regressed this.
- **Fix (per ruling)**: a slot whose LATEST event is a reset tombstone (empty values) has NO effective value for that slot; precedence falls to the team slot, then to the lower (template/static) layers when that too is a tombstone. An OLDER event of the SAME slot is NEVER consulted (history is audit-only; resurrecting a pre-reset value would undo the human revocation). History rows untouched.
- **Files changed**: `packages/runtime/effective-policy/select.ts` (human-slot selection + additive `humanSlotEvents` on the selection result), `packages/runtime/effective-policy/reader.ts` (the staleness anchor `committedGeneration` now counts EACH human slot's LATEST event, tombstone included — identical marker in the masking case, strictly more honest in the double-tombstone case, zero pinned-behavior change), `packages/runtime/test/governance-reset-tombstone.test.ts` (new E legs, appended at end of file), rebuilt `packages/runtime/dist/.../effective-policy/*` artifacts.
- **Tests (real chain: real governance mutation service + real storage + canonical reader)**:
  - full repro: static template mcp allow(srv/x) → TEAM human deny → INSTANCE human deny → reset ONLY the instance slot → the inherited TEAM deny is restored (provenance = the team record `ovr-mcp-team-g0`, not the tombstone); pre-reset instance-wins control pinned;
  - reopened canonical effective read: a fresh read over the REOPENED durable domain (new seam, rows re-read from disk) still sees the TEAM deny; full slot history intact;
  - control: double tombstone (team reset too) → template baseline returns, NO human winner.
- **Focused GREEN**: `governance-reset-tombstone` 10/10; effective-policy single-source / policy-state-live / restart / boundary-committed-applied + governance authority/concurrency/idempotence/stale-ui-generation/restart 61/61; consumer suites (p8s4b cell-provenance/mcp-facet/override-admission, multi-mcp-wiring, model-activation-step8, model-blueprint-initial-routing, mcp-blueprint-initial-grant, team-session-activation(+glue), p7t2 override-precedence/escalation/policy-state) 222/222. Runtime typecheck exit 0.

## Finding G (P2) — override.get resurrects reset values / stale generation on a different-capability write

- **Status**: RED confirmed → GREEN.
- **RED evidence** (`red-E-G.log`, pre-fix, true exit codes): after wire sequence model g1{m-a} → reset g2{} → mcp g3{srv-s}, `override.get(model)` returned the resurrected g1 row (`{ schemaVersion: 2, generation: 1, values: { model: allow[m-a] }, ... }`) instead of `null`.
- **Root cause**: the s6-remote `override.get` handler, after finding the current slot winner, scanned OLD slot history rows for the requested capability and returned the most-recently-written row carrying it — resurrecting a value the reset revoked AND handing the client the OLD row's generation (1). The client (`TeamGovernance.readSlotGeneration`, `packages/client/src/ui/TeamGovernance.tsx` ~L410–420, ~L471–476) then guarded the next UI write with `expectedGeneration: 1` against a slot at generation 3 → a DETERMINISTIC `OVERRIDE_GENERATION_CONFLICT` with zero concurrent writers.
- **Fix (per ruling, server-side only)**: derive `override.get` from the CURRENT LATEST slot winner only — capability present in the latest row → that row (value + its generation); capability ABSENT in the latest row → `null` at that slot (no scanning of older rows; history is audit-only). The CURRENT slot generation is preserved for future writes: the write-path guard (governance kernel `selectSlotWinner`) was and stays pinned to the LATEST row — the resurrected generation was never a valid guard input.
- **Files changed**: `packages/runtime/src/plugin/s6-remote.ts` (the `override.get` handler only, surgical), `packages/runtime/test/remote-override-expected-generation.test.ts` (new Part D over the real dispatcher + real governance service + wire), rebuilt `packages/runtime/dist/.../src/plugin/s6-remote.*` artifacts.
- **Tests**: model→reset→MCP→`get(model)` = **null** (NOT A, NOT gen 1); `get(mcp)` = the g3 row with the current slot generation; "next UI write" guarded by the CURRENT generation 3 commits g4 (no spurious conflict); the RESURRECTED stale generation 1 still conflicts typed (`{ expectedGeneration: 1, actualGeneration: 4 }` — the guard validates the LATEST row); `get(model)` after the fresh write returns the g4 row; untouched TEAM slot reads null.
- **Focused GREEN**: `remote-override-expected-generation` 18/18; override.get/remote consumer suites (governance-stale-ui-generation, p8s6-remote-commands, p8t3-round-trip, p8s6-pagination, p8s6-principal, remote-control-abandoned-code) 59/59. Runtime typecheck exit 0.

## Client diff

**ZERO.** The client needed no change: with the server fix, a null `override.get` read is exactly the client's documented empty-slot path (the settled read reports `null` → `readSlotGeneration` returns ABSENT → the next write is legacy/unguarded → no spurious conflict; the display falls through to the lower layers). The stale-generation input the client received was the server bug's output; fixing the server removes the conflict source. No client file was touched.

## Full suite + check:artifacts totals vs baseline

Baseline = personal pre-fix run on this worktree at base SHA `31ad828d` with the test-use marker present (`baseline-full-suite.log`; the degraded marker-absent ~39-collection-failure runs were NOT used and are not cited). Historical debt list (task brief) also recorded for comparison.

| gate | baseline (31ad828d) | changed (958e96a3) | delta |
| --- | --- | --- | --- |
| full `pnpm vitest run` files | 12 failed / 395 passed (407) | 9 failed / 398 passed (407) | **no new failed files**; 3 baseline files now pass |
| full suite tests | 36 failed / 4683 passed (4719) | 19 failed / 4707 passed (4726) | **+7 = my new tests (all pass)**; 17 previously-failing tests now pass; zero new failures |
| `pnpm run lint` | 143 problems (118E / 25W), exit 1 | 142 problems (117E / 25W), exit 1 | exactly one pre-existing error removed (see below); zero new |
| `pnpm run check:artifacts` | n/a at base (pre-fix) | **exit 0 — OK: 1372 files** (after each commit's rebuild; re-verified on the final tree) | — |
| p4t6 scanner pin | 896 | **896 — 10/10 pass** (no scannable-set change: no new .ts files — both regression suites were appended to existing test files, so no pin update was needed) | — |

**Failed-file SET DIFF (baseline → final) = empty on the "new" side.** Final failed files ⊆ personal baseline ⊆ historical debt list:

- `packages/domain/test/t1-capability-schema.test.ts` (9) — in both lists
- `packages/domain/test/t2-blueprint-hash.test.ts` (1) — in both lists
- `packages/runtime/test/d3-member-identity-context.test.ts` (1) — in both lists
- `packages/runtime/test/p6t3-mediation.test.ts` (5) — in both lists
- `packages/runtime/test/p6t3-restart.test.ts` (2) — in both lists
- `packages/tools/test/p6t6-actions.test.ts` (1) — in both lists
- file-level collection: `p8s3b-result-effects.test.ts`, `t12a-b2-child-identity.test.ts`, `t12a-glue-handoff-ports.test.ts` — in both lists (causes: `sessionPersistence.exists` seam absent in the p8s3b test world; t12a capability-template-unresolved / glue ports — pre-existing, NOT touched by this fix)

Baseline files that now PASS (listed as allowed debt fixes, not regressions):

- `packages/runtime/test/a2c7-subtree-matcher.test.ts` (9 → pass) — baseline-only failure (alpha.2 permission-fs-containment world); passes on the changed tree (environment/debt recovery; this fix does not touch that area)
- `packages/testkit/test/plugin-dsh-compat.test.ts` (6 → pass) — baseline-only failure (DSH compat loadEvaluator); passes on the changed tree (test-use checkout deps finished installing; this fix does not touch that area)
- `packages/runtime/test/p6t1-parallel.test.ts` (2 → pass in the final run) — known p6t1 flake family (P1/P2/P3); same family = recorded, no new signature; the guard clause (new signature = STOP) was not triggered

**NEW failure list: empty.** (36 − 17 recovered = 19 final failures; 4683 + 17 recovered + 7 new = 4707 final passes — the arithmetic closes exactly.)

## Lint fingerprint diff (plain + file-aware, both committed here)

- plain (`baseline-lint-fp.txt` vs `final-lint-fp.txt`): one line — the deletion of `248:10  error  'instanceSlotId' is defined but never used ... @typescript-eslint/no-unused-vars`.
- file-aware (`*-fp-fileaware.txt`): the same single entry — `packages/runtime/test/governance-reset-tombstone.test.ts|248:10|no-unused-vars`.
- Interpretation (per protocol): **zero new error lines in any file.** The one deletion is in a file this fix modified: the `instanceSlotId` helper was dead code (single reference = its own definition; pre-existing lint debt on base) and its removal was required to keep the fingerprint of the edited file stable — listed here as the allowed "deleted entry in a changed file". All files added/modified by this fix are lint-clean (`npx eslint` exit 0 on the two effective-policy sources + both test files individually; s6-remote.ts carries only its two PRE-EXISTING baseline entries at unchanged lines 99:8 / 1455:78).

## Gates / red lines

- One commit per finding (E then G) + one bookkeeping commit (evidence + log). No push, no merge, no force-push.
- CORE PATCH BUDGET = 0: zero upstream/test-use touches; no instance started (:3080/:3180 untouched); no model/config changes; `dev/agent-workflow/graph.yaml` untouched.
- No existing test weakened or deleted (the `instanceSlotId` removal is a dead non-test helper — disclosed above).
- Committed prebuilt dist surface: `pnpm build` + `pnpm build:composition` after each finding; `pnpm run check:artifacts` exit 0 on the final tree (1372 files, incl. 1 glue placement).

## Log files in this directory

`red-E-G.log` (RED capture, both findings, true exit codes) · `green-E-focused.log` / `green-E-consumers.log` / `green-E-relocated.log` (E focused GREEN) · `green-G.log` / `green-G-remote.log` (G focused GREEN) · `baseline-full-suite.log` / `final-full-suite.log` (full suites, both heads recorded in-file) · `baseline-lint.log` / `final-lint.log` + the four fingerprint files · `check-artifacts-{E,G,final}.log` · `build-{E,G}.log` / `build-composition-{E,G}.log` / `typecheck-{E,G}.log` / `lint-{E,G}.log`.
