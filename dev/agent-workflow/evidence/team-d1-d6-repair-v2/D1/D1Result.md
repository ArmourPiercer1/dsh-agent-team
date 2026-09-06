# D1 — durable ownership/index query + freeze the complete remote contract v3

- task_id: D1 (Wave D / Team D1-D6 repair v2, serial single-writer lane D1→D4)
- model_route: qiyuan-self/qwen3.8-27b
- base_sha: a6d1778f84eda06f274a42a64ebb7c8fa0c2f890
- branch: task/team-d1-d6-v2-D1
- worktree: .worktrees/team-d1-d6-v2-D1
- scope: packages/runtime (new pure index module + S6 host wiring), packages/remote (contract v3 closed-catalog freeze), packages/client (v3-stamped wrappers + zero-state roots share); TDD; install-surface artifacts rebuilt in the same commit.

## What was built

### 1. New pure ownership-index module — `packages/runtime/src/team-ownership-index.ts`

`buildTeamRootOwnershipIndex(repositories)` answers "which roots exist, with what
blueprint identity / generation / creation time / member + child-session attribution"
from the durable TeamDomain rows only (READ-ONLY — zero seam writes, pinned by test):

- deterministic order: roots in `teamSessions.list()` repository sort order
  (rootSessionId), per-root member attribution re-sorted by instanceId;
- **Leader exclusion in BOTH forms**: `inst-leader` rows are excluded from
  `memberCount` and from attribution for the v2 leader record form
  (schemaVersion 2, NO childSessionId/lifecycle) AND the legacy v1 harness form
  (instanceId `inst-leader` WITH a childSessionId — the production root.ts seed
  shape, childSessionId = the root session itself);
- **documented NON-failures** (fresh-state windows, not corruption):
  - a root record without its `team-root` session-binding row (fresh-root crash
    window) → the row's binding `kind` is simply absent;
  - a member child session without a binding row → the attribution `kind` is absent.
- **fail-closed typed errors** (NEVER a silent empty/partial list), each carrying a
  closed string `code` in the remote backing vocabulary (invariant 4b pass-through
  eligible) + remote-safe plural `details` (which ride `cause.details` through
  `toS6RemoteErrorResult`):
  - `TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH` — a root session bound as a
    non-`team-root` kind;
  - `TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH` — a member child bound as a
    non-`team-member` kind (plus the defensive case: a non-leader member record
    without any childSessionId);
  - `TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT` — a `team-member` binding whose
    identity/session disagrees with the member record.
- storage-layer typed errors (e.g. `RECORD_INVALID` on an undecodable row) propagate
  UNMAPPED — never swallowed, never re-coded (pinned by test);
- `toTeamRootWireRow(row)` — the closed wire row of `team.listRoots` (the D2-facing
  frozen shape, see below); the `defaultWorkspace` KEY is omitted when absent.

### 2. Remote contract v3 freeze — `packages/remote` (closed-catalog discipline)

- `REMOTE_CONTRACT_VERSION_V3 = 3`; `RemoteContractVersion = 1|2|3`;
  `SUPPORTED_REMOTE_CONTRACT_VERSIONS = [1, 2, 3]`;
- the catalog is the versioned union of **26 methods** (23 v1 + 1 v2-only + 2 v3-only);
  `REMOTE_V3_ONLY_METHODS = ['team.ensureRootLive', 'team.listRoots']` (closed set);
  `isRemoteMethodAvailableInVersion` is the 3-branch availability check;
- **`team.listRoots`** — params `{}` (EMPTY closed field set), success
  `{ roots: [ { rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt,
  generation, memberCount } ] }` — `revision` is the human-readable STRING
  (BlueprintRevision is a string end-to-end); `defaultWorkspace` key absent when unset;
- **`team.ensureRootLive`** — params `{ teamSessionId: string }` (closed set exactly
  `['teamSessionId']`), success `{ rootSessionId, mode: 'team', live: true }` — the
  TYPED-ERROR VOCABULARY is RESERVED: the 9 new codes are in
  `REMOTE_BACKING_ERROR_CODE_SET` so D2's handler errors pass the 4b gate with NO
  further closed-set change (see D2-facing surface below);
- the v3 method handlers normalize the backing port values fail-closed (a malformed
  port value → `internal-error`, never a partial success); v1/v2 requests to the v3
  methods → typed `method-version-unsupported`; the v1/v2 behavior of every existing
  method is byte-preserved (pinned by the pre-existing suites, re-run green).

