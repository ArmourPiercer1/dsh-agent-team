## What this is

**Plain statement of proof (what the production host has, and has not, seen):** PROVEN ON THE PRODUCTION HOST = the mount law in both directions and the unchanged shipped surface (boot A planes mount exactly as shipped — placement-feed + census-boot signatures, zero family witnesses; boot B enabled-without-store answers the typed `PLANE_AGENT_STATE_STORE_MISSING` fail-closed refusal on the public `/team-remote` surface, with zero placement rows behind it). DISCLOSED, NOT PASS = every POSITIVE agent-state read/write call leg on the live host — the production store port is NOT wired (`agent-bindings.mjs` passes `backends` for the jobs bridge only; this lane edits no binder line), so a positive host read/write is impossible on this tree and is claimed nowhere. Those positive legs are PROVEN at C1 only, over the real plane assembly and the real kernel `issueApprovedGrant`/consume edges.

ONE governed tool family — `dsh.agent-state-family` — mounting the five agent-state members (`todo_write`, `create_goal`, `get_goal`, `update_goal`, `exit_plan_mode`) at their fixed native spellings, as an **ordinary family** (`route: ordinary-family`) through the reviewed **FamilyAssembly seam**: the `packages/tools/families/` descriptor + manifest + the generic mount loop. **ZERO lines** in `team-tool-plane.mjs`, `family-assembly.mjs`, the binder (`agent-bindings.mjs`), or any of the 33 ARC-A protected paths — the family self-mounts nothing and carries no authority handle.

Mount config: the closed boolean `agentStateEnabled` (ABSENT = FALSE). Disabled ⇒ zero rows, zero witnesses, `disabledOwned` empty, and the shipped model surface unchanged (the zero-flip is proven at C1 Z0 and live at C2 boot A; measured disclosure: the 0.2.0-rc.2 team surface carries no native `todo_write` at all, so "unchanged" is asserted as the ABSENCE of all five spellings, never as a native ride).

## Read-vs-mutation split (in the effect declaration AND every PA request)

- `get_goal` is the family's only READ: its per-call ApprovalCase requests the metadata `meta` arm of `agent-state/<caller>/goal` and NOTHING mutation-bearing (C1 E1 asserts the request's own `requestedEffects`, via the real kernel `ApprovalCase.plan.requestedEffects`).
- The four mutators (`create_goal`/`update_goal`/`todo_write`/`exit_plan_mode`) each request their own `tool-invoke` arm — the closed vocabulary's honest carrier: `metadata` resources hold the `meta` right ONLY, so a fabricated `write`/fs-path arm would be vocabulary-laundering — plus the `meta` arm of the state they observe for their precondition/CAS legs. Declared == requested for all five, pinned testically (E1), arms compared as canonical sorted sets (vocabulary sort law).

## Scope law

