# A3 — D6 Team UI mode-open seam: characterization (v2)

- task: A3 (Wave A, Team D1-D6 repair v2)
- branch: `task/team-d1-d6-v2-A3` (worktree `.worktrees/team-d1-d6-v2-A3`)
- base: `2baad2f6aa3a5313b62251e15201eb96a830e1ee` (docs: P0-v2 baseline for Team D1-D6 repair v2)
- model_route: `qiyuan-self/qwen3.8-27b` — runtime declaration verified at session start: "You are a coding agent powered by the qwen3.8-27b model" (ROUTER_RULES §1.4). No route label is exposed via `DSH_*` env; model identity matches, so execution proceeded.
- host_sha: `76fda729799fe9b3848dbe2c211d4b231032b81e` (`references/deepseek-harness-test-use`, verified pristine: HEAD = that SHA, `git status --porcelain` empty at read time)
- mode: READ-ONLY characterization; no product code, remote methods, or files were added or modified. Only this evidence file.
- elapsed working time: see TaskResult.

Task question: can the v2 D6 approach (Team UI explicit **open-in-Team-mode** + **ordinary fallback**) be built from existing public seams WITHOUT any upstream change?

---

## Q1. LIVE-FIRST REOPEN (the crux) — VERDICT: YES

**Question.** If the Team glue resumes a persisted root via `agents.resume` (with the Team setup) while the session is NOT open in the UI, and then the user opens that session in the UI, does the upstream SessionController detect the already-live agent and REUSE it (keeping the Team setup and its registered `team_*` tools) instead of re-running an ordinary setup?

**Answer: YES — reuse is the upstream public behavior, on every ordinary entry point. No second agent can exist, by registry construction.**

### The decisive upstream code paths (host SHA `76fda72979`)

**(1) Ordinary resolve — the Web open / prompt / rename / selectModel path**
`packages/api/session-controller/src/agent.ts`, `ApiSessionAgentController.resolve()`:

```ts
// agent.ts L183-188
private async resolve(
  sessionId: SessionId,
  observation?: SessionObservation,
): Promise<ApiSessionAgentResult> {
  const live = this.liveAgent(sessionId)
  if (live !== undefined) return live        // <-- live-first short-circuit, BEFORE any compose/resume
```

```ts
// agent.ts L390-396
private liveAgent(sessionId: SessionId): ApiSessionAgentResult | undefined {
  const agent = this.ctx.agents.get(sessionId)
  if (agent === undefined) return undefined
  return hasApiSessionSubagentOwner(this.ctx, agent.session, agent)
    ? { error: apiSessionSubagentOwnershipError(sessionId) }
    : { agent }
}
```

`resolve()` (L183-222) only proceeds to `composeAgent()` + `ctx.agents.resume()` (L422-432 in `resumeObserved`) when `liveAgent()` returns `undefined`. A Team-glue-resumed agent is found by `ctx.agents.get(sessionId)` and returned as-is: **no `composeAgent`, no ordinary preset mount, no setup re-run**. The caller chain for a Web session is:
- first user prompt: `session/prompt` (`packages/api/session-controller/src/index.ts` L334-338) → `commands.ts` L299 `resolveAgent` → `agent.ts` L170-172 → `resolve()`;
- `session/selectModel` / `session/rename`: `commands.ts` L120 / L163 → same path;
- Typert agent/session lookups: constructor wiring `agent.ts` L148-157 → `resolveAgent`.

**(2) Create-or-adopt — the `session/create` path**
`packages/api/session-controller/src/agent.ts`, `createOrAdopt()`:

```ts
// agent.ts L435-446
private async createOrAdopt(
  sessionId: SessionId,
  cwd: string,
  checkPersistedIdentity: boolean,
  presetId: string | undefined,
): Promise<Agent> {
  const attached = this.ctx.sessions.get(sessionId)
  const live = this.ctx.agents.get(sessionId)
  if (attached !== undefined && hasApiSessionSubagentOwner(this.ctx, attached, live)) {
    throw new ApiSessionSubagentOwnership(sessionId)
  }
  if (live !== undefined) return live        // <-- adopt the already-live agent, no re-setup
```

(Entry: `index.ts` L242-245 `@Remote('create')` → `commands.ts` L73-95 `ensureSession(sessionId, cwd, request.sessionId !== undefined, request.agentPreset)` → `agent.ts` L232-269.)