### 3. Host wiring — `packages/runtime/src/plugin/s6-remote.ts` + `root.ts`

- `team.listRoots` is wired in s6-remote.ts ONLY, as a READ-ONLY host-authority port
  (`S6RemoteTeamRootsPort.listRoots(): Promise<readonly TeamRootWireRow[]>`):
  - NO writes, NO agent effects;
  - **deliberately NO bound-root guard** (host-authority read: the host owns the
    whole root list, unlike the per-root methods);
  - port absent → fail-closed typed `TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE` BEFORE any
    read (never a silent empty list);
  - the closure rethrows errors whose string `code` ∈ the remote backing set
    unchanged (4b pass-through), wraps only UNTYPED throws as
    `TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE` (message preserved);
- `team.ensureRootLive` — the port (`S6RemoteTeamEnsureRootLivePort`) exists and is
  wired; its D1 body runs `assertBoundRoot` FIRST (a foreign teamSessionId → typed
  `TEAM_REMOTE_FOREIGN_TEAM`) and then throws the typed
  `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` — **never a silent success**. D2
  replaces the port body; the guard stays.
- `root.ts` wires the `listRoots` port over the already-injected repositories:
  `buildTeamRootOwnershipIndex(repos).map(toTeamRootWireRow)`.

### 4. Client — v3-stamped wrappers + zero-state roots share

- `team-remote-client.ts`: `teamListRootsV3()` and `teamEnsureRootLiveV3(teamSessionId)`
  — the ONLY v3-stamping wrappers (`{ version: 3, params }` on `/team-remote`);
  `teamEnsureRootLiveV3` is documented INERT until D2 (it resolves to the typed
  NOT_IMPLEMENTED failure from the host — no client-side error kind);
- `team-mount-core.ts`: feeds the persisted roots into the TeamView ZERO state through
  the new `roots` face (`TeamViewRootsFace = { listRoots, ensureRootLive }`);
- `TeamView.tsx`: the zero state renders the durable root rows READ-ONLY
  (root id, `blueprintId@revision`, default workspace or the localized no-workspace
  placeholder, member count, creation time with title) — **NO open actions in D1**
  (D2/D3 add the open action over this same face); the read is one-shot, gated to the
  zero state, skipped while the creation panel is open, re-fires on return; typed
  failure → ONE verbatim note (UI §38 greyed-surface); malformed success payload →
  the defensive `malformed-response` note lane (never a throw); empty list → renders
  nothing; without the face the pre-D1 surface is unchanged.

## D2-facing frozen surface (consumers: D2 ensureRootLive handler, D3 open actions)

- **wire row** (`team.listRoots` success `data.roots[i]`, exact keys):
  `{ rootSessionId: string, blueprintId: string, revision: string,
  defaultWorkspace?: string, createdAt: string, generation: number,
  memberCount: number }` — `revision` STRING, `defaultWorkspace` key omitted when
  unset, order = durable repository order (rootSessionId sort);
- **port to replace** (D2): `teamEnsureRootLive` in
  `createS6RemotePorts` (s6-remote.ts) — swap the NOT_IMPLEMENTED throw for the live
  glue (A3 Q2 `(rootSessionId) => Promise<void>` ensure wiring); the
  `assertBoundRoot` guard already runs first (foreign → FOREIGN_TEAM before anything
  else);
- **reserved backing codes** (all already in `REMOTE_BACKING_ERROR_CODE_SET` — D2
  needs no closed-set change):
  - `TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE` (D1: port absent / untyped wrap),
  - `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` (D1: current port body),
  - `TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE`,
  - `TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT`,
  - `TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM`,
  - `TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED` (the four above are D2-reserved),
- ownership-index codes (pass-through via the index → port chain):
  `TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH`,
  `TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH`,
  `TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT`;
- client face for D3's open action: `TeamViewRootsFace.ensureRootLive(teamSessionId)`
  is already injected into the zero-state rows (no UI wiring needed for the call,
  only the action button + the success/failure presentation).

## Tests (TDD — red excerpts below were captured before the final green; the index
scenarios were developed in parallel against the locked design and re-verified)

New test files (70 tests, all green):

