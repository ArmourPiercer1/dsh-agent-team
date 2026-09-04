# Upstream DSH Compat Matrix — 0.1.2-alpha.1 → 0.1.2-rc.1

**Scope.** Every symbol/seam that `dsh-agent-team` (the vNext 9-package tree in the RC1
worktree) imports or depends on from the upstream test-use tree
(`references/deepseek-harness-test-use`), compared **old** (baseline `cd5ef8148158c3a752a658978873241fdf8e2bbc`,
0.1.2-alpha.1) against **new** (HEAD `76fda72979`, 0.1.2-rc.1).

**Method.** Old signatures recovered via `git -C <TU> show cd5ef814...:<path>`; new signatures read
from the TU working tree (read-only, `git status` clean at `76fda72979`). TU source is **not**
modified (CORE PATCH BUDGET = 0). Scope note: the matrix enumerates **package-import** seams;
the host runtime's **public-service registry** (seams consumed via `ctx.get`, not imports) is
not enumerable from source diffs and is covered retroactively in §6. Conclusions use:
`不变` (unchanged) · `机械适配` (mechanical adaptation) · `语义适配` (semantic adaptation) ·
`破坏-需验证` (breaking — needs instance-level verification).

**Headline.** No **package-import** seam used by this repo is broken. The package-import
surface required only a **mechanical build-metadata pin update** (5 `CLIENT_COMMIT_HASH`
constants + 2 procedural references, `cd5ef814` → `76fda72979`). One **host-service-registry
seam** — outside the matrix's package-import scope — turned out to be semantic: rc.1 removed
`sessionPersistence.ensureMaterialized` (discovered by the live boot, §6). It was adapted
in-repo to the stock `sessions` service's `flush(session)`, upstream's own rc.1 replacement
(present in both eras). All P9-F1/F2 user-visible behaviors (R118 / R119-1 / R119-2 / R121)
remain fully preservable.

---

## 1. Client-plane seams

| # | Package / subpath | Symbol(s) we consume | Old (alpha.1) | New (rc.1) | Conclusion |
|---|---|---|---|---|---|
| C1 | `@deepseek-ai/dsh-client-ui-slots` | `SlotMap` (empty decl-merge iface), `LocaleNamespaceMap` (empty decl-merge iface), `SlotCore`, `PropsLocale`, `InjectFace`, `PropsRuntime` | declared; class + iface bodies as at cd5ef814 | `index.ts` **additive-only**: adds `KeyedHooksSources` / `KeyedSnapshotSelectorHook` / `PropsKeyedHooks`; `ResolvedInjected` extended backward-compatibly for `keyedHooks`. `SlotMap` (L26) / `LocaleNamespaceMap` (L36) empty merging ifaces intact; `SlotCore`, `PropsLocale`, `InjectFace`, `PropsRuntime` unchanged. `./invariant` subpath removed (we do not use it). | **不变** |
| C2 | `@deepseek-ai/dsh-client-store` | `createSnapshotStore`, `ObservableSnapshot` | as at cd5ef814 | **src byte-identical** (only `invariant.ts` + `package.json` `./invariant` subpath & peer removed) | **不变** |
| C3 | `@deepseek-ai/dsh-client-locale/client` | `LocaleRuntime` (class) | class present | class intact (`src/client/index.ts` L162). Internal `inject` array drops `'connection'`; dict key `'connection.reconnecting'` removed from en/zh (**0 use in RC1** — verified); CSS border tweak | **不变** (removed key unused) |
| C4 | `@deepseek-ai/dsh-client-test-runtime` | `makeTranslate` (all 13 of our specs) | exported, unchanged | **unchanged**. Additive: `RemoteError` re-export; `FixtureSession.loadThrough()` fail-loud stub (upstream `SessionFace` gained `loadThrough`); `scriptedSettingsRemote` error code `'settings-rejected'`→`'settings/rejected'` (**0 use in RC1** — verified). Our spec doubles are typed by our own `TeamPluginClientContext` (`team-plugin.client.spec.tsx` L73), not upstream faces → unaffected by `ISession` growth | **不变** |
| C5 | `@deepseek-ai/dsh-client-ui-conversation/client` | slots `'conversation.view'`, `'conversation.input.dock'`; `InputZone`, `ConvViewOwnerProps`, `SessionStandardProps` (carries `sessionId`); `useWorkspaces` seat | `'conversation.view': { kind:'list'; scope:'session'; owner:ConvViewOwnerProps }` (L117); `'conversation.input.dock': { kind:'list'; scope:'session'; owner:InputZone }` (L127); `InputZone { session:SessionSnapshot; input:InputState }`; `SessionStandardProps` merge L155; `useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>` L152 | **identical** for all four. Removed (unused by us): InputZone owners on `conversation.composer.dock` / `input.left` / `input.right`; `conversation.input.overlay` dropped from render union (still declared). Additive: `ConversationSessionInjected.openView(view, focus)` / `selectView(view)`. `./client` export subpath retained | **不变** |
| C6 | `@deepseek-ai/dsh-client-ui-primitives` | `IconUserOutline16`, `IconChevronDownOutline14`, `IconChevronUpOutline14`, `StateDot`, `StateDotState`, `Tooltip` | as at cd5ef814 | all **identical** (icons/index.tsx L505/L161/L201; StateDot.tsx L5/L19; Tooltip.tsx L34) | **不变** |
| C7 | `vendor/cordis` | (no direct client import) | 4.0.1 | 4.0.2 — **version-only**; client `src/` has **no** direct cordis imports (comments only; `Config` type is local to `team-mount-core`) | **不变** (version-only) |