**(3) Why `ctx.agents.get()` sees the glue's agent — and why no double agent is possible**
`packages/core/agent/src/index.ts`, `AgentRegistry` (the single process-wide service behind `ctx.agents`):

```ts
// core/agent/src/index.ts L250-251
export class AgentRegistry extends Service {
  private store = new Map<SessionId, AgentEntry>()   // one store, keyed by session id
```

```ts
// L469-477 (enter — the authoritative collision boundary)
enter(agent: Agent, owner: Agent | undefined): () => void {
  const id = agent.id
  if (id !== agent.session.id) { throw ... }
  const carrier = scopeTarget(agent, agent)
  // This is the authoritative collision boundary. Concurrent create/resume
  // operations may both prepare, but only one exact entry can publish.
  if (this.store.has(id)) throw new Error(`agent "${id}" is already registered`)
```

```ts
// L578-580 — creator-agnostic lookup
get(id: SessionId): Agent | undefined {
  return this.store.get(id)?.agent
}
```

`AgentRegistry.get()` is a plain map lookup: it does not know or care which caller ran `create`/`resume`. The Team glue and the SessionController share this ONE registry:
- glue construction receives the host service: `packages/runtime/src/plugin/host.ts` L678 `const agents = ctx.get('agents')` and L819-827 `glue.createAgentBindings({ agents, sessionPersistence, domain, config, teamToolsRef, ... })`.
- therefore a glue `agents.resume` publication lands in the same `store` the SessionController probes.

If any path ever did call `ctx.agents.resume`/`create` for an already-live id (race or bug), the factory publication hits `enter()` L477 and **rejects with `agent "<id>" is already registered`** — a second agent under one session id is structurally impossible. This is the invariant that makes "Team ↔ ordinary switching produces no double Team registration" (v2 plan G4 exit criterion 5) hold by construction.

**(4) The Team glue's own resume primitive (Team-owned, already exists)**
`packages/runtime/src/plugin/live/agent-bindings.mjs` `ensureLiveAgent()` (L820-849):

```js
async function ensureLiveAgent(sessionId) {
  const existing = liveAgents.get(sessionId)
  if (existing !== undefined) return existing          // already live in glue -> no re-setup
  if (!sessionIsDurable(sessionId)) {
    throw new Error(`p6t6: session '${sessionId}' is neither live nor durable ...`)
  }
  resumingSessions.add(sessionId)
  try {
    const teamRoot = teamRootOfSession(sessionId)
    const handle = await agents.resume({
      resumeSessionId: SessionId(sessionId),
      setup: agentSetup(
        sessionId, undefined, undefined,
        teamRoot !== undefined && teamRoot === sessionId ? 'cold-root' : 'cold-member',
        teamRoot,
      ),
    })
    liveAgents.set(sessionId, handle)
    return handle
  } finally {
    resumingSessions.delete(sessionId)
  }
}
```

For a persisted dynamic root, `teamRootOfSession(sid)` resolves the session to ITSELF (L342-353: "a session that carries its own durable TeamSession row IS a team root of this row and owns itself", via `domain.repositories.teamSessions.get(sid)`), so the resume runs `agentSetup(..., 'cold-root', sid)` — the Team setup that registers all ten `team_*` tools:

```js
// agent-bindings.mjs L564-569 (inside agentSetup, L543-591)
const teamTools = teamToolsRef.current
if (teamTools) {
  for (const def of teamTools.tools) {
    toolDisposers.push(agentCtx.tools.register(def))
  }
}
```

`ensureLiveAgent` is exported on the glue bundle (L1623) — it is the existing Team-owned "ensure root live with Team setup" primitive for any durable session (root or member), dynamic or boot root alike. (`createRootAgent`, L1202-1229, is the create-or-ensure variant used by `team.create`/handoff — resume-with-`'cold-root'` for durable roots, plus fresh-create + `ensureMaterialized`; it is already wired to the remote as `startRootAgent` for `team.create` only — `root.ts` L1541, `s6-remote.ts` L945-976.)

### Live-first verdict

The v2 pattern works end-to-end on public seams alone:

