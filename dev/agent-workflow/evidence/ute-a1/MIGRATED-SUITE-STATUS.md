# The 16 migrated capability suites — measured, not assumed

**Measured:** 2026-11-22 (round 30) on `vnext/a1-cut`.
**Command:** `node <main-worktree>/node_modules/.pnpm/vitest@…/vitest.mjs run <the 16 files in
migrated-entry-imports.json>` from this worktree.
**Before this round:** 238 tests, **230 passed, 8 failed** across 7 files.
**After the `resolvePaMount` fix:** 238 tests, **233 passed, 5 failed** across 5 files.

The prior state of this evidence was `migrated-entry-imports.json` with `"missing": []` — i.e. the files
IMPORT the new entry (`vnext/root.js` / `vnext/agent-bindings.mjs`). That is an import migration, not a
behaviour migration, and nothing had ever RUN them: `vitest` in this worktree's `.bin` points at a
deleted sibling worktree's `node_modules`, so the suite looked un-runnable. It runs from the main
worktree's install. This file records what that revealed.

## Fixed in this round

**`ReferenceError: resolvePaMount is not defined`** (f15-mcp-live-loss L4 + L7, 2 tests). The A1 cut
retired `pa-mount-registry.mjs` — including the `publishPaMount`/`revokePaMount`/`resolvePaMount` index —
but `publishAuthorityGeneration` in the new `agent-bindings.mjs` still CALLED it. On any path that
publishes an authority generation the module threw. It is now an optional seam
(`resolveMemberMount(teamRoot, memberInstanceId)`): when wired, the refresh works as before; when not
wired, the publish is skipped with an explicit observation and `{refreshed: false, reason: 'no-mount-seam'}`
instead of a crash. **Not claimed:** the product wires no mount seam today, so the authority-generation
refresh cannot fire in the assembled product — that is a C-stage wiring item, now visible instead of
fatal.

## Round 31: the four LAYOUT PINS are re-anchored — 237/238

Four of the five were pins on the retired root/route, re-expressed against the new assembly
**without weakening what they assert**:

| suite | what changed | what did NOT change |
| --- | --- | --- |
| `a4p6-start-gate-entrances` BLOCKER 1 | `from './s6-remote.js'` → `from '../s6-remote.js'` (the root moved one directory down) | the law: the root imports the ONE `governanceStartRefusal` mapper and declares none of the three wire codes |
| `a3p5-permission-read-wiring` group A | the seam allow-list now accepts `plugin/vnext/root.ts` as well as `plugin/root.ts` | the law: `createPermissionReadProjection` has exactly ONE production consumer, and the decision-lane input is byte-stable across reads |
| `a4p7-ceiling-port-assembly-pin` PIN-4 | reads `src/plugin/vnext/root.ts` instead of the deleted `src/plugin/root.ts` | the census: exactly one producer of the ceiling reader, exactly one `{ authorityCeiling: permissionAuthorityCeiling }` |
| `a4p7-live-descendant-authority` §7.6 row 5 | walks `src/plugin/vnext` and names `admission.ts` / `centre-config.ts` where it used to name the retired `pre-execute-adapter.ts` | the law: the authority path never reaches a directory-listing API — and the walk now covers the CENTRE, which is where authority lives after the cut (strictly stronger coverage than before) |

Re-measured: **237/238**. The one that remains is the one that cannot be re-anchored, because it is not a
pin.

## The one that remains: E3 — the durable overlay no longer reaches the decision side

