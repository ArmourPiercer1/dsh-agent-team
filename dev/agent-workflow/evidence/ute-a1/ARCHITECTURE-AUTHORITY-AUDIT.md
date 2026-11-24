# ARCHITECTURE AUTHORITY AUDIT — the two assembly entries vs the ONE centre

**Task:** external architecture review `20261124-1341` §3.3 — *independent responsibility audit of the two big
assembly entries to confirm there is no hidden second execution authority*, i.e. that no code path in them can
let a **tool call, provider effect, process, or agent turn** run without passing the ONE centre
(admission → provider/OS boundary → settlement), and that **no second registry/mount/executor can be selected by
configuration**.

**Round:** 103 · **Tree:** `.worktrees/vnext-a1-cut` @ `f880370d2` (branch `vnext/a1-cut`) · **Date:** 2026-11-24
**Files audited (line-exact, this HEAD):**

| File | Lines | Role |
|---|---|---|
| `packages/runtime/src/plugin/vnext/root.ts` | 5,239 | the production ROOT factory (`createTeamProductionRoot`): Team domain wiring, control plane, lifecycle, remote surfaces, team tools, boot |
| `packages/runtime/src/plugin/vnext/agent-bindings.mjs` | 4,397 | the live AGENT bindings factory (`createAgentBindings`): every agent create/resume, the member realm/centre composition, delivery ports |

**Verdict: SINGLE-AUTHORITY.** No second execution authority, no second admission decision, no second
native-mount registry, no second executor selection, and no config key that disables the centre while leaving
controlled tool execution enabled *silently*. Two **latent, not-reachable-from-these-entries** shapes are
recorded in §8 as upgrades (neither is a path a row can select today). **Zero findings, zero product change.**

---

## 1. What "the centre" is, in code

The audit only means something if the centre has a precise address. It is a three-part object installed by
**one** function per member:

| Step | Component | Address | What it owns |
|---|---|---|---|
| admission | `installAdmissionPoint` via `tools.guard()` + `tools/pre-execute`/`tools/execute`/`tools/result` | `admission-port.mjs:367`, guard at `:1094`, pre-execute at `:998`, result at `:1056` | the decision (`admit()`, `admission.ts:395`) and its durable fact |
| provider/OS boundary | the confined provider realm (`installToolBindingRealm`, one `root.isolate('fs')` etc.) | `a5sf-realm-row.mjs:835` → `mountMemberA5sfRealm`, compiled answer frozen at `:991` | the *effect* runs on the substituted provider, and only after the guard |
| settlement + facts | `installExecutionFacts` / `createSettlementWriter` | `execution-facts.mjs:234`, `settlement-port.mjs:65` | the RUN record and its terminal settlement |
| composition | `installMemberExecution` → `installMemberCentre` | `member-execution.mjs:159`, `centre-install.mjs:197` | the ONE place the three above are wired together |

The decision law — the single place a controlled call can be allowed — is `admit()` in
`admission.ts:395-542`: no binding ⇒ refuse (`:401-405`); no declared axis ⇒ refuse (`:427-430`); PTC entry ⇒
refuse (`:455`); process tools require compiled tool-level authorization AND a ready executor (`:472-498`);
everything else is judged against the binding's compiled lane (`:519-541`). A tool name that is neither a centre
tool, a preserved host capability, an `mcp__*` name, nor in the closed `TOOL_AXES` table is **refused by name**
(`admission.ts:101-120`, `:427-430`) — a new family cannot become admitted by being forgotten.

**Key Host mechanic that makes the guard unavoidable (verified in the pinned Host source, not assumed):**
`tools.guard()` registers a scoped guard (`packages/core/tools/src/index.ts:384-398`), and the shared pipeline
runs `tools/pre-execute` → `checkGuards` → dispatch (`packages/core/tools/src/pipeline.ts:201-231`). **Every**
dispatch through the tools service — the agent loop's own, and any direct `tools.execute()` call — goes through
that one `prepare()`. There is no second dispatch path in the Host.

---

## 2. `root.ts` — execution-adjacent surfaces

Legend: **CENTRE** = passes through / feeds the one centre · **CENTRE-INPUT** = supplies a decision the centre
consumes but may still refuse · **LAWFUL-DELIVERY** = management-plane delivery that executes no tool ·
**LAWFUL-HOST** = host-owned code outside the Member centre by design (leader plane) · **LAWFUL-NOEXEC** =
durable write / read only · **LAWFUL-CONTAIN** = can only remove authority or block · **LAWFUL-REFUSAL** = the
outcome is a refusal, never an allow.

