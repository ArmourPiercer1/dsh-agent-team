# P9-T7 evidence — ui: add new-team creation panel and member command flows

Plan authority: frozen P9 plan **P9-S5** — **S5-A** (catalog/workspace
native picker, presets seam, probe, warning ack, fatal disable, initial
work, create + native open) and **S5-B** (create, followup/send,
archive/restore/dispose, command pending/error, projection pull after
success) — + **Gate P9-G5** (plan L1555–1564: every command flow proves
NO optimistic authority patch / the Remote typed result is preserved /
the projection refresh occurs / the rendered final state comes from the
Projection). S5-C (config/governance) and S5-D (handoff/legacy) are T8.
Branch `task/P9-ui-legacy-reuse`, worktree `.worktrees/P9`. CORE PATCH
BUDGET remains **0**; no frozen-contract edits; `references/
deepseek-harness-test-use` untouched (linked for type resolution only).

## Scope rationale

T7 adds the two remaining team-tab interaction surfaces, both strictly
over the frozen Remote wire:

1. **S5-A — New Team panel** (`TeamCreationPanel` + the pure
   `team-intent-model.ts`): the zero state of a non-team session gains a
   "Start Team from Here" entry (UI §3) that opens the panel; the panel
   loads the blueprint catalog (`catalog.list` + per-row `catalog.get`
   for the §6 display block), the workspace feed (native, optional),
   and the runtime preset rows (the S0 seam-6 mapping), runs the
   pre-creation `intent.probe` (the ONLY environment input channel the
   frozen params carry — `environmentFacts`), renders the four
   compatibility verdicts (OPEN ready / WARNING rows + explicit ack /
   FATAL disable / unknown loud error), and executes the locked create
   sequence: native `ISessions.create` root (workspaceId optional) →
   remote `team.create` (the real root is RETAINED on typed failure,
   retry reuses it) → native `openSession(rootId)`.
2. **S5-B — member command flows** (`TeamMembers` rewrite +
   `TeamMemberDialogs` + the pure `team-member-commands.ts`): the
   §40 action matrix per lifecycle state (send/followup/archive on
   created+running, +resume on settled, restore/dispose on archived),
   the §17 create-instance dialog (template delegation, fresh-per-
   delegation notice, label/group/workspace payload), the single
   `dispatch()` that parses every `RemoteResponse` through
   `parseMemberCommandOutcome` and pulls the projection exactly once on
   success (never on error), and the local pending/error notes keyed by
   instanceId (commands) or `template:<id>` (creates).

Both surfaces are OPTIONAL injected faces (`creation`,
`memberCommands`): absent → the T6 projection-only view renders
unchanged (all pre-T7 specs pass unmodified except the D9 click-target
migration), present → full S5 behavior. The T9 mount step supplies the
real faces.

## Locked design decisions (T7)

- **Create sequence**: native `createRootSession(workspaceId?)` →
  remote `teamCreate` → native `openSession(rootId)` — the §4.3
  canonical order; the panel stays mounted through `teamCreate` so the
  CREATION_FAILED + retry state renders in the originating session.
  If T11 proves the host needs another order, that is an
  evidence-backed swap, not a UI change.