---

## 2. Host-plane seams

| # | Package / subpath | Symbol(s) we consume | Old (alpha.1) | New (rc.1) | Conclusion |
|---|---|---|---|---|---|
| H1 | `@deepseek-ai/dsh-session` (+ `/types`) | `SessionId` (type), brand fn; `SESSION_FORMAT_VERSION` | `SessionId` type (types.ts L17) + `export * from './types.ts'` re-export | type + brand fn still exported via root. Impl now `brandString<SessionId>(id)` (a pure compile-time cast — **runtime-identical** to the old `as` cast). Additive `SessionSeq` / `SessionLogOffset` branded numbers; `SESSION_FORMAT_VERSION` bumped (fresh-home harnesses → no impact); `./types` subpath retained | **不变** |
| H2 | `@deepseek-ai/dsh-scope` | `scopeOf` | as at cd5ef814 | **version-only** bump; `scopeOf` unchanged | **不变** (version-only) |
| H3 | `@deepseek-ai/dsh-system-prompt` | `PERSONA_SECTION` | `PERSONA_SECTION = 'deployment:persona'` | **unchanged** (L172). `FIRST_PARTY_SECTION_ORDER` became private `SECTION_ORDERS` (**0 use in RC1** — verified). Additive `getContextOrder` | **不变** |
| H4 | `@deepseek-ai/dsh-agent` | `installModelSelection`; `CreateAgentOptions.meta` | `installModelSelection`; `meta.seedLength?: number` | `installModelSelection` **unchanged**. `CreateAgentOptions.meta.seedLength?` → `isSeeded?` — **we pass only `meta: { cwd }`** (all 6 `.create` sites verified: member-residency/harness/plugin.mjs L803/L1060, root-binding/harness/plugin.mjs L607/L977; `.resume` sites L828/L1064/L1070 + root-binding L823 use `{ resumeSessionId, setup? }`). Additive `inheritedEventCount`, projection.ts type exports | **不变** (rename unused by us) |
| H5 | `@deepseek-ai/dsh-mcp-client` | module used whole as a plugin object: `agent.ctx.plugin(mcpClient, cfg)` | module shape | **unchanged** (tools.ts type-import move only). Call sites: slots-t6.mjs L276, slots.mjs L270, agent-bindings.mjs L411 | **不变** |
| H6 | `@deepseek-ai/dsh-storage-domain` | `defineDomain`, `domainTable` | as at cd5ef814 | **unchanged**. Additive `invalidRecords: 'backup-and-skip'` + `compatibleVersions`. Our `seam.mjs` passes `{ name, version, tables }` (L58-61) | **不变** |
| H7 | `@deepseek-ai/dsh-llm` | `ToolCallId(id: string): ToolCallId`, `createUserMessage<T extends NewUserMessage>` | as at cd5ef814 | **unchanged** (brand.ts L38; message.ts L194). Internal brandString/deepFreeze refactor only | **不变** |