| # | Surface (line range) | What decides whether it runs | The centre call / interlock it passes through | Verdict |
|---|---|---|---|---|
| R1 | host-surface refusal point construction (`1038-1041`) | `config.centreStatePath` is a non-empty string | refusal-only writer `createCentreHostSurfacePoint` (`row-refusal-entry.ts`); it records, it cannot allow | LAWFUL-REFUSAL |
| R2 | Alpha.6 enablement refusal / recorded refusal (`2501-2525`) | the three enablement pieces (`centre-config.ts:39-119`); a row missing one is refused by name | same refusal point; no review wake is dispatched | LAWFUL-REFUSAL |
| R3 | fresh/cold root binding (`1787-1994`, incl. `enforceCreationPreflight` `1818-1991`) | the boot/create entrance; `requirementFacts` presence for the preflight | none needed: durable Team identity only, and the preflight can only throw `COMPATIBILITY_BLOCKED` | LAWFUL-NOEXEC (block-only) |
| R4 | member residency `createFresh`/`rehydrateCold` (`1995-2010`) | the activation provider / domain callers | durable MemberInstance rows only; the **child Agent** is created through `live.childFactory` (→ B15 → B1) | LAWFUL-NOEXEC |
| R5 | activation provider construction (`2086-2133`) | every member creation | creates child sessions **only** via `live.childFactory` (`2128`), which is `agent-bindings.mjs:3048-3108` → `agentSetup` → centre | CENTRE (via B15) |
| R6 | lifecycle service + commit port (`2263-2328`) | archive/dispose/restore requests | `live.closeAdmission` / `live.interrupt` / `live.drainDescendants` (`2282-2295`) — the archive path installs the `MEMBER_CLOSED` tombstone (`centre-install.mjs:310-327`) | LAWFUL-CONTAIN |
| R7 | work-completion notifier (`2331-2364`) | a detached work unit reaches terminal settlement | delivery to the Leader session (`live.deliverRootWorkCompletionNotification`) | LAWFUL-DELIVERY |
| R8 | TeamRuntime facade / work chain (`2330-2417`; `workDelivery` at `2402`) | remote/tool request through the router | member work is **delivered** via `live.workDelivery` (→ B18); the member's own turn then has every call admitted | LAWFUL-DELIVERY |
| R9 | Alpha.6 wake dispatch + latch + turn-end rescan (`2613-3100`) | `alpha6Wiring.mode === 'alpha6'` **and** the durable control row routes a recipient | delivery through `live.deliverReviewWake` (→ B22 → `sessionInput`); zero management-plane executions (`ADM-143`, `D-ACCEPTANCE-REPORT` D4 row) | LAWFUL-DELIVERY |
| R10 | control service (`2418-3284`) — approvals, cases, review routing | a durable control row / an ask from a member | this is the **ask outcome** input: the centre passes it as `approvals` and then re-asks its own recheck, spends the one-shot grant and mints the receipt (`admission-port.mjs:860-995`). It cannot allow an effect by itself | CENTRE-INPUT |
| R11 | messaging coordinator (`3285-3292`) | `member.send` / coordinator request | delivery through `live.sessionInput` (→ B17, `followup`) | LAWFUL-DELIVERY |
| R12 | activity ledger (`3293-3299`) | work/activity events | ledger read/write only | LAWFUL-NOEXEC |
| R13 | fork reconciliation (`3301-3420`) | a fork | durable rows only | LAWFUL-NOEXEC |
| R14 | handoff service, `createAndStartTeam`, `createHandoffTeam` (`3421-3753`) | handoff / wire create / boot create | fresh-root bind + governance start gate (`3504-3517`, block-only) + `live.createRootAgent` (`3474`) — the **Leader** plane, outside the Member centre by design (see §6.4) | LAWFUL-HOST |
| R15 | legacy read-only session reader (`3754-3763`) | a read | none: `inspect` only | LAWFUL-NOEXEC |
| R16 | permission mutation lane + governance override admission (`3764-3792`, `3793-4185`) | operator/Leader mutation request | writes the durable overlay **generation** that the centre's own decision reads (`binding.policyGeneration`, `admission.ts:519-541`); it grants nothing directly | CENTRE-INPUT |
| R17 | projection service, principal derivation, live overlay (`4186-4343`) | reads | read-only; catches degrade a **view** (`4266`, `4293`, `4318`), never a decision | LAWFUL-NOEXEC |
| R18 | S6 remote command plane (`4345-4790`; refusal hook `4375-4391`) | the closed effect table `s6-command-classification.ts:52-235` + `refuseExecutionCommand` (`s6-remote.ts:4847-4850`) | a **governed** row: any `agent-execution` command (and any unclassified method, since `isS6ControlPlaneCommand` is false for it) is REFUSED and recorded before envelope/params/handler; `work-delivery` commands deliver into the member's own governed path. The plane has **no tool/provider port at all** | LAWFUL-REFUSAL / DELIVERY |
| R19 | intent surface / remote method catalog (`4791-4792`) | static | none | LAWFUL-NOEXEC |
| R20 | Team tool set construction (`4794-4824`) | row config / blueprint | **definitions only** (`createTeamTools`); registration happens once at B10, and every name is in the centre's closed `CENTRE_TOOL_NAMES` (`admission.ts:104-122`) | CENTRE |
| R21 | `boot()` (`4931-5082`) | `config.bootPhase` | create/resume + governance gate + boot prober (`5055-5057`) then `live.boot()` (`5081`) → B16 → `agentSetup` → centre | CENTRE (via B16) |
| R22 | fixture seed (`4845-4916`) | `fixtureWorld` opt-in or legacy non-empty `seedMembers` | durable rows only; the real Agent is still created by `live.boot()` | LAWFUL-NOEXEC |
| R23 | governance start gate (`3504-3517`) | `params.governanceWarning` (absent ⇒ disclosed-ungated test world) | can only throw a typed refusal | LAWFUL-CONTAIN |
| R24 | per-root compatibility prober / authority (`1499-1533`, `2158-2205`) | a consultation | can only block new work; no tool dispatch | LAWFUL-CONTAIN |
| R25 | `close()` (`5084-5108`) | stop | teardown (no `close` path can start anything) | LAWFUL-CONTAIN |