- **Typed failure retains the real root**: `createdRootId` survives a
  failed `teamCreate`; retry re-sends `team.create` on the SAME root
  (the root session is real and reachable — the UI never pretends the
  creation didn't happen). A NEW blueprint/revision selection clears
  `createdRootId`+`createError` (a new attempt binds a new root; the
  old one stays real).
- **initialWork** = `{prompt: <trimmed text>}`; blank → the key is
  OMITTED (the create button label flips 创建团队 ↔ 创建并发送 on trim
  non-emptiness).
- **Warning ack is a LOCAL UI gate**: the frozen `intent.probe` carries
  no ack parameter and `team.create` carries no ack field; the ack
  checkbox (explicit, NOT default-checked, UI §9) only unlocks the
  create button for BLOCKED_WARNING. It RESETS to unchecked whenever a
  new probe verdict lands or blueprint/revision/preset changes (drift
  semantics). The DURABLE ack (`compatibility.ack`/`reprobe` post-
  creation) is T8 (S5-C).
- **FATAL persona preset** (UI §7.4): a complete:true persona
  requirement with `reasonCode TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`
  → create disabled, no ack, no continue-anyway; the remedy text is
  rendered under the fatal block.
- **Preset → probe channel**: the selected preset travels to the probe
  ONLY as the persona environment fact (below); preset switching
  re-runs the probe LIVE (UI §7.3).
- **Member create dialog omits the initial-work field** (frozen
  `RemoteMemberCreateParams` payload has no such channel — recorded
  divergence from the §17.1 sketch; the wire is authoritative).
- **Send vs followup**: 'send' (the MESSAGE dialog, subject optional)
  is exposed on created/running/settled rows alongside 'followup'
  (the PROMPT dialog; SETTLED labels it 恢复/resume) — the §40 matrix
  verbatim.
- **Restore = direct click, no confirm** (UI §23); dispose/archive
  confirm; the "Delete member" copy ban holds (处置/dispose vocabulary
  only).
- **Transport loss**: the ONLY rejection kind (`PushTransportLossError`
  surface) → local note code `transport-loss` (documented marker, NOT a
  remote code); native create failure → local marker `native-error`.
  Both are distinct from preserved `RemoteErrorResult` codes.
- **Workspace select semantics**: the PANEL's draft stores
  `workspaceId` (the option value); the MEMBER-CREATE dialog stores the
  PATH string (the payload's `workspace` is a path on the wire). Both
  documented at the component.
- **Start Team from Here without prefill** in T7 (the session→team
  handoff prefill is S5-D, T8).
- **Draft persistence** via TeamView-held state within the page run
  (UI §5.3/§7.3: the draft is a UI convenience, never authority).

## The persona environment-fact decision (recorded for T11)

The frozen `RemoteIntentProbeParams` is the ONLY probe input surface:
`{blueprintId, blueprintRevision?, environmentFacts: readonly
RemoteSafeRecord[]}`. T7 therefore sends the selected runtime preset as
the single fact `{domain: 'persona', subject: <presetId>, available:
true, generation: 0}` — and a MISSING preset row is expressed by NOT
sending the fact (unavailable), which is how the host probe reaches the
§7.4 FATAL persona-conflict verdict. `RemoteTeamCreateParams` carries
NO preset field, so the selected preset does not travel to
`team.create`:

- **Open question 1 (preset materialization)**: the client's public
  `ISessions.create(opts?: {workspaceId?; cwd?; sessionId?})` has no
  agentPreset channel (core patch budget 0 — and none needed). The
  host-side preset substrate (`presetSubstrate` runtime plugin config)
  is T11 provisioning territory. T7 selects + probes the preset but
  does not bind it to the created root; the host `team.create` handler
  owns materialization. This is a T11 seam, not a T7 gap — no fake
  channel was invented.
- **Open question 2 (host BLOCKED_WARNING rejection)**: whether the
  host `team.create` re-probes and independently rejects
  BLOCKED_WARNING (forcing the durable `compatibility.ack`/`reprobe`
  of T8 before success) is a T11 evidence question. T7 implements the
  LOCAL gate per UI §9 and renders the host's typed rejection
  verbatim if one arrives.

## Gate P9-G5 proof mapping (every command flow)

For each flow, the spec proves (a) no optimistic authority patch,
(b) the Remote typed result is preserved verbatim, (c) the projection
refresh occurs exactly once on success (never on error), (d) the
rendered final state comes from the Projection.

| Flow | Spec evidence (test) | (a) no patch | (b) typed result | (c) pull | (d) projection state |
| --- | --- | --- | --- | --- | --- |
| `team.create` happy | panel (9) | local `creating` flag only | typed success value drives `openSession(rootId)`; the created team renders from the projection mirror on the new session | n/a (team.create success → session switch; team state arrives via projection) | row/team state re-resolved by `resolveTeamProjection` |
| `team.create` typed fail | panel (10) | root retained, no partial team state | error note = verbatim `code: message` from `RemoteErrorResult.error` | NOT pulled on error | retry re-sends on the SAME root; panel re-resolves from the mirror |
| native create fail | panel (11) | no root, no team | local marker `native-error: <msg>` (documented, not a remote code) | not pulled | — |
| followup | actions (7) | row status text STILL 运行中 after settlement | success `{ok:true}`; error note `命令失败：{code} {message} [{token}]` (9) | exactly 1× on success, 0× on error (9) | status from the projection, not a local flip |
| message (send) | actions (8) | same as followup | typed params preserved: `subject` key OMITTED when blank, present+trimmed when given; token echo | 1× per success | same |
| typed command error | actions (9) | cluster re-enabled (0 disabled) | `details.requestToken` echoed verbatim in the note | 0× | — |
| transport loss | actions (10) | same | local marker `transport-loss: <msg> [token]` | 0× | — |
| archive | actions (11) | confirm is LOCAL only | `memberArchive({teamSessionId, instanceId})` verbatim | 1× | row re-resolved from the mirror |
| restore | actions (12) | DIRECT (no confirm) — no dialog at all | `memberRestore` params verbatim | 1× | — |
| dispose | actions (13) | confirm local; copy ban (处置) | `memberDispose` params verbatim | 1× | — |
| member.create | actions (15)(16) | pending mark on the template key only | success `{ok:true}`; typed error note with token echo (16) | 1× on success, 0× on error | instance list re-resolved from the mirror |

## Spec migrate/drop + new coverage (Gate P9-G5)

- **NEW `test/team-intent-model.test.ts`** (273 LOC, 17 pure-model
  tests, runner-executed): catalog list/detail parsers (malformed-row
  fail-safe), the four-status probe parser (PASS rows skipped, unknown
  status/outcome → loud), `intentCreateGate` (the full label/enabled
  matrix incl. checking/unknown/ack drift), `isPersonaPresetFatal`,
  `selectDefaultPresetId` (team-row-wins), `intentEnvironmentFacts`
  (the persona fact + missing-row omission), `teamWorkspaceOptions`.
- **NEW `test/team-member-commands.test.ts`** (199 LOC, 11 tests,
  runner-executed): `parseMemberCommandOutcome` (success `{ok:true}` —
  data ignored; error verbatim incl. null-token echo), the four param
  builders (`buildMemberCreate/Send/Followup/LifecycleParams` — subject
  omission, payload shapes), `humanCaller`, `createRequestTokenGenerator`
  (`ui-1`, `ui-2`, …), `memberActionMatrix`/labels (the §40 matrix).
- **NEW `test/team-creation-panel.client.spec.tsx`** (513 LOC, 13
  jsdom tests): the full S5-A surface — catalog load/fail-safe, detail
  block, the exact probe params (the persona fact), OPEN→createAndSend
  label flip, WARNING rows + ack gate + ack reset on drift, FATAL
  persona block (exact remedy copy, no ack/retry, disabled), preset
  switch re-probe, the happy create sequence (mid-flight state,
  `createRootSession` 1× with `{workspaceId}`, `teamCreate` 1× with the
  trimmed initialWork, `openSession`), typed failure (root retained,
  retry reuses the root), native failure, workspace picker absence/
  presence, loud unknown verdict.
- **NEW `test/team-members-actions.client.spec.tsx`** (592 LOC, 16
  jsdom tests): the G5 matrix above + the §17 create dialog (template
  delegation, fresh notice, hidden workspace field, trimmed payload)
  and the face-absent negative (0 action clusters, 0 create entries).
- **`test/team-view.client.spec.tsx`** (8 → 12 tests): the D9 click
  target migrates to `button[data-member-instance-nav]` (the row is
  no longer the click target); the `useWorkspaces` seat stub changes
  from throwing to a real (empty-feed) hook since the view now reads
  it; +4 zero-state entry tests (face-absent unchanged, entry label,
  open/cancel round-trip, draft persistence across close/reopen).
- **`test/team-members.client.spec.tsx`**: nav migration only (D9
  target inside the new row wrapper); fixture/section coverage
  unchanged (335 LOC).

**jsdom execution status (T5 precedent, disclosed)**: the four .tsx
specs (29 new tests + the 4 team-view additions) are TYPE-CHECKED
under the full-face strict tsconfig (noUncheckedIndexedAccess,
verbatimModuleSyntax, isolatedModules) but are NOT executed in-session
— the plain-node runner globs `*.test.ts` only, and the sandbox EPERM
on piped child-process spawns keeps vitest unstartable here (the T4/T5
established gate). They execute under real vitest+jsdom in the S8 test
instance. The runner-executed client suite grew 87 → **115** (+28
pure-model tests); the full repo suite is **2282 passed, 0 failed**.

## Files changed (all under the worktree)

| File | LOC | Change |
| --- | --- | --- |
| `packages/client/src/model/team-intent-model.ts` | 418 | NEW, the S5-A pure model (parsers, gate, preset selection, env facts, workspace options) |
| `packages/client/src/model/team-member-commands.ts` | 279 | NEW, the S5-B pure model (outcome parser, param builders, caller, token generator, §40 matrix) |
| `packages/client/src/ui/TeamCreationPanel.tsx` | 603 | NEW, the S5-A panel (catalog/presets/probe/ack/fatal/create sequence) |
| `packages/client/src/ui/TeamCreationPanel.module.css` | 257 | NEW |
| `packages/client/src/ui/TeamMemberDialogs.tsx` | 304 | NEW, the four dialogs (create/prompt/message/confirm; dialog-local field state) |
| `packages/client/src/ui/TeamMemberDialogs.module.css` | 119 | NEW |
| `packages/client/src/ui/TeamMembers.tsx` | 596 | REWRITTEN: the S5-B action clusters, `dispatch()`, pending/error notes, the "+" create entry, the dialog wiring (optional faces) |
| `packages/client/src/ui/TeamMembers.module.css` | 209 | extended: cluster/action/pending/error/dialog-entry styles |
| `packages/client/src/ui/TeamView.tsx` | 219 | EXTENDED: optional `creation`/`memberCommands` faces, zero-state entry + panel mount, draft state, workspace options (face-absent → the T6 view verbatim) |
| `packages/client/src/ui/TeamView.module.css` | 63 | extended: zeroInner/zeroText/zeroStart |
| `packages/client/src/model/team-members-model.ts` | 173 | EXTENDED: the synthesized leader group + instance rows feed the action clusters |
| `packages/client/src/ui/locales.ts` | 452 | EXTENDED: ~75 T7 keys (intent.*, member.action.*, member.create.*, member.send/message/archive/restore/dispose.*) |
| `packages/client/test/team-intent-model.test.ts` | 273 | NEW, 17 tests (runner-executed) |
| `packages/client/test/team-member-commands.test.ts` | 199 | NEW, 11 tests (runner-executed) |
| `packages/client/test/team-creation-panel.client.spec.tsx` | 513 | NEW, 13 jsdom tests (type-checked; executed at S8) |
| `packages/client/test/team-members-actions.client.spec.tsx` | 592 | NEW, 16 jsdom tests (type-checked; executed at S8) |
| `packages/client/test/team-view.client.spec.tsx` | 463 | 8 → 12 tests + D9 nav migration + useWorkspaces stub |
| `packages/client/test/team-members.client.spec.tsx` | 335 | D9 nav migration only |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | 411 | scannable-count pin 586 → **590** (+4: the two model .ts + the two spec .ts; the two new .tsx specs and the CSS modules are outside the scanner's extension set) + P9-T7 pin comment |

## Gates (logs in this directory)

| Gate | Result | Log |
| --- | --- | --- |
| tsc full face (src + test + vitest.config.ts) | round 1: 11 mechanical errors, ALL in the new spec files (missing export import path, element generics, one union narrowing); round 2: **EXIT 0** | `t7-typecheck-1.log` |
| tsc build face (src only) | **EXIT 0**, dist removed | `t7-build-1.log` |
| full suite (`node scripts/run-tests.mjs`) | **2282 passed, 0 failed** (client 115/115; the new .tsx specs are not runner-executed by design); p4t6 green at 590 | `t7-runtests-full.log` |
| testkit tsc | **EXIT 0** | (run output; the p4t6 pin test is in the suite log) |

No flake observed: the runtime package ran clean on the single suite
pass (the known p6t1 quota-race flake class did not trigger).

## Red lines

No frozen-contract or plan edits; no upstream patch (budget 0);
`references/deepseek-harness-test-use` pristine; legacy
`references/deepseek-harness` untouched; `graph.yaml` /
`SESSION_ROUTER_LOG.md` untouched (main-agent-owned); no push. The
p4t6 change is the count pin + its pin comment only — no denylist
vocabulary change, no quarantine-set change (the six marker-spec
fixture tokens stay quarantined until the T10 DROP).
