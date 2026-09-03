# P9-T8 evidence — ui: add config/policy/compat/handoff surfaces

Plan authority: frozen P9 plan **P9-S5** — **S5-C** (effective config
read; override set/reset; PolicyState read/set; compatibility
get/ack/reprobe; plan L1542–1547) and **S5-D** (handoff prepare/create;
client-local continue/cancel; legacy.inspect banner/zero-state; plan
L1549–1553) — + **Gate P9-G5** (plan L1555–1564: every command flow
proves NO optimistic authority patch / the Remote typed result is
preserved verbatim / the projection pull occurs exactly once on success
(never on failure) / the rendered final state comes from the
Projection). T8 is the last UI task of S5; T9 mounts the real faces
(including the dshHome closure the parameterless `legacyInspect` seam
expects). Branch `task/P9-ui-legacy-reuse`, worktree `.worktrees/P9`.
CORE PATCH BUDGET remains **0**; no frozen-contract edits;
`references/deepseek-harness-test-use` untouched (linked for type
resolution only).

## Scope rationale

T8 adds the remaining S5 surfaces, all strictly over the frozen Remote
wire v1 (23 methods):

1. **S5-C — Governance** (the pure `team-governance.ts` + the
   `TeamGovernance` component + `TeamGovernance.module.css` +
   40 `governance.*` locale keys): the compatibility badge (Projection
   `snapshot.compatibility.status` → mark/word; an unknown future
   status renders the raw state verbatim, never silent), the aggregate
   counts + generation from the Projection, the compat REVIEW read
   (`compatibility.get`) with its typed-failure note and labeled
   fresh-read detail, the human RECHECK (`compatibility.reprobe` with
   the closed `CAPABILITY_GENERATION_CHANGE` trigger — the only
   wire-legal trigger for a human action), the ack control (DISABLED
   with the explicit wire-gap reason — see D3), the PolicyState REVIEW
   read (`policyState.get`) + COMMIT (`policyState.set`: locked cells
   marker-only, kind allow/deny editors, allow requires ≥1 item,
   commit sends every non-`none` draft on the projection `stateId`),
   and the per-member effective-config card (the frozen four lanes +
   sorted `permissions:<name>` lanes, the English state words, the
   `effective from <step>` flag, the §19 hard-policy line
   Requested/Effective/Reason) with the Explicit-Human-Override editor
   (`override.get` read / `override.set` / `override.reset`, scope
   `instance`, targeting the member).