**root.ts has no tool registration, no `tools.execute`, no `spawn`/PTY/subprocess reference, no realm/provider
construction, and zero `a5sf` references** (§7 S1–S6). It cannot execute a controlled effect at all: its only
outward execution surfaces are *delivery* (R7–R9, R11), *creation delegation* (R5, R14, R21) and *authority
removal* (R6, R25).

---

## 3. `agent-bindings.mjs` — execution-adjacent surfaces

| # | Surface (line range) | What decides whether it runs | The centre call / interlock it passes through | Verdict |
|---|---|---|---|---|
| B1 | **`agentSetup`** (`1629-2119`) — the ONE place a session's tool plane is composed | every `agents.create` / `agents.resume` passes a setup produced here: **9/9 call sites** (`2608`, `3084`, `3103`, `3156`, `3160`, `3185`, `3235`, `3620`, `3629`); the only two `agents.*` calls in the file are `:1004` / `:1022` | composite — sub-surfaces below | CHOKEPOINT |
| B2 | realm mount (`1770-1791`) | `a5sfRealmConfigOf(config) !== undefined` **and** a provider is present **and** `sessionId !== teamRoot` | `mountMemberA5sfRealm` (`a5sf-realm-row.mjs:835`); a mounted realm always carries a frozen compiled answer (`:991` + `compiledAnswerOfRealm` `:364`), a `undefined` compiled answer returns **no realm** (`:880-906`) — the two facts cannot disagree | CENTRE (provider/OS boundary) |
| B3 | centre install (`1836-1864`) | `compiledAnswer !== undefined` (⇒ a realm was mounted) **and** `config.centreStatePath` — absent ⇒ **typed refusal** `MEMBER_CENTRE_UNWIRED` (`member-execution.mjs:109-121`) | `installMemberExecution` (`member-execution.mjs:159` → `centre-install.mjs:197`): admission point + fact ledger + settlement store + native mount handle | CENTRE |
| B4 | admission gate + governance REPORT (`1879-1888`) | the **mount result** (`a5sfMountedRealm !== undefined`), never the declaration (`centre-config.ts:161-199`) | governed+no realm ⇒ refuse; no centre configured ⇒ `{mode:'ungoverned', uteProtected:false}` + one observation (`1883-1886`), exposed at `4303` | CENTRE-GATE |
| B5 | model selection install (`1889-1918`) | the durable selection | none — no tool, no effect | LAWFUL-NOEXEC |
| B6 | preset base-tool mount (`1919-1956`, `presets.mount` at `1955`) | bind path; skipped when the preset is "already joined" | the centre is **already installed at B3, which is upstream of this mount** — the base definitions enter a scope that already has the guard | CENTRE |
| B7 | built-in tool deny lane (`1988-1990`) | `capabilities.selective` deny list | `tools.restrict` — can only remove names | LAWFUL-CONTAIN |
| B8 | route-C native attach (`2002-2004`) | row `a5sfNativeToolModules` **and** a mounted realm | `attachA5sfNativeToolModules` (`a5sf-realm-row.mjs:1170-1268`) → `realm.mountNativeToolModules`; the URL is refused unless it is a bare `@deepseek-ai/*` package (`realm-lane.mjs:24-25`, `:59-96`) | CENTRE |
| B9 | governed default native mount (`2017-2034`) | a compiled realm **and** the active preset's own rows (`governed-preset-modules.mjs:46-70`; every derivation failure is a typed refusal, never a guess) | `mountGovernedNativeToolModules` (`realm-lane.mjs:384-515` → `mountHostModules` `:119-256`): definition-identity proof per name, and `GOVERNED_NATIVE_SURFACE_CHANGED` refusal if the model-visible surface would move | CENTRE |
| B10 | team tool registration (`2043-2058`, `agentCtx.tools.register` `:2056`) | `capabilities.teamTools` | all 15 names are the centre's own closed set (`admission.ts:104-122`); a bound agent is allowed, an unbound one is refused | CENTRE |
| B11 | team skills registration (`2064-2071`) | `capabilities.skills` | `skill` is a preserved host capability (`admission.ts:161-169`); its host-service I/O is a stated limit, recorded | CENTRE (host-capability) |
| B12 | persona section install (`2072-2119`, `2120-2514`) | blueprint persona | prompt text only — no tool, no effect | LAWFUL-NOEXEC |
| B13 | MCP materialization (`1271-1566`, call at `2112-2114`; boundary at `3037`) | the template's `mcp` grant + the durable override, per server | transport is **always** `streamable-http` to a pre-configured `127.0.0.1:<port>` (`1513-1525`) — it starts **no process**; the resulting `mcp__<server>__<tool>` calls are admitted on the member's network axis, and refused unless that axis is `allow` (`admission.ts:415-425`) | CENTRE |
| B14 | `createTeamAgent` / `resumeTeamAgent` (`1002-1029`) | every session activation | the only two `agents.create`/`agents.resume` calls in the file, both with `setup = agentSetup(...)`; ownership-guarded by `runOwnedActivation` | CENTRE (via B1) |
| B15 | `childFactory.createChildSession` (`3048-3108`) | the activation provider | member child session created/resumed **only** with `setup: agentSetup(...)` (`3084`, `3103`) | CENTRE (via B1) |
| B16 | `boot()` (`3137-3426`) | `config.bootPhase` | root + every bound member resumed through `agentSetup` (`3156`, `3160`, `3185`, `3235`) | CENTRE (root half = B19/B20 leader plane) |
| B17 | `sessionInput.submitAttributedInput` (`3363-3416`) | the messaging coordinator / review-wake delivery | `prepareAgentForRequest` + `followup` (`3415`); the **recipient's** turn then runs its own governed tools | LAWFUL-DELIVERY |
| B18 | `workDelivery.deliver` (`3449-3548`) | the work chain | `prepareAgentForRequest` + `followup`/`steer` (`3503`, `3758-3760`) + `whenIdle` + materialize; no tool port | LAWFUL-DELIVERY |
| B19 | `createRootAgent` + root delivery ports (`3604-3700`, `root-delivery.mjs:28`) | handoff / wire create | Leader session — see §6.4 | LAWFUL-HOST |
| B20 | `deliverRootWorkCompletionNotification` (`3701-3785`) | a detached unit settles | Leader delivery (`followup`/`steer` `3758-3760`) | LAWFUL-HOST |
| B21 | `reviewWakeInbox` (`3786-3850`) | Alpha.6 latch recovery | Inbox **read/remove** only; unreadable is never "absent" | LAWFUL-NOEXEC |
| B22 | `deliverReviewWake` (`3855-3920`) + `review-wake-delivery.mjs` | Alpha.6 routing decision | delivery via `sessionInput` (`review-wake-delivery.mjs:1-30` states it explicitly: executes no tool, admits nothing, decides who reviews nothing) | LAWFUL-DELIVERY |
| B23 | `executeTool` (`4037-4095`) | a harness/route request | `handle.agent.ctx.tools.execute` (`4085`) on **the same `agent.ctx` the setup received** (`packages/core/agent-loop/src/index.ts:631`: `setup?.(agent.ctx, agent)`), therefore the same pipeline → `tools/pre-execute` (`admission-port.mjs:998`) → `checkGuards` (`:1094`). The file additionally refuses at the last moment after close (`4080-4083`) | CENTRE |
| B24 | `prepareAgentForRequest` + generation refresh (`2903-3045`, `2995-3045`) | every request boundary | re-reads durable truth and re-mounts MCP; no tool dispatch | LAWFUL-NOEXEC |
| B25 | `dropResidency` / `close` (`4012-4034`, `4108-4190`) | stop/archive | teardown order is itself a guarantee: native mount dispose (tombstone) **first**, then tool disposers, then the realm (`4130-4148`) | LAWFUL-CONTAIN |
| B26 | grant binder, approval port, overlay decision, Alpha.6 case producer (`574-654`, `1818-1835`) | config (`controlServiceRef`, `permissionOverlay`) | all four are **inputs to the centre** and can only narrow or refuse: the overlay `overlayDecision` can remove an allow (`overlay-decision.mjs`), the binder is spent once, the approval port produces the ask outcome, the case producer "executes nothing" (`alpha6-ask-case.mjs`) | CENTRE-INPUT |