1. **(a)** client Team-mode entry → Team-owned remote call → glue `ensureLiveAgent(rootSessionId)` → `agents.resume({ resumeSessionId, setup: agentSetup(…,'cold-root',sid) })` → ten `team_*` tools registered → agent published in the shared `ctx.agents` registry.
2. **(b)** client opens the session via the ordinary `ctx.sessions.open(rootSessionId)` (Seam 3 — already wired in the mount, see Q3). History renders cold via `session/page` + `session/follow` (`index.ts` L376-390 — no agent resume). The first `session/prompt` (or any `resolveAgent`-backed command) hits `resolve()` → `liveAgent()` → **returns the Team agent verbatim** (agent.ts L187-188), Team setup and tools intact.

No upstream SessionController change, no private API, no interception: the reuse is the controller's own live-first design.

### Caveats (design constraints for Wave D — none is a blocker)

- **Ordering.** (a) must be awaited BEFORE the first `session/prompt`. If an ordinary prompt wins the race, `resolve()` resumes with the ordinary preset composition (agent.ts L398-432) and the session becomes a live ordinary agent; a later glue `agents.resume` for the same id then fails at `enter()` (core/agent L477, `already registered`). The new remote method must therefore **fail closed** with a typed error (e.g. `TEAM_ROOT_LIVE_OUTSIDE_TEAM`) in that state, and the UI must gate the Team-mode entry until (a) has succeeded. The Team-mode open command is therefore a 2-phase awaited client sequence: `await ensureRootLive(); ctx.sessions.open(root)`.
- **Ordinary fallback over a live Team agent.** "Open ordinary" on a root whose agent is ALREADY live with Team setup adopts that same live agent (agent.ts L188/L446): the `team_*` tools REMAIN registered. The ordinary entry is a promise of "no Team ensure is performed / no `team_*` tools are guaranteed", not a tool-removal operation. The mode badge must display which entry was used (v2 plan §1.1.5), and G4 criterion 5 is satisfied by construction (registry collision guard).
- **`session/create` with an explicit preset on a live Team root** is rejected: `ensureSession` post-checks (agent.ts L262-267) run `assertPresetUnchanged` (L511-518) against the session's `agentPreset` projection, which a Team root never has (the glue setup mounts no preset; `agents.create`/`resume` meta carries no `agentPreset`). The ordinary fallback must be the pure `ctx.sessions.open` path (which the Web open already is) — never `session/create` with a preset.
- **Cold ordinary open still works** without (a): the Team root session records a `cwd` (glue `meta.cwd` = effective root workspace / default workspace, agent-bindings.mjs L980-988, L1221-1225), so `resumeObserved`'s `cwd !== undefined` check (agent.ts L416-418) passes and the session reopens as an ordinary session with history — exactly v2 §1.1.4 ("ordinary session list stays ordinary by default").
- **`boot()` enumeration is NOT the mechanism.** `boot()` (agent-bindings.mjs L967-1060) resumes only `config.rootSessionId` plus that root's members (L985-1044); enumerating all `teamSessions.list()` roots at boot would change startup semantics (eager re-activation of every persisted root) and is outside the user-confirmed v2 semantics (explicit UI entry, plan §1.1.1-§1.1.3). Rejected alternative, recorded here.

---

## Q2. ENSURE-LIVE ACTION — no existing remote method; minimal Team-owned spec

**Existing surface check.** The frozen Team remote catalog is CLOSED: `packages/remote/src/contracts/catalog.ts` L11-15 ("Adding a method or category is a remote contract change (a version bump), never a silent edit"), L64-89 (23 v1 methods), L130 (`REMOTE_V2_ONLY_METHODS = ['team.admitInitialWork']` → 24 total). None performs "ensure a persisted root is live with Team setup". The only root-agent-start mechanism, `startRootAgent` = glue `createRootAgent`, is invoked exclusively inside `team.create` (`s6-remote.ts` L945-976; `root.ts` L1541; `host.ts` L818-827). The client transport mirrors exactly these 24 methods (`packages/client/src/transport/team-remote-client.ts` L78-167, L216-245); the generic `call(method, params)` (L93, L181-214) assembles the `{version, params}` envelope on the `/team-remote` channel.

**Verdict for Q2:** step (a) has NO existing remote method. The minimal addition is a **Team-owned** remote contract version bump (v3) — a `CONTRACT_CHANGE_REQUEST` scoped to `packages/remote` + `packages/runtime` + `packages/client`, with **zero upstream changes** (upstream public surface used: the `agents` service already injected into the glue, and the existing `/team-remote` channel registration that the Team dispatcher owns). This matches v2 plan Wave D task D2 ("Team-mode open/resume command", plan §12.D2 step 3: "use Team-owned `ensureLiveAgent`/equivalent public Team facade").

