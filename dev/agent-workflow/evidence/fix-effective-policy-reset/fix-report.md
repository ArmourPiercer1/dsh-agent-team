# Fix report — effective-policy reset tombstone fallback (E) + override.get history-resurrection (G) + mixed-kind closure (G-external)

- **Branch**: `fix/effective-policy-reset-fallback` (worktree `.worktrees/fix-policy-reset`, sole writer)
- **Base**: `31ad828d06b5bcca858532f1930ac10c51c0f1bb` (= master at task start)
- **Commits** (pushed per parent instruction after the external review):
  - **E**: `ae51385b` — fix(effective-policy): the instance reset tombstone no longer masks a still-effective TEAM human deny (E, P1)
  - **G**: `958e96a3` — fix(remote): override.get derives from the CURRENT LATEST slot winner only — no history resurrection (G, P2)
  - (bookkeeping commit: this evidence dir + SESSION_ROUTER_LOG.md entry)
  - **G-external**: `80607c6b` — fix(remote): override.get selects the LATEST row per the FULL slot identity INCLUDING KIND — the HUMAN read plane (mixed-kind regression, external review BLOCK of PR #47 @ 958e96a3)
- **Scope discipline**: ONLY findings E and G (incl. the review-blocked mixed-kind regression of the G rewrite). No expansion. No counter-evidence encountered beyond the external review's finding (accepted — it was a real regression of my G rewrite).

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

## Finding G-external (P2, external review BLOCK of PR #47 @ 958e96a3) — mixed-kind regression of the G rewrite

- **Status**: RED confirmed (exact external repro, true exit codes) → GREEN. Commit `80607c6b`.
- **Root cause (the external's precise diagnosis, verified)**: the durable slot identity (`packages/runtime/governance/slot.ts` `SlotIdentity`/`slotIdentityOf` L276–293) is **kind + scope + rootSessionId + instanceId** — the **KIND (human-override vs autonomy-overlay) is part of the key**; the **capability is a VALUE inside the row** (the full-slot re-issue `values` map; `mintRecordId(Object.keys(cells), …)` binds the requested cell set to the recordId). Confirmed independently by the storage identity key `governanceOverrideKey({kind, recordId, rootSessionId, scope, instanceId})` (kind-prefixed) and by the write-path kernel `selectSlotWinner`'s `inSlot` (mutation/override-admission.ts L238–244, filters `record.kind !== slot.kind`). My G rewrite's `inSlot` filtered scope/instance ONLY — the cross-kind latest pick let a member-kind row (a) shadow a still-effective HUMAN value and (b) surface a MEMBER-kind generation to the HUMAN write path.
- **RED evidence** (`red-E-mixedkind.log`, pre-fix, the exact external repro — real storage + real governance mutation service + real dispatcher; the member lane is written through the REAL service with MEMBER authority, the single PR-A authority the member team-tool path uses — the remote override wire itself is the human UI plane: D-7 rejects agent-actor instance scope on the wire and `slotOf` independently blocks member+team): HUMAN instance-slot model=A @ g1 (wire) + MEMBER same-instance mcp-deny @ g1 + skills-deny @ g2 (a legitimate member tightening — the full-slot re-issue carries the merged {mcp, skills}):
  - `get(model)` = **null** (the member g2 row — a DIFFERENT slot — was picked as "latest" and has no model; the human A row was shadowed; base returned the human row);
  - `get(mcp)` = the **member g2 row** (`kind: 'autonomy-overlay'`, `origin: 'member'`, generation 2) — the member value surfaced on the human lane AND the member generation handed to the human CAS;
  - the subsequent HUMAN UI write of mcp (guarded exactly as the client `readSlotGeneration` guards: expectedGeneration from the settled read) → **spurious `OVERRIDE_GENERATION_CONFLICT`** (expected 2 from the MEMBER lane vs the empty HUMAN mcp slot — zero concurrent writers); storage 3 rows (the write never landed);
  - the lane-coexistence leg (canonical read: model from the human lane, mcp/skills from the member g2 overlay lane) was GREEN pre-fix by design — the canonical read was already kind-split; it pins the lanes so the fix's scope stays exactly on `override.get`.
- **Fix — ENDPOINT SEMANTICS (defined in the commit message + the handler comment)**: `override.get` is the **HUMAN read plane** (frozen-contract-compatible — the v7 wire carries no kind param, so the plane is fixed): the TeamGovernance per-member editor reads and writes the EXPLICIT HUMAN override slot (the client documents the read as "the Explicit Human Override record"; the set/reset handlers close the slot by the host-derived authority — a human caller lands in the human-override slot).
  1. The LATEST row is selected per the **FULL slot identity INCLUDING KIND** (`kind === 'human-override'` + scope + instanceId; rootSessionId pre-filtered) — the same slot rule the write-path kernel already applies;
  2. Each KIND's slot has its **OWN independent generation sequence** — generations are never compared across kinds, and a member/leader-kind generation is NEVER surfaced where the human write path consumes it: capability present in the human latest row → that row (value + its HUMAN generation); absent (incl. the human reset tombstone) → null;
  3. Everything else from the G fix unchanged (no within-slot history resurrection, older rows audit-only, write-path guard untouched — it was already kind-scoped).
  Member/leader-kind rows stay in their own lane: the canonical effective-policy read consumes them as the overlay layers (the per-member effective-config view is built on that same canonical read — the member's g2 tightening is visible there in the mcp/skills lanes with instanceOverlay provenance).
- **Per-leg before → after**: `get(model)`: null → **the human A row** (`ovr-model-inst-e-g0`, kind human-override, gen 1, values {model}); `get(mcp)`: member g2 row → **null on the human lane**; human mcp write: spurious conflict → **commits at gen 2 of the HUMAN slot's own sequence** (full-slot re-issue over the human model row → values {model, mcp} — the human generation is never the member's); canonical read: model=humanOverride layer / mcp+skills=instanceOverlay layer (the member g2 row beats the template mcp allow — GREEN both sides, pinning lane separation); per-kind slot winners (the guard's own kernel): 4 rows, 2 human-override + 2 autonomy-overlay, independent sequences (the same recordId across kinds = DIFFERENT storage identities — kind-prefixed key).
- **Files changed**: `packages/runtime/src/plugin/s6-remote.ts` (the `override.get` inSlot + endpoint-semantics comment — surgical), `packages/runtime/test/remote-override-expected-generation.test.ts` (new Part E, 5 its: the exact external repro over real storage + real service + real dispatcher + UI read/write semantics + the canonical lane-coexistence leg + the per-kind sequence leg), rebuilt `packages/runtime/dist/.../src/plugin/s6-remote.*` artifacts.
- **Focused GREEN**: `remote-override-expected-generation` 23/23 (18 pre-existing single-kind legs + 5 new mixed-kind); override.get/remote/governance suites 92/92; effective-policy/governance/consumer suites 118/118; the E canonical-read legs stay green (10/10). Runtime typecheck exit 0. Lint: zero new errors (s6-remote.ts carries only its two pre-existing baseline entries at unmoved lines 99:8 / 1455:78).

## Client diff

**ZERO.** The client needed no change: with the server fix, a null `override.get` read is exactly the client's documented empty-slot path (the settled read reports `null` → `readSlotGeneration` returns ABSENT → the next write is legacy/unguarded → no spurious conflict; the display falls through to the lower layers). The stale-generation input the client received was the server bug's output; fixing the server removes the conflict source. No client file was touched.

## Full suite + check:artifacts totals vs baseline

Baseline = personal pre-fix run on this worktree at base SHA `31ad828d` with the test-use marker present (`baseline-full-suite.log`; the degraded marker-absent ~39-collection-failure runs were NOT used and are not cited). Historical debt list (task brief) also recorded for comparison.

| gate | baseline (31ad828d) | after E+G (958e96a3) | final (80607c6b, mixed-kind closure) | delta |
| --- | --- | --- | --- | --- |
| full `pnpm vitest run` files | 12 failed / 395 passed (407) | 9 failed / 398 passed (407) | 9 failed / 398 passed (407) | **no new failed files at any head**; 3 baseline files now pass |
| full suite tests | 36 failed / 4683 passed (4719) | 19 failed / 4707 passed (4726) | 19 failed / 4712 passed (4731) | **+7 (E+G) +5 (mixed-kind) = 12 new tests, all pass**; 17 previously-failing tests now pass; zero new failures |
| `pnpm run lint` | 143 problems (118E / 25W), exit 1 | 142 problems (117E / 25W), exit 1 | 142 problems (117E / 25W), exit 1 | exactly one pre-existing error removed (see below); zero new |
| `pnpm run check:artifacts` | n/a at base (pre-fix) | **exit 0 — OK: 1372 files** | **exit 0 — OK: 1372 files** (after the mixed-kind rebuild; re-verified on the final tree) | — |
| p4t6 scanner pin | 896 | **896 — 10/10 pass** | **896 — 10/10 pass** (no scannable-set change: all regression legs appended to existing test files, no pin update needed) | — |

**Failed-file SET DIFF (baseline → final at 80607c6b) = empty on the "new" side.** The 9 final failed files are IDENTICAL at both changed heads (958e96a3 and 80607c6b) and ⊆ personal baseline ⊆ historical debt list:

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

**NEW failure list: empty at both changed heads.** (36 − 17 recovered = 19 final failures; 4683 + 17 recovered + 7 (E+G) + 5 (mixed-kind) = 4712 final passes — the arithmetic closes exactly.)

## Lint fingerprint diff (plain + file-aware, both committed here)

- plain (`baseline-lint-fp.txt` vs `final2-lint-fp.txt`): one line — the deletion of `248:10  error  'instanceSlotId' is defined but never used ... @typescript-eslint/no-unused-vars`.
- file-aware (`*-fp-fileaware.txt`, baseline vs final2 @ 80607c6b): the same single entry — `packages/runtime/test/governance-reset-tombstone.test.ts|248:10|no-unused-vars`. (The intermediate 958e96a3 fingerprints — `final-lint-fp*.txt` — show the identical diff.)
- Interpretation (per protocol): **zero new error lines in any file.** The one deletion is in a file this fix modified: the `instanceSlotId` helper was dead code (single reference = its own definition; pre-existing lint debt on base) and its removal was required to keep the fingerprint of the edited file stable — listed here as the allowed "deleted entry in a changed file". All files added/modified by this fix are lint-clean (`npx eslint` exit 0 on the two effective-policy sources + both test files individually; s6-remote.ts carries only its two PRE-EXISTING baseline entries at unchanged lines 99:8 / 1455:78 — the mixed-kind edit lands below them, so the lines never moved).

## Gates / red lines

- One commit per finding (E, G, mixed-kind closure) + bookkeeping commits (evidence + log). New HEAD `80607c6b` PUSHED on explicit parent instruction (the PR #47 review-fix round; a single fast-forward push of the branch, zero force-push, no merge).
- CORE PATCH BUDGET = 0: zero upstream/test-use touches; no instance started (:3080/:3180 untouched); no model/config changes; `dev/agent-workflow/graph.yaml` untouched.
- No existing test weakened or deleted (the `instanceSlotId` removal is a dead non-test helper — disclosed above).
- Committed prebuilt dist surface: `pnpm build` + `pnpm build:composition` after each fix; `pnpm run check:artifacts` exit 0 on the final tree (1372 files, incl. 1 glue placement).

## Log files in this directory

`red-E-G.log` (RED capture, E+G, true exit codes) · `green-E-focused.log` / `green-E-consumers.log` / `green-E-relocated.log` (E focused GREEN) · `green-G.log` / `green-G-remote.log` (G focused GREEN) · `red-E-mixedkind.log` (mixed-kind RED capture, the exact external repro) · `green-mixedkind.log` / `green-mixedkind-consumers.log` (mixed-kind GREEN) · `baseline-full-suite.log` / `final-full-suite.log` (full suites @ 958e96a3) / `final2-full-suite.log` (full suite @ 80607c6b; heads recorded in-file) · `baseline-lint.log` / `final-lint.log` / `final2-lint.log` + the six fingerprint files (plain + file-aware, both heads) · `check-artifacts-{E,G,final,mixedkind,final2}.log` · `build-{E,G,mixedkind}.log` / `build-composition-{E,G,mixedkind}.log` / `typecheck-{E,G,mixedkind}.log` / `lint-{E,G,mixedkind}.log`.