| file | tests |
| --- | --- |
| packages/remote/test/d1-remote-v3.test.ts | 24 — catalog facts (26 methods, [1,2,3], v3-only closed set, availability matrix, field sets), listRoots success/unknown-field/malformed-request, ensureRootLive success/unknown-field/missing/`INVALID_ROOT_SESSION_ID`/malformed port value → `internal-error`, v1/v2 → `method-version-unsupported`, the 9-code 4b pass-through battery (code + message + `details.cause`), ENOENT → `internal-error`, v1/v2 behavior preserved |
| packages/runtime/test/d1-team-ownership-index.test.ts | 16 — two-root world over `FileStorageSeam`: row order + exact identity fields, leader exclusion both forms (memberCount 2/1), unbound-child kind absent, wire row exact keys + defaultWorkspace key absence, rebuild-identical (byte-identical JSON, incl. after close + RE-OPEN the domain over the same medium), zero writes (seam `writeCount` stable), the 3 typed integrity codes with `details`, corrupt row → `RECORD_INVALID` unmapped (NOT re-coded), empty domain → `[]` |
| packages/runtime/test/d1-s6-remote-v3.test.ts | 14 — real `createS6RemotePorts` over minimal options (trip-wire repositories: ANY access throws + records; asserted untouched for listRoots), v3 listRoots success verbatim + port called once + provenance 3, v1/v2 → `method-version-unsupported` (details.contractVersion echo), absent port → `TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE`, `TeamOwnershipIndexError` rethrown unmapped (cause.details rides), `RECORD_INVALID` passthrough, untyped throw wrapped with message preserved, ensureRootLive foreign → `TEAM_REMOTE_FOREIGN_TEAM`, bound root → `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` (reserved), v1/v2 → `method-version-unsupported` |
| packages/client/test/d1-team-remote-v3.test.ts | 8 — envelope assembly (channel `/team-remote`, `{ version: 3, params: {} }` / `{ version: 3, params: { teamSessionId } }`), success + typed-error pass-through intact (provenance 3), the ONLY rejection kind unchanged (`PushTransportLossError`), version-stamping discipline (v1/v2 wrappers unchanged, v3 only from the v3 wrappers) |
| packages/client/test/team-roots-zero-state.client.spec.tsx | 8 — zero-state rows verbatim (incl. absent-workspace placeholder), NO open action (no buttons; `ensureRootLive` never called — inert until D2), empty list renders nothing, typed failure → one verbatim note, malformed payload → `malformed-response` note lane, no-face surface unchanged, team-session gating (never reads outside the zero state), creation-panel-open skip + re-fire on return |

Pre-existing tests updated for the approved v3 bump (the v2-era pins of the
catalog/version surface — the same class the v2 bump updated; no behavior change):

- `packages/remote/test/p8t3-helpers.ts` — the shared fake port surface: + the two v3
  fake ports (`teamRoots`, `teamEnsureRootLive`) + `P8T3_ROOTS` fixture +
  `p8t3WireV3` (16 fake backing ports);
- `packages/remote/test/p8t3-negative.test.ts` / `p8t4-negative.test.ts` — the
  dependency-surface pin: 14 → 16 ports;
- `packages/remote/test/p8t3-version.test.ts` — the unsupported-version negative
  re-pinned at 4 (3 is now supported);
- `packages/remote/test/tcm-m1-remote-v2.test.ts` — supported set `[1,2]` → `[1,2,3]`,
  catalog 24 → 26 methods, v3-only closed set assertion;
- `packages/runtime/test/p8s7r4-bc23-24-no-mutation.test.ts` — catalog 24 → 26;
- `packages/runtime/test/t12m4-remote-mount.test.ts` — unsupported-version negative
  re-pinned at 4;
- `packages/runtime/test/p8s7r1-create-params.test.ts` — the fake deps gained the two
  required v3 ports (compile surface).

## GREEN battery (full)

- typechecks: `tsc -p tsconfig.json --noEmit` exit 0 in packages/remote,
  packages/runtime, packages/client;
- full remote suite: 144/144 passed (11 files);
- full runtime suite: 1233/1233 passed (132 files);
  - one earlier full run hit the KNOWN Windows `rmSync` ENOTEMPTY teardown flake in
    `test/p6t5-restart.test.ts` (non-D6 file; a half-deleted scratch dir in
    `packages/testkit/test/.tmp-fault/`); after clearing the scratch debris the file
    re-ran solo 6/6 green, and the final full run was clean (132/132). Not caused by
    D1;