---

## 4. The four specific questions

### 4.1 Is there a second place that can mount native tool modules? — **No (two lanes, both inside the centre block).**
All production `mountNativeToolModules` call sites (S4): the row-config lane (B8), the governed-preset default
lane (B9), and two **observe-only ownership probes** that are disposed immediately (`realm-lane.mjs:308`,
`a5sf-realm-row.mjs:1757`). Both real lanes sit inside the `if (compiledAnswer …)` block *after* B3, and both
funnel through `mountHostModules`/`realm-lane`, which refuses a non-`@deepseek-ai/*` URL by construction and
refuses a mount that does not change definition identity. There is no third mount seam in either file.

### 4.2 Is there a second thing that can decide allow? — **No.**
Every effect decision is `admit()` (`admission.ts:395`). Two adjacent "allow-ish" things were checked and are
not authorities:
* the **control service** (R10) decides an *approval*, which the centre consumes as one input and then
  re-checks, spends and receipts (`admission-port.mjs:860-995`);
* the **permission mutation lane** (R16) decides a durable overlay generation, which the centre reads as
  `binding.policyGeneration`; `overlayDecision` can only remove an allow (`member-execution.mjs` docs,
  `overlay-decision.mjs`).
Additionally the guard is **monotonic**: it is consulted after `tools/pre-execute`, and the admission
pre-execute listener deliberately does not override another listener's non-allow verdict (`admission-port.mjs:999-1001`),
so another plugin allowing earlier cannot cause an execution the guard has not judged.

