# PF-1 (PR #42, pass 2) — intent.probe / per-root compatibility prober consume a BOOT-blueprint-scoped live-facts thunk: spurious FATAL on a multi-blueprint host

Status: **NEW product finding — red-line STOP (2026-09-30, E.12 W2-A re-run halted at S1)**.
No product semantics changed by this pass (zero `packages/**` diff). Kit + evidence only.

## Symptom (real host, E.12 W2-A world)

World: boot row bound to the **anchor v1 blueprint with `requirements: []`** (the kit's
zero-requirement boot team); created teams use OTHER blueprints (main v2 with
`teamRequirements: team.mcp.repo + team.mcp.leaderreq`, both `complete: true`).

World state at the failing moment (all-READY cell):

- row config CARRIES all three `mcpServers` (supply axis configured:
  `mcp_repo`/3492, `mcp_leaderreq`/3491, `mcp_web`/3493) —
  `prereq-2026-09-29T20-05-02/dump-carries.txt` + `dump-config.txt`;
- every mini-MCP ANSWERS initialize on its port (kit-side JSON-RPC) — run log `[S1] PASS live preconditions`;
- live state at probe time (p6t6 state dump, both live sessions): **no mounted fiber, no
  `failed` materialization slot** (all `materialization: "pending"`,
  `observations: []`) — `diag-mcp-state-1.json` / `diag-mcp-state-2.json`;
- row-config bootstrap seed present for all subjects (`environmentFacts` all
  `available: true`) — `dump-config.txt`.

Observed:

1. `intent.probe({blueprintId: 'team.prereq-main', environmentFacts: []})` →
   `status: BLOCKED_FATAL`, `team.mcp.repo=FATAL` + `team.mcp.leaderreq=FATAL`,
   reasonCode `COMPLETE_REQUIREMENT_NOT_MET` — `diag-s1-probe-body.json`.
2. 14 ms later, `team.create` of the SAME blueprint → creation preflight outcome
   **`consentRequired`** (NOT `fatal`) — "an optional requirement is down and not
   consented" (the leader-template optional `lead.mcp.signal`, deliberately
   unconfigured — the designed S2 supply axis) — `run.log`.

The two are mutually inconsistent with a single world state: `startupPreflight`
(`packages/runtime/requirements/startup-preflight.ts`) checks team-scope blocked →
`fatal` FIRST; outcome `consentRequired` proves the preflight's team scope was NOT
blocked (repo/leaderreq available) while the probe reported both FATAL.

## Root cause (code trace, all paths code-verified this segment)

1. The boot root's fresh-facts thunk
   (`packages/runtime/src/plugin/root.ts` L821-836, W3-A live feed switch):

   ```ts
   const environmentFacts = ... : async () => (
     await requirementFacts.provider.resolveFacts({
       requirements: scopeRequirementInputsOf(blueprint).team,  // ← BOOT blueprint
       scope: { kind: 'team' },
     })
   ).environmentFacts
   ```

   The thunk resolves the LIVE provider against the **boot root's bound blueprint**
   team requirements (`blueprint` = the row's boot blueprint = the anchor, whose
   `requirements: []` → `scopeRequirementInputsOf(anchor).team = []` → the provider
   returns an **empty feed**).

2. That same thunk is injected into the remote surface as
   `options.environmentFacts` (`root.ts` L2359-2374, `createS6RemoteSurfaces`).

3. `intent.probe` (`packages/runtime/src/plugin/s6-remote.ts` L1954-1968) evaluates
   the **requested** blueprint's requirements
   (`compatibilityRequirementsOf(resolved)`) against that thunk's facts:

   ```ts
   const hostFacts = (await options.environmentFacts?.()) ?? []   // boot-scoped (empty)
   const result = evaluateCompatibility({
     requirements: compatibilityRequirementsOf(resolved),          // main blueprint
     environmentFacts: mergeProbeEnvironmentFacts(hostFacts, callerFacts),
   })
   ```

   Engine missing-fact semantics (`packages/domain/compatibility/src/engine.ts`
   L103-109): a missing fact → `available: false` → `complete: true` requirement →
   **FATAL**. Hence the spurious `BLOCKED_FATAL` for configured+healthy live servers.

4. The SAME thunk also feeds the per-root compatibility prober factory
   (`root.ts` L1452-1471 `compatibilityFor` → `createCompatibilityProber({
   blueprint: boundBlueprintFor(key), environmentFacts })`, where
   `environmentFacts` is the boot thunk) and the prober evaluates its OWN root's
   requirements against the injected thunk's facts
   (`packages/runtime/compatibility/probe.ts` L225-232 `evaluateFresh`). So
   `compatibility.get`/`compatibility.probe` for any created root whose bound
   blueprint differs from the boot blueprint carries the same deviation (the durable
   aggregate of the main team would be `BLOCKED_FATAL` in the all-ready world).

