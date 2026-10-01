# Alpha.3 PR2 — boundary self-review (what shipped vs what was authorized)

Authorized file set (coordinator, verbatim intent): *"effective-policy module +
lane index export + a3p2 specs + helpers only; no production wiring; resolver
semantics untouched; same-commit `pnpm build` + staged `runtime/dist` + freshness
after build."*

## Files created (5)

| File | Kind | Note |
| --- | --- | --- |
| `packages/runtime/effective-policy/permission-assembler.ts` | production | the module itself — the only production logic in this PR |
| `packages/runtime/test/effective-permission-assembler-helpers.ts` | spec helper | fixture builders only; builds REAL PR1 snapshots through `createPermissionOverlaySnapshot`, no assertion logic |
| `packages/runtime/test/a3p2-permission-assembler-precedence.test.ts` | spec | 24 legs: overlay/static deny, fallback, same-layer priority, matching semantics, authority |
| `packages/runtime/test/a3p2-permission-assembler-provenance.test.ts` | spec | 29 legs: provenance, isolation, fail-closed validation, purity, wiring witness |
| `packages/runtime/test/a3p2-effective-policy-lane-import.test.ts` | spec | 4 legs: the lane re-export load-order witness (see §Cycle below) |

## Files modified (2 tracked, plus generated artifacts)

| File | Change |
| --- | --- |
| `packages/runtime/effective-policy/index.ts` | additive `export` block for the new module (9 values + 14 types). No existing export touched. |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | the established per-task scanner-pin increment `924 → 929` (+5 = the five new scannable files above), with the usual prose note. Zero denylist vocabulary added; the frozen quarantine hit set is unchanged; scanner `.mjs` untouched. |
| `packages/runtime/dist/**` (generated) | rebuilt in the SAME commit: `effective-policy/permission-assembler.*` (new), `effective-policy/index.*` (changed), plus `runtime/permission-governance/types.*` and `storage/schema/permission-overlay.*` mirrors — see §Artifact-surface observation. |
| `dev/agent-workflow/evidence/alpha3-pr2-effective-assembler/**` | this evidence directory (raw outputs, no derived claims). |

## Not touched (checked, not assumed)

- **PR1 permission-governance semantics**: `packages/runtime/permission-governance/**`
  and `packages/storage/schema/permission-overlay.ts` — consumed through
  `import type` only. `grep` witness (a committed leg in the provenance spec)
  proves no value import of that lane and no `../../storage/` import anywhere in
  the module: the emitted `permission-assembler.js` has exactly two import lines
  (`../../contracts/src/index.js`, `../operation-permission/permission-resolver.js`).
- **`TeamDomain/stores.ts`** — zero diff (the tenth store is PR1's).
- **Operation-resolver internals** — `permission-resolver.ts` and the A2
  canonicalizer have zero diff. The assembler CALLS `resolveOperationPermission`
  (once per layer, plus one single-lane probe per lane for the audit) and mutates
  nothing: the "reuse, do not reimplement" leg asserts the assembler's answer is
  `toEqual` a direct call of the frozen resolver on the same layer, and the
  lane-import spec pins that the resolver function object is the barrel's own.
- **Client / tools / remote / host / approval UI / notifications** — zero diff.
  `packages/remote/src/handlers.ts` has no new method; no StorageDomain binding;
  no durable write; no `node:` builtin in production code (the module's own
  zero-I/O claim is witnessed by a `node:fs`-read grep leg).

## No production wiring (the PR2 scope line)

The wiring witness walks `runtime/src`, `runtime/operation-permission`,
`runtime/permission-governance`, `tools/src`, `remote/src`, `client/src` for the
needles `permission-assembler`, `assembleEffectivePermission`,
`assembleEffectivePermissionPolicy` and asserts zero hits. That leg was already
green in the RED run — it is the single passing test in `red-run-1-raw.txt` — and
is green again after the implementation, which is exactly the point: the module
landed without a single consumer.

## Artifact-surface observation (not drift — first-time mirrors)

`pnpm build:composition`'s freshness gate demanded four dist paths beyond my own
module: `packages/runtime/dist/packages/runtime/permission-governance/types.*`
and `packages/runtime/dist/packages/storage/schema/permission-overlay.*`. Cause:
PR2 is the first runtime-BUILD consumer of PR1's overlay vocabulary, so those two
already-committed source files enter the runtime build program for the first time
and tsc now emits their dist mirrors. No existing file's content changed, no
PR1-owned source changed, and the mirrors are dead weight at runtime (the type
edge is erased — the emitted `permission-assembler.js` imports neither). Staged
in the same commit because `check-artifacts-committed` compares disk against the
index and a shipped source change must ship its artifacts. Flagging it so the
coordinator can confirm the install surface grows by those 8 generated files.

## Cycle found and fixed during TDD (the reason the 4th spec exists)

The first GREEN run of the assembler specs passed while **73 runtime/tools spec
files failed to collect** with `TypeError: Cannot read properties of undefined
(reading 'LEADER')` at `admission/actions.ts`. Cause: re-exporting the assembler
from this lane while importing `../operation-permission/index.js` closed an
initialization cycle (`admission/types.ts` → `effective-policy/index.ts` →
`permission-assembler.ts` → `operation-permission/index.ts` → canonicalizer → …
→ `admission/types.ts`, mid-initialization). The fix is import-level, not
semantic: the frozen resolver is taken from its OWN leaf module
(`permission-resolver.js`), which has type-only imports and cannot cycle. Verified
by identity diff against a `git archive` export of the base commit (same
node_modules, same command), and pinned by `a3p2-effective-policy-lane-import.test.ts`,
which fails with the original symptom when the barrel import is restored
(`import-cycle-regression-raw.txt`).

## Review-fix batch

Same boundary, no growth: one assertion added inside `validateOverlayViews`, one
module-private `canonicalViewKey` helper, `Object.freeze` on the exported
vocabulary. No new import in the module (the lane-import spec, which pins the
exact closed import set, is still green); no new exported symbol; no consumer;
the "PR2 wires NOTHING" leg still passes; `permission-resolver.ts`,
`TeamDomain/stores.ts`, PR1 overlay sources, client/tools/remote: zero diff.
The refusal is a new `details.problem` VALUE inside an existing closed error
code — no new code, no API widening.
