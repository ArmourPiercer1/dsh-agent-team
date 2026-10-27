# U7 agent-control family (#406) — positive-effect design (READ-ONLY design lane)

- **Lane:** `task/u7-agentcontrol-design-20261027`, worktree `.worktrees/u7-acdesign`, based on `origin/master @ a264d2df0`.
- **Nature:** design only. This lane writes no product code, boots no Host and edits no protected-center file. Its single deliverable is this file.
- **Host pin:** `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2), with a clean porcelain. Every `upstream:` citation below is relative to `tests/deepseek-harness-test-use/packages/`.
- **Laws applied:** AGENTS.md (CORE PATCH BUDGET = 0); ROUTER_RULES §0; ARC-A L1 protected-center digest lock (`dev/agent-workflow/ledgers/arc-a-protected-center.json`, scanner `packages/testkit/test/arc-a-fitness/scan.mjs:43-55`).
- **Inputs read:**
  - the acceptance ledger `dev/agent-workflow/ledgers/u7-tool-acceptance.json`, rows 12–18;
  - the #406 evidence `dev/agent-workflow/evidence/u7-f-agentA-20261026/c2/{C2-VERDICTS.md,boot-budget.md}`;
  - `packages/tools/agent-control-family/**`, `packages/tools/families/agent-control.mjs`, `family-assembly.mjs`, `team-tool-plane.mjs` and `agent-bindings.mjs`;
  - the #413 descriptor `origin/task/u7-agentstate-store-20261027:packages/tools/families/agent-state.mjs`.

> Vocabulary (from the ledger): **L1** definition, **L2** mounted, **L3** live typed refusal graded **PASS**, **L4** live positive effect.
> Class labels: **FEASIBLE-IN-LANE** / **NEEDS-CENTER-INTERFACE** / **CORE_SEAM_BLOCKER** / **DISCLOSE-PERMANENTLY-AT-THIS-PIN**.

---

## 0. Verdict in one paragraph

#406 tied its production port to the **wrong host face**. `createHostAgentRuntimePort` resolves only `agentTeams`, the upstream EXPERIMENTAL `tool-agent-team` runtime (`packages/tools/agent-control-family/src/agent-runtime-port.mjs:74-86,121,143,152,161`). The base bundle never loads that runtime, so every leg in the C2 world answered `agent-runtime-leg-unwired` (C2-VERDICTS `ac:enumerate-governed`).

At the pin, the seven **native** tools this family takes over ride two public services:

- **`subagents`** (`SubagentRuntime`, `upstream: subagent/subagent/src/index.ts:200-215`, `super(ctx,'subagents')`);
- **`workflowEngine`** (`upstream: workflow/workflow/src/index.ts:157-168`).

`bundle/base/cordis.patch.yml:349-399` composes both, together with the `spawn` and `fork` providers. Both services are reachable through the family's existing `cap.hostService(name)` capability, with zero protected-center lines. That is the same seam the image row (`team-tool-plane.mjs:1598-1608,2048`) and #413's store already use.

The missing "caller-authority snapshot" has a **sound in-lane answer** for a narrowed positive arm. The public `SubagentStartRequest.toolFilter` (`upstream: subagent/subagent/src/types.ts:186-192`) is applied as a chain-wide `tools.restrict` in the child's creation window (`upstream: subagent/subagent/src/child-agent.ts:200-218`; `core/tools/src/index.ts:1180-1218`). With it, the family can spawn a child that is ≤ ANY caller by construction:

- no inherited tools;
- the caller's own route;
- bounded lifetime;
- upstream already pins the child's approval policy to `never` (`child-agent.ts:249-256`).

A child that carries **tools** under the caller's real grants is the part that needs center work. That case is not recommended.

---

## 1. Cross-cutting findings

### F1 — The correct public faces at the pin (replaces the #406 "none at pin" claim)

| leg | public face @639ed01539 | native tool that rides it (proof that it is the same-name, same-meaning face) |
| --- | --- | --- |
| listAgents | `subagents.listChildren(parentSessionId, signal)` / `listDescendants(rootSessionId, signal)` — `subagent/subagent/src/index.ts:374,393` | `list_agents` — `subagent/tool-subagent-control/src/list-agents.ts:87,152-167` |
| listModels | `llm.listProviders()` / `llm.listModels(id)` | `list_subagent_models` — `subagent/tool-subagent/src/list-models.ts:42,50,63` |
| spawnChild | `subagents.start('spawn', SubagentStartRequest)` (one-shot) — `index.ts:559`; `subagents.startContinuable({provider:'spawn',label,request,signal})` — `index.ts:261`, `types.ts:32-50` | `subagent` — `subagent/tool-subagent/src/index.ts:530,550,563`; bundle row `cordis.patch.yml:370-376` (`provider: spawn`, `backgroundMode: continuable`) |
| forkChild | `subagents.start('fork', …)`. The fork provider seeds the child with the parent's completed-turn prefix (`subagent/subagent-fork-in-process/src/index.ts:48-54,63-72,95`) | `subagent_fork` — bundle row `cordis.patch.yml:383-389` (`provider: fork`, `backgroundMode: one-shot`) |
| steer | `subagents.sendMessage(sender: Agent, targetId, content, {signal})` — `index.ts:279`. The host enforces adjacency: direct parent or direct continuable child only | `send_message` — `subagent/tool-subagent-control/src/index.ts:29,64` |
| interrupt | `subagents.interrupt(targetId, {kind:'ancestor', agent})` — `index.ts:328`; `types.ts:65-67`. Throws `UNAUTHORIZED` off-lineage. An absent target is an accepted **no-op** | `interrupt_agent` — `tool-subagent-control/src/index.ts:75,108` |
| runWorkflow | `workflowEngine.start({script, meta, args?, subagentProvider?, maxTotalAgents?, parent, signal?})` — `workflow/workflow/src/runtime-types.ts:19-34` | `workflow` — `workflow/tool-workflow/src/index.ts:282,433` |
| (support) | `subagents.registerProvider(provider)` → disposer; `getProvider(name)` — `index.ts:512,535`; `SubagentProvider` — `types.ts:344-389` | the `spawn`/`fork` providers register exactly this way (`subagent-fork-in-process/src/index.ts:95`) |

**Consequences:**

- The `agentTeams` legs should be **removed** from the production resolver, not extended. `agentTeams` is a different product: an experimental peer-team runtime whose `spawnTeammate` cannot carry route, model or tool scoping (`agent-runtime-port.mjs:163-194` already documents this).
- The `provider-required` and `face-cannot-carry` refusals at `agent-runtime-port.mjs:184-194` are artifacts of that wrong face. On `subagents`, `agentOptions` and `toolFilter` are first-class optional fields (`types.ts:171,192`).

### F2 — Trusted caller identity (already present, zero center lines)

Every row already forwards the **dispatch-provided** live `exec.agent` (for example `spawn-row.mjs:35`), and the executor threads it into `caller.agent`. This is exactly the authority object the upstream faces want:

- `SubagentStartRequest.parent: Agent` (`types.ts:155`);
- `sendMessage(sender: Agent, …)`;
- `interrupt(…, {kind:'ancestor', agent})`;
- `listChildren(agent.id)`.

The model never supplies it. The upstream service re-checks it against recorded lineage (`index.ts:279-330`, `UNAUTHORIZED`). The family's mount identity (`realmId:instanceId`) stays the attribution key.

**Identity is solved. Authority (grants) is the open question.**

### F3 — Where a caller-authority snapshot could come from (each candidate evaluated)

| candidate | trusted? | reachable through `build`/`mount` with 0 protected lines? | verdict |
| --- | --- | --- | --- |
| **(a) Tier A ceiling** — a constant built in `build`: `{providers:[], models:[], tools:[], continuable:<lane flag>}`, plus port-forced `toolFilter:{allow:[]}`, no `agentOptions`, no `persona` | Yes. It asserts no grant; it asserts a ceiling (zero inherited tools, the caller's own route, a lifetime bounded by the caller) that is ≤ every caller by construction | **Yes.** It is set in `families/agent-control.mjs` the same way #413 sets its store: `cap.injected?.callerAuthority ?? TIER_A_CEILING` (today `?? null`, `families/agent-control.mjs:80`). `authorityBounded` (`agent-control-mechanics.mjs:249-270`) then admits only requests that ask for nothing beyond inheritance | **CHOSEN** for the first lanes |
| (b) vNext **MemberInstance** durable row | Yes (domain) | **No.** It lives in the agent-bindings closure (`domain.repositories.memberInstances`, `agent-bindings.mjs:2700-2709`) or in the `teamRoot` Cordis service (`packages/runtime/src/plugin/host.ts:3193-3237`). `teamRoot` also exposes `.mutation` ("the SINGLE governance mutation authority") and `.control`. A family reading it via `cap.hostService('teamRoot')` is zero lines but **breaks the by-construction law** of the capability object (`family-assembly.mjs:39-44`, `FORBIDDEN_CAPABILITY_KEYS` `:77-80`). Also, a MemberInstance names a template, not the effective grants | **REJECTED** (a law breach dressed as zero lines) |
| (c) **Permission ledger / effective policy at call time** = `readPaCallFactsForCall` (`pa-mount-registry.mjs:362`: the current policy projection, deny sources, ceiling, durable overlay and authority generation, keyed by the call identity) | Yes. It is the one public call-level entry that the PA edge itself awaits | **Not through the capability object.** It is wired into the plane at `agent-bindings.mjs:2809` → `team-tool-plane.mjs:946` (`paReadCallFacts`) but is not one of the closed `CAPABILITY_KEYS` (`family-assembly.mjs:61-74`). The minimal additive interface: one read-only key `callerAuthorityFacts: ({callId}) => Promise<frozen projection \| undefined>` in `family-assembly.mjs` `CAPABILITY_KEYS` (after `:69`), plus one field in `team-tool-plane.mjs:1610-1632` that closes over `paReadCallFacts` for the **same** call identity the family's PA walk used (the `livePaPlan` correlation). **Neither file is in the ARC-A protected ledger**, so the protected-center line count is 0. It still widens the family capability surface, so it should land as a **named center-interface PR** (the #391/#392 convention), not inside a family PR | **NEEDS-CENTER-INTERFACE** (additive, reviewable). Required only for Tier B |
| (d) the **PA** (`cap.pa`) as the proof: put the child's would-be effects into the spawn call's own requested effect set, so the caller is admitted only if it holds them itself | Yes. Admission is the authority | Mechanically yes (`cap.pa` is a capability). However, effects for native tool classes the projection does not know refuse with `projection-invoke-class-unknown` / `projection-inventory-missing` (the #391 closed-world law, booked on the protected `tool-admission/admission-kernel.ts`). Also, admission proves the bound **at spawn time only**: a continuable child outlives a later revoke | **Spike only.** Possibly a Tier B′. Not designed here |

**What Tier B (a child with tools ≤ the caller's grants) would need besides (c).** The child's tools must themselves be **governed**. In-process children join the parent's *preset* (`child-agent.ts:206`, `agentPresets.composeFrom`). That gives them the preset's **native, ungoverned** rows, which carry no vNext resource fence, so a child with any tool can exceed a subtree-scoped caller.

Governing the child means mounting the plane on a non-member child session. The mount gate lives in the protected `agent-bindings.mjs:2648` (`permissionPolicy !== undefined && config.teamToolPlane`). That is a protected-file interface change: **NEEDS-CENTER-INTERFACE**, with a large review surface and an unclear product need. **Not recommended at this pin.**

### F4 — What Tier A actually spawns (and what must be witnessed)

`applyChildComposition` performs these steps (`child-agent.ts:200-218`):

1. It joins the parent preset.
2. It adds the delegation-scope prompt.
3. It applies `toolFilter`.

The view algorithm (`core/tools/src/index.ts:1180-1218`) has three relevant properties:

- A restriction masks **every inherited name**: global, chain ancestors and the joined preset.
- Only the child's **own-scope** registrations bypass it.
- The `run_code` transport is re-added whenever the scope mode ≠ `native` (`:1211-1213`).

`allow: []` passes the `restrict` validation (`:1097-1124`; it rejects only an empty `{}` and unknown names). The visible tool set of a Tier A child is therefore:

- **∅**, plus own-scope registrations, plus `run_code` in PTC mode;
- plus the structured-capture tool, only when an `outputSchema` was sent (the family never sends one).

Two follow-ups:

- The own-scope remainder and the PTC case are **empirical**. Every spawn L4 case below witnesses the child's actual visible list.
- If the caller session runs in PTC mode, Tier A must refuse (`agent-control-child-ptc-refused`) until a C2 run proves that a tool-less `run_code` reaches nothing.

### F5 — Posture facts any L4 world must respect

1. **Deny-default templates never run the family.** `agent-control-executor.mjs:79-87` refuses `template-default-deny`, because the closed rule grammar (`PERMISSION_TOOL_NAMES`, `packages/domain/blueprint/src/index.ts`) names no agent-control tool. An L4 world needs a pilot template with `default: ask` (#406 boot 4 precedent). Making the family usable under deny-default is a contract-vocabulary change, out of scope here. It is listed as an orthogonal follow-up, not as a blocker.
2. **Continuable children die with their member.** `host.ts:2281` passes `subagents: ctx.get('subagents')`. The archive procedure drains continuable descendants through `drainContinuableDescendants` (`upstream index.ts:342`; agent-bindings T12-M3 doc `:129-138`). This is what makes a continuable Tier A child acceptable. It still has to be **witnessed** (case `ac:archive-drains-child`).
3. **Grammar drift that must be fixed in the lane.** The family's `workflow` grammar is `{description, prompt}` (`agent-control-mechanics.mjs:110-112`). The native `workflow` grammar is `{script, meta{name,description,whenToUse?,phases?}, args?, run_in_background?}` (`upstream workflow/tool-workflow/src/index.ts:325-360`). The same-name, same-meaning takeover law requires the native shape. Likewise `list_agents` natively accepts `scope: children|descendants`; the family's `{}` grammar is a strict subset, which is acceptable but should gain `scope`.
4. **Fork stays one-shot.** The bundle ruling is explicit (`cordis.patch.yml:378-389`; ".agents/notes/…/2026-08-10-fork-children-stay-one-shot.md"). The family's `subagent_fork` grammar accepts `run_in_background`. With `true`, it must refuse typed and never map to `startContinuable('fork')`.

### F6 — Risk classes (used in each tool section)

| class | meaning | Tier A mitigation |
| --- | --- | --- |
| **R-AMP-TOOL** | the child holds a tool or resource the caller lacks | `toolFilter:{allow:[]}` forced by the port. No `tools` arm exists in any grammar. The visible list is witnessed |
| **R-AMP-ROUTE** | the child runs on a provider or model the caller does not (cost, data egress to another vendor) | no `agentOptions` is ever sent (in-process merge = parent route, `types.ts:164-171`). Any `provider`/`model`/`reasoning_effort` arm is refused by the Tier A ceiling |
| **R-AMP-LIFE** | the child outlives the call or the caller | one-shot first. Continuable only after `ac:archive-drains-child` is proven |
| **R-AMP-CODE** | code execution beyond the caller (`run_code` in PTC mode; the workflow script realm) | refuse in PTC mode; workflow gated on a realm-confinement probe |
| **R-AMP-QUOTA** | an LLM spend that the member quota/envelope does not count | disclosed. One-shot spend is bounded by the call; workflow is bounded by `maxTotalAgents` |
| **R-STEER-MEMBER** | steering or interrupting a vNext team member (bypassing `team_send_message`'s SD-GUARD) | the fence is derived from the caller's **subagent catalog**. Member sessions are not created through `subagents` (no `startContinuable`/`subagents.start` in `packages/runtime/src`), so they are never in it. The host adjacency/lineage check stays the second gate |
| **R-INVISIBLE** | a live agent that is absent from the Team roster or UI | disclosed. Children appear in upstream `list_agents`, not in the Team roster |

---

## 2. Per-tool design

All lane work below touches only these paths:

- `packages/tools/agent-control-family/**`
- `packages/tools/families/agent-control.mjs`
- `packages/tools/families/manifest.json` (digest rebook)
- the dist mirror (`scripts/place-dist-glue.mjs`)
- tests and evidence

**Protected-center diff = ∅** (scanner L1), unless a section explicitly says otherwise.

### 2.1 `list_subagent_models`

1. **Host face:** `llm.listProviders()` / `llm.listModels(providerId)`, the same seam the native tool uses (`upstream subagent/tool-subagent/src/list-models.ts:42-63`). The port leg **already exists** (`agent-runtime-port.mjs:132-141`). The #406 disclosure is "not booted live", not "no face".
2. **Caller authority:** not needed. This is an enumeration row with only `tool-invoke` and `meta(model-routes)` arms (`agent-control-mechanics.mjs:86`), and there is no mutation arm. The trusted identity is irrelevant to the answer. Optional hardening: when the Tier A ceiling is active, annotate the answer "spawn routes: inherit-only" so the listing does not invite refused overrides.
3. **Team-native alternative:** not needed.
4. **Minimal C2:**
   - **L4** `ac:models-positive` — the pilot calls `list_subagent_models {}` under `default: ask`. Witness: one Control row, settled once and consumed; the row RAN; the result's provider ids equal the host `llm.listProviders()` echo in the host log. Then `{provider:<id>}`, where the model list is non-empty.
   - **L3** `ac:models-schema-refused` — `{provider: 1}` or an unknown field returns the typed `agent-control-schema-refused` with zero Control rows, graded **PASS** on the refusal sentence.
   - **Risk:** read-only (**none** of R-AMP or R-STEER).
5. **Class: FEASIBLE-IN-LANE.** It needs a C2 boot only, plus at most the shape fix: `listModels(provider.id)` returns objects, so verify the `models` projection against the live answer.

### 2.2 `list_agents`

1. **Host face:** `subagents.listChildren(exec.agent.id, signal)` and `listDescendants(exec.agent.id, signal)` (`upstream index.ts:374,393`; the native body is at `list-agents.ts:152-167`). Replace the `agentTeams.listMembers` leg (`agent-runtime-port.mjs:120-131`). Optionally grow the grammar with `scope: 'children'|'descendants'` (the native default is children).
2. **Caller authority:** the identity is the trusted `exec.agent` (F2). It lists only the caller's own catalog, and the host keys it by the caller session. No grants are involved.
3. **Team-native alternative:** the vNext roster is already served by `team_list_members`. `list_agents` must **not** be repurposed into a member roster: that is a different object (MemberInstance), and #406's "vNext roster face" follow-up should be dropped as a misframing.
4. **Minimal C2:**
   - **L4** `ac:list-positive` — the pilot first runs a Tier A continuable `subagent` (see 2.3), then calls `list_agents {}`. Witness: the answer contains exactly that child id with a status; a second member's child is **absent**.
   - **L3** `ac:list-schema-refused` — `{scope:'everyone'}` returns the typed schema refusal with zero Control rows (PASS).
   - **Risk:** read-only. It leaks only the caller's own children (lineage-scoped by the host).
5. **Class: FEASIBLE-IN-LANE.** Without a child, L4 depends on lane 2 (continuable spawn). A **degenerate L4** (an empty list returned by the real face, RAN + consumed) can land in lane 1.

### 2.3 `subagent`

1. **Host face:**
   - one-shot: `subagents.start('spawn', {label, prompt:[text], parent: exec.agent, signal: exec.signal, toolFilter:{allow:[]}})` (`index.ts:559`; `types.ts:145-198`);
   - continuable: `subagents.startContinuable({provider:'spawn', label, request:{prompt, parent, toolFilter:{allow:[]}}, signal})` (`index.ts:261`; `types.ts:32-50`). `toolFilter` persists in the continuable descriptor, so it also survives cold resume.

   Replace the `agentTeams.spawnTeammate` leg (`agent-runtime-port.mjs:160-205`).
2. **Caller authority:**
   - **Tier A (in-lane):** the build-time ceiling F3(a) is fed to the existing `authorityBounded` fence (`agent-control-executor.mjs:96-101`).
     - `provider`, `model` and `reasoning_effort` refuse as `agent-control-amplification-refused`. This replaces today's "no snapshot" refusal with a *meaningful* refusal.
     - `run_in_background: true` is admitted only once lane 2 flips `continuable: true` in the ceiling.
     - The port **forces** `toolFilter:{allow:[]}` and sends no `agentOptions` or `persona`. It refuses `agent-control-child-ptc-refused` when the caller's scope is not `native` mode. Detection: `run.localAgent` / child tool view witness, or refuse when `exec.agent` reports PTC mode (to be decided by C1 against the public Agent face).
     - Zero protected lines: the snapshot lives in `families/agent-control.mjs` `build`, exactly the #413 pattern (`agent-state.mjs:81-89`: the injected port wins, otherwise production is built from `cap` fields, otherwise the whole mount refuses).
   - **Tier B (a child with tools ≤ the caller):** needs F3(c) (the capability-key interface, 0 protected lines) **and** governed child tools (the protected `agent-bindings.mjs:2648` mount gate). **NEEDS-CENTER-INTERFACE.** Not recommended now.
3. **Team-native alternative (evaluated honestly):** `subagent` → `team_create_member` + `team_delegate` (`packages/tools/src/tools.ts:13-14,570-600`).
   - The created member's authority is the **template's** policy plus the Leader's overlay grants. It is never bounded by the *calling* member: `team_create_member` is "SD-CREATE: unguarded", with only quota, envelope and gates (`tools.ts:13,575`).
   - Preserving "child ≤ caller" would need a policy-lattice subsumption check: template policy ⊑ the caller's effective policy at call time. That requires F3(c) plus template-catalog access, and the family has **no** sanctioned route to the facade's create action. `teamRoot.mutation`/`.live` via `hostService` is the rejected F3(b).
   - Semantically it also diverges: a durable roster member with quota and archive duty is not an ephemeral child that returns its result to the caller.
   - **Verdict: rejected.** It would either amplify (template > caller) or need two center interfaces to emulate what the upstream face gives natively.
4. **Minimal C2:**
   - **L4** `ac:spawn-positive` — the pilot calls `subagent {description, prompt:"reply PONG"}`. Witness: Control row settled once and consumed; RAN; the child's final text is returned; the upstream `subagent/start` and `subagent/end` events are in the host log; and **`ac:child-toolview`**: the child transcript's tool list is empty (the mock lane asserts no tool definitions in the child's model request).
   - **L3** (each graded PASS on the typed sentence, zero `subagent/start`):
     - `ac:spawn-route-refused` — `{…, provider:'x'}` returns `agent-control-amplification-refused`;
     - `ac:spawn-replay-refused` — a second call under the same exec token returns `agent-control-replay-refused` (`executor:133-140`).
   - **Lane 2 L4** `ac:spawn-continuable` + `ac:archive-drains-child` — `run_in_background:true` returns `{childId}`; the Leader archives the member; the host log shows the child drained and released.
   - **Risks:** R-AMP-TOOL, R-AMP-ROUTE, R-AMP-LIFE, R-AMP-CODE (PTC), R-AMP-QUOTA (disclosed), R-INVISIBLE (disclosed).
5. **Class:**
   - **FEASIBLE-IN-LANE** (Tier A: tool-less, inherit-route; one-shot in lane 1, continuable in lane 2).
   - Tier B: **NEEDS-CENTER-INTERFACE** (protected `agent-bindings.mjs` + capability key), deferred.

### 2.4 `subagent_fork`

1. **Host face:** `subagents.start('fork', {label, prompt, parent: exec.agent, signal, toolFilter:{allow:[]}})`. The fork provider declares `toolFilter: true` (`subagent-fork-in-process/src/index.ts:63-72`) and seeds the completed-turn prefix (`:48-54`). This **refutes** the ledger's "forkChild has NO recognized public host face". The leg stays unwired today only because `agent-runtime-port.mjs:206-210` never looked at `subagents`.
2. **Caller authority:** the same Tier A ceiling as 2.3. The grammar has no route arm by design (`agent-control-mechanics.mjs:99-101`).
   - The **fork-context law** changes form. The context is now the provider's own seed of the caller's own log, so the family no longer ships context bytes and `forkContextProvider` becomes unused on this face.
   - The seed may contain approval or Control identifiers as text. With **zero tools**, an authority-shaped string in the seed is inert data, so the `scanContextAuthority` refusal is no longer needed on this path. Keep the guard for kit ports.
   - `run_in_background: true` refuses typed (F5.4).
3. **Team-native alternative:** none meaningful. A vNext member cannot be seeded with the caller's conversation.
4. **Minimal C2:**
   - **L4** `ac:fork-positive` — the pilot, in a turn after it has seen a token `K7Q` in a completed turn, calls `subagent_fork {description, prompt:"what token did we see?"}`. Witness: RAN; the child answers `K7Q` (proof of the inherited context); `ac:child-toolview` is empty.
   - **L3** `ac:fork-continuable-refused` — `run_in_background:true` returns a typed refusal with zero `subagent/start` (PASS).
   - **Risks:** R-AMP-TOOL (data visible to the child is the caller's own; zero tools makes it inert), R-AMP-CODE (PTC), R-AMP-QUOTA (a large seeded context).
5. **Class: FEASIBLE-IN-LANE** (lane 1, together with `subagent`).

### 2.5 `send_message`

1. **Host face:** `subagents.sendMessage(exec.agent, targetId, [{type:'text',text}], {signal})` (`index.ts:279`; native at `tool-subagent-control/src/index.ts:57-70`). The host enforces direct-parent or direct-continuable-child adjacency and cold-resumes an absent direct child. Replace the `agentTeams.sendMessage` leg (`agent-runtime-port.mjs:142-150`).
2. **Caller authority:** the steer authority is lineage, not a grant. The family's advisory fence (`agent-control-executor.mjs:89-95`) currently needs an injected roster (`injected.agentScope`, fail-closed `scopeMembership`, `agent-control-mechanics.mjs:222-237`). In the lane:
   - Derive the roster **at call time** from `subagents.listChildren(exec.agent.id)`. Admit only the caller's **direct children** (strictly narrower than the host, which also admits the direct parent).
   - The authoritative second gate stays the host's adjacency check.
   - This is a host-public read keyed by the trusted caller: **0 protected lines.**
   - Mechanics change: `scopeFence` accepts a resolver `async (caller) => {members}` in addition to the static object (lane file).
3. **Team-native alternative:** steering *team members* is already `team_send_message` (guarded on the recipient, SD-GUARD, `tools.ts:16-17`). `send_message` must never reach members (R-STEER-MEMBER). This design keeps that separation, which resolves the #406 worry "would steer a live member": the target set is the caller's own subagent children, by construction.
4. **Minimal C2** (needs lane 2's continuable child):
   - **L4** `ac:steer-positive` — spawn a continuable child, then `send_message {agent_id:<child>, message:"reply ACK2"}`. Witness: `messageId` returned; the child log shows a turn with ACK2.
   - **L3:**
     - `ac:steer-member-refused` — the Leader targets a **member's session id** and gets `agent-control-scope-foreign` (not in the catalog), zero Control rows, zero delivery (PASS).
     - `ac:steer-sibling-refused` — member A targets member B's child and gets the same refusal (PASS).
   - **Risks:** R-STEER-MEMBER (mitigated by the catalog fence plus host adjacency); waking an idle own child spends tokens (R-AMP-QUOTA, disclosed).
5. **Class: FEASIBLE-IN-LANE** (lane 3; depends on lane 2).

### 2.6 `interrupt_agent`

1. **Host face:** `subagents.interrupt(targetId, {kind:'ancestor', agent: exec.agent})` (`index.ts:328`; `types.ts:65-67`; native `tool-subagent-control/src/index.ts:98-110`). The host throws `UNAUTHORIZED` off-lineage. An absent target is an **accepted no-op**, so a return value can never be the L4 witness. Replace the `agentTeams.interrupt` leg (`agent-runtime-port.mjs:151-159`).
2. **Caller authority:** lineage, as in 2.5. The call-time fence uses `listDescendants(exec.agent.id)`; the native semantics are "your direct child or a deeper descendant". Zero protected lines.
3. **Team-native alternative:** interrupting a team member is a Leader/Control concern, not this tool's. No alternative is needed.
4. **Minimal C2** (needs lane 2):
   - **L4** `ac:interrupt-positive` — spawn a continuable child with a long task, then `interrupt_agent {agent_id:<child>}`. Witness (state, not return value): a host `subagent/end` with `stopReason:'aborted'` for that child, **and** `list_agents` showing `inactive` afterwards.
   - **L3:** the already-PROVEN `ac:interrupt-foreign-zero` (re-run on the new fence), plus `ac:interrupt-member-refused` (the Leader targets a member session id and gets `scope-foreign` with zero reach) (PASS).
   - **Risk:** stopping an agent you do not own is mitigated by the fence plus host lineage; R-STEER-MEMBER.
5. **Class: FEASIBLE-IN-LANE** (lane 3).

### 2.7 `workflow`

1. **Host face:** `workflowEngine.start({script, meta, args, subagentProvider, maxTotalAgents, parent: exec.agent, signal})` (`workflow/workflow/src/runtime-types.ts:19-34`; `index.ts:157-168`). The engine starts every `agent()` child itself through `subagents.start(provider, …)` **with no `toolFilter`** (`workflow/workflow-ptc/src/host.ts:197-211`). The family's per-leg delegates (`agent-control-executor.mjs:196-230`) can therefore **never** be inserted into the engine. That part of the #406 design is unrealizable on this face and must be replaced.
2. **Caller authority:** in-lane realization through two public faces.
   - **(i)** On the first workflow call (`hostService` is bound only after `mount`, `team-tool-plane.mjs:2048`), register a per-mount **governed provider** through `subagents.registerProvider(…)` (`index.ts:512`), named `dsh-team-gov-<instanceId>-<nonce>`.
     - Its `start(resolved)` admits only requests whose `parent` is the `exec.agent` of a currently-walked workflow correlation; anything else refuses.
     - It re-runs `authorityBounded` against the Tier A ceiling on `resolved.agentOptions`.
     - It forces `toolFilter:{allow:[]}`, strips `persona`, and delegates to `subagents.getProvider('spawn').start({...resolved, toolFilter})`.
     - Its `prepareContinuable` is absent: workflow children stay one-shot.
     - The disposer is released in the family `teardown` (`family-assembly.mjs` `BUILT_KEYS` allows `teardown`).
   - **(ii)** Call the engine with `subagentProvider: <that name>` and a family-chosen `maxTotalAgents` ceiling. A request arm that tries to override either is refused by `workflowEffectWorld` (`agent-control-mechanics.mjs:309-321`). This is zero protected lines.
   - **(iii)** **Gate:** the script body runs in a sandboxed Node PTC process under the **parent session's upstream sandbox policy** (`workflow-ptc/src/index.ts:103,124,160-166`). That is not the vNext policy. If the script realm can reach fs, process or network beyond a tool-less child, the workflow carries code authority the governed caller may lack (R-AMP-CODE). `WorkflowStartRequest` has no per-run sandbox override (`runtime-types.ts:19-34`). C1/C2 must therefore prove confinement before any positive arm ships. If confinement fails, the row stays a typed refusal permanently at this pin.
   - **(iv)** Re-grammar to the native `{script, meta, args?}` (F5.3). `run_in_background` (jobs-backed in the native tool, `tool-workflow/src/index.ts:274-288`) refuses typed in the first cut.
3. **Team-native alternative:** a Leader can already orchestrate members with `team_delegate`/`team_collect` (async by default). That is the governed fan-out with real tools. `workflow` adds reasoning-only fan-out. Recommend documenting `team_delegate` as the tool-carrying path rather than inventing a member-backed workflow.
4. **Minimal C2:**
   - **Confinement probes** (graded on the outcome; any reach = FAIL and the row is disclosed permanently):
     - `ac:wf-realm-confined` — a script tries `require('fs')`, `process.env`, `fetch`, `import('node:child_process')`. Witness: each throws inside the realm, and the workflow result is `error` or a value naming the failures; zero files are touched (a sentinel file hash is unchanged).
   - **L4** `ac:wf-positive` — the script returns `await agent('reply PONG')`. Witness: RAN; value `PONG`; the host log shows `workflow/agent-start` with the **governed provider name**; the child tool view is ∅.
   - **L3:**
     - `ac:wf-provider-override-refused` — `{…, subagentProvider:'spawn'}` is not in the grammar and refuses with zero `workflow/start` (PASS);
     - `ac:wf-foreign-parent-refused` — a direct call into the governed provider with a non-walked parent refuses with zero children (C1, with a C2 witness through the host log).
   - **Risks:** R-AMP-CODE (decisive), R-AMP-QUOTA (bounded by `maxTotalAgents`), R-AMP-TOOL (forced filter), and a global name squat (a host-wide provider registration; mitigated by the per-mount unique name and the parent check).
5. **Class: FEASIBLE-IN-LANE, conditional.** It is the last lane and is gated on `ac:wf-realm-confined`. If the probe shows reach: **DISCLOSE-PERMANENTLY-AT-THIS-PIN** (there is no public per-run sandbox override; anything else would be a host patch).

---

## 3. Classification table

| tool | host public face @639ed01539 | caller-authority source | team-native alt | class |
| --- | --- | --- | --- | --- |
| `list_subagent_models` | `llm.listProviders/listModels` (`tool-subagent/src/list-models.ts:42-63`) | not needed (read-only meta) | — | **FEASIBLE-IN-LANE** |
| `list_agents` | `subagents.listChildren/listDescendants` (`subagent/src/index.ts:374,393`) | trusted `exec.agent` (lineage) | `team_list_members` is a different object; do not merge | **FEASIBLE-IN-LANE** |
| `subagent` | `subagents.start('spawn')` / `startContinuable` (`index.ts:559,261`) + `toolFilter` (`types.ts:192`) | Tier A ceiling built in `build` (0 protected lines, the #413 pattern) | member creation **rejected** (template authority ≠ ≤ caller; no sanctioned route) | **FEASIBLE-IN-LANE** (Tier A) · Tier B with tools = NEEDS-CENTER-INTERFACE (deferred) |
| `subagent_fork` | `subagents.start('fork')` (`subagent-fork-in-process/src/index.ts:48-95`) | Tier A ceiling | none | **FEASIBLE-IN-LANE** |
| `send_message` | `subagents.sendMessage` (`index.ts:279`) | `exec.agent` + call-time catalog fence (`listChildren`) | `team_send_message` stays the member path | **FEASIBLE-IN-LANE** (after continuable spawn) |
| `interrupt_agent` | `subagents.interrupt(…,{kind:'ancestor'})` (`index.ts:328`) | `exec.agent` + call-time `listDescendants` fence | — | **FEASIBLE-IN-LANE** (after continuable spawn) |
| `workflow` | `workflowEngine.start` (`runtime-types.ts:19-34`) + `subagents.registerProvider` (`index.ts:512`) | Tier A ceiling enforced inside a per-mount governed provider | `team_delegate` fan-out for tool-carrying work | **FEASIBLE-IN-LANE, conditional** on `ac:wf-realm-confined`; else **DISCLOSE-PERMANENTLY-AT-THIS-PIN** |

**No tool is a CORE_SEAM_BLOCKER.** Every positive arm above uses only upstream public services and needs **0** protected-center lines. The only NEEDS-CENTER-INTERFACE item is the optional Tier B (a child carrying tools under the caller's real grants). It needs:

- the `callerAuthorityFacts` capability key (`family-assembly.mjs:61-74` + `team-tool-plane.mjs:1610-1632`; not in the protected ledger, but a capability-surface widening, so it belongs in a named interface PR);
- a plane mount on non-member child sessions (protected `agent-bindings.mjs:2648`).

---

## 4. Recommended order of implementation lanes

Every lane is one task, one branch, one worktree and one writer, with **zero protected-center diff** (scanner L1 receipt in the PR body). It touches `packages/tools/agent-control-family/**`, `families/agent-control.mjs`, the manifest digest, the dist mirror, tests and evidence. C2 budget: 3 boots per lane (#406 precedent: cap declared up front, an over-budget boot needs main-agent grant).

1. **Lane AC-1 — re-target the port + Tier A, one-shot** (`list_subagent_models`, `list_agents`, `subagent` one-shot, `subagent_fork`):
   - Replace the `agentTeams` legs with the `subagents`/`llm` legs. Delete the `face-cannot-carry` provider-required arm (wrong-face artifact).
   - Add the Tier A ceiling in `build` (`cap.injected?.callerAuthority ?? TIER_A_CEILING`). Force `toolFilter:{allow:[]}`, add the PTC-mode refusal, refuse fork `run_in_background`, and add `scope` to the `list_agents` grammar.
   - C1: port shape against the pinned types; a mutation control proving that removing the forced filter turns `ac:child-toolview` RED.
   - C2: `ac:models-positive`, `ac:list-positive` (degenerate/empty acceptable here), `ac:spawn-positive` + `ac:child-toolview`, `ac:fork-positive`, `ac:spawn-route-refused`, `ac:fork-continuable-refused`, `ac:models-schema-refused`, plus the existing `ac:mounted` / `ac:leak-check` / `stable-instance-unchanged`.
   - Ledger: L3/L4 for 4 rows. Refusals must be graded **PASS** when the expected sentence appears; this fixes the #406 grading gap noted on the `subagent` row.
2. **Lane AC-2 — continuable spawn:** flip `continuable:true` in the ceiling. C2: `ac:spawn-continuable`, `ac:archive-drains-child`, and `ac:list-positive` with a real child. Book the R-INVISIBLE disclosure.
3. **Lane AC-3 — steer + interrupt:**
   - call-time catalog fences (`listChildren` for steer, `listDescendants` for interrupt);
   - the `send_message`/`interrupt` legs;
   - C2: `ac:steer-positive`, `ac:steer-member-refused`, `ac:steer-sibling-refused`, `ac:interrupt-positive` (state witness), `ac:interrupt-member-refused`, `ac:interrupt-foreign-zero` re-run.
4. **Lane AC-4 — workflow:**
   - **AC-4a**, first and alone: the confinement probe `ac:wf-realm-confined`. If it fails, write the DISCLOSE-PERMANENTLY ledger entry and stop.
   - If it passes: the governed provider (register/teardown), the native grammar, the `subagentProvider` + `maxTotalAgents` pinning, and C2 `ac:wf-positive` / `ac:wf-provider-override-refused` / `ac:wf-foreign-parent-refused`.
5. **(Deferred, only on a product ruling) Lane AC-B — Tier B:**
   - first a named center-interface PR for `callerAuthorityFacts` (non-protected plane/assembly files, additive key);
   - then a separate protected-file interface PR for governed child mounts in `agent-bindings.mjs` (ledger override entry required).
   - Not recommended at this pin: Tier A covers the native semantics' useful core, and `team_delegate` already carries governed, tool-bearing delegation.

**Orthogonal follow-up** (not a lane of this family): the deny-default posture (F5.1). Agent-control can never run under `default: deny` until the blueprint rule grammar names it. This is a contract-vocabulary decision for the user, not a seam blocker.

---

## 5. Open questions the lanes must settle by C1/C2 (stated, not assumed)

- **Q1 — the child's own-scope registrations** (`core/tools/src/index.ts:1203-1208`). Which plugins, if any, register scoped tools on every new Agent? `ac:child-toolview` decides. Anything non-empty and non-inert must be refused (fail closed).
- **Q2 — detecting PTC mode for the caller from the public Agent face.** If it is not detectable, Tier A refuses spawn when `run_code` appears in the child tool view (the witness is moved into the port as a post-start check that disposes the run).
- **Q3 — whether `llm.listModels` answers an array of objects or strings at the pin.** The lane adjusts the projection to the measured shape.
- **Q4 — whether the governed member's `exec.agent.id` equals the session id whose catalog `listChildren` reads.** It should, because the native tool uses `parent.id` (`list-agents.ts:152-161`); C1 pins it.
