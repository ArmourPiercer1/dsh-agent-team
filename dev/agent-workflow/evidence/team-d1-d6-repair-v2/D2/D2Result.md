# D2 — Team-mode open/resume command: the dedicated "以 Team 模式打开 / 回到 Leader" entry

- task_id: D2 (Wave D / Team D1-D6 repair v2, serial single-writer lane D1→D4)
- model_route: qiyuan-self/qwen3.8-27b (runtime declaration confirmed qwen3.8-27b)
- base_sha: 21629c62d48b2bcb1899b09d05b46da6c943c1b4 (the D1 commit, verified clean worktree before start)
- branch: task/team-d1-d6-v2-D2
- worktree: .worktrees/team-d1-d6-v2-D2
- verdict: PASS
- scope: packages/runtime (S6 `team.ensureRootLive` real handler + root.ts port wiring), packages/client (AWAITED two-phase `openTeamMode` in the mount + the UI entries/badges on picker rows and the leader row, zh+en); TDD; install-surface artifacts rebuilt in the same commit.

## What was built

### 1. HOST — `packages/runtime/src/plugin/s6-remote.ts`: the real `team.ensureRootLive` handler

- The D1 placeholder body (which failed closed with the reserved
  `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED`) is replaced by the real
  handler, wired at the existing dispatch site — NO catalog/params/version
  change (the v3 surface is FROZEN by D1 and untouched; the code
  `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` STAYS in the closed set —
  D2 simply stops throwing it):
  1. `assertBoundRoot('team.ensureRootLive', requestedTeamSessionId)` runs
     FIRST (reusing the D1 bound-root guard verbatim): a foreign
     teamSessionId → typed `TEAM_REMOTE_FOREIGN_TEAM` before any port call
     (pinned: the port double is never invoked on the foreign path);
  2. `requireEnsureRootLivePort(options.ensureRootLive)` — the new OPTIONAL
     port `ensureRootLive?: (rootSessionId: string) => Promise<void>` in
     `S6RemoteOptions`; absent (test worlds without the live glue) →
     fail-closed typed `TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE` BEFORE
     any agent effect;
  3. the port's failure is mapped typed by `mapEnsureRootLiveError`:
     - upstream registry collision (`agent "<id>" is already registered` —
       the A3 Q1 live-first ordering makes a second agent under one session
       id structurally impossible) →
       `TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM` ("already live outside the
       Team glue — refusing to adopt it silently");
     - glue "neither live nor durable" →
       `TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT`;
     - every other glue failure → `TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED`
       (message preserved for diagnosis);
  4. success → `{ rootSessionId, mode: 'team', live: true }` (the frozen v3
     wire shape).
- All handler errors are `TeamPluginError` with string codes in
  `REMOTE_BACKING_ERROR_CODE_SET` → invariant 4b pass-through: the wire
  envelope carries `details.reason === 'domain-error'` with the code in
  `details.cause.code` (the tests assert exactly that shape).

### 2. HOST — `packages/runtime/src/plugin/root.ts`: the port wiring (NO glue change)

- `ensureRootLive: async (rootSessionId) => { await live.ensureLiveAgent(rootSessionId) }`
  added to the S6RemoteOptions literal right after `startRootAgent`.
- **NO glue change**: `TeamAgentBindings.ensureLiveAgent` is the ALREADY
  EXPORTED typed glue surface (types.ts) — the await wrapper only adapts
  the glue's `Promise<unknown>` result to the port's `Promise<void>`
  contract (the handler never consumes the return value — it builds the
  success envelope itself and maps failures from the thrown error).

### 3. CLIENT — `packages/client/src/plugin/team-mount-core.ts`: AWAITED two-phase `openTeamMode`

- `openTeamMode(rootSessionId)`: phase 1 `await teamRemote.teamEnsureRootLiveV3(rootSessionId)`
  (the D1 v3-stamped wrapper — unchanged), phase 2 `ctx.sessions.open(rootSessionId)` —
  the open happens ONLY after a successful ensure (the "ensure THEN open"
  ordering pinned by test; a typed failure never opens the session).
- Per-root client-local open-mode state: `openModeByRoot = Map<string, 'team'>`
  — set after the successful open, deleted on typed failure, cleared in the
  store-teardown effect, plus a dedicated fiber effect
  `'dsh-agent-team: open-mode reset on session switch'` (subscribes
  `ctx.sessions.list`, drops entries for roots that are no longer the
  current session). NO remote field, NO push, NO polling — the mode is
  strictly client-local, per root, for the lifetime of this mount.
- View inject face gains `openTeamMode` (the handler) and
  `teamOpenMode: (rootSessionId) => 'team' | null` (the state reader).
- `TeamOpenModeOutcome` is exported as a TYPE (the UI files import it
  type-only — erased at runtime, no cycle at execution time).

### 4. UI — `TeamView.tsx` / `TeamMembers.tsx` / locales / CSS

- Picker rows (persisted-roots list): when the `openTeamMode` face is
  present, each row renders the dedicated entry button
  (`data-team-mode-open-root`) labeled 以 Team 模式打开 / 回到 Leader; a
  typed failure renders the error note (`data-team-mode-open-error`) with
  code + message; the row's own open behavior and the D1 surfaces are
  unchanged (no-face worlds render exactly the D1 surface — pinned by the
  pre-existing `team-roots-zero-state.client.spec.tsx`, re-run green).
- Members section, root/leader row: the D1 leader navigation button is
  unchanged; alongside it (face present only) the same dedicated entry
  (`data-team-mode-open`) + the current open-mode badge
  (`data-team-mode-badge`, "Team 模式" / "Team mode") when
  `teamOpenMode(root) === 'team'` + the typed error note.
- 3 new locale keys in BOTH zh and en: `view.members.openTeamMode`,
  `view.members.openMode.team`, `view.members.openMode.error`
  (`{code}`/`{message}` interpolation matching the existing
  `member.command.error` pattern); TeamKey union extended accordingly.
- CSS: `.rootRowOpen` (TeamView.module.css), `.teamModeRow` /
  `.teamModeOpen` / `.teamModeBadge` (TeamMembers.module.css) — house
  token style, disabled states included.

## TDD evidence

- RED captured (before the implementation):
  - `red-host-ensure-root-live.txt` — 7 failed | 3 passed of 10 (the
    success path + all typed mappings red; only the guard/port-absent
    pins that D1's placeholder already satisfied were green);
  - `red-client-open-team-mode.txt` — 5 failed | 2 passed of 7 (the
    face-missing suite-level pin + the ordering/no-open pins red).
- GREEN after implementation:
  - focused: `d1-s6-remote-v3.test.ts` (14) + `d2-s6-ensure-root-live.test.ts`
    (10) = 24/24; `d2-open-team-mode.test.ts` (6) +
    `d2-team-mode-entry.client.spec.tsx` (7) +
    `team-roots-zero-state.client.spec.tsx` = 14/14.

## Gates (all run in this worktree)

- full root vitest suite (all `packages/*/test/**/*.test.ts`): **242 files /
  2666 tests — ALL GREEN** (after two environment/pin fixes, see below);
- full client package suite (adds the jsdom `.client.spec.tsx`): **555/556**
  — the single failure is the SAME pre-existing base failure D1 verified at
  a6d1778 (`team-creation-panel.client.spec.tsx` create happy path) —
  reported, NOT fixed (out of D2 scope);
- typechecks: runtime exit 0, client exit 0, testkit exit 0;
- `git diff --check`: clean (exit 0);
- install-surface: `pnpm build` exit 0 + `pnpm build:composition`
  `[check-artifacts-committed] OK: 1032 files` (exit 0 on the staged index);
  the 8 rebuilt artifacts (client-bundle.js + runtime dist root/s6-remote
  js/d.ts + maps) are committed in THIS commit (same-commit rebuild rule).

## Pre-existing / environment findings (recorded, handled in-evidence)

- `p4t6-session-event-scan` file-count pin was STALE at the D1 base: D1's
  6 scannable files + the C1/C2 line's 3 test files were never recorded
  after the TCM-D4 pin (618). D2 records the nine missed increments AND its
  own +2 (`d2-s6-ensure-root-live.test.ts` + `d2-open-team-mode.test.ts`);
  new pin = 629, verified against the live scanner (`.tsx` specs are out of
  the scanner's `.ts/.mts/.mjs` scope; `dist/` is skipped).
- `client-plugin-mount.test.ts` pinned "exactly three fiber effects" — D2's
  open-mode reset effect is the fourth; the two pins updated 3 → 4 with the
  exact label order (the test name records the D2 increment).
- `p5t4-intersection` / `p6t6-guard` module-level scratch worlds under
  `packages/testkit/test/.tmp-fault/` have run-once-per-clean-tree
  semantics: repeated full-suite runs (mine, while investigating the
  failures) left stale seed dirs that make later runs fail with
  "team_domain already exists" / "missing schema_meta.json". Cleaning the
  gitignored scratch dir and re-running the FULL suite once: 2666/2666
  green. Not a D2 regression; recorded for the suite operators.

## A3 lines consumed

- A3 Q1 (live-first ordering): the glue `ensureLiveAgent` resolves a live
  upstream agent and reuses it; the registry collision
  (`agent "<id>" is already registered`) is the ONLY way an "already live
  outside the glue" root can surface — mapped typed, never adopted.
- A3 Q2 (no durable artifact): the glue's "neither live nor durable"
  failure is mapped to the reserved `NO_DURABLE_ARTIFACT` code — the
  Team-mode ensure never silently mints a fresh session.

## What D2 deliberately does NOT do (scope discipline)

- no ordinary-mode fallback entry (D3); no restart re-verification (D4/G4);
  no port 3180 host operations (D4 only); no remote/storage/schema changes
  beyond the two v3 methods (the v3 catalog/params/version files are
  untouched by this commit); NO push; one atomic commit.

## Files

- source: `packages/runtime/src/plugin/s6-remote.ts`,
  `packages/runtime/src/plugin/root.ts`,
  `packages/client/src/plugin/team-mount-core.ts`,
  `packages/client/src/ui/TeamView.tsx`,
  `packages/client/src/ui/TeamMembers.tsx`,
  `packages/client/src/ui/locales.ts`,
  `packages/client/src/ui/TeamView.module.css`,
  `packages/client/src/ui/TeamMembers.module.css`;
- tests (new): `packages/runtime/test/d2-s6-ensure-root-live.test.ts`,
  `packages/client/test/d2-open-team-mode.test.ts`,
  `packages/client/test/d2-team-mode-entry.client.spec.tsx`;
- tests (updated, justified above):
  `packages/runtime/test/d1-s6-remote-v3.test.ts` (the stale bound-root
  pin now expects the D2 replaced-placeholder code
  `TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE` — the card says D2
  replaces the D1 placeholder),
  `packages/client/test/client-plugin-mount.test.ts` (3→4 effects),
  `packages/testkit/test/p4t6-session-event-scan.test.ts` (pin 618→629 +
  missed-increment record);
- evidence: `red-host-ensure-root-live.txt`, `red-client-open-team-mode.txt`,
  this file;
- rebuilt install-surface artifacts (8): `packages/client/composition-shim/
  client-bundle.js`, `packages/runtime/dist/packages/runtime/src/plugin/
  root.js`, `root.js.map`, `root.d.ts.map`, `s6-remote.js`,
  `s6-remote.js.map`, `s6-remote.d.ts`, `s6-remote.d.ts.map`.