### 4.3 Is there a config switch that disables the centre while leaving tool execution enabled? — **One, and it is the owner-ruled ungoverned row; it is reported, never silent.**
`centreStatePath` absent ⇒ `memberAdmissionGate` answers `{mode:'ungoverned', uteProtected:false}`
(`centre-config.ts:167-199`, used at `agent-bindings.mjs:1880`), one observation is written (`1883-1886`), the
live bindings expose it (`4303`), and owner ruling `20261124-0151` §Realmless (round 98) makes that the lawful
DEFAULT for a row that never asked for the centre. The **converse** is refused: a row that *asked* for the centre
but mounted no realm is refused `MEMBER_CENTRE_UNWIRED` on the mount result, and a row with a realm but no
`centreStatePath` is refused by `member-execution.mjs:109-121`. There is **no key** that turns admission off
while a realm exists.

### 4.4 Is a fallback used when the centre is absent? — **No fallback in the execution path; one latent shape (§8.1).**
`installMemberExecution` returns early only when `compiledAnswer === undefined`, which can only happen when no
realm was mounted — and in that case no member tool plane was installed on a confined provider either. The
native mount inside that module is *not* gated on a centre being installed; it is unreachable from these entries
(no caller passes `nativeSpecs`), which is §8.1.

### 4.5 Is the attribution-only async context used as an authorization input? — **No.**
The only `AsyncLocalStorage` in this area is the attribution-only carrier `attachGuardToolCallAttribution`
(`team-services/src/guard-observability.ts:198-260`), whose reader `currentGuardToolCallAttribution` has **zero
callers in the repository** (S8b) — it is write-only evidence. In the two audited files the attribution uses
(`3391-3410`, `3497-3502`, `4381-4385`) feed the Sticky-Stop / goal-authority classification, never a tool
decision. Admission's authorization data is a *value* (`Binding`) passed into `installAdmissionPoint`, not an
async-context lookup.

---

## 5. Verdict counts

| Verdict | root.ts | agent-bindings.mjs | cross-cutting | Total |
|---|---|---|---|---|
| CENTRE (passes/feeds/installs the one centre; incl. B1 chokepoint and B4 gate) | 3 | 14 | 0 | **17** |
| CENTRE-INPUT (supplies a decision the centre still judges) | 2 | 1 | 0 | **3** |
| LAWFUL-DELIVERY (management-plane, executes no tool) | 4 | 3 | 0 | **7** |
| LAWFUL-HOST (leader plane, outside the Member centre by design) | 1 | 2 | 0 | **3** |
| LAWFUL-NOEXEC (durable/read only) | 8 | 4 | 0 | **12** |
| LAWFUL-CONTAIN / BLOCK (can only remove authority or refuse) | 4 | 2 | 0 | **6** |
| LAWFUL-REFUSAL (the outcome is a refusal) | 3 | 0 | 0 | **3** |
| CONFIG-UNGOVERNED (owner-ruled, reported) | 0 | 0 | 1 | **1** |
| NOT-REACHED (latent shape, unreachable today) | 0 | 0 | 1 | **1** |
| **FINDING (P0/P1)** | **0** | **0** | **0** | **0** |
| **Total surfaces** | **25** | **26** | **2** | **53** |

Cross-cutting: **X1** = the `centreStatePath`-absent ungoverned row (§4.3) · **X2** = the `nativeSpecs` mount in
`member-execution.mjs:207-224` (§8.1).

---

## 6. Boundaries stated, not hidden (not findings)

These are real limits of the audited design. Each is either ruled or disclosed elsewhere; none is a second
authority, and none was introduced by this round.

1. **The centre is Member-scoped.** `sessionId !== teamRoot` (`agent-bindings.mjs:1770`) is a load-bearing
   condition: the Leader/root session gets no realm, no admission point and no settlement. The Leader's tool
   calls run under the Host's own permission model — the same plane the Host gives any agent. This is the
   design's governance unit (a Member), and it is why the S6 plane (R18) can be a management plane for a
   governed row. A governed row's **Leader** is therefore not UTE-protected; that is a scope statement the
   matrix already carries (member-level rows only).