---

## 3. Behavior dependency chains (R118 / R119 / R121)

These are the chains that implement the user-visible behaviors that MUST be preserved.

| # | Behavior | Dependency chain | Old → New | Conclusion |
|---|---|---|---|---|
| B1 | **R121** workspace prefill (new-team draft prefilled with the workspace holding the current session) | `ctx.sessions.list` (Seam 3 read face) → `getSnapshot().current` → `useWorkspaces(s => s.items)` → `WorkspaceView.sessionIds` → `w.sessionIds.some(id => id === sid)` | provider `@deepseek-ai/dsh-api-session-controller`: `ISessions.list: ObservableSnapshot<SessionListState>` **unchanged**; `SessionListState` **identical** (`{ ids, byId, current: SessionId\|undefined, phase, subagentsByParent, jobsBySession, currentAddress }`); `create(opts?: { workspaceId?; cwd?; sessionId? }): Promise<SessionId>` **identical**; `open(id)` **identical**. `ui-session` still reads `this.sessions.list.getSnapshot().current` (L355). Workspace seam: `useWorkspaces` → `WorkspaceSnapshot` (merged by ui-conversation contract/slots.ts L152); `WorkspaceView { sessionIds: readonly SessionId[]; … }`, `items: readonly WorkspaceView[]` **preserved**; types.ts diff = error-vocabulary consolidation only | **不变** |
| B2 | **R118** global "New Team" bottom-left entry (shell slot) | ui-sidebar `sidebar.footer.action` slot → our mirror `TeamNewTeamEntryOwner { wide: boolean }` | ui-sidebar `sidebar.footer.action` **byte-identical** (contract/slots.ts L46 `{ kind:'list'; scope:'root'; owner:SidebarFooterActionOwnerProps }`; rendered `SidebarRoot.tsx` L214 `{renderSlot('sidebar.footer.action', { wide })}`); our owner mirror stays accurate | **不变** |
| B3 | **R119-1** blueprint loud placeholder + disabled | (driven by client-side state, no upstream symbol change) | no upstream seam touched | **不变** |
| B4 | **R119-2** no flicker on mount | (client render-timing, no upstream symbol change) | no upstream seam touched | **不变** |

**Per-session `ISession` face (NOT used by us):** renamed `ClientResult`→`RemoteResult`,
`BeginSubmissionInput` gained a **required** `mode: 'queue'\|'steer'`, `SessionSnapshot.openError`
`ClientFailure`→`RemoteFailure`. Verified **0 hits** in our tree for `BeginSubmissionInput` /
`beginSubmission` / `.submit(` / `ClientResult` / `ClientFailure`; the only `RemoteResult`
occurrences are descriptive comments in our client code (roster envelope prose), **no type
imports**. We consume the roster envelope structurally (`.value`) and never call `submit`. →
**不变** (rename not a seam we depend on).

---

## 4. Scanners & harness tooling (unaffected)

| # | Item | Why unaffected | Conclusion |
|---|---|---|---|
| S1 | `testkit/fault-injection/session-event-scan.mjs` + p4t6 test scan | scan **our** 9-package tree only, not upstream | **不变** |
| S2 | tools `p6t6-bypass-scan` | `SESSION_TYPES_SPECIFIER = '@deepseek-ai/dsh-session/types'` is a **string constant**; the `/types` subpath still exists | **不变** |
| S3 | `client-bundle.client.spec.ts` L100 token | string-assembled, not a live import | **不变** |

---

## 5. Build-chain metadata pins (the one required change)