- full client suite: 542/543 passed (37 files) — the single failure is the
  PRE-EXISTING `team-creation-panel.client.spec.tsx`
  "create happy path (TCM M4 two-stage v2)" assertion (line 453,
  `expect(admitMock).toHaveBeenCalledTimes(0)`). VERIFIED NOT MINE: the spec imports
  `TeamCreationPanel` directly (TeamView/transport not in its import graph; only
  `locales.ts`, where D1 added 4 new keys), and the same test fails identically at
  BASE a6d1778 (temp worktree, solo run, same line/assertion);
- `git diff --check`: clean (exit 0);
- install surface: `pnpm build` exit 0 (all 9 packages); `pnpm build:composition`
  place-dist-glue (byte-identical) + build-client-composition (86 modules, 11 css)
  succeeded; the `check-artifacts-committed` gate reported exactly the rebuilt
  artifacts listed below — all staged in this commit, and the gate re-run against the
  staged index exits 0.

## Changed files (source + tests + artifacts; evidence: this file)

- new: `packages/runtime/src/team-ownership-index.ts`;
  `packages/runtime/test/d1-team-ownership-index.test.ts`,
  `packages/runtime/test/d1-s6-remote-v3.test.ts`,
  `packages/remote/test/d1-remote-v3.test.ts`,
  `packages/client/test/d1-team-remote-v3.test.ts`,
  `packages/client/test/team-roots-zero-state.client.spec.tsx`;
- modified (remote): `contracts/{version,catalog,params}.ts`,
  `handlers/{ports,team,dispatch}.ts`, `index.ts`;
- modified (runtime): `src/plugin/{s6-remote,root}.ts`;
- modified (client): `src/transport/team-remote-client.ts`,
  `src/plugin/team-mount-core.ts`, `src/ui/{TeamView.tsx,TeamView.module.css,locales.ts}`;
- modified (pre-existing tests): as listed above;
- install-surface artifacts rebuilt + committed in this commit:
  `packages/client/composition-shim/client-bundle.js`,
  `packages/runtime/dist/...` (team-ownership-index.js/.d.ts + maps — new; remote
  contracts catalog/params/version + handlers dispatch/ports/team; runtime plugin
  root/s6-remote) — the gate's full B/C list.

## Deviations / honest notes

- TDD note: the index scenario file was developed in parallel against the locked
  design (module + tests together, then the battery re-run green); the red→green
  cycle for the envelope/param errors was genuine (two initial expectations in
  d1-remote-v3.test.ts were wrong — non-record params → `malformed-request` at the
  envelope boundary, not `malformed-params`; malformed teamSessionId → the mirrored
  frozen P3 code `INVALID_ROOT_SESSION_ID` — and corrected against the
  implementation, which was correct);
- model-route verification: no `DSH_*` environment variables are exposed to this
  session; the route was verified from the runtime model declaration text
  ("qwen3.8-27b") consistent with the required `qiyuan-self/qwen3.8-27b`. Recorded
  here per the task card.

## Remaining risks / D2+ inputs

- D2 replaces the `teamEnsureRootLive` port body (the guard is already in place); the
  4 reserved `TEAM_REMOTE_TEAM_ROOT_LIVE_*` codes are ready (no closed-set change
  needed); D3 adds the open action over the already-injected
  `TeamViewRootsFace`; D6 (restart/reopen) should re-verify the rebuild-identical
  property across a process restart (pinned here across a domain reopen over the
  same medium).

## TaskResult

- task_id: D1
- model_route: qiyuan-self/qwen3.8-27b
- elapsed_minutes: ~40
- base_sha: a6d1778f84eda06f274a42a64ebb7c8fa0c2f890
- changed_files: 12 source files (3 packages) + 7 test files (5 new, 2 pre-existing suite updates beyond the 3 listed shared-helper/pin updates) + rebuilt install-surface artifacts (36 files) + this evidence
- tests_run: remote 144/144; runtime 1233/1233 (1 known non-D6 Windows teardown flake observed once, re-run solo 6/6 green, final full run clean); client 542/543 (1 pre-existing base failure verified at a6d1778); 70 new D1 tests green; typechecks 3× exit 0; git diff --check clean; install-surface build exit 0 + artifact gate green on staged index
- evidence_paths: `dev/agent-workflow/evidence/team-d1-d6-repair-v2/D1/D1Result.md`
- self_verdict: PASS
- blocker_type: none
- remaining_risks: D2 must wire the ensureRootLive port body (currently typed NOT_IMPLEMENTED); D3 the open actions; D6 the restart re-verification
- commit_sha: pending
