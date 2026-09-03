# P9-T9 evidence — plugin registration + native DSH integration (P9-S6)

Plan authority: frozen P9 plan **P9-S6** (L1568–1607) — "complete the unique
client mount in `packages/client/src/plugin/client.ts`" — expected
registrations `conversation.view -> TeamView`, `conversation.input.dock ->
TeamDock`, `settings.section -> optional minimal Team settings/help`; the New
Team entry uses the actual public surface (S0 seam map,
`dev/agent-workflow/evidence/P9/host-seam-map.md`, pinned cd5ef814); explicit
non-registration: NO `conversation.chat.node` team marker, NO synthetic
trajectory. Native integration: open root/member session, native
Chat/Trajectory/fork, workspace picker, presets seam. **Gate P9-G6**
(L1600–1607): plugin mount clean; ordinary Session remains ordinary; Team
Root + Member child resolve correct perspective; no DOM navigation hack; no
private DSH import; CORE PATCH BUDGET remains 0. Branch
`task/P9-ui-legacy-reuse`, worktree `.worktrees/P9`. T9 is client-mount-only
per directive: the D3 compat-ack wire gap stays UI-disabled on the T8
surface (out of scope). CORE PATCH BUDGET remains **0**; no frozen-contract
edits; `references/deepseek-harness-test-use` untouched (linked for type
resolution only).

## Deliverables (per-file, measured line counts, CRLF)

| File | Status | Lines (final) | Diff (cached numstat) |
| --- | --- | ---: | --- |
| `packages/client/src/plugin/team-mount-core.ts` | new | 552 | +552/−0 |
| `packages/client/src/plugin/client.ts` | rewritten (thin glue) | 77 | +65/−42 |
| `packages/client/src/ui/TeamSettingsSection.tsx` | new | 42 | +42/−0 |
| `packages/client/src/ui/TeamSettingsSection.module.css` | new | 53 | +53/−0 |
| `packages/client/test/client-plugin-mount.test.ts` | new | 724 | +724/−0 |
| `packages/client/test/client.test.ts` | rewritten | 35 | +23/−27 |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | pin edit | 427 | +9/−2 |

Provenance note: `TeamSettingsSection.tsx` / `.module.css` were authored in
the T8 span (legacy help component, verbatim CSS) but remained untracked;
they ship in this commit because the `settings.section` registration is a T9
(P9-S6) deliverable. The T8 note does not claim them.

## Mount design (decisions D-T9-1 … D-T9-14)

- **D-T9-1** `dshHome` comes from the plugin row config
  (`apply(ctx, config?: TeamPluginClientConfig)`); absent or blank after trim
  → the `legacyInspect` face is OMITTED (the T8 degraded zero-state path).
  `generation.host.home` was rejected (it is the OS home dir, not DSH_HOME).
  The S8 composition row supplies the value.
- **D-T9-2** slots seam = `Pick<SlotCore, 'register'>` + a mirrored
  `inject(key, callback)` (the typed `register` comes from the linked
  ui-slots; `inject` lives on the unlinked ui-renderer, so it is mirrored
  locally as `() => TeamPluginEffect` disposer).
- **D-T9-3** `settings.section` is registered (minimal help page, id `team`,
  order 50, label `() => t('nav')`, locale `team`). The SlotMap entry is
  mirrored locally via `declare module '@deepseek-ai/dsh-client-ui-slots'`
  (ui-settings is NOT linked; the mirror cites the ui-settings shell contract
  `src/client/contract/slots.ts` L54 + L123–126: `{ kind: 'list'; scope:
  'root'; owner }` with owner = `close` only).
- **D-T9-4** `openTeamTab` is a documented degraded no-op: Seam 4 (cross-entry
  view activation) is ABSENT in the served web app, and the seam map forbids
  private store reach, DOM hacks (the legacy tab click), or a new framework
  extension. The dock jump button is the dock entry's own title button;
  CLIENT_LOCAL decision per the seam map.
- **D-T9-5** `ensureProjection` is single-flight: the session id first goes
  through `resolveTeamProjection(mirror, sessionId)` (invariant-9 candidate-
  root probe); `teamSessionId = resolution?.team.teamSessionId ?? sessionId`;
  the inflight map is keyed by the RESOLVED team id and deleted in
  `.finally()`; a typed failure leaves the mirror untouched; `pull` never
  rejects.