2. **Host-capability tools are admitted, not lane-bounded.** `skill`, `todo_write`, goal tools, `subagent`,
   `send_message`, `interrupt_agent` (`admission.ts:161-169`) are allowed for a bound agent and recorded, with
   the host-service I/O declared as outside the member's ceiling. For `subagent` the law is that **the child's
   own binding governs the child's tools** (`CAPABILITY-MATRIX-C.md:34`, `D-ACCEPTANCE-REPORT.md:328`).
3. **MCP tool effects are unknowable to the centre.** The centre judges the server name on the network axis
   only; the server's own I/O is out of reach. Refused unless the network axis is `allow`.
4. **Delivery starts turns; it does not execute tools.** B17/B18/B22/R7–R11 hand input to an agent's own loop.
   Every tool call inside the resulting turn still meets the guard. `ADM-143` measures "zero management-plane
   executions" for the routed wake.
5. **The work-admission gate is a different object with a colliding name.** `packages/runtime/admission/index.js`
   (imported by `root.ts:203-207`) is the **new-work compatibility** gate (`admission/gate.ts:86`), not the UTE
   centre; it decides whether *work* may be created and cannot allow a tool call.

---

## 7. Searches run (reproducible; raw log = `round103/searches.log`)

All searches were run at `f880370d2` over exactly the two files unless stated.

| # | Search | Result |
|---|---|---|
| S1 | `child_process\|execFile\|execSync\|node:child_process\|spawn(` | **0** in both files — neither entry can spawn a process or PTY |
| S2 | `\.register(` | **1** — `agent-bindings.mjs:2056` (team tools only); `root.ts` **0** |
| S3 | `tools\.execute` | **1** call site — `agent-bindings.mjs:4085` (B23); `root.ts` **0** |
| S4 | `mountNativeToolModules\|hostNativeSpecs\|mountHostModules\|mountGovernedNativeToolModules\|attachA5sfNativeToolModules` | 2 real lanes (`2003`, `2018`) + 2 observe-only probes (other files) — no third |
| S5 | `installToolBindingRealm\|mountMemberA5sfRealm\|createProductRealmProvider\|isolate(` | **1** realm construction (`1771`); `root.ts` **0** |
| S6 | `installMemberCentre\|installMemberExecution\|installAdmissionPoint\|createControlApprovalPort\|createSettlementWriter\|installExecutionFacts` | **1** centre composition (`1839`); `root.ts` **0** |
| S7 | `memberAdmissionGate\|admissionModes\|centreStatePath` | gate `1880`, report map `766`/`4303`; `root.ts` only the refusal-point wiring `1036-1041` and `2510` |
| S8 | `AsyncLocalStorage\|getStore\|attribution\|machineInputs` | no ALS in either file; attribution only for Sticky-Stop/goal authority (`3391-3410`, `4381`) |
| S8b | `currentGuardToolCallAttribution` repo-wide | **0 readers** (write-only evidence) |
| S9 | `catch` | `root.ts` 17, `agent-bindings.mjs` 25 — every one inspected; none wraps a centre install, a realm mount, a guard, or a tool dispatch (see §7.1) |
| S10 | `agents\.create(\|agents\.resume(\|\.plugin(` | `1004`, `1022` (both `agentSetup`), `1513` (MCP client, HTTP transport) |
| S11 | `\.followup(\|\.steer(\|\.interrupt(\|cancel(\|submitAttributedInput` | delivery/turn-control only (`3415`, `3503`, `3512`, `3518`, `3758`, `3760`; `root.ts:2291`) |
| S12 | `a5sf` in `root.ts` | **0** — root.ts never touches realm/centre/policy compilation |
| S13 | `live\.[a-zA-Z]*` in `root.ts` | 27 distinct ports; all are delivery / boot / lifecycle / read (§2) |

### 7.1 The `try/catch` review, explicitly
Every `catch` in the two files was read. They fall into four classes, and **none** can skip the centre:
* **teardown** — dispose/close paths that swallow a dispose error (`agent-bindings.mjs:2153`, `2166`,
  `4136-4144`, `4153`, `4168`, `4180`; `root.ts:4316-4318`); swallowing a dispose failure cannot start an
  execution;
* **durable bookkeeping / liveness** — Alpha.6 wake-latch Inbox remove/clear, the stale-generation sweep, and
  notification-failure reporting (`root.ts:2765-2782`, `2815-2824`, `3019-3058`, `3218-3225`;
  `agent-bindings.mjs:2986-2988`, `3791-3795`); every one either KEEPS a durable row for a retry or records a
  fault — none can produce an allow;
* **read/view degradation** — a projection/effective-config/model-state read that fails closes the *view*, not a
  decision (`root.ts:4266`, `4293`, `4318`, `4657-4673`, `4683-4694`; note `1826-1840` is a **throw**, not a
  swallow);
