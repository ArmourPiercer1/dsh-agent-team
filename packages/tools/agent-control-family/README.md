# packages/tools/agent-control-family — the AGENT-CONTROL family lane (U7-F)

ONE governed tool family: the seven agent-control natives `subagent`,
`subagent_fork`, `send_message`, `interrupt_agent`, `list_agents`,
`list_subagent_models`, `workflow`, mounted TOGETHER or not at all through the
FamilyAssembly seam (`packages/runtime/src/plugin/live/family-assembly.mjs`).
The lane is DATA and pure mechanics; every DECISION (admission, grant mint,
grant consume, spawn/steer at commit) belongs to the kernel and the agent
runtime (CI-06). Effects are declared honestly (law (a)): `tool-invoke` for
every row; `meta` for the two enumeration rows' read-only views
(`agent-roster`, `model-routes`) and the fork row's conversation-context
disclosure; `domain-ref` (`dsh-agent-runtime`) ONLY for the five spawn/steer
rows — enumeration rows never derive the mutation arm (C1 pins the actual
per-call PA requests from the same constants).

- LAW HOME (this lane): the scope fence (`send_message`/`interrupt_agent`
  address only the CALLER's own scope — a foreign id is a typed refusal with
  ZERO reach). SCOPE STATED EXACTLY: at this pin the fence is a
  DURABLE-ROSTER MEMBERSHIP fence over the caller's OWN MOUNT identity
  (`realmId:instanceId`): an explicit `scope:` prefix must match that
  identity byte-exact, and the id must appear VERBATIM (no case/whitespace
  folding) in the assembly-injected member list. It is NOT subtree
  containment (a sibling member's child is off this roster — refusal, not
  containment proof) and NOT a liveness gate (status belongs to the runtime;
  an archived member leaves the fence by leaving the durable roster).
  Also law-home here: the no-amplification rule (a request that would widen
  the caller's authority is refused, zero spawn) and the fork-context law
  (the mounted conversation context is DATA, never authority). Proof lives
  in `packages/runtime/test/u7-f-agent-control-c1.test.ts`.
- THE PORT CARRIES EXACTLY OR REFUSES: the production `spawnChild` leg
  forwards the bounded `provider` byte-equal to the pinned host face
  `SpawnTeammateRequest` (closed six fields — `types.ts:166-173` at the
  pinned host tree); a bounded `model`/`reasoning_effort`/`run_in_background`
  that face cannot carry, or a face-required field the walk did not carry,
  is a typed `agent-runtime-port-face-cannot-carry` refusal with ZERO spawn
  reach — never a silent drop, never an invented default.
- Allowed outward edges, and only these: `node:*` builtins (`node:crypto`),
  `../../../contracts/src/index.js` (canonical JSON), and the frozen
  `parseRequestedEffectSet` vocabulary face of
  `../../../domain/tool-governance/src/index.js` (registered consumer:
  `scripts/audit-a5-tool-governance-imports.mjs` + the pinned set in
  `packages/domain/test/a5p0-layer-audit.test.ts`). NO imports of the plane
  (`src/plugin/live/*`), the governance-center lane, tool-dispatch, any
  SIBLING family, or Host modules; the runtime reaches the rows only through
  the ONE hostService port face this lane DECLARES (`agent-runtime-port.mjs`)
  and never the reverse.
- DIST MIRROR: plain `.mjs` files are tracked as byte copies under
  `packages/runtime/dist/packages/tools/agent-control-family/src/` via
  PLACEMENTS in `scripts/place-dist-glue.mjs`. Edit here, run `node
  scripts/place-dist-glue.mjs`.
- MOUNT: the reviewed descriptor lives at
  `packages/tools/families/agent-control.mjs` (manifest + `node
  scripts/gen-family-index.mjs` regenerate the index; the mount is gated by
  the family config boolean `agentControlEnabled`).
