# F9 (repair-r1) — F9Result: the F9 human-control v4 surface

Task: implement ONLY F9 of the F3/F11/F9/T1.4 repair round — the
versioned Remote v4 bump carrying the EXISTING `team` category method
`team.resolveControl` with the frozen params
`{ teamSessionId, requestId, decision: 'allow'|'deny', note? }`, the
host-derived human principal (existing T12-B4 seam, never a
client-provided role), the unchanged `CONTROL_RESOLVER_ROLES` + durable
exactly-once semantics, and the minimal pending-request Allow/Deny
command surface with typed error rendering.
Branch: `task/repair-r1-f9-human-control` (worktree
`.worktrees/repair-r1-f9`, base `int/repair-r1` @ `4f6e4f9`).
Execution: 1/3. CORE PATCH BUDGET = 0 honored — upstream untouched
(no `references/` changes); all capability is in the plugin packages
through public seams.

## Adjudications honored (frozen contract, minimum-frozen-contract.md)

- U1: ONE version bump to v4 (`REMOTE_CONTRACT_VERSION_V4 = 4`; the v1
  baseline constant stays `1`; supported set `{1,2,3,4}`).
- U2: the method lives in the EXISTING `team` category (no new category;
  9 categories / 27 methods closed union).
- U3: the closed v4 params are EXACTLY `{ teamSessionId, requestId,
  decision, note? }` — NO caller/role/actor field; a spoofed identity
  field is a `malformed-params` `unknown-field` BEFORE any derivation or
  port work.
- U4: F9 + T1.4 share one v4 record; T1.4 code is T14-H scope — NOT
  implemented here (documented in `contracts/version.ts`).
- U7: no scope expansion to R-F2 / R-F5 / R-B7 / R-F4 / F7 / F10.

## Implementation

### packages/remote (the v4 contract surface)

- `contracts/version.ts` — `REMOTE_CONTRACT_VERSION_V4 = 4`, the union
  `1|2|3|4`, `REMOTE_CONTRACT_SUPPORTED_VERSIONS = [1,2,3,4]`.
- `contracts/catalog.ts` — 27th method `team.resolveControl` (category
  `team`), `REMOTE_V4_ONLY_METHODS = ['team.resolveControl']`, the
  availability function admits v1–v4 per the versioned union.
- `contracts/params.ts` — `parseRemoteTeamResolveControlParams`: the
  closed field set (`assertNoUnknownFields` — caller/role/actor are
  unknown fields), `requiredField` × 3, the team-session-id ID rule
  (1..255, no control/whitespace — a violation is the FROZEN P3 code
  `INVALID_ROOT_SESSION_ID`, deviation D-1), the opaque-token requestId
  (1..255, no control/whitespace), the `allow|deny` decision enum,
  `note?` (1..2048, any content).
- `handlers/ports.ts` — Port 17 `RemoteTeamResolveControlPort.resolveControl(teamSessionId, requestId, decision, note): RemoteSafeRecord`
  (SYNC; NO caller parameter — the caller arrives through the port
  context set by the S6 host wiring).
- `handlers/team.ts` — `normalizeTeamResolveControlValue` (the closed
  decision record: requestId non-empty string, decision ∈
  allow|deny|stale-denied, decider/scope records, requestSequence /
  decisionSequence safe int ≥ 1, createdAt string, reason/note
  string-when-present) + the handler case → `{ data: { decision } }`.
- `handlers/dispatch.ts` — `REMOTE_BACKING_ERROR_CODES` +=
  `TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE` + the seven closed
  `CONTROL_*` codes (REQUEST_MALFORMED, TARGET_STALE, REQUEST_NOT_FOUND,
  REQUEST_DECIDED, RESOLVER_NOT_AUTHORIZED, REQUEST_STALE,
  EXTERNAL_POLICY_DENIED); the guard codes stay EXCLUDED (they are
  verdicts, not failures). Dispatcher invariants 4a/4b/5 unchanged.
- `src/index.ts` — v4 exports.

### packages/runtime (the S6 production wiring)

- `plugin/s6-principal.ts` — `deriveControlCaller` (the T12-B4 seam):
  `assertTeamScoped` (the bound root or `isOwnedRoot`) →
  `{ kind: 'human', humanId: String(teamSessionId) }`. The branch runs
  BEFORE the host-operator fall-through; the derivation NEVER returns
  an instance caller for this method (the wire carries no identity).