**Minimal spec (for Wave D, NOT implemented here):**

- Method name: `team.ensureRootLive` (category `team`, contract v3).
- Params (closed object): `{ teamSessionId: string }`.
- Host wiring:
  - `packages/runtime/src/plugin/s6-remote.ts`: new optional port `ensureRootLive?: (rootSessionId: string) => Promise<void>` in `S6RemoteOptions` (next to `startRootAgent`, L617); new handler case in the `team` category handler (`buildS6CategoryHandlers`, L1915+) that (1) re-asserts the P9-S8 bound/owned-root guard via the existing `assertBoundRoot('team.ensureRootLive', teamSessionId)` (L906-915; owned roots already include dynamic roots, `ownsRoot` L902-904, `isOwnedRoot` = `ownsTeamSessionRoot` = `repos.teamSessions.get(id) !== undefined`, `root.ts` L1475-1481/L1499), (2) fails closed with a typed error when the port is absent (mirror the D-3 `TEAM_CREATE_ROOT_START_UNAVAILABLE` pattern, L945-955), (3) wraps glue rejections into typed codes, including a distinct code when the session is already live outside the glue map (the `already registered` rejection of `agents.resume`, core/agent L477) and when the root has no durable session artifact (glue `ensureLiveAgent` L823-825).
  - `packages/runtime/src/plugin/root.ts`: wire `ensureRootLive: (sid) => live.ensureLiveAgent(sid)` in the `createS6RemoteSurfaces({...})` options (next to `startRootAgent: live.createRootAgent`, L1541). No glue change: `ensureLiveAgent` is already exported (agent-bindings.mjs L1623).
  - `packages/remote`: catalog v3 entry + closed param schema + version constant (the version-bump discipline of catalog.ts L11-15).
- Client wiring: `teamRemote.ensureRootLive(teamSessionId)` wrapper (stamps v3) in `team-remote-client.ts`; mount face in `team-mount-core.ts`: `openTeamMode = async (rootSessionId) => { await teamRemote.ensureRootLive(rootSessionId); ctx.sessions.open(rootSessionId) }` (the (a)→(b) sequence; `ctx.sessions.open` = existing Seam 3, mount L490-492).
- Response: success carries at least `{ rootSessionId, mode: 'team', live: true }` for the UI mode display (plan §12.D2 step 6).

---

## Q3. ORDINARY FALLBACK — existing public seam, already wired

**The seam.** `ctx.sessions.open(sessionId)` (public Seam 3, renamed `open`/`create`; `TeamSessions` face, `team-mount-core.ts` L184-206). Already wrapped and injected:

- `openSession(sessionId) => ctx.sessions.open(sessionId)` — `team-mount-core.ts` L489-492, injected into TeamView at L628 (`viewInject`).
- `openCreatedSession(sessionId)` (creation-path variant: open → on throw, `ctx.sessions.refresh()` + retry) — L494-509, injected at L535 (creation face) and L702 (NewTeamEntry face).
- `ensureProjection(sessionId)` (single-flight cold pull of the team projection) — L460-475, injected at L626/L637; `pullProjection(teamSessionId)` — L518-520.
- `openTeamTab` — L511-516, documented degraded no-op (Seam 4 ABSENT); NOT needed for D6 v2.

**Where the explicit actions attach (Team UI).** `TeamView` (the `conversation.view` slot entry, mount L656-668) receives `openSession` as `TeamViewInjected.openSession` (`TeamView.tsx` L103) and already passes it as `onSelectSession` to `TeamTimeline` (L338), `TeamMembers` (L348) and `TeamLedger` (L371) — today for member-session navigation only. The v2 entry points attach at:

- **"Open in Team mode / back to Leader"** — on the Team root (leader) row of the TeamView members section: the leader row is the member row with `childSessionId === null` whose navigation target is the root (`team-ui-snapshot.ts` L92-93, `TeamUiMemberInstance`), and/or on the root-picker rows fed by the Q4 ownership index (the zero-state / team-picker surface; `TeamView` zero state at `TeamView.tsx` L278-326 is the natural home for a persisted-roots list). Action = `openTeamMode` (Q2 spec).
- **"Open ordinary"** — same rows. Action = the existing `openSession(rootSessionId)` verbatim (pure Seam 3 open; no remote call; no `session/create` with preset — see Q1 caveat).
- **Current-mode display.** No field exists in the frozen projection for it (`TeamUiSnapshot`, `team-ui-snapshot.ts` L154-171, carries no open-mode fact; the projection is Team-side data). Per v2 §1.1.5 the mode must be displayed; it is **client-local UI state** (per-root mode map in the mount, e.g. next to `projectionStores`/`ledgerOpened`, `team-mount-core.ts` L357-363): `team` when the Team-mode entry completed (a)+(b), `ordinary` when the ordinary entry was used, reset on session switch. No new remote field, no upstream involvement. Locale copy in `packages/client/src/ui/locales.ts`.

