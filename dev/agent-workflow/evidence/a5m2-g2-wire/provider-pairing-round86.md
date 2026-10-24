# A5M2-WIRE-G2 provider pairing (A–E) — deployment routing + measured boundaries

PAIRING COMMIT removes the B-ORCH safety constant (c6a50abfa) and ships the
Team-governed SubagentProvider in the SAME commit — the block's posture
outlives the constant by moving into the seat DRIFT GATE: every admit reads
input.governedProvider.isActive(); an unregistered or unrouted mount keeps
EVERY call failing closed with P_B_ORCH_WIRE_CHILD_GOVERNANCE_UNGOVERNED.

## Deployment routing pairing (fixture side — root-owned homes; this is the exact pairing)
1. team plugin planeCfg (the world's team config):
   `teamToolPlane.bOrchestrationEnabled: true`
   `teamToolPlane.bOrchestrationRouting: '<NAME>'`   # REQUIRED config law; the arm registers the governed provider under EXACTLY this name
2. workflow-ptc plugin config:  `provider: '<NAME>'`   (workflow-ptc/src/index.ts:106; resolution :75-76/:136)
3. ralph plugin config:         `subagentProvider: '<NAME>'`  (tool-ralph Config :24-40; rides start() :445)
'<NAME>' must be IDENTICAL in all three; the global `spawn` service is NOT
replaced (providers coexist by name, subagent/src/index.ts:7). Mismatch or
missing evidence ⇒ the mount or the seat refuses (never silently executes
against global spawn). Suggested concrete name: `team-governed-spawn`.

## What the pairing DOES prove (measured seams, chain doc 90979f57)
- admission BEFORE creation (per-child PA walk at the top of start; parent
  call context from the wiring seat's admitted-call hand-off WeakMap — an
  unknown parent fails closed, zero creation);
- restrict BEFORE publication (agents.create setup runs pre-insert/announce,
  core/agent :100-116; commit() re-checks the lane at the boundary);
- THROW publishes NOTHING (factory rollback law; provider closes the plan);
- REAL attribution (parentAgent = the LIVE member Agent from request.parent,
  runOwnedActivation + teamOwnedSetup/claimOwnedGeneration funnel, durable
  meta origin 'subagent' + parentSession lineage; no fake member rows).

## What it does NOT claim (center boundary sync, standing)
- ONE-SHOT/workflow children only: the provider ships NO prepareContinuable,
  so the SERVICE refuses continuable starts on it (method presence IS the
  capability, types.ts) — continuable/fork 39/40 stays under the spawn-row
  safety block (1adac6ab) until its own TeamDomain pre-publication pairing.
- No lane-allow list yet: the installed lane is the member's effective DENY
  set (permissionPolicy.deny) via scoped tools.restrict; allow-lane facts are
  a follow-up card, and the provider refuses to publish when lane facts are
  unanswerable (P_TGP_LANE_ABSENT).
- Release/Host deployment still requires root's acceptance window; this
  commit removes NO protection — the drift gate is the protection.