| # | Location | Old | New | Conclusion |
|---|---|---|---|---|
| P1 | `packages/tools/harness/run.mjs:117` | `const CLIENT_COMMIT_HASH = 'cd5ef814'` | `…'76fda72979'` | **机械适配** |
| P2 | `packages/tools/harness/t12-vertical.mjs:158` | `const CLIENT_COMMIT_HASH = 'cd5ef814'` | `…'76fda72979'` | **机械适配** |
| P3 | `packages/runtime/member-residency/harness/run.mjs:94` | `const CLIENT_COMMIT_HASH = 'cd5ef814'` | `…'76fda72979'` | **机械适配** |
| P4 | `packages/runtime/root-binding/harness/run.mjs:69` | `const CLIENT_COMMIT_HASH = 'cd5ef814'` | `…'76fda72979'` | **机械适配** |
| P5 | `packages/legacy/session-reader/e2e/run.mjs:59` | `const CLIENT_COMMIT_HASH = 'cd5ef814'` | `…'76fda72979'` | **机械适配** |
| P6 | `packages/legacy/session-reader/e2e/run.mjs:5` (header comment) | `pin cd5ef814` | `pin 76fda72979` | **机械适配** (consistency with P5) |
| P7 | `packages/runtime/root-binding/harness/README.md:61` | `DSH_CLIENT_COMMIT_HASH=cd5ef814` | `…=76fda72979` | **机械适配** (consistency with P4) |