| # | suite / leg | failure | class | action |
| --- | --- | --- | --- | --- |
| 1 | `a3p4-pr4-production-entry-regression` "E3" | `the glue installed a pre-execute leg on tpl-a: expected 0 to be greater than 0` | **BEHAVIOUR — REAL CAPABILITY LOSS** | see below |
| 2 | `a3p5-permission-read-wiring` group A | projection outside the seam | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 3 | `a4p6-start-gate-entrances` BLOCKER 1 | missing `from './s6-remote.js'` | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 4 | `a4p7-ceiling-port-assembly-pin` a4-76 | `ENOENT …/src/plugin/root.ts` | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 5 | `a4p7-live-descendant-authority` §7.6 row 5 | walk lost `pre-execute-adapter.ts` | LAYOUT PIN | **RE-ANCHORED** (round 31, walk now covers the centre) |
| 6 | `team-session-activation-glue` G8 | `bothFulfilled === false` once | **FLAKY** | passed 3 further full runs and in isolation; one occurrence under parallel load is recorded as a flake risk, not a pass — the arm must be made deterministic before D |

Note 1 and 6 are behaviour; 2–5 are pins that must be RE-ANCHORED to the new assembly without weakening
what they assert. Classification is by reading the failure message only; each one needs its own
investigation before the expectation is touched — the rule that produced the SLICE-16 correction (an arm
that encoded a defect as an expectation) cuts both ways.

## Why this is the A1 completion gate, not a side quest

The objective's A1 clause is "16 个保留能力历史测试迁移到新入口". Import-migration was done; behaviour
migration was not measured until now. 233/238 passing is the honest current number, and the five above
are the remaining A1 work.

### Why E3 is not a pin

The old entry installed a **pre-execute adapter that consulted the durable permission overlay per call**.
The A1 cut retired that adapter with the execution route, and the new centre judges a call against the
COMPILED binding lanes only. So a `grantInstance` deny persisted AFTER the member was bound has **no
decision-side effect** until something recompiles the binding — i.e. the Alpha.4 durable overlay lost its
execution-time enforcement. That is exactly the "入口整体替换后的 Team 功能损失" risk in the objective, and
it is a capability the 06 contract preserves.

The test's expectation is right and its assertion (`the glue installed a pre-execute leg`) is the honest
way to state it: the glue installs NO decision leg today.

**Design decision needed (C stage), not a test edit.** The centre must stay the ONE decision point, so
the options are (a) the centre consults an injected overlay-decision port per call, next to the lane
verdict (the old adapter's semantics, moved under the centre's authority), or (b) the overlay mutations
are compiled INTO the binding and the generation recheck recompiles it. (a) is closer to the retired
behaviour and keeps one decision function; (b) keeps admission synchronous but makes every mutation a
recompile. This must be decided with the Control allow/ask/deny wiring, because both are the same
question: what is the ONE place a durable restriction becomes a verdict.

**Not claimed:** the overlay is not enforced at execution time by the new centre today. No row in
`CAPABILITY-MATRIX-C.md` may say otherwise.

## The CI population declaration (round 32)

`tests/checks/eb3-ute-migrated-suites.txt` now declares the population in the one form the repo's token
runner accepts, and the command is recorded in the file's header:

```
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=FAIL suites=15 files=15 describes=76 passed=237 failed=1
```

FIFTEEN suites, not sixteen: the sixteenth bookkeeping entry in `migrated-entry-imports.json` is
`t12a-live-bridge.mjs`, a live-bridge HELPER with no tests of its own. The token runner refuses a list
longer than the report, which is how that was discovered — the census told the truth about its own shape.

