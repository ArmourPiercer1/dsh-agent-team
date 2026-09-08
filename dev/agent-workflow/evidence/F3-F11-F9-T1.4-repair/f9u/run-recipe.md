# F9U run recipe (F3/F11/F9/T1.4 repair round r1 — the four gate-review UI supplements)

Worktree: `.worktrees/repair-r1-f9u` — branch `task/repair-r1-f9-ui-supplements`
(from `int/repair-r1` @ `8e9e211`). Node 24.20.0, Windows, workspace-write
sandbox. `node_modules` installed once at worktree creation
(`pnpm install --ignore-scripts`).

Client-only task: the diff is confined to `packages/client` (src + tests +
the regenerated `composition-shim/client-bundle.js`). No wire / host /
runtime / remote changes; the v1–v3 wrappers stay byte-frozen (the F9U
surface rides the EXISTING `teamResolveControlV4` wrapper + the existing
`onResolveControl` face — no new remote code, no new method, no new
protocol vocabulary: kinds / decisions / reasons / error codes are all
closed sets already on the frozen v4 wire; the added locale entries are
localized DISPLAY text named by frozen UI §26.2 / §26.4).

## Sandbox constraints that shape the recipe (same as f9/run-recipe.md)

1. `vitest` cannot start directly in this sandbox (vite's
   `windowsSafeRealPathSync` execFile → EPERM). The CLIENT vitest runs
   in-sandbox via the netuse stub (the F11/F9 precedent). The stub was
   copied from the F11 worktree as `.f9u-vitest-netuse-stub.mjs`
   (UNCOMMITTED scratch at the worktree root, same as F9).
2. `pnpm -r` / `pnpm build` fail with EPERM spawn → direct `npx tsc`
   per package (only the client package was touched here).
3. `check-artifacts-committed.mjs` spawns git (EPERM here) → the
   committed-artifact state is hand-verified in `diff-boundary.txt`
   (`git ls-files` tracked + `.gitattributes eol=lf` pin;
   `packages/client/dist` gitignored and untracked).
4. `place-dist-glue.mjs` copies the runtime live binding from the
   ON-DISK source (CRLF on this Windows worktree) over the committed
   LF `packages/runtime/dist/.../agent-bindings.mjs` mirror (eol=lf
   attribute) — a pure EOL flip, NO content change (verified: the
   pre-commit `git diff` on that file is empty). The F9U task touches
   no runtime source, so after every glue run the mirror is restored
   with `git checkout -- packages/runtime/dist/.../agent-bindings.mjs`
   (documented here for reproducibility; the committed blob is
   unchanged by this task).

## Commands (from the worktree root)

```powershell
# 1. client package — vitest via the in-sandbox stub (FULL suite)
node --import ./.f9u-vitest-netuse-stub.mjs node_modules/vitest/vitest.mjs run --root packages/client
#    F9U result: 639 passed, 1 failed (the 1 = PRE-EXISTING
#    team-creation-panel "create happy path", identical to the F9 state
#    607/1 and the pre-F9 baseline 593/1 — same single test, verified by
#    name in vitest-client-full.txt; +32 = F9U: 11 + 15 + 6)

# 2. F9U files only (the four specs: 3 new + the updated F9 UI spec)
node --import ./.f9u-vitest-netuse-stub.mjs node_modules/vitest/vitest.mjs run --root packages/client test/f9u-control-surface-model.test.ts test/f9u-control-panel.client.spec.tsx test/f9u-control-surface-probe.client.spec.tsx test/f9-resolve-control-ui.client.spec.tsx
#    → 41 passed, 0 failed (11 + 15 + 6 + 9) — f9u-focused.txt

# 3. typecheck + build (client only — the only touched package)
npx tsc -p packages/client/tsconfig.json --noEmit        # exit 0
npx tsc -p packages/client/tsconfig.build.json           # exit 0

# 4. composition artifacts (committed mirrors)
node scripts/place-dist-glue.mjs
node scripts/build-client-composition.mjs packages/client packages/client/composition-shim
#    → "87 modules, 11 css files"; client-bundle.js regenerated
#    (937,014 B → 959,026 B; verified to carry the new locale keys,
#    the frozen en §26.4 strings "Team decision: Allowed" /
#    "Execution: Blocked by managed policy", the zh display text, and
#    the new data-* attributes — see F9UResult.md)
#    then: git checkout -- packages/runtime/dist/.../agent-bindings.mjs
#    (the EOL-only glue side effect, constraint 4)
#    typecheck-build.txt
```

