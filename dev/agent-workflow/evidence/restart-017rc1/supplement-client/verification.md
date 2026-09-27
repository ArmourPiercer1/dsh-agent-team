# S3 — same-page "Session unavailable" (会话不可用) client characterization

PR #31 supplemental fix guide, §7 **Commit S3** (evidence only — 先不写最终产品
workaround, i.e. **no product workaround written in this commit**).

- Worktree: `.worktrees/team-restart-017rc1` (branch `task/team-restart-017rc1`, base master `7c23610`)
- Upstream under test: `tests/deepseek-harness-test-use` **pristine @ `46a7f68b0922371ce7144b668b90e377d8e799f4`** (0.1.7-rc.1 official release point), read-only, zero edits (including zero temporary edits)
- Spike: `packages/client/test/s3-client-generation-spike.test.ts` (new, committed with this evidence; excluded from the package tsc program — see "Reproducibility" below)
- Run: `cd packages/client && npx vitest run test/s3-client-generation-spike.test.ts` → **1 passed** (Node v24.21.0, vitest 4.1.11, vite 8.2.2 rolldown pipeline)
- Raw run log: `supplement-client/spike-run-1.log` (contains the `S3-SPIKE-TRACE` and `S3-SPIKE-SEAMS` machine-readable blocks quoted below)

## 1. Method

