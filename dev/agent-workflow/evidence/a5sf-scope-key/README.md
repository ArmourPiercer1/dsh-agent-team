# a5sf SCOPE KEY — route-C native attach takes the canonical runtime Agent

**Task:** the first live boot (`dev/agent-workflow/evidence/a5sf-live-native/`,
branch `task/a5sf-live-native-20261103`) found every a5sf-wired Member activation
refused with:

```
TypeError: agent-bindings: the a5sf native tool re-mount needs a SCOPED agent Context (the tool plane is per-agent)
```

The Host booted, the Team Session was created, the a5sf realm MOUNTED — only the
route-C attach's surface read refused. Fails closed, but the effective half was
never reached.

**Root cause (measured host-free, re-measured here):** `@deepseek-ai/dsh-scope`
is resolved twice — the Team plugin through `node_modules/.pnpm/…` and the
pristine Host through `packages/core/scope/lib`. The scope tag is a
module-private `Symbol`; a scope minted through one instance reads
`scopeOf=KEY` there and `undefined` through the other. `agent-bindings.mjs`
already documents this hazard (its `resolveSetupAgent` doc, lines 503-508).
`a5sfAgentToolSurface()` used only `scopeOf(agentCtx)`, so a healthy Host-tagged
ctx answered `undefined` and the attach refused. `mountNativeToolModules` itself
was fine (the mount succeeded).

## 1. Fix

| file:line | change |
| --- | --- |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:226-227` | `a5sfAgentToolSurface(root, runtimeAgent)`; `const scope = runtimeAgent ?? scopeOf(root)` — the canonical runtime Agent (the Agent IS the scope key upstream) first, the context tag LAST-RESORT only |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:327,334,354` | `attachA5sfNativeToolModules(realm, root, a5sfConfig, runtimeAgent)` forwards the agent to BOTH surface reads (pre- and post-mount) |
| `packages/runtime/src/plugin/live/agent-bindings.mjs:2809` | the production glue passes the already-resolved `runtimeAgent` (line 2236: `resolveSetupAgent(agentCtx, setupAgent)`) into the attach, with the measured duplicate-instance rationale |

The refusal is unchanged and still fires when NEITHER path yields a key — that
is the fail-closed behaviour the live boot observed, and N8 pins it.

No hardcoded scope key, no second scope package import, no monkey-patch.

**ARC-A protected center:** `agent-bindings.mjs` is a named center-interface
file. THIS BRANCH DOES NOT BOOK THE LEDGER OVERRIDE — the coordinator books it.
New sha256:

```
df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b  packages/runtime/src/plugin/live/agent-bindings.mjs
2f3d88c21f99c243043230a52d662c10f752076d1724b9945a7952ae09cf8f6d  packages/runtime/src/plugin/live/a5sf-realm-row.mjs
```

Exact rationale for the coordinator's override entry: route-C's native attach
now receives the setup's CANONICAL runtime Agent as the scope key instead of
trusting a `scopeOf(agentCtx)` that is blind across duplicate
`@deepseek-ai/dsh-scope` module instances (the live boot's measured refusal,
`a5sf-live-native/scope-duplicate-instances.log`). The delta is one added
argument at the existing attach call plus its justification comment; no control,
PA-mount, admission/dispatch, or governance-center byte moves.

## 2. The test that would have caught it

`tests/world-factory/a5sf-native-route-c.test.mjs`, arm **N8** (new; suite
7 -> 8):

- loads a SECOND `@deepseek-ai/dsh-scope` module namespace from a copy at a
  different realpath (only its bare cordis import rewired to the same file), so
  `createScope`/`scopeOf` identities differ — the `.pnpm` vs workspace split;
- mints an agent ctx through the copy and asserts the hazard: key readable
  through the minting namespace, `undefined` through the helper's;
- asserts the attach still finds the key via the runtime Agent and MOUNTS
  (one fiber, the fixture native module);
- asserts with BOTH identity paths empty (same blind ctx, no runtime Agent) the
  attach still refuses with the exact same `TypeError` and mounts nothing.

RED on the pre-fix source (`route-c-RED.log`, reproduced by stashing only the
two source files): `N8` fails at `a5sf-realm-row.mjs:220` with the live boot's
exact TypeError. GREEN after the fix: 8/8 (`route-c-GREEN.log`).

Host-free duplicate-namespace re-measurement: `scope-duplicate-measure.mjs` ->
`scope-duplicate-measure.log` (same realpath split, `scope key via duplicate:
KEY`, `same ctx via row instance: undefined`, attach MOUNTED, both-empty
REFUSED).