State scope = `agent:<exec.agent.id>` — the CALLING agent from the dispatch, never an argument, never a session guess. A call that NAMES another agent's goal (planted S1b/S1c): the row reads the CALLER's own scope and answers `GOAL_NOT_FOUND` / `GOAL_STALE_REVISION` (the stale sentence can only ever name the caller's own current), while the recording store's log proves ZERO touches of the foreign scope and the foreign entry stays byte-identical. Mutation control: deriving scope from args turns exactly S1b RED (evidence).

## Transition table = LAW (pinned to host source)

`GOAL_TRANSITION_LAW` pins every edit/pause/resume/complete/blocked leg, the revision CAS, and the fold law, each with a `file:line` citation against host pin `639ed015397290b3745d163aafe02ffee4aa3f84`; the C1 table test (T1, 24 legs) pins the whole table: every illegal leg answers its typed refusal (`GOAL_ALREADY_EXISTS`, `GOAL_INVALID_TRANSITION`, `GOAL_STALE_REVISION`, `GOAL_NOT_FOUND`, `GOAL_TOOL_NOT_DIRECT_HUMAN`, `GOAL_TOOL_NO_COMPLETION_AUTHORITY`, `GOAL_TOOL_BLOCK_THRESHOLD`, …) with ZERO durable writes and byte-equal state; every applied transition advances `revision` exactly one (`goal/src/fold.ts:194`).

## PROVEN vs DISCLOSED per tool

| | C1 (real plane + real kernel grant) | C2 (real host, 2 of ≤3 declared boots) |
| --- | --- | --- |
| `get_goal` | PROVEN positive read + single bounded snapshot read (ONE logged read), deny-default fail-closed, pre-PA arg-law refusals | mount law live; store-backed call legs DISCLOSED-NO-SEAM |
| `create_goal` | PROVEN direct-human positive with durable read-back; already-active / not-direct-human refusals zero-write | same |
| `update_goal` | PROVEN pause/edit/complete/blocked(≥3 rounds)/resume positives; full T1 table; stale-revision CAS; idempotence trio (in-flight token, settled→CANCELLED, applyId ledger, fresh-call CAS re-drive) | same |
| `todo_write` | PROVEN whole-list replacement + counts; list law pre-PA | same |
| `exit_plan_mode` | PROVEN plan law, PLAN_MODE_NOT_ACTIVE zero-write, approved commit post-consume | same |
| mount | enabled-without-store ⇒ whole assembly refuses `PLANE_AGENT_STATE_STORE_MISSING` (M2); ABSENT==FALSE byte-identical (Z0) | **PROVEN live:** boot A zero-flip (plane mounts as shipped: placement-feed + census-boot signatures, zero family witnesses, zero agent-state spelling on any captured surface — disclosed: the 0.2.0-rc.2 team surface carries NO native `todo_write` at all, so the ride claim is asserted as measured ABSENCE) · boot B enabled⇒ typed live mount refusal + zero placement rows + zero RAN witnesses |

**DISCLOSED-NO-SEAM (never coloured PASS):** the enabled-and-store-mounted LIVE positive legs (authorized read; authorized mutation with the durable fact read back; refused cross-scope write) have no production seam on this tree: `agent-bindings.mjs` wires `backends` for the jobs bridge only, and this lane adds no binder line — a durable store adapter is a separate named binder lane. Those legs are PROVEN at C1 over the real plane and the real `issueApprovedGrant`/consume edges; C2 carries the disclosure verbatim into its evidence json.
**DISCLOSED (template law):** on the default-`deny` template every agent-state call answers `IO_POLICY_UNSUPPORTED / template-default-deny` before PA and before the store (D1) — the agent-state effect class has no rule-grammar spelling on this mount; extending the grammar is a named center-interface change (follow-up), never family self-authorization. Governed positives require the ask-default template + Control leg, which C1 exercises end-to-end.

## Live C2 verdicts (recorded run `u5-u7-fagentb-x-2026-10-27T00-41-36-828Z`, overall **PASS 6/6**, verbatim)

| case | verdict | witness |
| --- | --- | --- |
| `agt:zero-flip-mount` | PASS | `a5g7: placement-feed rows=[team_grep,team_glob,team_bash,read,write,edit,read_image]` + `a5ptc: census-boot`, zero family lines, no agent-state name in any placement |
| `agt:surface-unchanged-witness` | PASS | shipped `read/write/edit/read_image` on the model surface; `agentStateNamesOnAnySurface: []`; census-boot present |
| `agt:enabled-mount-refused` | PASS | team.create response body: `agent-bindings: alpha.5 Team tool plane refused the mount for '<session>': the dsh.agent-state-family is enabled but its state-store port is not mounted (the agent-state store port is absent) — an enabled family with no durable store never mounts (fail closed) (code: PLANE_AGENT_STATE_STORE_MISSING)` |
| `agt:enabled-zero-plane` | PASS | 0 placement-feed rows, 0 census-boot, 0 family RAN |
| `agt:leak-check` | PASS | both worlds torn down clean |

Boot budget: the suite's design is 2 boots/run, 3 declared, 2 used in the
recorded run. Five runner invocations total (10 host starts) are disclosed in
the evidence dir: runs 1–2 diagnosed the witness channels, run 3 kept homes
for the post-mortem that located the typed refusal on the `team.create` body,
run 4 proved the verdict path but carried a swallowed drive-phase reference
error so it is **not** the record, run 5 is the clean record. `tests/homes/`
empty after; the pristine `tests/deepseek-harness-test-use` remained byte-clean
@ `639ed01539`.

## Gate results (local, at this PR's head)

- `ci-pr-gate --store-dir .tmp-pnpm-store --full --census`: **DSH-CI-VERDICT
  pass pass=8 fail=0** — graph-parse, state-freshness, install,
  blueprint-fence, typecheck, lint-identities (baseline 76 distinct, **new 0,
  resolved 0**), artifacts-at-head (1835 files, drift 0 — HEAD carries its own
  build), **census PASS** (nine roots, 286s). An earlier census capture at the
  merge commit listed exactly TWO lane-caused reds — the un-booked
  tool-governance consumer edges — booked in `chore(a5p0)` (file-by-file,
  fs-family precedent); three further drift reds were proven on clean
  origin/master in this worktree (client `dist` never built here + load
  timing) and vanished after `pnpm build` — not lane-caused.
- `pnpm typecheck`: clean (all packages, tests included).
- `eb3-ci-required`: pass workflows=9 findings=0.
- `docs:sync --check` blocking=0; `docs:probe --worktree-only`
  blocking=0 non_blocking=0.
- `gen-family-index --check`: OK (4 reviewed families).
- `diag-call-chain --self-test`: OK 49 codes, 5 kinds (this PR's two family
  refusal codes resolve through the reviewed manifest + descriptor
  `refusalCode`, per #398).
- C1 45/45, family seam 9/9, ARC-A fitness 12/12, p4t6 20/20, world-factory
  offline 38/38, diag+devex `node --test` 44/44.

**Hosted round 1 (runs 40462120941/40462120913) found two real lane gaps —
both fixed on this branch, disclosed here:**
- `FAMILY_CROSS_INFLUENCE` ×5 — the lane was unbooked in
  `eb3-family-boundaries.mjs`. Fixed by the lane README (the boundary
  statement) + the edge booking: `node:*` + the two thin tool-governance
  faces only; `EB3-FAMILY-BOUNDARIES pass files=38 findings=0`.
- C3 negative control leg **3d MISSED on this lane**: the C3 control seeded
  this lane's contribution (alphabetically first family-body seed) and its
  execute-transport-swapping mutation DID NOT APPLY — my source digest
  bound row names only, so a swapped row body would have kept the same
  digest. The control caught a real gap, not a control bug. The digest now
  binds each row's `name` + `execute?.toString?.()` + `parameters` (the
  fs/search `sourceDocument` precedent, with a fail-closed order guard);
  `eb3-ci-negative-controls` reports **16/16**, leg 3d detected on this
  file. Re-verified after the fix: definitions 12/0, boundaries 38/0,
  trusted-sources 1902/0, C1/ARC-A/seam/p4t6 green, and the full local
  8-leg gate re-run green at this head.

## Zero-plane-edit file list (everything touched)

New: `packages/tools/agent-state-family/src/{agent-state-law,state-store,executors,contribution,index}.mjs` · `packages/tools/families/agent-state.mjs` · `packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts` (45 cases) · `tests/world-factory/suites/070-u7-fagentb.mjs` + `tests/world-factory/lib/u7fagentb-assembly.mjs` · `packages/testkit/test/p4t6-bookings/u7fagentb.json` · `scripts/dist-placements/070-agent-state.json` · `dev/agent-workflow/evidence/u7-f-agentB-20261026/**`.
Modified (bookkeeping only): `packages/tools/families/manifest.json` (+family entry +sha, +`kernelCapabilities.agent-state`) · generated `packages/tools/families/index.mjs` · `packages/runtime/test/u7-w0b-family-seam.test.ts` (reviewed-family count 3→4) · `dev/agent-workflow/ledgers/arc-a-family-census.json` (L3 census booking) · `packages/runtime/dist/packages/tools/**` (byte-copy mirrors).

Ledger notes: the p4t6 booking delta is MEASURED (1322→1329; RED-unbooked capture in evidence); the ARC-A census booking is the sanctioned registration, and the L3/L4 fitness suites pass with it. The goal/plan matrix rows in `TOOL-CAPABILITY-MATRIX-9b2.md` are NOT touched by this lane — their acceptance rows remain the matrix owner's call (disclosed as an UNKNOWN gap, not silently claimed).