- `plugin/s6-remote.ts` — the `team.resolveControl` case: the principal
  derivation runs FIRST (foreign team → `TEAM_REMOTE_FOREIGN_TEAM`
  before any port work), then the port body: `assertBoundRoot` →
  absent-option check → `TeamPluginError(TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE)`
  (never a silent success) → the closure
  `{ rootSessionId, caller, requestId, decision, note? }` — NO
  try/catch: an UNTYPED closure throw reaches dispatcher invariant 5
  (`internal-error`, generic message, no leak). Typed `Error` with a
  closed backing code → 4b pass-through (code + message + cause +
  `details.reason: 'domain-error'`).
- `plugin/root.ts` — the production closure over the A25 control
  service: `service.resolveControl({ rootSessionId, caller, requestId,
  decision, note? })` — the option arg shape matches the service arg
  shape EXACTLY (a direct forward; the human caller passes the service's
  `resolveCaller` untouched, so the host-stamped human is accepted).
  The control service (`packages/runtime/control/*`) is UNCHANGED —
  wired, not modified.

### packages/client (the minimal command surface)

- `transport/team-remote-client.ts` — `teamResolveControlV4(params)` →
  `callWithVersion('team.resolveControl', params, REMOTE_CONTRACT_VERSION_V4)`
  (the ONLY v4-stamping wrapper; every v1–v3 wrapper is byte-frozen).
- `model/team-ledger-model.ts` — `TeamLedgerEventRow.requestId?` carried
  by `buildRow` for control-request rows (the bar needs the durable id).
- `ui/TeamLedger.tsx` — the per-request command bar: rendered ONLY when
  `onResolveControl` is present AND the row is a `control-request` with
  `pending !== false` AND a `requestId`; SIBLING of the row `<button>`
  (fragment — nested buttons are invalid HTML); per-request-id local
  state `{ busy | error{code,message} }`; on EVERY completed wire
  outcome (success OR typed error) the catch-up `onRetry()` fires (a
  durable close may have settled the row — stale / external-policy); a
  transport rejection (the only rejection kind) renders the
  `transport-loss` note and the row stays pending. Markers:
  `data-ledger-resolve-bar/-allow/-deny/-busy/-error` (+
  `data-resolve-error-code`, `title` = the verbatim message).
- `ui/TeamView.tsx` — the `TeamViewControlFace`
  (`resolveControl(params) => Promise<RemoteResponse>`);
  `onResolveControl` additionally fires `pullProjection(teamSessionId)`
  ON SUCCESS ONLY (the D4-A1 discipline).
- `plugin/team-mount-core.ts` — the face is ALWAYS wired (no config
  gate; `control: { resolveControl: (p) => teamRemote.teamResolveControlV4(p) }`).
- `ui/locales.ts` — the four `view.ledger.resolve.*` keys (en/zh).
- `ui/TeamLedger.module.css` — the bar styles.

### committed build artifacts (repo convention — check-artifacts-committed)

- `packages/client/composition-shim/client-bundle.js` regenerated via
  `build-client-composition.mjs` from the rebuilt client dist (86
  modules, 11 css files; 914,453 B → 937,014 B; `team.resolveControl`
  now in the bundle × 15).
- `packages/runtime/dist/**` — the committed dist mirrors of the changed
  remote contract/handler modules + the runtime plugin modules + the
  agent-bindings glue (place-dist-glue, byte-identical).

## Authority model (INV-9.3 + T12-B4)

The wire carries NO identity. The host derives the decider principal
from the TRUSTED authenticated UI/session ownership: the v4
`teamSessionId` is validated against the ownership index (bound root or
`isOwnedRoot`); a foreign team is rejected `TEAM_REMOTE_FOREIGN_TEAM`
BEFORE any port work; the host stamps `{ kind: 'human',
humanId: <validated owned teamSessionId> }` (the invariant-9 identity
channel). The control service's frozen `CONTROL_RESOLVER_ROLES`
(`user-approval → ['human']` only; a member is NEVER a resolver —
invariant 37) is unchanged and is the last authority: an instance
caller resolving its own user-approval request →
`CONTROL_RESOLVER_NOT_AUTHORIZED` with ZERO side effects.