## Acceptance mapping (gate-review supplements → specs)

| acceptance (minimum-frozen-contract §8.9) | evidence |
|------------|----------|
| pending control-request DETAIL fields (requester / kind / operation / reason / time / status / authority, +tool; fail-safe omission of absent leaves; requester ref resolution) | `packages/client/test/f9u-control-panel.client.spec.tsx` (supplement 1 block, 4 tests) |
| external-policy display "Team decision: Allowed / Execution: Blocked by managed policy" (the closed `deny`+`external-policy` combination; never the plain denied label; en strings verbatim; zh pairing; ordinary deny untouched) | `packages/client/test/f9u-control-panel.client.spec.tsx` (supplement 2 block, 3 tests) |
| kind-aware affordance from the CLOSED human resolver-role map (closed kind incl. human → commands; unknown/absent kind → panel yes, commands NO, fail-closed; authority read closed-only) | `packages/client/test/f9u-control-panel.client.spec.tsx` (supplement 3 block, 3 tests) + `packages/client/test/f9u-control-surface-model.test.ts` (map mirror + fail-closed reads, 4 tests) |
| served-version gating (v4 probe → 'enabled' commands live; pre-v4 `unknown-method` → 'read-only' panel + note, no commands; transport rejection → unresolved fail-closed + re-probe; per-team re-probe on switch; no probe without face / without pending control; closed side-effect-free probe params) | `packages/client/test/f9u-control-surface-probe.client.spec.tsx` (6 tests) + `packages/client/test/f9u-control-surface-model.test.ts` (probe classification, 4 tests) + `packages/client/test/f9u-control-panel.client.spec.tsx` (supplement 4 block, 4 tests) |
| the F9 command surface stays green (face + pending + requestId + sibling + flight state machine; fixtures now carry the closed `kind` + the v4 mode) | `packages/client/test/f9-resolve-control-ui.client.spec.tsx` (9 tests, updated) |
| diff confined to packages/client (+ the regenerated committed composition-shim bundle); no wire/host/control changes; no new protocol vocabulary | `diff-boundary.txt` (status + diff --stat + tracked-state hand verification) |

## Design notes (the decisions the specs pin)

- **The probe is side-effect-free by construction**: it reuses the
  EXISTING `teamResolveControlV4` wrapper with the closed params
  `{ teamSessionId, requestId: '', decision: 'allow' }`. The v4 host's
  dispatcher validates the closed params BEFORE any port work: the
  empty `requestId` fails the frozen 1..255 opaque-token rule → typed
  `malformed-params` (the v4 method was reached → 'enabled'). A pre-v4
  build's closed catalog lacks the v4-only method → `unknown-method`
  before the envelope is read → 'read-only'. The probe never reaches
  the control service, never resolves a request, never writes.
- **The response `provenance.contractVersion` echoes the REQUEST
  version, not the served capability** — the version must be PROBED,
  hence the probe; the classification is closed (the model spec pins
  every frozen boundary code).
- **The kind-aware affordance mirrors the host's
  `CONTROL_RESOLVER_ROLES` client-locally** (the `FACT_TYPE_CATEGORY`
  mirror precedent — the client may not value-import the host package):
  `humanMayResolveControlKind` / `requestedAuthorityForKind` fail
  closed for any kind absent from the closed map.
- **Served-version gate = fail-closed**: mode 'enabled' → commands;
  'read-only' → detail panel + localized note, no commands; absent
  (unprobed / transport loss) → detail panel, no commands, no note —
  the commands wait for the v4 proof.
- **§26.4 is a DISPLAY mapping of a closed combination**: the durable
  row is `decision: 'deny'` + `reason: 'external-policy'` (the control
  service records an allow that the external hard policy blocks exactly
  that way — `packages/runtime/control/service.ts`, external policy
  check); the badge renders the frozen two-line block and never the
  plain denied label. No new decision/reason values exist.

## In-sandbox notes

- The vitest runs above are the IN-SANDBOX stub runs; on a non-sandboxed
  machine the identical suite runs with plain
  `pnpm --filter @dsh-agent-team/client test`.
- The stub is UNCOMMITTED scratch (documented here for reproducibility);
  it is not part of the F9U diff.