---

## Q4. OWNERSHIP INDEX — minimal read-only query; NOT exposed today

**Repositories (Team-owned, public within the plugin).** `TeamDomainRepositories` (`packages/storage/repositories/team-domain.ts` L52-69): `schemaMeta`, `teamSessions`, `memberInstances`, `sessionBindings`, `overrides`, `compatibility`, `operations`, `ledger`.

- `TeamSessionsRepository.get(rootSessionId)` / `.list()` — `packages/storage/repositories/team-sessions.ts` L78 / L91 → `TeamSessionRecordDto[]` (frozen fields: `rootSessionId`, `blueprint`, `defaultWorkspace?`, `createdAt`, `generation`, `handoffSourceSessionId?` — `packages/contracts/src/dto/team-session-record.ts` L52-88).
- `MemberInstancesRepository.list(rootSessionId)` — `packages/storage/repositories/member-instances.ts` L102 → root/member attribution (child session ids).
- `SessionBindingsRepository.get(sessionId)` — `packages/storage/repositories/session-bindings.ts` L104 → `SessionBindingDto` = `SessionBindingOrdinary | SessionBindingTeamRoot | SessionBindingTeamMember` (`packages/contracts/src/dto/session-binding.ts` L95) — the session-kind fact.

**Minimal query** (exactly what the glue already does in `teamRootOfSession`, agent-bindings.mjs L342-374): `roots = teamSessions.list()`; per root, `members = memberInstances.list(root)` (attribution); optional per-session kind via `sessionBindings.get`. No second JSON source, no transcript copy — satisfies v2 §1.2.

**Exposed via an existing remote handler? NO.** Every team-scoped method requires an addressed `teamSessionId` and re-asserts the owned-root guard (`s6-remote.ts` L1511 `team.getProjection`, L1520-1524 `team.getLedgerPage`, …); `catalog.list` enumerates blueprints, not teams; the per-team projection frame carries NO root list (it is one team's fold — `root.ts` L1462-1466). So a **read-only remote method must be added** (Team-owned, contract v3, alongside Q2's method):

- Method name: `team.listRoots` (category `team`, v3).
- Params: `{}` (no fields — host authority only; the browser payload cannot self-appoint roots, CR-4 discipline already enforced by the ownership predicate).
- Response data: `{ roots: [{ rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt, generation, memberCount }] }` — a remote-safe subset of `TeamSessionRecordDto` + `memberInstances.list(root).length` (leader excluded or included per D1 design). Read-only: no repository writes, no agent effects.
- Wiring: s6-remote port reading `repositories.teamSessions.list()` + `repositories.memberInstances.list(root)` (both already injected, `S6RemoteOptions.repositories`, L545) → root.ts passthrough → client wrapper `teamRemote.listRoots()` → Team UI zero-state/picker rows.

---

## Q5. OVERALL VERDICT — **yes**

The v2 D6 approach (explicit Team-mode open + ordinary fallback) **can be built purely from Team-owned code + existing upstream public APIs**, with zero upstream changes:

| Piece | Status | Evidence |
|---|---|---|
| Live-first reopen (glue resume → UI open reuses Team agent) | **existing upstream public behavior** | agent.ts L187-188, L390-396, L442-446; core/agent index.ts L251, L477, L578-580 |
| Team-owned ensure-live facade | **exists** (glue export) | agent-bindings.mjs L820-849, L1623; host.ts L678, L819-827 |
| Remote method to invoke it (step a) | **missing → Team-owned contract v3** (`team.ensureRootLive`) | catalog.ts L11-15, L64-89; s6-remote.ts L945-976 (pattern); root.ts L1541 (pattern) |
| Ordinary fallback open (step b) | **exists** (Seam 3, already injected) | team-mount-core.ts L184-206, L489-492, L628; TeamView.tsx L103 |
| Ownership index query | **missing → Team-owned contract v3** (`team.listRoots`) | team-sessions.ts L78/L91; member-instances.ts L102; session-bindings.ts L104; s6-remote.ts L1511 (no enumeration today) |
| Mode display | client-local UI state (no upstream/remote field needed) | team-ui-snapshot.ts L154-171 (no mode fact); v2 §1.1.5 |
| No double Team registration on mode switch | **by construction** | core/agent index.ts L477 |
| Upstream session-resume interception / private API needed? | **NO — neither half** | — |

