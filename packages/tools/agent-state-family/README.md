# packages/tools/agent-state-family — the governed agent-state family (U7-F B)

One ordinary family (`dsh.agent-state-family`, route `ordinary-family`) mounting
the five agent-state members — `todo_write`, `create_goal`, `get_goal`,
`update_goal`, `exit_plan_mode` — through the reviewed FamilyAssembly seam
(`packages/tools/families/agent-state.mjs` descriptor + the manifest + the
generic mount loop). Owner role: this README is the lane's boundary statement;
`scripts/eb3-family-boundaries.mjs` books exactly what §"Lane law" declares,
and `scripts/audit-a5-tool-governance-imports.mjs` + the pinned consumer set in
`packages/domain/test/a5p0-layer-audit.test.ts` register the two governance
edges file-by-file.

## What lives where

- `src/agent-state-law.mjs` — the LAW module: the goal transition table
  (`GOAL_TRANSITION_LAW`, each leg cited to host source @ `639ed01539…`), the
  todo-list law, the plan-mode law, the fold/revision-CAS law. Pure; imports
  nothing.
- `src/state-store.mjs` — the durable state-store PORT (closed interface the
  family consumes via `cap.injected.agentState`) plus the in-memory reference
  adapter used by tests. Pure; imports nothing. An enabled family with no
  store port never mounts (`PLANE_AGENT_STATE_STORE_MISSING`, fail closed).
- `src/executors.mjs` — the five governed bodies. Scope is the CALLING agent
  (`agent:<exec.agent.id>`) from the dispatch, never an argument; reads are
  meta-only and bounded; durable writes are idempotent under replay.
- `src/contribution.mjs` — builds the plane contribution (rows + provider
  digest + `nativeNames` literal list, drift-guarded against the executor's
  `AGENT_STATE_NAMES`).
- `src/index.mjs` — the lane face; re-exports the contribution builder only.

## Lane law (imports, dist, tests)

- Allowed outward edges, and only these: `node:*` builtins and the two thin
  faces of `../../../domain/tool-governance/src/index.js` —
  `executors.mjs` imports ONLY `parseRequestedEffectSet` (the effect-grammar
  face every governed executor carries) and `contribution.mjs` imports ONLY
  `canonicalJsonStringify` (deterministic canonical serialization for the
  provider digest; pure function, zero authority). NO imports of the plane
  (`src/plugin/live/*`), the governance-center lane, tool-dispatch, any
  sibling family, or Host modules. No lane file imports the binder or mounts
  itself: mount authority is the plane's, config is the closed boolean
  `agentStateEnabled` (ABSENT = FALSE).
- dist mirrors are byte-copies placed by `scripts/dist-placements/110-agent-state.json`.
- Tests: C1 `packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts`
  (real plane + real kernel grant, 45 cases); C2
  `tests/world-factory/suites/110-u7-fagentb.mjs` (live host, ≤3 boots, the
  mount law both directions). Evidence:
  `dev/agent-workflow/evidence/u7-f-agentB-20261026/`.
- Vocabulary law (disclosed): `metadata` resources carry the `meta` right
  ONLY; mutators ride the `tool-invoke` arm plus their precondition read's
  `meta` arm. Declared == requested, per call, pinned by the C1 E1 legs.
- DISCLOSED-NO-SEAM: enabled-and-store-mounted LIVE positives have no
  production seam on this tree — `agent-bindings.mjs` wires `backends` for
  the jobs bridge only; a durable store adapter is a separate named binder
  lane. Those legs are PROVEN at C1 only, and the disclosure rides the C2
  evidence verbatim.
