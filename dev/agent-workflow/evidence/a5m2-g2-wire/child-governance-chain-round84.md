# B-ORCHESTRATION child-governance: the MEASURED public-seam chain (root urgent audit round, post-c6a50abfa)

Safety block STANDS (c6a50abfa229d8cf87b1f4013672961f95cdaa5e): the seat fail-closes every call
(P_B_ORCH_WIRE_CHILD_GOVERNANCE_UNGOVERNED, zero PA, zero body) until the pairing below lands.
Release/Host deployment of any build without the block is PROHIBITED (root directive).

## The bypass (root-measured, confirmed in pinned source @639ed01539)
Engine children ride the PARENT preset generation only. Member-private shadow/guard/deny do NOT
ride: plane defs are agent-scoped registrations (core/tools/src/index.ts:804 scoped shadow is
per-scope); children are distinct scopes. The Team activationFence (live/agent-bindings.mjs
:1262-1310 teamOwnedSetup/runOwnedActivation) is entered ONLY by Team create/resume entries
passing through that funnel; the raw spawn provider never enters it — a fresh child UUID claims
no owned generation, agentSetup never runs, and the fence membership test passes it.

## THE CHAIN — every link a PUBLIC face at the pin (no Core patch, no private API)
1. **Config routing (the two named seams)**: workflow-ptc `Config.provider`
   (workflow-ptc/src/index.ts:106; resolution :75-76/:136 `ctx.subagents.getProvider(name)`) and
   ralph `Config.subagentProvider` (tool-ralph Config :24-40; request field rides
   `ctx.workflowEngine.start({... subagentProvider ...})` :445 → same resolution). Both route by
   NAME — pointing them at a NEW provider name selects the Team-governed provider WITHOUT
   replacing the global `spawn` service (providers coexist by name, subagent/src/index.ts:7).
2. **Registration (public)**: `subagents.registerProvider(provider): () => void` —
   subagent/src/index.ts:512-527, public-seam wrapper, name-collision refuse, disposer.
3. **Provider.start (the admission + setup owner)**: contract types.ts:344-374 —
   "Establish a ONE-SHOT child and return its handle AFTER publication… the provider owns setup
   and cleans any unpublished partial resources before rejecting". Request carries the LIVE
   parent Agent (`SubagentStartRequest.parent: Agent`, types.ts) + the caller signal. Admission
   runs AT THE TOP of start, BEFORE any creation exists — the root's `provider.start 创建前准入`.
4. **Pre-publication restricted surface (public)**: `agents.create(options: CreateAgentOptions)`
   — core/agent/src/index.ts:391 (service 'agents' :256). Options carry `parentAgent` (runtime
   OWNERSHIP by the live member Agent — the real attribution), `meta {origin:'subagent',
   delegationDepth, cwd, parentSession}` (durable, validated), and `setup: AgentSetup` (:50-55,
   :100-116): the factory awaits setup after minting `agentCtx` but BEFORE inserting/announcing
   either session or agent; everything registered through agentCtx (scoped tools, `restrict()`,
   prompt sections, listeners) exists before `agent/created` and the first prompt; an optional
   synchronous `commit()` re-validates at the exact publication boundary; throw/rollback publishes
   NOTHING. Retrofitting after the original `spawn.start` returns is too late — this seam is the
   publication-gated one.
5. **The restricted surface itself (public)**: `ctx.tools.restrict({allow?, deny?})` —
   core/tools/src/index.ts:1097-1122; scoped-context REQUIRED (a global restrict throws — exactly
   the per-scope semantics we need); unknown spellings refuse; disposer returned. Setup installs
   the member's effective lane (its plane denies + team guard denies; allow-list = the member's
   governed lane) into the CHILD's scoped world before publication.
6. **Real Team attribution (existing system, no fake rows)**: mint the child through the SAME
   funnel every Team entry uses — `runOwnedActivation(childSid, () => teamOwnedSetup(childSid,
   governanceSetup)(...))` (live/agent-bindings.mjs:1262-1310; the funnel's own documented entry
   list already includes childFactory creates). The fence then KNOWS the child: the claim is
   accepted inside the runOwned guard (`claimOwnedGeneration`), the durable meta says
   origin:'subagent' with parentSession lineage, and runtime ownership rides `parentAgent` = the
   LIVE member Agent (not a minted UUID pretending to be a member — no durable member row, no
   new ledger, no filter-equivalence).

## Bounded change set (the pairing card, in order)
- **A. `governed-families/team-governed-provider.mjs` (+d.mts)** — implements SubagentProvider
  {name:'team-governed-spawn', capabilities (one-shot; agentOptions merge),
  inheritsParentContext:false (truthful: the child world is the RESTRICTED composition, not the
  parent's completed prefix)}; start = ① per-child PA admission walk over the plane's ONE paAdmit
  (outer plan identity = the parent workflow call fingerprint + child ordinal; refuse ⇒ typed
  throw BEFORE agents.create); ② `agents.create({sessionId, parentAgent: request.parent, meta
  {origin:'subagent', delegationDepth+1, cwd, parentSession}, agentOptions merged, signal,
  setup: teamOwnedSetup(sid, childSetup)})` with childSetup = tools.restrict(member lane) + commit
  re-check; ③ wrap the published handle into SubagentRun (result/cancel/dispose map); rollback of
  the unpublished scope on any throw (provider-owned cleanup law).
- **B. wiring pairing**: register the provider at arm time (disposer in the wiring dispose),
  REMOVE the CHILD_GOVERNANCE_FAIL_CLOSED constant in the same commit (the block is removed by
  this pairing, never by config); seat resumes real walks only now.
- **C. deployment pairing (fixture-only)**: patch config routing
  workflow-ptc `provider: 'team-governed-spawn'` + ralph `subagentProvider` same; the team plugin
  refuses the EXECUTION arm if its registered provider name is absent from the engines' resolved
  provider at dispatch (drift gate), so a mis-deployed world stays fail-closed by refusal, not by
  silent global-spawn use.
- **D. identity semantics**: durable-membership for fence recognition of NON-durable owned
  children needs NO change — recognition rides runOwned+claimOwnedGeneration+meta lineage (above).
  If implementation hits a fence test that requires a durable member row for a child, that is a
  NAMED escalation (identity semantics), not a silent fake setup.
- **E. tests (author-side, no boot)**: provider unit over doubles (admission-before-create order
  pin; refuse ⇒ zero agents.create; restrict bytes land in setup before publication; parentAgent
  identity = live member Agent; rollback on setup throw); wiring pairing (block constant gone,
  walk machinery green again, provider disposer rides dispose); plane-mount widened back.

## Pins (all read this round @639ed01539 unless noted)
workflow-ptc/src/index.ts:106/:75-76/:136; tool-ralph Config :24-40, start :445;
subagent/src/index.ts:7/:512-527/:535; subagent/src/types.ts:344-374 (provider), :parent on
SubagentStartRequest; core/agent/src/index.ts:256/:391/:50-55/:71-72/:100-116 (setup/commit/
parentAgent/meta); core/tools/src/index.ts:1097-1122 (restrict), :747-748/:804 (scoped shadow);
workflow-ptc/src/host.ts:197-207 (the bypass chain being replaced); lane agent-bindings.mjs
:1262-1310 (fence funnel).
