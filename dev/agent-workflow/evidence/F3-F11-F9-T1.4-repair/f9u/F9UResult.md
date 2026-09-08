# F9U (repair-r1) — F9UResult: the four gate-review UI supplements on the F9 control surface

Task: implement the FOUR gate-review supplements on the F9 human-control
UI (frozen UI §26.1–§26.4) —
(1) the pending control-request DETAIL fields (requester / request kind /
requested operation / tool / reason / creation time / current status /
requested authority),
(2) the external hard policy display ("Team decision: Allowed" /
"Execution: Blocked by managed policy"),
(3) the KIND-AWARE affordance from the closed human resolver-role map,
(4) the SERVED-VERSION gating (v3 read-only / v4 enabled) —
with persistent client specs for all four. Client-only: no wire / host /
control changes, no new protocol vocabulary beyond the frozen sets.
Branch: `task/repair-r1-f9-ui-supplements` (worktree
`.worktrees/repair-r1-f9u`, base `int/repair-r1` @ `8e9e211`).
Execution: 1/3. CORE PATCH BUDGET = 0 honored — upstream untouched.

## Scope (diff boundary — see diff-boundary.txt)

- NEW `packages/client/src/model/control-surface.ts` — the client-local
  surface model: the frozen `CONTROL_RESOLVER_ROLES` mirror (provenance:
  `packages/runtime/control/types.ts`; the `FACT_TYPE_CATEGORY` client
  mirror precedent), `humanMayResolveControlKind` /
  `requestedAuthorityForKind` (fail-closed for unknown/absent kinds),
  `ControlSurfaceMode`, `RESOLVE_CONTROL_PROBE_REQUEST_ID = ''`, and
  `interpretResolveControlProbe` (the closed classification over the
  frozen Remote boundary codes).
- `model/team-ui-snapshot.ts` — `TeamUiControlChain` += `requesterId?` +
  `requesterRefKind?` (`'instance' | 'human'`; ABSENT when the fact
  names no requester — fail-safe).
- `model/ledger-adapter.ts` — `adaptControlRequestDraft` extracts the
  durable `requester` ControlCallerRef fail-safe (instance ref →
  `instanceId`; human ref → `humanId`; malformed ref → ABSENT).
- `ui/locales.ts` — the 13 new display keys (en/zh): the §26.2 field
  labels, the pending status, the human label, the read-only note, and
  the §26.4 two-line block (en VERBATIM per the frozen doc).
- `ui/TeamLedger.tsx` — `renderResolveBar` → `renderControlPanel`:
  the §26.2 detail `<dl>` (every field rides the paired chain; absent
  leaf → field OMITTED; requester instance ref resolves through the
  snapshot members with the raw id as display fallback; human ref →
  the fixed human label; authority = the closed role set, closed kinds
  only) + the kind-aware × served-version-gated Allow/Deny commands +
  the read-only note (mode 'read-only') + the existing busy/typed-error
  / transport-loss discipline unchanged. New prop
  `controlSurfaceMode?: 'enabled' | 'read-only'` (absent = unresolved →
  fail-closed: panel yes, commands no).
- `ui/TeamLedger.tsx` stateBadge — the §26.4 branch: a
  control-decision row with `decisionReason === 'external-policy'`
  renders the frozen two-line block (`data-external-policy="true"`,
  both lines data-attributed, the decision value kept for diagnostics)
  and NEVER the plain denied label.
- `ui/TeamView.tsx` — the served-version PROBE (one-shot per team
  session; guards: face present + snapshot present + ≥1 pending control
  chain + mode unresolved for this team + not in flight): calls the
  EXISTING face `resolveControl` with the closed side-effect-free
  params `{ teamSessionId, requestId: '', decision: 'allow' }` (the v4
  host fails the 1..255 token rule BEFORE any port work; a pre-v4 host
  answers `unknown-method` before the envelope; the probe never reaches
  the control service). Transport rejection → mode stays unresolved
  (fail-closed) and re-runs on the next ledger publish; a team switch
  re-probes for the new team. Passes `controlSurfaceMode` to
  TeamLedger (absent when unresolved / for another team).
- `composition-shim/client-bundle.js` — regenerated (the committed
  artifact; 937,014 B → 959,026 B; verified to carry the new locale
  keys, the frozen en §26.4 strings, the zh display text, and the new
  `data-*` attributes).
- SPECs: 3 NEW + 1 UPDATED (below). The updated F9 spec fixtures now
  carry the closed `kind: 'user-approval'` (the kind-aware rule) and
  the default `controlSurfaceMode: 'enabled'` (the v4 proof) — the F9
  surface semantics are unchanged and stay green.

## Results (all in-sandbox; see transcripts)

- F9U focused (4 specs): **41 passed, 0 failed**
  (f9u-control-surface-model 11 + f9u-control-panel 15 +
  f9u-control-surface-probe 6 + f9-resolve-control-ui 9) —
  `f9u-focused.txt`.
- Full client vitest: **639 passed, 1 failed** — the 1 = PRE-EXISTING
  `team-creation-panel "create happy path"` (identical to the F9 state
  607/1 and the pre-F9 baseline 593/1; +32 = F9U) —
  `vitest-client-full.txt`.
- typecheck `npx tsc -p packages/client/tsconfig.json --noEmit` exit 0;
  build `npx tsc -p packages/client/tsconfig.build.json` exit 0;
  composition rebuild `87 modules, 11 css` exit 0 —
  `typecheck-build.txt`.

## No-regression notes

- The F9 command surface spec (9 tests) stays green after the
  supplement layer (its fixtures gained the closed `kind` + the v4 mode
  — required by the new fail-closed rules, semantically identical
  surface).
- The v1–v3 wrappers, the wire schema, the remote catalog, the runtime
  control service, and the host glue are UNTOUCHED (diff-boundary.txt:
  every modified/new tracked file is under `packages/client`).
- The `place-dist-glue.mjs` EOL-only side effect on the runtime dist
  mirror (`agent-bindings.mjs`, CRLF on disk vs the LF committed blob,
  empty content diff) was reverted with `git checkout --` — the
  committed blob is unchanged by this task (see run-recipe.md
  constraint 4).

## Blockers

NONE. No access beyond the workspace-write sandbox was needed.
(check-artifacts-committed.mjs is git-spawn-EPERM in-sandbox as in F9 —
hand-verified in diff-boundary.txt instead.)