2. **S5-D — Handoff** (the pure `team-handoff.ts` + the
   `TeamCreationPanel` extension + 12 `handoff.*` locale keys): the
   zero-state creation panel gains the §32.2 handoff block (enabled by
   default when BOTH the `handoff` face and the `handoffSource` are
   present; the §32.2 prefill of the Default workspace from the
   session's workspace feed, applied only to an empty draft) —
   `handoff.prepare` on enable (a read-only preview convenience; its
   typed failure renders verbatim and NEVER blocks create, because
   `handoff.create` snapshots the source itself), the create button
   routing a handoff attempt to `handoff.create` (fresh token, no
   `staged`), the five create-state arms (completed /
   completed-without-handoff → `openSession(rootSessionId)`; awaiting-
   decision / creation-failed → the §32.4 `Context handoff failed`
   note + decision triad; unknown kind → fail-safe arm), and the
   client-local triad semantics (Retry / Continue without handoff /
   Cancel — see D4/D6).
3. **S5-D — Legacy** (the pure `team-legacy.ts` + the `TeamView`
   zero-state extension + 6 `legacy.*` locale keys): the one-shot
   `legacyInspect` read for the ZERO state (a read, not a command
   flow — no projection pull) that decides WHICH zero state renders:
   `legacy-team` REPLACES the ordinary zero state with the persistent
   read-only banner (UI §34.1 verbatim) + the decoded legacy summary
   (best-effort rows; NO Start-Team entry — UI §34.3 forbidden list);
   `native-fallback` keeps the ordinary zero state; typed failure /
   transport loss / unrecognized status keep the ordinary zero state +
   ONE verbatim note (UI §38: a greyed surface states its reason).

New faces are OPTIONAL props; absent ⇒ T6/T7 rendering is byte-for-
byte unchanged (covered: the handoff face-absent tests, the legacy
seam-absent test, the governance section gated on
`governance !== undefined`).

## Design decisions and divergences (wire is authority)

- **D1 — handoff carries no blueprint (v1)**: the frozen closed
  `handoff.create` params are `{sourceSessionId, requestToken, staged?}`;
  the v1 production host wiring (`createHandoffTeam`) pins the
  Blueprint row's bound blueprint and ignores `staged`. DIVERGENCE
  from UI §32.2 "Blueprint = user select": the blueprint/preset/
  workspace selections apply to the NON-handoff path only; the handoff
  attempt sends ONLY `{sourceSessionId, requestToken}`.
- **D2 — post-creation provenance deferred**: UI §32.3 places
  `Started from Session: …` / `Handoff generated at: …` in the NEW
  team's Root Team detail view, which T8 does not cover — the panel
  flow ends at `openSession(rootSessionId)`. The `handoff.provenance`
  locale key is added but UNUSED (reserved copy for the team-detail
  surface).
- **D3 — compat-ack wire gap**: `compatibility.ack` requires a
  `requirementId`, but the frozen `compatibility.get` exposes AGGREGATE
  counts only — the UI cannot enumerate a per-requirement id. The ack
  control renders DISABLED with the explicit reason (UI §38); the
  model builder + parser are complete and covered by model tests, so
  the wire fix is UI-free.
- **D4 — typed RESPONSE failure gets the full triad**: a typed
  `handoff.create` response failure (`ok:false`, no stored state)
  renders the full frozen `Retry / Continue / Cancel` triad with a
  FRESH-token retry — a design choice mirroring the awaiting-decision
  fallback; no operation exists under the used token.
- **D5 — the policy commit sends EVERY non-`none` draft**: the REVIEW
  rehydrates drafts from the wire values (`cellToDraft`), so COMMIT
  sends wire values read back PLUS the user's edits — not only touched
  cells. Re-sending an unchanged cell is idempotent (safe under both
  host partial-map readings); the `stateId` always comes from
  `snapshot.policyState` (projection — never invented); locked cells
  render marker-only with no editor.
- **D6 — cancel is terminal within the panel run** (fixed this task):
  Cancel discards the handoff attempt with NO remote call and disables
  the checkbox; a later plain Create click must route to the standard
  non-handoff path, not silently re-open the attempt. The
  `handleCreateClick` routing condition gained `!handoffCanceled`;
  the handoff spec's cancel test pins exactly this.
- **D7 — legacy zero-state narrowing**: the component uses the direct
  discriminant `inspection.status === 'unknown'` (the model's
  `legacyZeroStateKind` helper is a selection, not a type guard — it
  stays covered by the model tests). Legacy-team detection REPLACES
  the ordinary zero state (banner + decoded read-only summary, NO
  Start-Team entry — conservative reading of UI §34.1 (read-only) +
  the §34.3 forbidden executable list); the legacy inspect face is
  parameterless `() => Promise<RemoteResponse>` (the dshHome closure
  is bound at the T9 mount).
- **D8 — badge and recheck trigger**: the badge is Projection-driven
  (`snapshot.compatibility.status` → the frozen mark/word map); the
  human "Recheck" (§10.4) uses `CAPABILITY_GENERATION_CHANGE`
  (`HUMAN_RECHECK_TRIGGER`) — the reprobe builder throws
  `GOVERNANCE_MALFORMED:` for any of the other four frozen triggers,
  so a human action can never impersonate a system event.
- **Reads are not command flows** (T7 catalog precedent):
  `compatibility.get` / `policyState.get` / `override.get` /
  `handoff.prepare` / `legacy.inspect` never pull the projection;
  their typed failures render verbatim as LOCAL notes; their success
  payloads render only as explicitly labeled transient detail (fresh
  read / summary preview / decoded summary) — durable state stays
  Projection-driven.

## Gate P9-G5 proof mapping (every command flow)

For each flow, the spec proves (a) no optimistic authority patch,
(b) the Remote typed result is preserved verbatim, (c) the projection
pull occurs exactly once on success (never on error), (d) the
rendered final state comes from the Projection. Spec references are
the jsdom test titles in `test/team-governance.client.spec.tsx`
("governance") and `test/team-creation-handoff.client.spec.tsx`
("handoff").

| Flow | Spec evidence (test) | (a) no patch | (b) typed result | (c) pull | (d) projection state |
| --- | --- | --- | --- | --- | --- |
| `compatibility.reprobe` (Recheck) | governance: "the human Recheck re-probes … pulls once on success" + the typed-failure and transport-loss tests | badge/counts stay Projection-driven; the local pending flag only gates the button | typed failure renders `Error: PROBE_REJECTED: probe budget exhausted [governance-1]` (token echo in brackets; a null token renders none); transport loss → the local `transport-loss` marker | exactly 1× `pullProjection(LEADER)` on success; 0× on both failure arms | badge + counts re-render from `snapshot.compatibility`; unchanged on failure |
| `policyState.set` (commit) | governance: "a policy commit sends a PARTIAL cell map … pulls once" + the typed-failure and inert tests | the cell editors hold LOCAL drafts only; nothing lands in the snapshot before the response | typed failure renders `Error: POLICY_INVALID: unknown capability [governance-1]` | 1× on success; 0× on typed failure; 0× when inert (no command sent) | the policy label + cells re-render from the projection `policyState` (the committed map is never written locally) |
| `override.set` | governance: "an override set targets the member instance … pulls once" + the typed-failure and inert-until-items tests | the override read shows the last Projection value; edits are local drafts | typed failure renders verbatim `code: message [token]` | 1× on success; 0× on failure; 0× while the button is disabled | the effective-config lanes re-render from the projection; the override is re-read as a READ (no patch) |
| `override.reset` | governance: "an override reset targets the member instance … pulls once" | same as override.set | the typed-failure arm is SHARED with override.set on the identical `dispatch()` path (its error invariants are proven by the set arm) | 1× on success; 0× on failure (shared dispatch) | same as override.set |
| `handoff.create` (new-team path) | handoff: the completed / completed-without-handoff / creation-failed / typed-response-failure / transport-loss tests + the two retry-semantics tests | local busy flag + local state only; no optimistic "team created" row or provenance | the create state is parsed VERBATIM from `response.value.data` (kind, replayed, the team ids, the failure code + message; an unknown kind keeps the raw record in the fail-safe arm); a typed response failure keeps the frozen triad | NO explicit `pullProjection` on the panel face — on success the new team's projection is cold-pulled exactly ONCE by the new session's TeamView mount effect after `openSession(rootSessionId)`; 0× on every failure arm (no session switch) | the new team renders from its own cold projection frame, not from the create response beyond the session id |
| `team.create` (Continue without handoff) | handoff: "Continue without handoff routes to the standard non-handoff path" | T7 semantics re-exercised through the handoff panel (the handoff create stays at its 1× attempt) | T7 semantics (verbatim typed error, root retained) | T7 semantics (no panel pull; the new session's cold pull) | same as T7's table |
| READS: `compatibility.get` / `policyState.get` / `override.get` / `handoff.prepare` / `legacy.inspect` | governance: the three "is a read: no projection pull" tests + the typed-failure note tests; handoff: the prepare tests; legacy: all 8 tests (one-shot read, no arguments) | local note/detail state only | typed failures render verbatim as local notes (`Error: code: message` / `Legacy inspection failed: code: message`); transport loss → the local `native-error` / `transport-loss` marker | 0× (reads are not command flows) | durable state stays Projection-driven (badge, counts, policy label, the zero-state kind); read payloads render only as labeled transient detail |

## Spec coverage

**jsdom execution status (T5 precedent, disclosed)**: the three new
.tsx specs (24 + 15 + 8 = 47 tests) are TYPE-CHECKED under the
full-face strict tsconfig (noUncheckedIndexedAccess,
verbatimModuleSyntax, isolatedModules) but are NOT executed in-session
— the plain-node runner globs `*.test.ts` only, and the sandbox EPERM
on piped child-process spawns keeps vitest unstartable here (the T4/T5
established gate). They execute under real vitest+jsdom in the S8 test
instance. The runner-executed client suite grew 115 → **193** (+78
pure-model tests); the full repo suite is **2360 passed, 0 failed**.

- **NEW `test/team-governance.test.ts`** (557 LOC, 43 tests,
  runner-executed): the badge mark map (four admission states + the
  unknown-status pass-through), `parseCompatibilityStateValue` /
  `parseCompatibilityVerdictValue` (the closed fields, malformed
  throws), the reprobe trigger gate (frozen set; `HUMAN_RECHECK_TRIGGER`
  is the only legal human value), the param builders (override
  get/set/reset with the paired scope/targetInstanceId; policyState
  get/set — the partial cells map + boundary cast; compatibility
  get/ack — the ack builder is complete despite the D3 wire gap),
  `parseOverrideValue` (the `override: null` arm), `parsePolicyStateValue`
  (the sorted cell map), `effectiveConfigLanes` (the frozen order:
  model, workspace, sorted `permissions:<name>`, autonomy; the English
  state words), `hardPolicyDisplay` (denied + `deniedBy` only).
- **NEW `test/team-handoff.test.ts`** (300 LOC, 23 tests,
  runner-executed): `parseHandoffPrepareValue` (the nested-summary
  flattening to `{sourceSessionId,title,bullets}`; malformed throws),
  `parseHandoffCreateState` (all five state arms + the unknown-kind
  fail-safe arm; the `replayed` required-bool), `handoffDecisionActions`
  (awaiting → the narrowed options when non-empty else the frozen
  triad; creation-failed → `retry` only; else none),
  `handoffRetryPlan` (creation-failed → SAME token; awaiting → FRESH
  token; else null).
- **NEW `test/team-legacy.test.ts`** (224 LOC, 12 tests,
  runner-executed): `parseLegacyInspection` (the three-branch closed
  union; the best-effort degradation of malformed nested fields to
  null/''; the roster row parsing; the unknown-status fail-safe arm
  keeping the raw record), `legacyZeroStateKind` (the selection
  helper — not a type guard, covered here).
- **NEW `test/team-governance.client.spec.tsx`** (686 LOC, 24 jsdom
  tests): the badge loop over the four admission states (mark + en
  word; no pull on mount), the unknown-status verbatim pass-through
  (no mark), counts/generation from the Projection, the disabled ack
  with the exact wire-gap title, the compat REVIEW read (exact params,
  no pull) + its typed-failure note + the labeled fresh-read detail,
  the Recheck (exact closed trigger; 1× pull on success; the typed-
  failure and transport-loss arms never pull), the policy REVIEW (the
  locked cell renders marker-only, no editor), the policy COMMIT
  (the PARTIAL map with wire read-back + edit; the exact preview;
  1× pull) + the inert test, the override SET/RESET (exact params
  incl. scope `instance` + target member; 1× pull; the typed-failure
  arm; the inert-until-items gate), the override SHOW read (no pull;
  the `null` → "No explicit human override" arm), the lane order +
  state words + `effective from 7` flag, the hard-policy line
  (Requested/Effective/Reason), the empty-config note, and the zh/en
  pairing (byte-exact zh badge + ack title).
- **NEW `test/team-creation-handoff.client.spec.tsx`** (629 LOC, 15
  jsdom tests): the block presence (BOTH face + source required),
  enabled by default with the `Source: "A"` line, the §32.2 workspace
  prefill (feed membership + empty draft only; the draftSpy never
  fires on a picked draft), the prepare-on-enable (1×, exact params,
  the ready + preview body), the uncheck/recheck cycle, the prepare
  typed failure (verbatim note; the gate STILL enables — prepare never
  blocks create), the create happy path (1× with the exact frozen
  params; NO `createRootSession`/`teamCreate`/`openSession` on the
  handoff path; the busy gate; completed → `openSession(rootSessionId)`),
  completed-without-handoff → its root id, awaiting-decision (no
  options) → the full triad + the failed code/token attrs + the
  FRESH-token retry (canceled resolution clears the triad), narrowed
  options (`['retry']` → retry only), Continue without handoff (the
  standard path: `createRootSession` + `teamCreate` + `openSession`;
  the handoff create stays 1×; the checkbox unchecks), Cancel (NO
  remote call; the note; TERMINAL — a later create click routes to
  the standard path), creation-failed (retry ONLY; the SAME token),
  the typed response failure (full triad; FRESH token), and the
  transport loss (the local `native-error` code; no session switch).
- **NEW `test/team-legacy.client.spec.tsx`** (329 LOC, 8 jsdom
  tests): the legacy-team banner replacing the zero state (the three
  §34.1 verbatim lines, the decoded summary — team-id /
  leader-session rows only when non-null, the counts, the roster
  warning, the roster rows `name ?? id ?? fileName` + ` (role)`, NO
  Start-Team entry), the roster-only variant, native-fallback → the
  ordinary zero state + start button, the typed failure (ONE verbatim
  note), the transport loss (the `native-error` note), the
  unrecognized future status (the raw-record note), the seam-absent
  T7-unchanged negative, and the one-shot read (exactly 1×, no
  arguments; the only pull is the T7 cold-pull), plus the verbatim zh
  banner test.

## Files changed (all under the worktree)

| File | LOC | Change |
| --- | --- | --- |
| `packages/client/src/model/team-governance.ts` | 605 | NEW, the S5-C pure model (badge map, compat parsers, the param builders, the policy-state parser, the lane builder, the hard-policy display) |
| `packages/client/src/model/team-handoff.ts` | 294 | NEW, the S5-D pure model (prepare flattening, the five-arm create-state parser, the decision actions, the retry plan) |
| `packages/client/src/model/team-legacy.ts` | 186 | NEW, the S5-D pure model (the closed-union inspection parser, the zero-state selection) |
| `packages/client/src/ui/TeamGovernance.tsx` | 778 | NEW, the S5-C component (badge/counts/ack-disabled, compat review + recheck, policy review/commit, effective-config lanes + override editor; the T7 `dispatch()` pattern replicated) |
| `packages/client/src/ui/TeamGovernance.module.css` | 275 | NEW (`--dsw-alias-*` tokens only) |
| `packages/client/src/ui/TeamCreationPanel.tsx` | 949 | EXTENDED (+350): the `handoffSource`/`handoffFace` optional props, the §32.2 handoff block (prepare/preview/failed triad), the create-button routing (handoff attempt vs the standard path; the D6 cancel-terminality fix) |
| `packages/client/src/ui/TeamCreationPanel.module.css` | 362 | extended (+105): handoff block/ready/failed/triad styles |
| `packages/client/src/ui/TeamView.tsx` | 348 | EXTENDED (+135): the optional `governance`/`legacyInspect`/`handoff` faces, the governance section mount, the one-shot legacy zero-state machine (banner replacement / ordinary + note) |
| `packages/client/src/ui/TeamView.module.css` | 124 | extended (+61): legacyBanner/legacySummary/legacyNote |
| `packages/client/src/ui/locales.ts` | 627 | EXTENDED (+175): 58 keys (40 `governance.*` + 12 `handoff.*` + 6 `legacy.*`, en + zh; `handoff.provenance` reserved per D2) |
| `packages/client/test/team-governance.test.ts` | 557 | NEW, 43 tests (runner-executed) |
| `packages/client/test/team-handoff.test.ts` | 300 | NEW, 23 tests (runner-executed) |
| `packages/client/test/team-legacy.test.ts` | 224 | NEW, 12 tests (runner-executed) |
| `packages/client/test/team-governance.client.spec.tsx` | 686 | NEW, 24 jsdom tests (type-checked; executed at S8) |
| `packages/client/test/team-creation-handoff.client.spec.tsx` | 629 | NEW, 15 jsdom tests (type-checked; executed at S8) |
| `packages/client/test/team-legacy.client.spec.tsx` | 329 | NEW, 8 jsdom tests (type-checked; executed at S8) |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | 420 | scannable-count pin 590 → **596** (+6: the three model .ts + the three spec .ts; the three new .tsx specs, the new CSS module, and the T7 .tsx/.css edits are outside the scanner's extension set) + the pin comment only |

## Gates

| Gate | Result | Log |
| --- | --- | --- |
| tsc full face (src + test + vitest.config.ts) | round 1: 13 mechanical errors, ALL in the two new .tsx spec files written before the first typecheck (4× `dataset` on untyped `Element` in the handoff spec; the governance spec's fixture return type vs `EffectiveConfigDto`, a `Record<string, …>` index under noUncheckedIndexedAccess, a partial `cells` map against the over-constrained frozen TS mirror — the host parser accepts the partial map, so the boundary cast carries the wire truth — and `title` on untyped `Element`); round 2: **EXIT 0** | `t8-typecheck-1.log` |
| tsc build face (src only) | **EXIT 0**, `dist/` removed | `t8-build-1.log` |
| full suite (`node scripts/run-tests.mjs`) | **2360 passed, 0 failed, 2360 total** (client 193/193 = 115 + 78 new pure-model tests; the three new .tsx specs are not runner-executed by design); p4t6 green at **596** (10 tests) | `t8-runtests-full.log` |
| testkit tsc | **EXIT 0** (the p4t6 pin test is in the suite log) | `t8-typecheck-2.log` |
| git | single commit on `task/P9-ui-legacy-reuse`; porcelain 0 after the commit | — |

No flake observed: the single suite pass ran clean (the known
p6t1-parallel timeout-race and g8s1-generation-stamp `.tmp-fault`
ENOTEMPTY flake classes did not trigger).

## Red lines

No frozen-contract or plan edits; no upstream patch (budget 0);
`references/deepseek-harness-test-use` pristine; legacy
`references/deepseek-harness` untouched; `graph.yaml` /
`SESSION_ROUTER_LOG.md` untouched (main-agent-owned); no push. The
p4t6 change is the count pin + its pin comment only — no denylist
vocabulary change, no quarantine-set change. All 17 files carry the
repo CRLF convention; the four gate logs + this note are committed
BOM-free.