* **typed recovery with a narrower alternative** — the writer-held single retry (`agent-bindings.mjs:2632-2665`)
  rethrows every non-qualifying error and does exactly one retry.
No `catch` wraps `mountMemberA5sfRealm`, `installMemberExecution`, `installAdmissionPoint`,
`mountGovernedNativeToolModules`, `attachA5sfNativeToolModules`, or `tools.execute`.

---

## 8. Observations (not findings; no behaviour changed this round)

### 8.1 `member-execution.mjs` mounts native specs without checking that a centre was installed (latent)
`member-execution.mjs:207-224` runs `mountHostModules` whenever `nativeSpecs` is non-empty, **independently** of
whether a centre was installed (that block is outside the `compiledAnswer !== undefined` branch at `:109`).
Production cannot reach it: the only production caller (`agent-bindings.mjs:1839`) passes no `nativeSpecs`, and
every test caller either passes a compiled answer or no specs. It is therefore **NOT-REACHED**, not a path a
row can select. Suggested upgrade (later round, not this one): refuse `nativeSpecs` when no centre was
installed, or move the mount inside the centre branch — a three-line invariant that removes the whole class.

### 8.2 `root.ts` and `agent-bindings.mjs` both name an `admission` that is not the centre
`root.ts:203-207` imports the **new-work** compatibility gate as `admission`; `agent-bindings.mjs` uses
`admissionModes` for the governance *report*. Both are correct, and the collision is a navigation hazard for
exactly this kind of review. A rename is a product-code change and is **not** done this round; the
responsibility map (§9) names both.

### 8.3 Enforcement coverage is the matrix's business, not authority
The centre decides *allow* for every controlled name, but a controlled tool whose provider was not substituted
(e.g. a native module that declares no `fs`/`subprocess`/`web`/`terminals` inject, so it is not a candidate for
the governed mount) would execute on the base provider **with** a centre allow. This is the per-tool
`ENFORCE-PARTIAL` / `NOT_WIRED` axis of `TOOL-ACCEPTANCE-MATRIX.md`, and `bash` is the known instance (its module
injects `shell`, and the governed realm substitutes the shell service instead — the D4 live round measured the
governed PTY refusal). It is a **provider-substitution coverage** question, not a second authority: the decision
is still the centre's, and a refuse is still a refuse. Recorded here so the final review does not read the
surface table as an enforcement claim.

---

## 9. Responsibility map (for navigating the two entries; this is a map, not a refactor)

### 9.1 `packages/runtime/src/plugin/vnext/root.ts` (5,239)

| Lines | Concern | Owner of the decision |
|---|---|---|
| 1-279 | module header (the A-map / invariants), imports | — |
| 280-404 | A4-PR5 durable proposal store + late-bound approval port | durable governance |
| 405-501 | ephemeral mutation store (documented boot-world wiring) | mutation lane |
| 502-530 | blueprint capability-policy mapping | policy read |
| 531-673 | BQ-17/BQ-18 read surfaces | read-only |
| 674-1000 | factory params + exported pure helpers (`isExecutionAskLane`, `settlementCallIdOf`) | — |
| 1001-1049 | factory entry; **host-surface refusal point** (R1) | config + refusal |
| 1050-1054 | A02 handle / write ports | durable |
| 1055-1272 | A03 blueprint + catalog + migration classification | read |
| 1273-1288 | A03b bound snapshot ref | read |
| 1289-1291 | A07 leader identity | identity |
| 1292-1498 | fresh-read fact thunks | facts |
| 1499-1533 | A14/A15 compatibility prober + authority + work gate | block-only |
| 1534-1777 | A11-A13 the three overlay slots | read/derive |
| 1778-1786 | A10 binder | routing |
| 1787-1994 | A05/A06 root binding (fresh + cold) + creation preflight (R3) | durable + block |
| 1995-2010 | A08/A09 member residency (R4) | durable |
| 2011-2085 | the production `PolicyReader` | read |
| 2086-2134 | A16 activation provider (R5) | creates children → bindings |
| 2135-2157 | P8-S5B team operation coordinator | serialization |
| 2158-2205 | S1-H2 per-root prober factory | block-only |
| 2206-2262 | TCM §15.8 Root initial-work closure | delivery |
| 2263-2329 | A20/A21 lifecycle service + commit port (R6) | lifecycle |
| 2330-2417 | A17-A19 TeamRuntime facade / work chain (R8) | delivery |
| 2418-3284 | A25 control service (+ Alpha.6 wiring, latch, wake dispatch R9/R10) | approval input |
| 3285-3292 | A24 messaging coordinator (R11) | delivery |
| 3293-3300 | A26 activity ledger (R12) | durable |
| 3301-3420 | A27 fork reconciliation (R13) | durable |
| 3421-3447 | A28 handoff service | durable |
| 3448-3753 | T12-B6 create-and-start primitive + handoff creation + governance start gate (R14/R23) | host start |
| 3754-3763 | A29 legacy read-only reader (R15) | read |
| 3764-3792 | A22/A23 mutation service + governance override admission | mutation |
| 3793-3954 | pre-alpha3 PR4 permission lane (R16) | durable overlay |
| 3955-4057 | alpha.3 PR5 permission-change notification emitter | notification |
| 4058-4185 | pre-alpha3 PR4 permission lifecycle planes | durable overlay |
| 4186-4322 | A30 projection service (R17) | read |
| 4323-4344 | A32/A30 principal derivation + live overlay | read |
| 4345-4790 | A31/A33/A34 remote surfaces / S6 plane (R18) | effect table + refusal |
| 4791-4793 | A04 intent catalog (R19) | static |
| 4794-4825 | Team tool set construction (R20) | centre tools |
| 4826-4930 | boot docblock + fixture seed helper (R22) | durable |
| 4931-5083 | `boot()` (R21) | create/resume |
| 5084-5108 | `close()` (R25) | teardown |
| 5096-5239 | W3-B requirement-fact writers + the returned root object | read/write facts |

