# FINDING — D-3 PENDING scope over-blocks non-MCP (no-probe-port) required capabilities

Date: 2026-09-30, pass 3b (after D-1 + D-3 product + 37-test suite green + reverse-reds).
Status: **STOP-AND-REPORT** (red line: new product finding ≠ PF-1/D-1/D-2/D-3).
This is NOT a code bug in my wiring — it is the adjudicated D-3 semantics applied to a
class of capability the adjudication's "zero-new" gate did not anticipate. Adjudication
required from the parent before committing / gating / E.12.

## 1. Symptom
Full root suite (clean scratch, `pnpm exec vitest run` from the worktree root) after the
D-1 + D-3 product changes: **24 failed files / 31 failed tests** vs the baseline
`rr/../suite-run1.log` **9 failed files / 19 failed tests**. The 12 new file failures and
10 new test failures (below) all carry the SAME error at creation/boot:

```
TeamRuntimeError: TeamRuntime: the creation preflight of "session-..." is 'pending' —
the durable Team bind is refused (zero durable effect; a required capability is not yet
observed (materialization pending) — re-drive the creation at the next boundary
(or run the compatibility reprobe); the block is recheckable, not a deadlock)
 ❯ packages/runtime/src/plugin/root.ts:1363 (createAndStartTeam)
```

## 2. New-vs-baseline failure diff (exact)
Baseline (suite-run1.log): 19 test-level + 3 suite-level failures, all pre-existing
(domain t1-capability-schema ×9, domain t2-blueprint-hash ×1, runtime
d3-member-identity-context ×1, p6t3-mediation ×5, p6t3-restart ×2, p8s3b / t12a-b2 /
t12a-glue module-load, tools p6t6-actions ×1).

NEW in the D-1+D-3 run (`rr/suite-run3.log`), by category:

A. D-3 preflight PENDING at creation/boot — the finding (10 suites + 8 tests):
   - suites (module-load = the boot `applyWorld` rejects, so 0 tests run):
     bp1-freeze-barrier, bp1-red-probe, p8s5a-production-assembly,
     startup-consent-production, t12b1-real-create, t12b2-resume-separation,
     t12b6-handoff-agent-start, team-compatibility-scope, p8s6-principal
     (p8s6's downstream "missing-key on team_sessions" is the refused create's
     consequence — the session row was never durably bound).
   - tests (the create is refused mid-scenario):
     p8s7r4-handoff-wiring S1/S2/S3/S4/S6 ("creation-failed" ≠ "completed"),
     startup-preflight-production-create S4 (expected `consentRequired`, got `pending`),
     startup-template-disable-production S3 + S3a (re-driven create refused),
     startup-all-templates-real-authority S6 (re-drive refused).

B. Expected / non-product (2 tests) — NOT part of the finding:
   - testkit p4t6-session-event-scan ×1 — the denylist scanner pin moves because this
     pass adds files (the pin update is part of commit 2 by the pass plan).
   - runtime p6t1-parallel ×2 — the known p6t1-parallel flake (isolated rerun 9/9;
     `rr/../p6t1-parallel-isolated-rerun.log`).

## 3. Root cause (single mechanism)
The production host (`src/plugin/host.ts:1812-1842`) registers a live-readiness probe
port for **`mcpServer` ONLY**. The readiness provider
(`readiness/provider.ts:84-89`) is fail-soft: a capability type with **no probe port**
resolves to `unknown` ("no probe port for capability type 'skill'"). The D-3 classifier
(`requirement-facts/pending.ts:108-109`) PENDING-blocks any REQUIRED requirement whose
live observation is `unknown` (the only exemption is the COLD `mcpServer`
not-applicable materialization axis). Therefore:

> A REQUIRED requirement of a type with NO live probe port (`skill`, `tool`,
> `modelRoute`, `teamStructure`) is PERMANENTLY live-`unknown` → D-3 PENDING-blocks the
> creation in every production world that requires such a capability and relied on the
> static seed (`config.environmentFacts`) to satisfy it.

