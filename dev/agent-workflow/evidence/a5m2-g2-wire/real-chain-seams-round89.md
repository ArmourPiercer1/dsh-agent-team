# Real-chain seam verification (center source list @int 104513c8e, re-measured on lane tree) + named contract gaps forwarded to root

Nothing here is implementation; blocks stand (workflow constant seat
1e731166; 39/40 first-statement block signed). All five seam groups VERIFIED
line-for-line on THIS tree:

## A. REAL Team create/run chain — VERIFIED
- `src/plugin/types.ts:953` `TeamAgentBindings` — the ONLY side of the
  production root touching the DSH agent service (create/resume/followup/
  cancel/dispose + durability barrier). Members verified in-file:
  `childFactory :956` (ChildSessionFactoryPort, A16 step 13, the one
  external effect), `sessionDurability :958` (invariant 46 barrier),
  `surface :960` (TeamAgentSetupSurface — "the binder's ONLY agent contact"
  = the real pre-publication setup face; restrict CANNOT substitute),
  `sessionInput :962` (A24 ONLY channel), `workDelivery :964`
  (WorkDeliveryPort), `interrupt :966` (§20.3 step 2), `drainDescendants
  :970` (step 3), `residency :974`, `resolveCaller :979` (caller + owning-
  root binding).
- Attribution/single-flight funnel VERIFIED in `src/plugin/live/agent-
  bindings.mjs`: `teamOwnedSetup` with `fence.claimOwnedGeneration(sid,
  setupAgent)` INSIDE the runOwned-guarded operation at **:1267-1271**;
  "funnels through runOwnedActivation, so at most ONE in-flight" **:1066**.

## B. REAL run→result = requestToken correlation — VERIFIED (handle.result was the wrong mechanism)
- `admission/types.ts` `WorkDeliveryPort.deliver` (~:645): deliver one
  ADMITTED work request's prompt/context to the member's child session,
  AWAIT THE TURN'S COMPLETION, normalize into the frozen WorkDeliveryResult;
  status law succeeded=readable non-empty body / failed=explicit turn
  failure / unavailable=no readable body or undeterminable seam; requestToken
  echoed VERBATIM and "doubles as the visible correlation for the at-least-
  once delivery contract's dedup"; @throws = fail-closed settlement.
- lane consumption VERIFIED: `agent-bindings.mjs:7964` "completion boundary
  stays work-completion: workDelivery.deliver".
- followup/whenIdle/result semantics VERIFIED at `src/plugin/types.ts`
  deliverRootWorkCompletionNotification doc block (~:1080-1098): DSH Agent
  semantics `status === 'idle'` → followup, else steer at the next step
  boundary; SUCCESS BOUNDARY = followup/steer ACCEPTANCE ONLY ("no whenIdle,
  no materialize as a success condition"); the notification "carries no
  result — the durable settlement fact + team_collect stay the authority";
  activation envelope `[team-work-settled requestToken=<token>]`.
- per-run correlation carrier precedent ALREADY IN TREE (not WeakMap):
  plane `governedTokenLedger` keyed on the REAL `exec.token`
  (team-tool-plane.mjs :2017-2027, single-flight + correlation law;
  :2885 refuses exec-token-unbound rows).

## The implementable chain (once gaps C1-C2 are adjudicated)
seat PA admit → delegate → engine routes the Team-governed provider name →
provider.start creates through **childFactory + surface (real Team setup/
Guard/PA/IO/durable ownership pre-publication)** → runs via
**workDelivery.deliver(requestToken)** awaiting turn completion →
WorkDeliveryResult → engine's SubagentResult mapping; settlement read-back =
durable settlement fact + team_collect; cancel = interrupt/drainDescendants.
Parent attribution = childFactory's durable lineage + the A-funnel claim —
NOT parent.sessionId (undefined; Agent.id) and NOT a parentAgent WeakMap.

## NAMED CONTRACT GAPS forwarded to root (per card: 具名裁, no mock delivery)
- **C1 (639 host face)**: AgentHandle = {agent, dispose()} — NO result/
  whenIdle face. Real read-back = durable settlement + team_collect. The
  SubagentRun.result the ENGINES await has no honest source on the real
  Team chain unless deliver() (member-work channel) is the run's carrier.
  Ask: root rules how a workflow child run's result maps (deliver-
  WorkDeliveryResult as the run's settlement, or engines accept a
  settlement-by-reference contract) — a named contract decision, not code.
- **C2 (per-run correlation through the engine)**: workflow-ptc
  host.startChild passes ONLY {prompt, parent, signal, agentOptions?} to
  subagents.start (:197-207) — the engine DROPS any correlation, so a named
  provider cannot bind a child admission to the admitting outer call except
  by parent identity (rejected: parallel same-parent overwrite; background
  children start after the call ends). Minimal contract diff for root:
  ONE opaque correlation field on the engine's child-start path
  (carrying the admitted run's requestToken/token-ledger id). Until that
  exists (or root names another public carrier), the seat stays closed.
- **C3 (39/40 absent-state REAL gate)** — my proposed concrete 落点 per
  root's strictGuard/coverage order: when the a5 plane is deployed, spawn
  rows mount REGARDLESS of spawnGoverned (masked+fail-closed); the always-
  record invisible case splits HONESTLY via the member's deny lane
  (permissionPolicy/builtinToolDeny naming the tool ⇒ safe, no native face
  to mask; otherwise ⇒ typed mount refusal). This turns "absent" into an
  execution gate rather than a comment. Blast radius (recorded): governed-
  plane members without subagent faces outside the deny lane would fail
  mount loudly — root confirms or names a softer strict form.

Implementation resumes ONLY on root's rulings for C1/C2 (and C3 form).
No fake readiness, no mock loops; everything outside the real chain routes
back to named adjudication.