**Semantics.** `DSH_CLIENT_COMMIT_HASH` is consumed by TU `scripts/client-build-environment.ts`:
`repositoryCommitHash(root, environment)` **honors** an explicitly supplied value (validates
`/^[0-9a-f]{7,40}$/`, truncates to 7 chars) and falls back to `git rev-parse HEAD` otherwise.
It stamps **browser build metadata only** (the web bundle's commit record). It is **not** an API
seam, is **not exercised by the five gates**, and is only consumed when a harness boot chain
re-triggers the TU build (lib missing) — i.e. during the PENDING-LIVE smoke, not the gates.
Updating the pin keeps the stamped hash consistent with the upstream commit we actually consume
(`76fda72979`, the value the main agent builds TU at). Zero behavior risk.

**Deliberately NOT changed (historical evidence pointers).** These correctly record the commit at
which the frozen seam-map *evidence* was captured; rewriting them would misrepresent provenance:
- `packages/client/src/plugin/team-mount-core.ts:15` — `host-seam-map.md pinned at cd5ef814`
- `packages/client/src/transport/host-seams.ts:24` — `Seam 5, pinned at P9-T0 / cd5ef814`
- `packages/client/test/client-plugin-mount.test.ts:6` — `host-seam-map … pinned cd5ef814`

---

## 6. Post-matrix discovery: the host-service-registry seam (R122)

**Discovery.** Boot attempt 5 on the live rc.1 host failed with `TeamPluginError: the
"sessionPersistence" public service is absent (or lacks ensureMaterialized)` — the frozen glue
(`agent-bindings.mjs:863`) called the facade our `host.ts` provides, which resolved
`ctx.get('sessionPersistence')` per call and delegated to `ensureMaterialized`.

**The rc.1 fact.** `ensureMaterialized` has **zero occurrences** in rc.1 source (it existed in
alpha.1's `session-persistence-jsonl` interface, the ACP, and the api-catalog). The
`sessionPersistence` public service survived, but its face moved from an id-based API
(`create(meta): void`, `ensureMaterialized(session)`, `append(id, events)`,
`load/inspect/prepare/readRaw/locate`) to a handle-based API (`create(header, opts?) →
SessionHandle`, `open(id, access, opts?) → SessionHandle`, a service-wide `flush()` durability
barrier, `stat/list`). rc.1 README: "`SessionHandle.flush` forces materialization."

**The upstream's own replacement.** rc.1 ACP (`packages/acp/acp/src/index.ts` L228-229) replaced
alpha.1's `await persistence.ensureMaterialized(record.agent.session)` with:

> `// The attached log writer's flush materializes an empty session durably.`
> `await ctx.sessions.flush(record.agent.session)`

The stock `sessions` service exposes `async flush(session: Session): Promise<boolean>` in
**both** eras (api-catalog, alpha.1 and rc.1) — a stable seam, so the migration carries no
alpha.1-regression risk.

**The in-repo adaptation (R122 commit, 6 files).** `CORE PATCH BUDGET = 0` holds — no upstream
source changed:

| File | Change |
|---|---|
| `packages/runtime/src/plugin/host.ts` | The lazy materialization facade now resolves `ctx.get('sessions')` per call and delegates to `svc.flush(session)` (same stable `TEAM_PLUGIN_SERVICE_MISSING` code; message updated to name the `sessions` service); `inject` swaps `sessionPersistence` → `sessions` (dependency-declaration accuracy — the row depends on the service it calls; a stock core service present at boot, so Loader semantics are unchanged); the frozen glue's deps key `sessionPersistence` and its `ensureMaterialized` method name are preserved (glue untouched) |
| `packages/runtime/member-residency/harness/plugin.mjs` | The REAL `SessionDurabilityPort` (`makeSessionDurability`) uses the same `sessions.flush(agent.session)` seam — the member-residency vertical stays rc.1-runnable |
| `packages/runtime/member-residency/fresh-member.ts`, `packages/runtime/member-residency/types.ts` | Doc comments referencing the removed seam updated to name `sessions.flush(liveSession)` as rc.1's replacement |
| `packages/runtime/test/p8s5a-host-loadability.test.ts`, `packages/runtime/test/runtime.test.ts` | The two `inject`-list pins updated to `['agents', 'storageDomain', 'sessions']` |

**Known follow-ups.** None for the s8 boot vertical. The member-residency vertical's e2e
harness held the only other live call site — adapted above. (`t12a-live-bridge` test doubles
drive the glue directly with their own facade double and remain valid: the facade's method
name and deps key are unchanged.)

**Matrix-gap lesson.** Package-import seams ≠ host-service-registry seams. Source diffs
enumerate importable symbols; services consumed via `ctx.get` resolve against the host's live
registry, so only the live boot (or an api-catalog diff) can check them. R122 records the live
boot as the authoritative registry gate.

---

## 7. Verdict

- **`破坏-需验证`:** **none.** No **package-import** seam used by this repo is broken in rc.1.
- **`语义适配`:** **one** — post-matrix, host-registry-plane only: `sessionPersistence.
  ensureMaterialized` removed in rc.1; adapted in-repo to the stock `sessions.flush(session)`
  seam (§6). Not a blocker: upstream's own replacement, present in both eras, `CORE PATCH
  BUDGET = 0` preserved.
- **`机械适配`:** P1–P7 (build-metadata commit pins only; already applied in the RC1 worktree).
- **`不变`:** every client-plane seam (C1–C7), every host-plane seam (H1–H7), every behavior
  chain (B1–B4), every scanner (S1–S3).

All P9-F1/F2 user-visible behaviors — **R118** (global entry), **R119-1** (blueprint loud
placeholder + disabled), **R119-2** (no flicker), **R121** (workspace prefill) — are preserved
under rc.1 (package-import plane: zero semantic change; the one §6 service-seam swap is
behavior-preserving for every call site, per upstream's own ACP migration).

---

## 8. Empirical gate results (rc.1, RC1 worktree @ `task/upstream-rc1-compat`)

Ran AFTER the TU (test-use tree) was built green at `76fda72979` / 0.1.2-rc.1. All five gates
pass. `pnpm -r` was **not** used — every package gate ran from its own directory.

| Gate | Scope | Result | Per-package detail |
|---|---|---|---|
| **typecheck** | 8 pkgs (`legacy` has no typecheck script) | **PASS** (all EXIT=0) | contracts, domain, storage, testkit, tools, remote, runtime, client — all `tsc -p tsconfig.json` EXIT=0 |
| **vitest** | 8 pkgs (`legacy` has no unit tests) | **PASS** (all EXIT=0) | contracts **150/150**, domain **312/312**, storage **269/269**, testkit **124/124**, tools **35/35**, remote **92/92**, client **480/480** (33 files), runtime **1070/1070** (116 files). Total **2532** |
| **build** | 9 pkgs | **PASS** (all EXIT=0) | contracts, domain, storage, testkit, tools, remote, client, legacy, runtime — all `tsc -p tsconfig.build.json` EXIT=0 |
| **lint** | root (`pnpm eslint .`) | **PASS** (EXIT=0) | — |
| **smoke** | live instance | **PENDING-LIVE** | covered by the 3180 vertical; not started here (per task) |

**Typecheck is the decisive API-compat signal:** all 8 typecheck-capable packages compile clean
against the rc.1 `lib/`+`types/` — empirically confirming the static verdict (no breaking seam).

### Runtime vitest: stale-state artifact (not an rc.1 break)

The runtime package's first run showed `15–16 failed files / 918–922 tests` with **zero
assertion failures** — the failing files were `Failed Suites` (file-load failures). Two distinct
causes, both **environmental to this verification run**, neither an rc.1 API break:

1. **Missing built legacy-reader mirror (build-ordering).** 13+ files call
   `bootstrap → loadLegacyInspect` (`src/plugin/host.ts:310`), which loads the frozen legacy
   reader via a two-candidate search: candidate 1 = the **built** mirror
   `packages/runtime/dist/packages/legacy/session-reader/index.js` (produced by the `legacy`
   package's `tsc -p tsconfig.build.json`, `outDir: ../runtime/dist`), candidate 2 = the source
   `.js`→`.ts` location. Running vitest **before** the build gate left candidate 1 absent, so
   those suites failed to load. **Fix: run the build gate first.** After building (9/9 EXIT=0),
   the mirror exists and all those suites load.
2. **Stale scratch state from interrupted runs (test-isolation).** `p8s7r4-fork-describe` and
   `p8s7r4-handoff-wiring` use a **fixed** workspace-internal scratch base
   (`packages/testkit/test/.tmp-fault/<name>`), cleaned only by each module's end-of-file
   `destroyDir`. Interrupted/contention runs left 9-file stale domains behind (the module threw
   at bootstrap before `destroyDir` ran), so a later run's fail-closed `createTeamDomain` threw
   `TeamDomainError: team_domain already exists (schema_meta holds 8 stamp row(s)); use
   openTeamDomain`. **Fix: clean the disposable `.tmp-fault` base, re-run in isolation.**

After (build first) + (clean `.tmp-fault`) + (isolation, no concurrent jobs), the runtime gate is
fully green: **116/116 files, 1070/1070 tests, EXIT=0** — matching the expected count exactly.
No test expectation was changed and no assertion weakened.

### Client count reconciliation

The task listed "client ≈471"; the actual rc.1 run is **480/480** (33 files) — identical to the
P9-F2 (alpha.1) baseline. Treat "471" as approximate; **480** is the authoritative count.

### Residual risks (for the main-agent vertical / live smoke)

- **Smoke (live instance) is PENDING-LIVE.** All five static gates are green, but the R118/R119/R121
  behaviors are *unit*-verified, not yet *instance*-verified against a running rc.1 harness. The
  3180 vertical must confirm the bottom-left global entry (R118), blueprint placeholder+disabled
  (R119-1), no-flicker mount (R119-2), and workspace prefill (R121) render correctly at runtime.
- **Runtime vitest must run build-first and isolated.** If the 3180 vertical re-runs the runtime
  unit suite, it must (a) build before vitest and (b) not run it concurrently with other heavy
  jobs, or the two environmental failure modes above will resurface (they are not rc.1 defects).
- **Build-pin metadata.** The 6 updated `CLIENT_COMMIT_HASH` pins stamp browser build metadata
  only; they are not exercised by the five gates (only by the PENDING-LIVE boot chain). The live
  smoke will be the first to exercise them.
- **R122 seam-swap re-run (post-§6).** After the §6 service-seam adaptation and the two
  inject-pin updates: runtime typecheck EXIT=0, runtime build EXIT=0, runtime vitest
  **1070/1070 re-confirmed** (log: `runtime-vitest-r122b.log`). The first post-change run
  (log: `runtime-vitest-r122.log`) differed only by one stale inject pin
  (`test/runtime.test.ts:57`) plus two `p6t1-parallel` failures — the known environmental
  flake under concurrent load (this §8 note); the clean isolated re-run was fully green. No
  other test expectation changed; no assertion weakened.