## Tests (all NEW or updated in this round)

| file | tests | role |
|------|------:|------|
| `packages/remote/test/f9-remote-v4.test.ts` | 36 | catalog facts, v1–v3 rejection matrix (contractVersion echo), closed params (spoofed caller/role/actor → unknown-field; invalid values; ID-rule; note bounds), success (provenance 4, decider/scope stamping, note omission), 4b battery (8 closed codes), untyped → internal-error no leak, v1–v3 wire preserved |
| `packages/runtime/test/f9-s6-resolve-control.test.ts` | 14 | REAL S6 ports + dispatcher + REAL principal derivation: host-stamped human reaches the closure; spoofed identity → malformed-params; foreign → FOREIGN_TEAM before port work; v1–v3 → method-version-unsupported; absent closure → typed unavailable; the seven CONTROL_* rejections pass through 4b; untyped → internal-error no leak; closure called exactly twice (only bound-root successes) |
| `packages/runtime/test/f9-control-exactly-once.test.ts` | 8 | REAL P6T4 world + REAL control service behind the REAL dispatcher: F9H-T1 (human allow durable with host-stamped decider; second resolve → CONTROL_REQUEST_DECIDED with exactly ONE decision row + one raw fact; the guard consumes the allow EXACTLY ONCE; unit RESTART → decision durable, re-resolve rejected, guard still blocks) + F9H-T2 (member AND leader rejected by the frozen user-approval closure with zero side effects; the request stays resolvable by the human) |
| `packages/client/test/f9-remote-client-v4.test.ts` | 5 | the v4 wrapper: version-4 stamping on the frozen channel/endpoint, verbatim closed params (omitted note stays absent; no caller/role/actor ever), success + typed error resolve intact, carrier rejection → PushTransportLossError |
| `packages/client/test/f9-resolve-control-ui.client.spec.tsx` | 9 | F9U-T1/T2: the bar renders ONLY on pending control-request rows with a requestId while the face is present (absent face → inert; non-pending / id-less → no bar); the bar is a sibling of the row button; Allow/Deny call the face with the exact (teamSessionId, requestId, decision); busy disables both buttons; typed error renders with data-resolve-error-code + title + re-pull; transport-loss note keeps the row pending; per-request isolation (two pending rows); en/zh pairing |

Updated surface pins (the v4 bump's frozen-surface consequences):
`d1-remote-v3`, `p8t3-version` (+1 new positive), `p8t3-negative`,
`p8t4-negative`, `tcm-m1-remote-v2`, `p8s7r1-create-params`,
`p8s7r4-bc23-24-no-mutation` (catalog 26→27; the no-decision-method pin
narrowed to AGENT-side), `t12m4-remote-mount` (unsupported-version
negative 4→5).

## Results (full detail in baseline-pre-f9.txt + run-recipe.md)

- remote shim: 147p/6f baseline → **185p/5f** (strict improvement; the
  5 = pre-existing d1-remote-v3 `toBeDefined` shim limitations).
- runtime sweep (d5-excluded): 1265p/23f baseline → **1287p/23f**
  (the six pre-existing shim-surface files unchanged; +22 = F9 tests).
- client vitest: 593p/1f baseline → **607p/1f** (the 1 = pre-existing
  team-creation-panel "create happy path", identical both states;
  +14 = F9 tests).
- typecheck: remote/runtime/client all exit 0. Build: all 9 packages
  exit 0 + composition regenerated.
- v1–v3 wire behavior byte-preserved (round-trip + rejection pins green).

## Blockers

NONE.

Notes for the integrator:
1. The in-sandbox vitest client run uses the F11 netuse stub
   (`run-recipe.md`); the d5-instance-contract runner crash is
   PRE-EXISTING (verified byte-identical with F9 stashed) and is why
   the runtime sweep uses the scratch targeted runner (uncommitted).
2. `check-artifacts-committed.mjs` spawns git (EPERM in this sandbox) —
   the committed-state check was hand-verified (tracked + not ignored +
   eol=lf pins).
3. The T1.4 side of the shared v4 record is deliberately ABSENT
   (U4/T14-H): the v4 catalog carries only the F9 method today.