**The leg is NOT bound to a Required layer yet, deliberately.** Its population is FAIL (E3). Adding it
would redden Required, and adding it with an exemption or an expected-fail would be the skip this project
refuses. The order is: fix E3 → the list goes green → the leg (`cmd` = the runner, `check` = the four
argv tokens, matching `ci-security`'s shape) is bound to `ci-integration` with the manifest entry and the
workflow step. I measured that binding end to end (the gate's `CI_LAYER_LEG_UNPROVEN` /
`CI_LAYER_LEG_ARGUMENT_MISSING` findings both fired and cleared), then reverted it rather than ship a red
Required leg.

## E3, diagnosed further (round 33): admission is CONDITIONAL on the realm

Reading the call site, not the failure message:

```js
const a5sfRowConfig = a5sfRealmConfigOf(config)
if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined && sessionId !== teamRoot) {
  const a5sfRealm = await mountMemberA5sfRealm({ ... })
  ... installMemberExecution(...)   // the centre, and therefore the ONLY admission point
}
```

The centre — and with it the admission leg, the durable ledger and the settlement — is installed
**only when a confined provider realm is mounted**. A member whose row has no `a5sf` realm config, or a
world that provides no realm provider, gets **no centre at all**: its native tools run with the host's
own mediation and NO admission decision. That is not "explicitly refused"; it is "not covered", which is
worse, because the A1 law says an unwired controlled call must be refused rather than forwarded.

So E3 is the witness to TWO defects, not one:

1. **the durable Alpha.4 overlay has no decision-side effect** (the adapter that consulted it was retired
   with the execution route) — this is what E3's assertion text names;
2. **admission itself is conditional on the realm** — a member without a realm is unmediated. E3's world
   has no realm, which is exactly why it observes zero pre-execute legs.

Order of repair, and why:

- **First (2), because it is a security gap and it is small:** install the centre for every governed
  member and make the native mount the OPTIONAL half (`realm`/`nativeSpecs` absent ⇒ admission-only
  centre). A member with no confined provider is then still admitted-or-refused, and the record says so.
- **Then (1),** which needs the decision recorded in the matrix: the centre consults an injected
  overlay-decision port per call, or overlay mutations compile into the binding and the generation
  recheck recompiles it.

Neither is a test edit. E3 stays red until both are done; the CI leg stays unbound until then.

## The overlay port is in; what the product side needs is now measured (round 39)

The centre accepts `overlayDecision` (ADM-45). The remaining half is the product supplying one, and reading
the assembly narrows it to two facts:

1. **The overlay lives in `deps.permissionOverlay`, and the glue already reads it** — `readAuthorityGeneration`
   calls `permissionOverlay.latest({ teamSessionId, memberInstanceId })`, returns `0` only for the legal
   no-row world, and THROWS on a fault or a non-generation. That is the same port the admission consultation
   must use; a second reader would be a second policy.
2. **`latest()` is async, and the admission consultation is synchronous** (it runs inside the pre-execute
   listener's decision and the guard). So the product has exactly two lawful shapes:
   - **(a) resolve the overlay row ONCE per binding generation and keep a synchronous view** — the binding's
     `policyGeneration` is already the cache key, and any mutation bumps it, so a stale view is impossible
     by construction; the recheck that already runs after approval re-reads it;
   - **(b) make the consultation async on the pre-execute path only** and let the guard consult the cached
     decision (the port already memoizes one verdict per callId).

(a) is the one that keeps every path synchronous and needs no new await in a guard. Either way the row's
RULES need canonicalizing against the operation before they can deny, which is what the retired adapter's
`canonicalizeOperation` + `resolveOperationPermission` did — both modules SURVIVE the cut
(`operation-permission/`), so the work is assembly, not reimplementation, and it is the C-stage "one place a
durable restriction becomes a verdict" item.

Not started: this needs the overlay row's rule shape read in detail, and half of it would leave E3 red in a
new way rather than fixed.

### The product side has a named owner already (round 41)

The durable plane is not hypothetical or unowned in the new root: `root.ts` builds `permissionPlane`
(mutation lane `grantInstance`/`revoke`, the durable `append`/`latest`/`history` store) and refuses with
`PERMISSION_MUTATION_NOT_CONFIGURED` when it is absent — "zero write" rather than a silent no-op. So the
admission consultation has an obvious provider: the SAME `permissionPlane` the mutation entry uses, read
through the SAME `latest()`, keyed by the binding's `policyGeneration`.

Concretely, the remaining work is:

1. `root.ts` hands the plane (or a bound reader) into the bindings deps it already passes
   (`permissionOverlay` is already threaded to `agent-bindings` at `:2435`);
2. `member-execution` resolves the overlay row once per `policyGeneration` and closes a synchronous
   `overlayDecision` over `canonicalizeOperation` + `resolveOperationPermission` (both SURVIVE the cut);
3. the centre passes it to `installMemberCentre` (already accepted, ADM-45);
4. E3 turns green; the migrated-suite list becomes green; the vitest leg is bound to `ci-integration`.

No new authority, no second store, no reimplementation of the retired adapter — the adapter's decision
CORE is reused, its retired listener shape is not.

## E3, measured properly (round 48, delegated investigation): the world is v3-era

The premise "E3 only needs the overlay provider" is **false**, and the instrumentation that shows it is
short: the assertion `chain.length > 0` fails at `test:1143` because **E3's world has no centre at all**.
Its setup passes no `a5sf` config, no realm provider and no `centreStatePath`
(`test:1123-1139`), and installation is gated on the first two (`agent-bindings.mjs:1759-1763`).

Four facts, each with its own file:line:

1. **No centre ⇒ no leg.** Only `installAdmissionPoint` populates that listener list
   (`admission-port.mjs:257-264`). The "asked for the centre" rule refuses (`centre-config.ts:34-41`) — it
   never installs — so "install anyway" is a product-behaviour change, not a filler.
2. **E3's filled plane ref is not consumed.** It fills `permissionPlaneRef` (`test:1089-1106`), and the new
   glue never references it (`grep -c permissionPlaneRef agent-bindings.mjs` → 0) even though
   `root.ts:838-846` still documents that the glue consults it. (My earlier note said the deps were
   threaded "at `agent-bindings.mjs:2435`" — wrong, that is root.ts's Alpha.6 wiring.)
3. **Even an installed centre would have no ALLOW lane for E3.** The centre's lanes come from the compiled
   realm member (`centre-install.mjs:44-88`); E3's control expects the **Alpha.4 `capabilities.permissions`
   template ALLOW** to execute (`test:1145-1153`), and its fixture is a **v3** document with no
   `memberIoCeilings` (`test:923-991`) while the compiler reads the **v4** ceiling family
   (`product-assembly.ts:66,140,1173-1188`). So escalation Option A compiles nothing for this world, and
   `installMemberExecution` would throw for lack of `centreStatePath` (`member-execution.mjs:98-108`).
4. **The prescribed sync port cannot call the decision core.** `overlayDecision` is synchronous
   (`admission-port.mjs:141-149`) but `canonicalizeOperation` is **async** over a promise-returning fs seam
   (`canonical-operation.ts:463`, `types.ts:189-191`), so a per-call sync consultation cannot canonicalize;
   and E3's expected reason text (`'permission denied'` + `'overlay'`, `test:1182,1185`) is the RETIRED
   adapter's wording (`pre-execute-adapter.ts:1915`), not the port's `ADMISSION_OVERLAY_DENY` text.

### So E3 is a world-rebuild, not a wiring gap

Its ASSERTION is right and must survive: *a persisted overlay deny beats a template allow through the real
glue*. Its WORLD is pre-cut: v3 document, no v4 ceilings, no realm, no centre. The migration is to rebuild
the fixture on the current contract (declare `a5sfMemberPolicies` + `centreStatePath`, give the member v4
ceilings, keep the persisted deny and the same assertions) — a **test-world rebuild preserving the
assertion**, which is the same class of move as the four layout pins and needs the same discipline: change
what the world IS, never what it asserts.

Three roads, and only the first is legitimate here:

- **rebuild the world on v4 + wire the provider (recommended)** — assertion untouched; needs the async
  consultation resolved by a bind-time cache keyed on `policyGeneration` (the generation bumps on every
  mutation, so the cache cannot be stale), which ALSO settles fact 4 without inventing synchronous path
  semantics;
- refuse realm-less members (option B) — fail-closed, but E3's control (`no overlay row ⇒ the static ALLOW
  executes`) fails by construction, so E3 can never be green this way;
- reinstate the retired Alpha.4 template-permission lane — the legacy fallback the A1 law forbids.