Before D-3 such a required fact was seed-satisfied in the 2-state feed → engine PASS
(the documented false-OPEN that D-3 exists to remove). After D-3 the 3-state read sees
`unknown` → typed PENDING. E.g. `bp1-freeze-barrier` requires `skill:base` (required) +
`tool:web` (optional), seed-satisfies both; `skill:base` is now the PENDING subject.

## 4. Why the adjudication's "zero-new" + E.12 did not anticipate this
- The D-3 PENDING story is a **materialization-pending** block: recheckable at the next
  boundary / reprobe because the capability is in flight (the kit B5 case = a RESUMING
  member's `mcpServer` slot pending). That only exists for PROBEABLE types.
- In the **E.12 kit world** the required capabilities are MCP servers (probe port
  registered, live ≥90s after boot) → they become `reachable`, so the preflight PENDING
  is DORMANT there — which is why the "E.12 PENDING dormant" note held.
- The **unit production worlds** (bp1/t12b*/p8s*/startup-*/team-compatibility-scope)
  require `skill`/`tool`/`model` capabilities that have NO probe port and are
  seed-only. They were never in the D-3 mental model (B5/E.11/E.12 are all MCP/persona).

So the D-3 mechanism is implemented exactly as adjudicated, but its blast radius
(19 production worlds) exceeds the "zero-new" gate. The two parent directives conflict
and need a decision.

## 5. Blast radius of a NARROWING (if the parent chooses option 1 below)
Narrowing the PENDING to PROBEABLE required types only (mcpServer; persona via the
substrate observer) — i.e. NOT PENDING-blocking a `no-probe-port` unknown — would:
- Restore all 19 blocked production worlds to their baseline (zero-new holds).
- Leave the D-3 B5 case (mcpServer slot pending) PENDING — unchanged.
- Leave the E.11 negative #1 (cold member MCP not-applicable) exempt — unchanged.
- Leave my 37-test D-1/D-3 suite GREEN — every subject in it is `mcpServer`
  (mcp_repo / mcp_leaderreq / mcp_web / mcp_signal) or `persona`; none is a no-probe-
  port type. (The reverse-reds were all captured on that same mcp/persona basis.)
- Leave the s6 probe drop filter (`dropSeedFilledPendingFacts`) unaffected in the E.12
  world (mcp subjects only).
The cost: a REQUIRED `skill`/`tool`/`modelRoute`/`teamStructure` that is seed-satisfied
keeps the 2-state seed PASS (a documented "no live probe for this type → the seed is the
only observation" gap, NOT a false-OPEN in the D-3 sense, because the product has no live
source for that type at all). That gap needs its own ADR/probe port to close.

## 6. Options for the parent
1. **(recommended) Narrow D-3 PENDING to probeable required types.** Distinguish
   `unknown`-because-no-probe-port (structural, unobservable-by-design → keep the
   legacy seed-satisfied 2-state behavior, document the gap) from `unknown`-because-
   materialization-pending (probe exists, in flight → typed PENDING). This satisfies
   "never a seed-filled PASS" for every type the product CAN observe, preserves the
   zero-new gate + E.11/E.12, and keeps B5. Requires the classifier (and the probe drop
   filter, for symmetry) to know whether the `unknown` came from a live probe.
2. **Add live probe ports for skill/tool/modelRoute/teamStructure** so those types are
   observable. Larger product change; needs a definition of "live" per type; likely
   beyond this pass.
3. **Accept the block; re-baseline the gate to the new failure set and update the 19
   tests** to expect PENDING at creation. Changes documented behavior for every world
   requiring a non-MCP capability (a regression for those worlds until probes exist);
   contradicts the "zero-new" directive.

## 7. What I have NOT done (awaiting adjudication)
- No commits 2-4, no push, no E.12 fresh-world, no dist mirrors, no p4t6 pin update,
  no kit S12/B5 work beyond the completed unit suite + reverse-reds.
- Working tree: D-1 + D-3 product changes + `test/requirement-d1-d3-decision-scoping.
  test.ts` (37/37 green) + `rr/` evidence, all on top of local commit 1 (`bb7b9f0b`);
  origin still `2de8f902`.
