## What this is

ONE governed tool family — `dsh.agent-state-family` — mounting the five agent-state members (`todo_write`, `create_goal`, `get_goal`, `update_goal`, `exit_plan_mode`) at their fixed native spellings, as an **ordinary family** (`route: ordinary-family`) through the reviewed **FamilyAssembly seam**: the `packages/tools/families/` descriptor + manifest + the generic mount loop. **ZERO lines** in `team-tool-plane.mjs`, `family-assembly.mjs`, the binder (`agent-bindings.mjs`), or any of the 33 ARC-A protected paths — the family self-mounts nothing and carries no authority handle.

Mount config: the closed boolean `agentStateEnabled` (ABSENT = FALSE). Disabled ⇒ zero rows, zero witnesses, `disabledOwned` empty — `todo_write` keeps riding the host native byte-identically (the zero-flip is proven at C1 Z0 and live at C2 boot A).

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
| mount | enabled-without-store ⇒ whole assembly refuses `PLANE_AGENT_STATE_STORE_MISSING` (M2); ABSENT==FALSE byte-identical (Z0) | **PROVEN live:** boot A zero-flip (plane mounts as shipped, zero family witnesses, native `todo_write` ride) · boot B enabled⇒ typed live mount refusal + zero placement rows + zero RAN witnesses |

**DISCLOSED-NO-SEAM (never coloured PASS):** the enabled-and-store-mounted LIVE positive legs (authorized read; authorized mutation with the durable fact read back; refused cross-scope write) have no production seam on this tree: `agent-bindings.mjs` wires `backends` for the jobs bridge only, and this lane adds no binder line — a durable store adapter is a separate named binder lane. Those legs are PROVEN at C1 over the real plane and the real `issueApprovedGrant`/consume edges; C2 carries the disclosure verbatim into its evidence json.
**DISCLOSED (template law):** on the default-`deny` template every agent-state call answers `IO_POLICY_UNSUPPORTED / template-default-deny` before PA and before the store (D1) — the agent-state effect class has no rule-grammar spelling on this mount; extending the grammar is a named center-interface change (follow-up), never family self-authorization. Governed positives require the ask-default template + Control leg, which C1 exercises end-to-end.

## Live C2 verdicts (from the run record, verbatim)

(boot A / boot B verdicts + leak check pasted from `dev/agent-workflow/evidence/u7-f-agentB-20261026/` after the recorded run)

## Gate results

(append after the recorded `ci-pr-gate --full --census` run)

## Zero-plane-edit file list (everything touched)

New: `packages/tools/agent-state-family/src/{agent-state-law,state-store,executors,contribution,index}.mjs` · `packages/tools/families/agent-state.mjs` · `packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts` (45 cases) · `tests/world-factory/suites/070-u7-fagentb.mjs` + `tests/world-factory/lib/u7fagentb-assembly.mjs` · `packages/testkit/test/p4t6-bookings/u7fagentb.json` · `scripts/dist-placements/070-agent-state.json` · `dev/agent-workflow/evidence/u7-f-agentB-20261026/**`.
Modified (bookkeeping only): `packages/tools/families/manifest.json` (+family entry +sha, +`kernelCapabilities.agent-state`) · generated `packages/tools/families/index.mjs` · `packages/runtime/test/u7-w0b-family-seam.test.ts` (reviewed-family count 3→4) · `dev/agent-workflow/ledgers/arc-a-family-census.json` (L3 census booking) · `packages/runtime/dist/packages/tools/**` (byte-copy mirrors).

Ledger notes: the p4t6 booking delta is MEASURED (1322→1329; RED-unbooked capture in evidence); the ARC-A census booking is the sanctioned registration, and the L3/L4 fitness suites pass with it. The goal/plan matrix rows in `TOOL-CAPABILITY-MATRIX-9b2.md` are NOT touched by this lane — their acceptance rows remain the matrix owner's call (disclosed as an UNKNOWN gap, not silently claimed).