- **D-T9-6** the two published observables are bare `createSnapshotStore`s:
  the team-keyed projection mirror (value = `projectionFromWire(frame.
  projection)` — the PURE CAST, so republish is skipped when the frame ref
  did not change) and the per-team ledger states. The FIRST applied frame
  lazily creates + opens the team's ledger store (guarded by a set; `open`
  never rejects).
- **D-T9-7** the connection-generation subscription lives in a `ctx.effect`:
  snapshot `undefined` → `markConnectionLost` on every bound PROJECTION store
  (CLIENT_LOCAL backoff retry); defined → `markConnectionRestored` (cancels
  the retry, fires exactly one pull). No initial-snapshot read (the map is
  empty at apply time; stores self-bind on first pull). Ledger stores are
  deliberately NOT rebaselined (the frozen §6.3 guarantee is the projection
  pull only; ledger errors surface in `state.error`, manual refresh via
  `refreshTeamLedger`).
- **D-T9-8** `pullProjection` is a passthrough to the per-team projection
  store `pull` (the post-success final-state authority).
- **D-T9-9** presets: `ctx.remote.agentPresets.list()` → filter
  `broken === undefined` → map to `{id, name, description, isDefault}` (the
  `trust` field is dropped before the UI sees it).
- **D-T9-10** native sessions: `createRootSession` → `ctx.sessions.create(
  opts)`; `openSession` → `ctx.sessions.open(id)` (Seam 3, RENAMED public
  surface).
- **D-T9-11** `packages/client/package.json` has NO `./client` export
  subpath — S8/main-agent composition territory; recorded as a handoff item,
  NOT widened in T9.
- **D-T9-12** identity: `export const name = 'dsh-agent-team-client'` +
  `export const inject = ['slots', 'locale', 'sessions', 'connection',
  'remote'] as const` (only the services the mount reads; the skeleton's
  optional `get?`/`on?` surface was dropped). `const NS = 'team'` keeps the
  literal type; all nested seam interfaces are exported (declaration emit).
- **D-T9-13 (refined this span)** core/glue split:
  `src/plugin/team-mount-core.ts` is pure `.ts` (identity exports, all seam
  types, `applyTeamMount(ctx, {config, components})` with the full mount
  logic); `src/plugin/client.ts` is the thin glue — the SOLE module that
  value-imports the three `.tsx` components and wraps `applyTeamMount`.
  Rationale: the plain-node runner executes only `.test.ts` files, resolves
  no `.tsx`/`.css`, and the sandbox denies the child-process re-spawn that
  `--experimental-transform-types` would need. REFINEMENT: the original
  design typed `TeamMountComponents` members as `SlotComponent<never>`
  believing that was universal — WRONG direction (contravariance: `(props:
  never) => ReactNode` is NOT assignable to `(props: ComposedProps) =>
  ReactNode`). Members are now typed `typeof TeamView` / `typeof TeamDock` /
  `typeof TeamSettingsSection` via TYPE-ONLY imports (erased at runtime — the
  executed graph stays `.tsx`-free) so the three `register` call sites get
  full compile-time `ComposedProps` checking. Consequence: p4t6 pin = 596 +
  2 = **598** (the two NEW scannable `.ts` files).
- **D-T9-14 (new this span)** freeze-safe ledger bridge. The T4 ledger store
  documents `entriesBySequence` as "published by reference" (the store stays
  the mutation authority) — the snapshot's `ReadonlyMap` is the store's LIVE
  Map. The mount bridge originally embedded `store.getState()` into
  `ledgerStatesStore` (a `createSnapshotStore`); its `set()` deep-freezes
  state outside production (dsh-client-store engine contract), which froze
  the ledger store's live Map — `reset()` then died with
  `[Immer] This object has been frozen and should not be mutated` (exposed by
  the T9 teardown scenario). Fix (in the T9 bridge, NOT the T4 store): the
  bridge republishes `{...snapshot, entriesBySequence: new Map(snapshot.
  entriesBySequence)}` — the published state is freeze-safe, the live Map is
  never embedded, and the T4 store file stays byte-identical (its 13 tests
  remain green; no Map-identity assertions exist to break).