The spike boots the assembled client over `RemoteMock` (the same `createClientTest`
bench upstream's `reference-ownership.client.spec.ts` uses), then drives **its own**
`ClientSessions` + `UiWorkspaceService` pair (the same construction the app
assembly performs) and records, step by step: `sessions.retainInfo(id)`
(reference counts per source), the Session **binding/generation identity**
(object identity of `sessions.binding(id)`), the session snapshot
(`openState` / `openError` / `lastAgentError`), the `uiWorkspace` main selection
(persisted `dsh.sessions.current`), and the number of `session/follow` stream
opens per session id.

Scenario = the Q2 browser finding (`phase0/run2026-09-26T07-03-12/legB/q2-browser/Q2-FINDING.md`)
reproduced at the data layer, plus a failed-open variant:

| Step | Action | What it characterizes |
|---|---|---|
| S1 | `uiWorkspace.openSession(root)` (ordinary open of the cold Team root) | normal first open: `retain {1, mainView:1}`, generation G1, `session/follow` open #1, `openState 'open'` |
| S2 | `api-session/error` (exact fence veto wire wording) via `svc.handleSessionError(root, veto)` | the veto lands on G1: `lastAgentError` **sticky per generation** |
| S3 | backend takeover success + the **current product step (c)** `ctx.sessions.refresh()` (team-mount-core `openTeamMode`, unchanged in this round) | catalog refresh: **generation unchanged, error unchanged → stuck** |
| S4 | `uiWorkspace.openSession(root)` again (same-SID reopen) | retain +1/release −1: **transiently 2, settles at 1, never 0** (captured by a `retainInfo` subscription bump); **generation unchanged, error unchanged → still stuck** |
| S5 | connection reset `svc.handleConnected()` | baselines rebuild; **generation and error untouched → still stuck** |
| S6 | `uiWorkspace.archiveSession(root)` | the **only** public path that releases the mainView reference — with the **host-archive side effect** (recorded: the workspaces archive call fired); count → `{0, {}}`; **generation RETIRED** (`binding === undefined`, scope disposed) |
| S6b | `uiWorkspace.unarchiveSession(root)` | second recorded side effect; while a session sits in the archived set, `clearArchivedCurrent` (navigation.ts:364) refuses to hold it as main on every reconcile — so the public repair is the archive → unarchive → reopen **pair** |
| S7 | `uiWorkspace.openSession(root)` | **fresh generation G2 ≠ G1**, one new `session/follow` open (#2), clean open, `lastAgentError` **null**; main selection still names the **same** session id (no other-session switch) |
| S8 | ROOT2 whose `session/follow` open is **rejected** (branded `RemoteError 'session/intercepted'`, like the real fence wire failure) | failed-open lifetime: `reference.ready` **resolves** (doOpen swallows a RemoteFailure — session.ts:616), the failure lands as a **terminal background failure** (`failEventStream`, session.ts:876) → `openState 'error'` + `openError` sticky; a second retain **retries the open** (follow #2, fails again, same generation); `handleConnected` does **not** retire it; release-to-0 retires it; re-retain → **fresh generation GF2**, clean open (#3) |

### Reference-count trace (same-SID reopen) — from `S3-SPIKE-TRACE`

```text
S1 openSession #1                 retain {1, mainView:1}                       gen G1  openState loading
S1 probe ready                    retain {2, mainView:1, probe:1}              gen G1  openState open
S2 api-session/error (veto)       retain {1, mainView:1}                       gen G1  lastAgentError=<veto, STICKY>
S3 takeover + sessions.refresh()  retain {1, mainView:1}                       gen G1  lastAgentError=<unchanged>   ← STUCK (Q2 reproduced)
S4 openSession #2 (same id)       retain {1, mainView:1}  (transient 2 → 1)    gen G1  lastAgentError=<unchanged>   ← STUCK, refcount never 0
S5 handleConnected                retain {1, mainView:1}                       gen G1  lastAgentError=<unchanged>   ← STUCK
S6 uiWorkspace.archiveSession     retain {0, {}}                               gen —   binding undefined           ← RETIRED (host-archive side effect recorded)
S6b uiWorkspace.unarchiveSession  retain {0, {}}                               gen —
S7 openSession #3 (same id)       retain {1, mainView:1}                       gen G2  clean open, follow #2, lastAgentError null
S8 ROOT2 retain (open rejected)   retain {1, probe:1}                          gen GF1 openState error, openError 'session/intercepted' (ready RESOLVED)
S8 second retain (retry)          retain {2, probe:2}                          gen GF1 openState error (follow #2, fails again)
S8 release-to-0                   retain {0, {}}                               gen —   RETIRED
S8 re-retain (backend healed)     retain {1, probe:1}                          gen GF2 openState open (follow #3), lastAgentError null
```

follow counts at end: `s3-spike-root: 2` (S1 + S7), `s3-spike-root2: 3` (S8 #1, S8 retry, S8 fresh).

### Failed-generation lifetime — summary

A Session **generation** (one `Session` object + scope fiber + binding) is:

- created on the first retain of an id (`materializeScope` → `manager.get` builds a new Session; manager.ts:236, service.ts:282);
- **invalidated only by generation replacement**: `manager.drop` (manager.ts:184) fires when the reference count reaches 0 (`retireScope`); a re-retain then materializes a **new** generation (`manager.get` after drop builds a fresh Session — "no auto-open — the reference allocator opens history after binding the scope");
- **not** touched by `sessions.refresh()` (catalog only, service.ts:353), by a same-SID `openSession` (replaceMain re-retain, navigation.ts:380 — count never reaches 0), nor by `handleConnected` (manager.ts:736 clears projections/list state and re-pulls; scopes/generations persist — binding identity, `lastAgentError`, `openState` all survive, verified at S5 and S8);
- carries **sticky per-generation state**: `lastAgentError` (set by `handleAgentError`, session.ts:590, never cleared except by generation replacement) and `openState 'error'` + `openError` (set by `failEventStream`, session.ts:876, after a rejected open — note `doOpen` at session.ts:616 swallows a RemoteFailure and **resolves**, so `SessionReference.ready` resolves even for a failed open; the failure is observable through the session snapshot, and lands as a terminal background failure after the open settles).

### Public seam inventory — from `S3-SPIKE-SEAMS`

`UiWorkspaceService` public/prototype surface (22 methods):
`archiveSession, clearArchivedCurrent, clearMain, connectWorkspace, createDirectory, forkSession, initializeDefaultWorkspace, listDirectory, notify, openSession, openWorkspace, pickDirectory, pinSession, replaceMain, restoreSelection, reuseBlank, reuseOrCreateBlank, startSession, unarchiveSession, unpinSession, watchNavigation`
(private-by-contract members are TS-private but JS-visible on the prototype; the public API is the `UiWorkspace` contract type).

`ClientSessions` surface (30 prototype methods + 5 instance properties):
`binding, create, drainScopeDrops, dropScope, fork, handleConnected, handleControlFrame, handleSessionActivity, handleSessionAdded, handleSessionError, handleSessionRemoved, handleSessionStatus, materializeScope, projectList, publishRetention, refresh, refreshProjections, retain, retainAgentScope, retainInfo, retainScope, retentionSnapshot, retireScope, scope, scopeOf, search, sessionOf, startScopeDrop, subagentAddress, using`
properties: `list, manager, scopes, retainObservers, closed`.

**Negative finding (the Q4 answer, runtime-verified): across BOTH public surfaces there is no method name matching `/reset|reopen|release|unstick|clearError|discard/`.** The only public call that can drive the main session's reference count to 0 is `uiWorkspace.archiveSession(id)` — which releases the mainView reference **and** performs the host-archive side effect (the session row is archived on the Host), and the navigation policy then refuses to hold an archived session as main until `unarchiveSession`.

## 2. The guide §3.2 five questions — answers

**Q1. Does the same-SID failed generation have a public reset/reopen seam? — NO.**
Source: `sessions.refresh()` (service.ts:353) touches only the Host catalog; `handleConnected` (manager.ts:736) rebuilds projections/list, not scopes; the seam inventory above contains no reset/reopen/release name.
Run: S3/S4/S5 — after veto (S2), both `refresh()` and the same-SID reopen leave the **same generation** (binding identity unchanged) with the **same sticky error**.

**Q2. After `SessionReference.release()` to referenceCount=0, does re-retain establish a fresh generation? — YES.**
Source: `retireScope` → `manager.drop` (manager.ts:184) deletes the Session; `manager.get` (manager.ts:236) lazily builds a new Session on the next retain.
Run: S6→S7 (`{0,{}}` → re-retain → `G2 ≠ G1`, new `session/follow` open, clean state, `lastAgentError` null) and S8 (failed generation retired at 0 → `GF2 ≠ GF1`, clean open). This half of the mechanism **works** — the problem is reaching 0 (Q3).

**Q3. Can the Team plugin safely do this via existing public `ctx.sessions` / `ctx.uiWorkspace`? — NO.**
The `mainView` reference is **privately owned by the host-assembled `UiWorkspaceService`** (`mainReference` field; `clearMain` at navigation.ts:372 is TS-private). The plugin's own `sessions.retain(id, {source:'plugin'})` + `release()` only moves the plugin's own counter — the count stays ≥ 1 because of `mainView`, so the generation is never retired. The single public call that releases the mainView reference is `archiveSession` (navigation.ts:243), which carries the host-archive side effect (verified at S6) and leaves the session archived — guide §3.4 explicitly forbids disguising an archive/switch side effect as a same-page repair without a formal ADR. **No safe public action exists.**

**Q4. Is there a public navigation API to "reopen the same Session generation" without switching to another Session? — NO.**
`openSession(same id)` (navigation.ts:200 → `replaceMain` at navigation.ts:380) is the only "reopen": retain +1 then release −1 (transiently 2, settles at 1 — **never 0**), so the failed generation survives (verified at S4). The seam inventory confirms no other candidate exists.

**Q5. If not, can a small client-side Session navigation provider replacement take over same-id generation reopen without Host B+? — NO.**
The `UiWorkspaceService` instance is constructed inside the host package's own assembly — `packages/client/ui-workspace/src/client/index.ts` `apply()` (index.ts:100-112, pristine 0.1.7-rc.1) — and is **not** a replaceable provider slot: no public seam substitutes or overrides the `uiWorkspace` service instance. A plugin replacement would (a) require preventing the host-constructed instance from running (a core/app patch — CORE PATCH BUDGET = 0), or (b) re-implement the entire navigation policy (selection persistence, `restoreSelection`, `clearArchivedCurrent`, workspace/blank flows, pin/archive actions, directory-picker bridge) while **still not owning** the `mainView` reference that pins the failed generation. That is not a "small client replacement" — it is a navigation-policy fork. (This is the empirical closure of the source-level reading: even a hypothetical provider swap cannot retire the reference it does not own.)

## 3. Composer lock chain (source-verified, for the record)

`InputBar.tsx` (pristine 0.1.7-rc.1): `disabled = removed || inert || !live || blocked !== undefined || parentOffline` (InputBar.tsx:138); `live = input !== undefined && keyboard !== undefined && inputActions !== undefined` (:72); the 会话不可用 / "Session unavailable" placeholder renders exactly when `disabled` (:345, `placeholder.unavailable`).

- `blocked` = the per-session `ComposerBlockRegistry` face (`useComposerBlock`, skeleton/ConversationContent.tsx:38,139) — **plugin-owned**. This plugin sets **zero** composer blocks (verified: no `composerBlock`/`setComposerBlock` usage anywhere in our `packages/client/src`).
- `removed` only flips on `api-session/removed` (host `session/disposed`) — absent from the Q2 timeline.
- `parentOffline` — subagent context only; the Q2 session is the root.
- `inert` — the session is the current one (slot active) — not the Q2 case.
- `!live` — the per-binding conversation/input machine faces (`apply.ts:244-257` provides `hooks ['conversation','input']`, `props ['inputActions']` per binding; composer bar keyboard face at apply.ts:397/418). The face materialization is **cached per binding object** (`sourceFor`/`createMaterializedBinding`, ui-session index.ts:427-430) — i.e. **per generation**. A failed/stuck generation keeps its faces in the stuck state; only a **fresh generation** re-materializes them (`createMaterializedBinding` release-effect → source absent → `publishMain` re-runs on the new binding → faces re-provided → composer live).

The Q2 browser evidence (authoritative symptom, `phase0/.../Q2-FINDING.md`): veto at 07:12:23.148Z → rollback → `api-session/error` "resume failed … intercepted foreign Agent activation for Team-managed session" at 07:12:23.152Z → successful Team takeover at 07:13:12.649Z → composer **still** locked 会话不可用 within the page load; **full reload recovers** (reload = new client = fresh generations for all sessions). The spike shows exactly why: within one page load, no public operation replaces the stuck generation of the current main session; the sticky per-generation state (openError/lastAgentError + cached faces) is cleared **only** by generation replacement, which requires the reference count to reach 0, which the plugin cannot trigger for a session it does not reference (Q3).

## 4. GO/NO-GO conclusion — **NO-GO-C1** (empirical)

Per guide §3.4: the only safe same-page repair path requires either a **core patch** (provider substitution / reference ownership — budget 0), a **private store** access, or the **archive+unarchive+reopen pair** whose host-archive side effect §3.4 forbids disguising as a same-page repair without a formal ADR. All three are off the table for this round. Therefore:

1. **Stop the C1 client workaround** (no "auto-switch to blank and back", no refresh stacking — §3.2 forbids it and S3 now proves it insufficient at the data layer).
2. **Reassess A′ (startup ownership protection) vs B+ (compatibility replacement)** — the decision is recorded in the S6 PR body (§12 Q4).
3. **B+ is NOT started in this round** (guide §3.4: "本轮在实证 NO-GO 前，不直接开始 B+" — the NO-GO is now empirical; starting B+ is a separate, explicitly deferred decision).
4. **S4 (same-page client repair) is SKIPPED** — guide §7: "仅在 S3 得出 GO 后实现". S3 = NO-GO-C1 → S4 does not run.
5. The user-visible recovery until the A′/B+ decision lands: **full page reload** (already proven to work, Q2). No product change in this round alters that; `team-mount-core.ts` `openTeamMode` step (c) `ctx.sessions.refresh()` (openTeamMode, unchanged @ lines 648-651) stays as-is — it is now documented as **proven-insufficient** for this case, not removed (removal is an A′/B+ scope decision).

## 5. Reproducibility

```bash
cd .worktrees/team-restart-017rc1/packages/client
npx vitest run test/s3-client-generation-spike.test.ts
```

- The spike is **excluded from the client package's tsc program** (`packages/client/tsconfig.json` `exclude`, documented in-file): it imports the pristine upstream sources straight from `tests/deepseek-harness-test-use`, which are outside the package rootDir (TS6059) and use bare specifiers tsc cannot resolve here (TS2307) — the Vite pipeline resolves them via the `linked-dsh-source-redirect` plugin. Runtime is verified by vitest; the package `typecheck` (tsc) passes clean with the exclusion.
- Environment note (for future runs): the upstream spec helper `tests/remote/session.client.ts` (and thus its `event-script.client.ts` chain) cannot be imported by this repo's vitest worker pipeline — the chain pulls `@deepseek-ai/dsh-llm`, whose source hub fails under this repo's vite 8.2.2 (rolldown/OXC) transform with a bare `SyntaxError` (reproducible with a bare `import '@deepseek-ai/dsh-llm'` probe; plain Vite SSR of the same import loads fine — the failure is specific to the vitest worker externalization). The spike therefore imports the import-clean `history.client.ts` (`followSnapshot`) and mirrors the 12-line `followScript` wrapper locally (byte-for-byte behavior, documented in the file).
- The spike uses a bounded test-harness settle (`waitUntil`, 2 s deadline, explicit timeout error) to observe the terminal background failure that lands after `open()` settles — test-harness waiting, not product backoff.

## 6. Red-line compliance (this commit)

- CORE PATCH BUDGET = 0: zero upstream/test-use modifications (pristine @ 46a7f68b09, verified); no v6 bump; remote contract stays v5.
- No product workaround written (guide: 先不写最终产品 workaround); `team-mount-core.ts` untouched.
- No private store / DOM hack / reload repair / blank-switch disguise in any committed code.
- All operations inside the workspace (workspace-write); no impact on :3080/:3180 or the stable instance; the spike is a node-side vitest run (no browser, no host instance).
- Orphan host pid 671881 @ :3491 untouched.