### 9.2 `packages/runtime/src/plugin/vnext/agent-bindings.mjs` (4,397)

| Lines | Concern | Owner of the decision |
|---|---|---|
| 1-355 | module header: the deps contract + the returned bindings surface | — |
| 356-573 | imports, module constants, helpers (`resolveSetupAgent`, `a5PlaneSubtreeContains`), factory signature + deps destructure | — |
| 574-602 | B: the ONE grant binder (B26) | centre input |
| 603-655 | R1 Alpha.6 case producer + the durable approval port (B26) | centre input |
| 656-718 | A5-M1 authority-generation reader | centre input |
| 719-831 | closure state (one row instance per boot) | state |
| 832-891 | single-flight activation + session identity / admission close | lifecycle gate |
| 892-1001 | C1 ownership-guarded activation wrappers | activation fence |
| 1002-1047 | `createTeamAgent` / `resumeTeamAgent` + writer-held detection (B14) | NEW/ RESUME |
| 1048-1270 | consumption-view resolution + boundary records | read |
| 1271-1437 | MCP materialization slots + capability witness (B13) | centre (network axis) |
| 1438-1567 | `reconcileMcpSet` (B13) | centre |
| 1568-1628 | template binding (bound blueprint, template locator) | read |
| **1629-2119** | **`agentSetup` — the tool-plane chokepoint (B1-B13)** | **the centre** |
| 2120-2514 | T12-M2 persona boundary (B12) | prompt |
| 2515-2767 | `ensureLiveAgent` (single-flight, writer recovery) | activation |
| 2768-2902 | requirement-aware final-input verdict | gate (block-only) |
| 2903-3045 | generation publish/refresh + `prepareAgentForRequest` (B24) | read |
| 3046-3119 | activation ports: `childFactory`, `sessionDurability` (B15) | creates children → B1 |
| 3120-3426 | `boot()` (B16) | create/resume |
| 3427-3445 | review-wake port | delivery |
| 3449-3548 | `workDelivery` (B18) | delivery |
| 3549-3785 | handoff root ports: `createRootAgent`, `deliverRootContext`, `deliverRootWork`, completion notification (B19/B20) | host leader plane |
| 3786-3920 | review-wake inbox + `deliverReviewWake` (B21/B22) | delivery |
| 3921-3983 | base-tool-unavailable readers + `resolveCaller` | read / authority |
| 3984-4035 | live-handle surface: `governanceAuthority`, `dropResidency` (B25) | authority read |
| 4037-4095 | the row-owned tool execution budget: `executeTool` (B23) | **the centre** |
| 4097-4190 | row-stop cleanup / `close()` (B25) | teardown |
| 4192-4397 | the returned bindings object (report, ports, classification) | — |

---

## 10. Method and limits (honest statement)

* Every **execution-adjacent** region was read in full: `agentSetup` (491 lines), the activation/boot/delivery
  region (1002-4190), and in `root.ts` the control service, lifecycle, work chain, remote plane, team tools and
  boot. The remaining prose-heavy regions were covered by whole-file symbol scans (S1-S13) and targeted reads
  at every match.
* The Host mechanics the argument leans on were read in the **pinned Host source**
  (`packages/core/tools/src/index.ts`, `pipeline.ts`, `packages/core/agent-loop/src/index.ts:631`), not recalled.
* This is an authority audit, not an enforcement proof: §8.3 states exactly where enforcement coverage (the
  provider substitution per tool) is measured elsewhere (`TOOL-ACCEPTANCE-MATRIX.md`).
* No product code was changed. The only artefacts of this round are this document, the responsibility map above
  and the gate logs under `round103/`.

**Verdict: SINGLE-AUTHORITY.** 17 surfaces pass through or install the one centre, 3 are centre inputs that the
centre can still refuse, 31 are lawful non-execution (delivery / host / no-effect / contain / refusal), 1 is the
owner-ruled ungoverned configuration and 1 is a latent unreachable shape. **No finding.**