## Gates (worktree, final state after byte normalization)

- `node scripts/run-tests.mjs` → **2383 passed, 0 failed, 2383 total**
  (baseline 2360 + 24 new mount `it`s − 1 dropped skeleton `it`);
  `p9-t9-gate-run-tests.log`.
- `node node_modules/typescript/bin/tsc -p packages/client/tsconfig.json` →
  silent, exit 0; `node node_modules/typescript/bin/tsc -p packages/
  testkit/tsconfig.json` → silent, exit 0; `p9-t9-gate-tsc.log`.
- `node node_modules/typescript/bin/tsc -p packages/client/
  tsconfig.build.json` → EMITS (356 files), then `packages/client/dist`
  removed entirely; `p9-t9-gate-tsc-build.log`.
- p4t6 scan pin: 596 → **598** (`expect(scanResult.filesScanned).toBe(598)` /
  `expect(scanResult.files.length).toBe(598)`; +2 scannable `.ts` files —
  `src/plugin/team-mount-core.ts`, `test/client-plugin-mount.test.ts`; the
  glue/test rewrites are in-place; `.tsx`/`.css` outside the scanned
  extension set). The quarantine hit count stays **twenty-one** (p4t6
  passes, 10 tests, in the full run).
- Byte hygiene: all seven touched files CRLF, BOM-free, exactly one trailing
  newline — verified byte-wise via Node before staging.
- `git status --porcelain` → 0 after staging code + evidence.
- Single commit on `task/P9-ui-legacy-reuse`, parent `cda5737`. NO push.

## Test notes

- `client-plugin-mount.test.ts`: 24 `it`s over 4 module-level async
  scenarios A–D (shim constraint: `it` bodies are SYNCHRONOUS only; the
  scenarios run at top level and the `it`s assert on captured data).
  Scenario A = base mount (registrations, locale effect, faces, S5-A
  catalog, single-flight cold read, first-frame ledger auto-open,
  ordinary-session typed failure, legacyInspect, preset mapping, native
  sessions seam); B = generation rebaseline (loss → restore ⇒ exactly one
  new pull, retry cancelled, generation 2 applied); C = teardown (no
  carrier call after dispose); D = dshHome absent/blank ⇒ `legacyInspect`
  omitted, shape unchanged.
- Carrier double: the carrier result IS the frozen dispatcher result — the
  T4 "no re-wrap" rule (`team-remote-client.test.ts`: "returns a success
  envelope intact (value + provenance, no re-wrap)"). An initial draft
  re-wrapped in `{ok: true, value: ...}` and died with
  `PushTransportLossError: ... malformed seam envelope`; fixed to return the
  `RemoteResponse` verbatim.
- The mirror zero-state assertion captures the snapshot at scenario-A time
  (`mirrorBeforeColdRead`) — the `it` blocks run after EVERY scenario, so a
  live-store read inside an `it` would already see scenario B's generation-2
  mirror.
- Locale double: the rest-parameter `register` signature is what makes the
  double assignable to the real runtime's overloaded generic `register`
  under `strictFunctionTypes` (a single `Record<string, string>` signature
  is not).
- Flake disclosure: **no flakes triggered** — the final full run is 2383/2383
  clean. The known flake classes (p6t1-parallel timeout race,
  g8s1-generation-stamp `.tmp-fault` ENOTEMPTY) did not fire this span.

## Divergences / handoffs

- No wire divergences: every method call rides the frozen Remote contract v1
  envelope verbatim; the carrier double mirrors the T4 fixture rules.
- D-T9-11 (handoff): the client package exposes no `./client` export subpath
  — the S8 composition row must reference the module path that exists (or
  the main agent adds the subpath when it owns the package manifest).
- `scripts/composition-smoke.mjs` (the P1-T4 plugin-shape smoke) imports the
  BUILT entries and requires `pnpm build` — forbidden in this sandbox, so it
  could not be executed here. The plugin shape it checks (stable `name`,
  callable `apply`, well-formed `inject`) is covered by
  `client.test.ts` against the source exports instead; the main agent may run
  the smoke after a build.