## 3. Verification (all host-free; NO Host boot, NO ports, NO `tests/homes/**`)

| check | result |
| --- | --- |
| route-C suite | **8/8 pass** (7 existing + N8) — `route-c-GREEN.log` |
| all a5sf `node:test` suites | 12+9+10+8+14+9+13 = **75/75 pass** (7 files) |
| `vitest run a5sf` | **166/166 pass**, 11 files — `vitest-a5sf.log` |
| p4t6 | **20/20 pass**; measured tie `filesScanned=1428`, booking `{1396,1428}` unchanged (edits ride already-counted paths; N8 lives outside the scan) — `p4t6-post-booking.log` |
| law suites (ARC-A fitness / ARC-D adversarial / A4P3 lane hygiene) | **31/34 pre-booking**: exactly the three ARC-A/ARC-D L1 digest-drift arms, naming `agent-bindings.mjs` booked `bf081ae267fe…` now `df9b46af67cd…` (`law-suites-pre-booking.log`) — the same pre-booking red as #550/#555/#557. With a TEMPORARY local override (reverted, never committed) **34/34 pass** (`law-suites-with-temporary-override.log`) |
| typecheck | exit 0 |
| build | exit 0 |
| `place-dist-glue` | 101 placements, both changed live modules byte-identical into dist |
| `check-artifacts-committed` | `verdict=ok compared=1916 glue=101` |
| `check-artifacts-at-head` | `verdict=ok compared=1916 drift=0` — "HEAD carries its own build" |
| `eb3-ci-required` | `pass workflows=9 findings=0` |
| negative controls | `26/26 control(s) behaved as required` |
| `pnpm ci:local` | `verdict=fail steps=6 failed=1 coverage=determined files=3` — the failures are the three expected ARC-A/ARC-D pre-booking digest arms plus one sandbox-store refusal in the nested a4p7 at-head leg; see §5 |

Environment note: this fresh worktree had no `tests/deepseek-harness-test-use`
and no package `node_modules` symlinks. It was provisioned test-use-local per
`docs/TEST_METHODS.md` §1 (clone from the main checkout + built tree copied from
the same checkout) so the two host-tree-reading suites (`plugin-dsh-compat`,
`u7-f-agent-control-native-output-schema-c1`) could grade THIS tree instead of a
foreign ancestor. No Host was started; no tests/homes entry was created.

## 4. Risks

1. **The runtime Agent must actually be the tools-registry scope key.** The fix
   assumes the upstream identity the existing Permission Coverage Gate already
   relies on (`tools.schemas(runtimeAgent)`, `agent-bindings.mjs:2236/2686`).
   If a host supplied a runtime Agent that is NOT the tool-plane scope key, the
   surface read would target a missing layer. N8 pins the exact split (Agent
   finds the layer, tag does not) and the 0.1.2-era fallback still uses the tag;
   the reviewer should confirm no other setup path passes a different object.
2. **The ARC-A digest lock is RED until the coordinator books the override.**
   This is deliberate and matches #550/#555/#557. Do not merge before booking.

## 5. `pnpm ci:local` — verbatim

Post-commit run (default `--base origin/master`), verdict line:

```
DSH-CI-LOCAL verdict=fail steps=6 failed=1 coverage=determined files=3 wall=245.5s
```

Exit 1. Read precisely: `Test Files  3 failed | 511 passed (514)`,
`Tests  4 failed | 6444 passed (6448)`. The four failures:

1-3. the three ARC-A/ARC-D L1 digest-drift arms — the SAME expected pre-booking
red as #550/#555/#557, silenced by the coordinator's override entry (proved
34/34 with a temporary override, reverted and never committed);

4. `a4p7-merge-gate`'s nested `check-artifacts-at-head` leg refused with
`verdict=not-run reason=store-not-writable`: this worktree's symlinked
`node_modules/.modules.yaml` records a pnpm store path from another lane's
deleted `.review-scratch`, and the nested instrument is spawned without
`--store-dir`. The instrument itself passes on the same commit when given this
worktree's writable store:

```
DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=HEAD verdict=ok compared=1916 drift=0
[check-artifacts-at-head] HEAD carries its own build: the committed surface IS a fresh build of itself (1916 compared file(s)).
```

That is an environment-store limitation of this sandboxed worktree, not a
product/artifact drift; CI's runner has a writable store. No `--no-tests`, no
exit-2 reinterpretation: the verdict above is quoted as returned.