5. The post-creation paths are correctly scoped: the creation preflight resolves the
   provider DIRECTLY with the bound blueprint
   (`root.ts` L1208-1211 `authority.provider.resolveFacts({requirements:
   scopeRequirementInputsOf(bound).team, ...})`), and each created root gets its OWN
   thunk (its own closure, its own `blueprint`) for its own gate/prober/authority.
   Hence the preflight (and the created team's own gate) see the truth
   (unknown → bootstrap seed → available; optional signal unconfigured →
   deterministic supply-axis `unreachable` → WARNING → `consentRequired`).

## Why the pure logic is exonerated

`repro.mjs` (+ `repro-output.txt`): the REAL dist provider
(`createRuntimeRequirementFactsProvider`) with the exact world inputs — 3 configured
servers, live probe answering `unknown` (no fiber, no failed slot, as the state
dumps show), seed = the row `environmentFacts`, scope `team`, reqs = the 2 main team
requirements — yields feed `[mcp_repo available:true (bootstrap seed detail),
mcp_leaderreq available:true (bootstrap seed detail)]` and engine `status: OPEN`,
both requirements `PASS SATISFIED`. With the CORRECT feed (unknown + seed) the
contract works; the deviation is the host-side feed SCOPING (the thunk's
requirements argument), not the provider, the live probe, the seed path, or the
engine.

## Contract deviation

- Frozen `intent.probe` JSDoc (`s6-remote.ts` L378-404, T1.4-B): "the probe is a
  FAITHFUL PREDICTOR of the post-creation admission gate. It evaluates the SAME
  world the gate consumes"; L1938-1952: INV-9.4 two-worlds identity. On a
  multi-blueprint host the probe and the gate diverge (BLOCKED_FATAL vs
  consentRequired-with-team-PASS): **configured + healthy server still probes
  unreachable/unprobed** — the red-line pattern the parent adjudication pre-named.
- The T1.4-B comment at `root.ts` L2365-2373 ("the same injected source the
  post-creation admission gate consumes") holds only when the probed/created
  blueprint IS the boot blueprint; W3-A changed the thunk from the full static row
  facts to a live provider read scoped to the boot blueprint's requirements —
  correct for the boot team's own gate, wrong for the shared remote-surface source.
- S12 (persona blueprint) probes are incidentally unaffected (U5: persona domain is
  caller-only on the wire; the persona blueprint carries no non-persona
  requirements), which is why only S1's all-ready probe check fails on the re-run.

## Impact on E.12

- S1 all-ready probe check (the plan E.12 pre-create probe, INTENT preserved per the
  parent's rework instruction) CANNOT pass in a plan-conformant world shape (boot
  team + created teams of other blueprints — the E.12 multi-team premise, incl. S14).
  Kit-side restructures were examined and rejected: booting the row with the main
  blueprint (so probe scope == boot scope) makes the boot's own creation preflight
  refuse at boot (the main leader's optional `lead.mcp.signal` is unconfigured by
  design → `consentRequired` before any durable consent exists) and changes the
  world shape beyond the authorized rework.
- Any future scenario asserting `compatibility.get` on a created non-anchor team
  (repo/leaderreq/web subjects) asserts the deviated world.
- The S2 consent flow (grant `lead.mcp.signal` degradation consent before `t-create`
  in B1) is a correct-by-design kit-flow requirement under W2-A (signal is
  unconfigured in every boot) and must be added to the kit when the pass resumes.

## Evidence index (this dossier + worlds)

| artifact | location |
| --- | --- |
| probe response body (BLOCKED_FATAL) | `../prereq-2026-09-29T20-05-02/diag-s1-probe-body.json` |
| live state dumps (no fiber / no failed slot) | `../prereq-2026-09-29T20-05-02/diag-mcp-state-1.json`, `diag-mcp-state-2.json` |
| row dump (mcpServers carried + seed) | `../prereq-2026-09-29T20-05-02/dump-config.txt`, `dump-carries.txt` |
| run log (probe FATAL + t-create `consentRequired`) | `../prereq-2026-09-29T20-05-02/run.log` |
| first fatal run (same signature) | `../prereq-2026-09-29T19-56-27/run.log` |
| diag run 1 (state dumps) | `../prereq-2026-09-29T20-03-24/run.log` |
| pure-logic repro (provider+engine, unknown+seed → OPEN/PASS) | `./repro.mjs`, `./repro-output.txt` |

Kit-side exit codes: all three runs `KIT_EXIT=1` (fatal at S1) — real exit capture
(`node kit > log 2>&1; echo $?`), not the tee/tail artifact of pass 1.