**No `CORE_SEAM_BLOCKER` for D6 v2 as scoped.** The v1 blocker (automatic Team-setup interception of arbitrary ordinary Web reopens, `dev/agent-workflow/evidence/team-d1-d6-repair/T6-d6/core-seam-blocker.md`) remains TRUE as a characterization of upstream behavior (agent.ts L422-432 / L459-464 compose the ordinary setup with no downstream hook), but v2 §1.1 deliberately removes that requirement: the guaranteed path is the explicit Team UI entry, which needs no interception. If a future requirement revives "ordinary list open auto-detects Team", it is again `CORE_SEAM_BLOCKER` (seam: public session-resume ownership/interception; host SHA `76fda729799fe9b3848dbe2c211d4b231032b81e`), and must be recorded as such, not worked around.

The only contract movement is a **Team-owned** remote contract v1/v2 → v3 bump (two new read/action methods, closed-catalog discipline per catalog.ts L11-15) — i.e. the `CONTRACT_CHANGE_REQUEST` the A3 card anticipates when a seam is missing, scoped to `packages/remote` + `packages/runtime` + `packages/client`. This is the planned Wave D work (D1 ownership/index, D2 Team-mode open command), NOT an upstream blocker.

---

## Owned-file list for future D-wave tasks (characterization output, no writes made)

| File | Change (Wave D) |
|---|---|
| `packages/remote/src/contracts/catalog.ts` | v3 catalog entries `team.ensureRootLive`, `team.listRoots` + v3-only-method set |
| `packages/remote/src/contracts/params.ts` | v3 closed param schemas (+ version constant module) |
| `packages/runtime/src/plugin/s6-remote.ts` | `ensureRootLive?` / `listRoots` ports in `S6RemoteOptions`; `team` category handler cases (owned-root guard reuse, fail-closed typed errors) |
| `packages/runtime/src/plugin/root.ts` | wire `ensureRootLive: (sid) => live.ensureLiveAgent(sid)` and the read-only index port (L1497-1558 options block) |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | **no change expected** — `ensureLiveAgent` already exported (L1623); `hasLive` (L1621) available for glue-side checks if needed |
| `packages/client/src/transport/team-remote-client.ts` | v3-stamped wrappers `ensureRootLive`, `listRoots` |
| `packages/client/src/plugin/team-mount-core.ts` | `openTeamMode` / ordinary-open face + per-root client-local mode state (next to L357-363 store maps) |
| `packages/client/src/ui/TeamView.tsx` (+ root/leader row of `TeamMembers`, zero-state picker) | explicit "Open in Team mode / back to Leader" + "Open ordinary" entries; mode badge |
| `packages/client/src/ui/locales.ts` | locale copy for the two entries + mode labels |
| `packages/runtime` (new module, D1) | pure ownership-index function over `teamSessions.list()` + `memberInstances.list(root)` (+ `sessionBindings.get` for kind) |

Focused tests to add in Wave D (per plan §12.D4 restart/reopen acceptance): restart + explicit Team-mode open (root history, Leader prompt, ten `team_*` tools, real `team_*` call), explicit ordinary open (no Team ensure; mode shown as ordinary), Team→ordinary→Team switch without double registration, foreign/unknown root fail-closed, race case (ordinary prompt before ensure-live → typed failure, UI gated).

## Read-only compliance

- No file under `packages/`, `references/`, `docs/local-issues/`, `docs/plans/`, `docs/ROUTER_RULES.md`, `docs/TEST_METHODS.md` was modified.
- `references/deepseek-harness-test-use` read from the main checkout (gitignored from the worktree) at pristine SHA `76fda729799fe9b3848dbe2c211d4b231032b81e`; not written.
- Stable instance `:3080` and `D:\deepseek-harness` not touched; no host started.
- No remote methods, code, or files added in this task (characterization only).
