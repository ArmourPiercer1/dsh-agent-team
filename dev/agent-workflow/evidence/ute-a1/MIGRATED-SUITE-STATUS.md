# The 16 migrated capability suites — measured, not assumed

**CURRENT (round 49, 2026-11-23): 238/238, E3 GREEN.** See §"Round 49 (current)" at the end; the
round-30/31 narrative below is kept as history.

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
| 1 | `a3p4-pr4-production-entry-regression` "E3" | `the glue installed a pre-execute leg on tpl-a: expected 0 to be greater than 0` | **BEHAVIOUR — REAL CAPABILITY LOSS** | **REBUILT ON v4 + overlay supplier (round 49) — GREEN**; see §"Round 49 (current)" |
| 2 | `a3p5-permission-read-wiring` group A | projection outside the seam | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 3 | `a4p6-start-gate-entrances` BLOCKER 1 | missing `from './s6-remote.js'` | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 4 | `a4p7-ceiling-port-assembly-pin` a4-76 | `ENOENT …/src/plugin/root.ts` | LAYOUT PIN | **RE-ANCHORED** (round 31) |
| 5 | `a4p7-live-descendant-authority` §7.6 row 5 | walk lost `pre-execute-adapter.ts` | LAYOUT PIN | **RE-ANCHORED** (round 31, walk now covers the centre) |
| 6 | `team-session-activation-glue` G8 | `bothFulfilled === false` once | **MISLABELLED FLAKE — it was the retired `resolvePaMount` `ReferenceError` on the delivery path**, the same live defect `f6ceacc2a` fixed for the f15 legs; the re-runs that "cleared" it all came after that fix | reproduced deterministically by restoring the pre-fix line (round 50), then fixed for real: G8 now awaits the world's own `resumeGate` promise instead of polling a 3 s wall clock. 238/238 in 8 full parallel runs (5 under CPU load) plus 32 standalone runs |

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

## Round 49 (current): E3 rebuilt on v4 and GREEN — 238/238

**Measured:** 2026-11-23 on `vnext/a1-cut` (this worktree), from the main-worktree install:
`node <main>/node_modules/.pnpm/vitest@…/vitest.mjs run <the 16 files in migrated-entry-imports.json>`.
Result: **15 test files, 238 passed, 0 failed**. `a3p4-pr4-production-entry-regression` is 20/20, E3
included.

### What the WORLD became (the assertion did not move)

E3's world is now a current-contract Member, not a v3 document:

- `glueBlueprintSource` is a **v4** blueprint: `schemaVersion: 4` and a `memberIoCeilings` family for
  `tpl-a` whose `write`/`read` lanes ALLOW the member workspace (`test:919-990`). The retired Alpha.4
  `capabilities.permissions` lane is gone from the fixture; the allow now comes from the ONE compiler.
- The row declares `a5sfMemberPolicies` (the same ceiling family, as the product's exception path) and
  `centreStatePath` (a real directory), and the live world is created with `realmMount: true` so the
  a5sf install gets the Cordis service isolation it mounts into (`test:1103-1121`, `test:1177-1202`).
- `a5sfRealmProvider: () => undefined` is the production shape when the composition has no
  `teamA5sfRealm` service: the row's own declaration supplies the plan, and the mount compiles it
  through `parseProductRealmDeclaration` / the product assembly — the SAME path a real Member takes.
- The SAME `permissionOverlay` port instance is handed to `createTeamProductionRoot` (the mutation
  lane) and to `createLiveWorld` (the glue). There is no second store.

### What moved in production (two seams, no second authority)

1. `packages/runtime/src/plugin/vnext/overlay-decision.mjs` (new): the supplier for the centre's
   already-existing synchronous `overlayDecision` port. An async `prepare` listener (registered AHEAD
   of the centre's) canonicalizes the call's operation and reads `overlay.latest` for the bound
   `{teamSessionId, memberInstanceId}`; it decodes the stored deny rules once per overlay
   **generation** and computes the one asynchronous input (`FileSystem.contains` for `subtree`) there.
   The sync `decide(facts)` only reads that prepared entry and calls the frozen
   `resolveOperationPermission`. It answers `deny | undefined` only: a durable ALLOW cannot widen the
   compiled lane and a durable ASK is not turned into a deny. A read/parse/canonicalize fault is stored
   and surfaced by the port as `ADMISSION_OVERLAY_FAULT` (a refusal).
2. `packages/runtime/src/plugin/vnext/agent-bindings.mjs` builds that supplier in the a5sf branch
   (same `permissionOverlay`, same per-agent `fsBackend` seam) and passes `overlayDecision` into
   `installMemberExecution` → `installMemberCentre`. The centre stays the ONE decision point; the
   overlay is consulted only when the lane already allowed (`admission-port.mjs:141-149`), and only
   removes authority.

The supplier is byte-placed into the shipped dist mirror by
`scripts/dist-placements/240-ute-vnext-centre.json`; without that entry the shipped
`files: ["dist"]` face would fail `ERR_MODULE_NOT_FOUND` at the first governed bind.

### The test-harness seam this needed (and what it does NOT change)

`t12a-live-bridge.mjs` gained an OPT-IN `realmMount` option. When set, each agent ctx gets a real
Cordis `Context` used only for `isolate`/`plugin(Service)`/`get('fs')`, with a minimal base `fs`
Service; every other double surface is unchanged. The fake ctx's `get('tools')` now returns its
`tools` object (the centre's admission port requires it). Absent `realmMount`, no Context is
allocated and the pre-E3 worlds are unchanged.

### The two expectation edits, stated plainly

- `denied.reason` is asserted with `ADMISSION_OVERLAY_DENY` (plus `overlay`) instead of the retired
  adapter's prose `'permission denied'`. This is the ADM-45 port's own typed vocabulary and is
  strictly more specific; `nextCalls === 0`, `kind === 'deny'`, and every control assertion are
  unchanged.
- `driveOnce`'s `nextCalls` now counts the BODY EDGE as "the whole chain answered allow", not "the
  last listener called `next()`". The centre is an outer waterfall leg that calls `next()` before its
  own verdict, so the old counter would report 1 for a call the centre refused. The assertion's
  meaning (`1 == the tool executed`) is preserved and is now faithful to the host: the body runs only
  after an allowed chain.

### What this proves — and what it does not

**Proven:** with no overlay row, the v4 compiled `write` ALLOW reaches execution through the real
`createAgentBindings` → centre pipeline (control `nextCalls === 1`); after a persisted
`grantInstance` deny through the production mutation lane, the SAME call is refused by the centre with
`ADMISSION_OVERLAY_DENY` and executes nothing (`nextCalls === 0`), while the compiled lane still
allows it.

**Not proven / limits:** this is a test-world mount, not a host boot line, so E3 is NOT
PRODUCT-PROVEN and no row in `CAPABILITY-MATRIX-C.md` is upgraded by it. The world mounts a real
declared realm, so it does not exercise (and does not resolve) the realm-less admission question in
`ESCALATION-realmless-admission.md`; that ruling remains open and its witness is now a different
world (or none). Overlay `ask`/`allow` rules are outside the port's contract and are not expressed.
Subtree containment depends on the host's canonical-key-wrapping form of `FileSystem.contains` (the
same form `host.ts`'s `fsContainsKeys` uses); the E3 probe is an exact deny, so subtree matching is
implemented but not exercised by this leg.

## Round 50: G8 is deterministic — the mechanism was a delivery-path rejection, not a pending read

**The recorded flake** (the `FLAKY` row above): `team-session-activation-glue` G8,
`bothFulfilled === false`, `expected false to be true`, seen once in a full parallel run and never in
the re-runs. The row's guess was "one path was still pending when the assertion ran". **That guess is
wrong, and it is worth saying plainly:** `G8` computes `bothFulfilled` from
`await Promise.allSettled([pEnsure, pDeliver])` (`team-session-activation-glue.test.ts:553` before this
round), which AWAITS both paths. A `false` there is a **rejection**, never a still-pending path. So the
arm was not observing an unsettled state; one of the two paths genuinely **threw**.

**The mechanism, named exactly.** `world.binding.workDelivery.deliver` first joins the one in-flight
`ensureLiveAgent` (so the resume count stays 1 and `pEnsure` fulfils), then runs
`prepareAgentForRequest` → `refreshAuthorityGeneration` → `publishAuthorityGeneration`, and THAT
function called `resolvePaMount(...)` — a symbol the A1 cut had retired with the old execution route.
Result: `ReferenceError: resolvePaMount is not defined` on the delivery path only. Reproduced
deterministically at this HEAD by restoring the pre-fix line (and then reverting it):

| form | G8 result |
| --- | --- |
| pre-fix `publishAuthorityGeneration` (old `agent-bindings.mjs:2804`) | `× G8 … 1 failed │ 17 passed`, `AssertionError: expected false to be true` |
| this HEAD (the seam guard at `agent-bindings.mjs:2846`) | `18 passed` |

So the "flake" was the same live `ReferenceError` already fixed for `f15-mcp-live-loss` L4/L7 in
`f6ceacc2a` — commit `f6ceacc2a`'s own message classifies the arm as "remote-ensure || work-delivery
lazy ensure does not fulfil both paths". It was mis-labelled FLAKY because the three re-runs came after
that fix.

**What this round changed in the arm (the assertion did not move).**
- `team-session-activation-glue.test.ts` G8 no longer polls `world.agents.resumes.length` through
  `waitFor`, i.e. no longer reads a counter against a **3 s wall-clock deadline**. It now awaits
  `gateArmed`, a promise the world's own `resumeGate` hook resolves at the instant the one cold resume
  reaches the gate (the product event the poll was approximating), and races it against `pEnsure` so a
  settled ensure that never reached the gate is a **named** guard failure instead of a silent timeout.
- `state.g8.outcomes` records `fulfilled` / `rejected: <message>` per path, and only the assertion's
  **message** gained that detail. `expect(g8.bothFulfilled).toBe(true)`, `resumesCount === 1`,
  `hasLive`, `followupsCount === 1` are all unchanged.

**Determinism evidence.** Before: 1 occurrence in a full parallel run (round 30), non-reproducible in
3 re-runs and in isolation. After, on this worktree:

| campaign | result |
| --- | --- |
| standalone ×12 | 12/12 `18 passed` |
| standalone ×20 under 12 busy CPU hogs | 20/20 `18 passed` |
| full migrated suite ×3 | 3/3 `238 passed` |
| full migrated suite ×5 under 12 busy CPU hogs | 5/5 `238 passed` |

**Gates:** `dispatch-tests --leg ute-vnext-a1` 109/109 pass; `test-catalog` uncollected=41 excluded=14
(within the 41/7 bound); `ute-cut-closure` findings=0; `docs-sync` findings=0 blocking=0;
`place-dist-glue` 27 placements byte-identical; `eb3-ci-required` findings=0; the bound leg
`eb3-security-run --layer ci-integration` → `verdict=PASS suites=15 passed=238 failed=0`.

**Not proven:** the diagnostic arm was exercised only by restoring the pre-fix symbol (a scratch edit,
reverted — `agent-bindings.mjs` sha1 unchanged); no NEW rejection mode was fabricated. The retire of
`waitFor` in G8 is scoped to G8 — G5/G7/G9/G10 still use the same 3 s poll and were not touched.

## Round 51 (B stage): the `ask` path is real — durable Control approval, recheck, one-shot grant

**The B gap, stated as measured.** `admission-port.mjs` had an `ask` branch, a one-shot grant and a
recheck, and **nothing in the product ever supplied `grants`**: every ask in a governed member was
`ADMISSION_ASK_UNWIRED` (`admission-port.mjs:393-397` at the pre-round HEAD). The branch was also
incomplete in the other direction: even with a binder, the "approval" was the pre-execute verdict
itself — no durable request, no recorded decision, no refusal code for a denied or expired approval.

**What is now real (file:line at this HEAD).**

| step | where |
| --- | --- |
| the product's grant binder + trusted-member projection | `agent-bindings.mjs:556-568` (ONE `createInvocationBinder()` per row; the identity is projected from the binding, never invented) |
| the durable approval authority (port over the EXISTING bridge) | `admission-port.mjs:60-199` (`createControlApprovalPort`: `requestControl({executionCoupling:'inline'})` → `awaitControlDecision` → the closed decision mapped to a code), wired lazily at `agent-bindings.mjs:569-571` |
| the glue supplies BOTH ports to the ONE centre | `agent-bindings.mjs:1868-1869` → `member-execution.mjs:161-162` → `centre-install.mjs:148` |
| the binding carries the authoring reference a grant needs | `centre-install.mjs:86-93` (`templateId` from the compiled policy; absent ⇒ no grant, `ADMISSION_MEMBER_UNIDENTIFIED`) |
| the ask becomes a Control request, then a grant | `admission-port.mjs:399-402` (hand the ask to pre-execute) + `admission-port.mjs:435-521` (`completeAsk`: identity → durable request → decision → `binder.bind`) |
| the post-approval recheck (lane AND policy generation) | `admission-port.mjs:524-538` re-admits at the guard; `admission-port.mjs:540-556` consumes with the generation **as it is now**, so a recompiled policy is `ADMISSION_GRANT_CAPABILITY_REVISION_MISMATCH` |
| one-shot spend, replay refused | `admission-port.mjs:540-556` (`binder.consume` exactly once) + the durable ledger replay (`:355-360`) |
| the host-native ask is preserved | `admission-port.mjs:403-432`: with a binder and NO approval authority the verdict stays `ask` (the host's own approval prompt) — the shape `vnext-fs-slice` SLICE-20/22 already enforce |

**Controls (all in `packages/runtime/test/vnext-admission.test.mjs`; 55/55 green).**

- ADM-46 — three wirings: no binder ⇒ `ADMISSION_ASK_UNWIRED`; binder only ⇒ the host-native `ask`
  (grant spendable at the guard); binder + approval authority ⇒ `allow` after exactly ONE approval
  request.
- ADM-47 — a DENIED approval: refusal `ADMISSION_APPROVAL_DENIED`, no execution (the guard refuses
  too, both consultations), the durable fact names the enforced refusal + `laneDecision: 'ask'`, and
  the product settlement store is `REFUSED` (closed at admission).
- ADM-48 — an EXPIRED (`stale-denied`) approval has its OWN code, asserted distinct from a denial.
- ADM-49 — a throwing authority and an answer with no verdict are both `ADMISSION_APPROVAL_FAULT`.
- ADM-50 — over the REAL durable ControlService (real TeamDomain world): exactly one durable request
  (`kind: leader-approval`, `executionCoupling: inline`, `correlation: admission:<callId>`,
  `requester = the member`), exactly one durable `allow` decision, the guard spends exactly ONCE
  (counted binder), the host's second guard consultation spends nothing, and a same-callId replay is
  `ADMISSION_REPLAY`. Negative control: a NEW callId is a NEW request + decision (no approval reuse).
- ADM-51 — over the REAL service: a leader DENY ⇒ `ADMISSION_APPROVAL_DENIED`, a durable `deny`
  decision row, and the guard cannot turn it into an execution.
- ADM-52 — the post-approval recheck: the same lane at a NEW policy generation is refused
  (`ADMISSION_GRANT_CAPABILITY_REVISION_MISMATCH`); negative controls prove the unchanged generation
  spends and that lane-narrowing is a different refusal (`ADMISSION_RECHECK_LANE_DENY`).
- ADM-53 — an incomplete trusted identity refuses BEFORE a reviewer is asked (zero approval requests).
- ADM-54 — the SUPPLY chain: `installMemberExecution` installs a centre that still refuses every ask
  without the two ports, and with them turns the same ask into a real approval + spendable grant; plus
  a source pin on the glue hop (destructure, lazy `controlOf`, both ports on the ONE install call, the
  PRODUCT binder import).
- ADM-55 — the wait bridge's closed outcomes each map to their own code: `aborted` →
  `ADMISSION_APPROVAL_WAIT_ABORTED`, `abandoned` → `ADMISSION_APPROVAL_ABANDONED` (asserted distinct),
  an unrecognized decision value and an absent service are refusals, never allows.

**Gates (this HEAD).** `dispatch-tests --run --leg ute-vnext-a1` → `suites=6 files=6 exit=0` (117
pass); `test-catalog --max-uncollected 41 --max-excluded 7` → `UNCOLLECTED 41`, `findings=0`;
`ute-cut-closure --check` → `findings=0`; `ute-p0-assets --check` → `findings=0`;
`docs-sync --check` → `findings=0 blocking=0`; `place-dist-glue` → 27 byte-identical placements;
`eb3-ci-required` → `findings=0`; the bound leg `eb3-security-run --layer ci-integration
--list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000` →
`verdict=PASS suites=15 files=15 passed=238 failed=0` (the count did not move: the new arms are
node:test in `vnext-admission.test.mjs`, which rides the `ute-vnext-a1` leg, not the vitest list).

**NOT proven — do not read more into this than it says.**

1. **No host boot.** The product hop is pinned behaviourally at `member-execution` (ADM-54) and by a
   source pin on the glue, not by booting a real host with a real leader. A member ask reaching a
   real leader's `team_list_pending_control` / `team_resolve_control` (or the GUI) end to end is
   **not** exercised here.
2. **The durable allow is not consumed by the Control guard.** The request is `executionCoupling:
   'inline'`, and the Control plane's own law is that an inline allow is NOT a last-mile guard token
   (`control/service.ts:4278-4290`) — it authorizes its own waiter. The exactly-once enforcement here
   is therefore the one-shot `member-io-policy` grant plus the durable admission-ledger replay
   refusal. A `guarded` + `guardOperation` variant was NOT built: it would consume twice and would
   burn a durable allow on a crash between the consumption and the body.
3. **`stale-denied` over the real service** is not exercised (its fixture needs the target to become
   terminal between request and decision); only the mapping is proven (ADM-48). The abort/abandon wait
   paths are likewise proven at the mapping level (ADM-55), not over a real aborted wait.
4. **E3 is untouched.** This round does not resolve `ESCALATION-realmless-admission.md`,
   `CONTRACT-CHANGE-REQUEST-settlement-recheck.md` or `CONTRACT-CHANGE-REQUEST-process-lane.md`, and
   the E3 blocker recorded above is unchanged. No row in `CAPABILITY-MATRIX-C.md` is upgraded.
5. **The `ask` grant is bound to member + call + tool + policy revision, not to the locator.** The
   Control request carries no `operationFingerprint` (canonicalizing the operation is async and the
   port's decision is sync), so two asks by the same member for the same tool under the same revision
   are distinguished by callId alone.

## Round 52 (B stage): Stop priority and lifecycle close, over the one centre

**What was missing, measured at HEAD `256d43430`.**

- **Stop.** `admission-port.mjs` never read `exec.signal`. The ask wait called
  `service.awaitControlDecision({ rootSessionId, requestId })` with **no signal**, so a Stop that landed
  while an ask was pending left the durable inline request parked until somebody decided it — a request
  nobody was left to answer — and the call hung. Nothing at the guard checked an abort either, so an
  approval that already held executed regardless of a Stop that arrived after it.
- **Close.** `installMemberCentre`'s `dispose()` **removed** every point (ADM-28 pins exactly that:
  after a disposal no point answers). For a lifecycle close that is the wrong shape twice over: the
  archived member's tools kept running with **no admission at all** (the unwired state the centre
  exists to refuse), and the settlement observer died with the point, so an in-flight call's record
  stayed `ADMITTED`/`RUNNING` and the next bind's recovery turned it into `UNKNOWN`.

**The Stop is the host's own signal.** There is no second stop mechanism: `exec.signal` is the same
field the execution fact already reads (`execution-facts.mjs:88`), and the fs-slice world already
dispatches with it (`vnext-fs-slice.test.mjs:425`). The one thing added is that the **one** wait bridge
now receives it, and the ControlService's **existing** inline-abort cascade
(`control/service.ts:4636-4672`) durably abandons the inline request and rejects typed — the durable
abandonment mark is terminal, so a decision that arrives afterwards can never become an allow.

### What is now enforced (file:line)

| Rule | Where |
| --- | --- |
| **A1** a Stop decides **before the lane and before any reviewer**; own code `ADMISSION_STOPPED`, distinct from deny/expired/fault | `admission-port.mjs:54`, `:471` (order: memo → replay → Stop → binding → lane), `:334` (`refuseStop`) |
| **A1-record** a Stop at admission is recorded as the ENFORCED deny: durable fact `refusalCode: ADMISSION_STOPPED`, settlement `REFUSED`, `dispatch`/`bodyOutcome` `not-started`, zero effects | `admission-port.mjs:400-421` + `settlement-port.mjs:28-40` |
| **A2** the pending ask's wait receives the call's signal (combined with the port's close signal); abort ⇒ the ControlService durably ABANDONS the inline request and the centre names the CAUSE of the aborted wait | `admission-port.mjs:599` (`signal: waitSignalOf(exec)`), `:315` (`AbortSignal.any`, a combiner not a second bridge), `:615-640` (relabel `..._WAIT_ABORTED` → `ADMISSION_STOPPED` / `ADMISSION_MEMBER_CLOSED`) |
| **A3** a Stop is never downgraded by a later approval: the signal is re-checked AFTER the durable decision returns, before the grant is minted | `admission-port.mjs:639` |
| **A4** a Stop after the approval but before the body: the guard refuses with `ADMISSION_STOPPED`, the grant is **not spent**, and the record is closed with the product's own Stop vocabulary (`pre-dispatch` Stop + `CANCELLED`, `not-started`) | `admission-port.mjs:778` (`refuseStopAtGuard`), `:798-806`; `settlement-port.mjs:221` (`stoppedBeforeBody`) |
| **A5** a stale approval after a Stop is refused by the Control plane with zero side effects | `control/service.ts:3216-3230` (`resolveControl` consults the abandonment FIRST) — asserted, not implemented here |
| **B1** lifecycle CLOSE is a state, not a removal: `dispose.close()` keeps the pre-execute listener and the guard in closed mode, aborts the pending ask, removes only the memo observer | `admission-port.mjs:871-878`; the removal path `dispose()` is unchanged (`:850-861`) |
| **B2** a call after the close is REFUSED with its own code, recorded and settled `REFUSED`/`not-started`, and the live binding is **never consulted** | `admission-port.mjs:738` (pre-execute), `:807` (guard), `:354` (`refuseClosed`), `:356-360` (`closedBinding` for identity only) |
| **B3** the product calls the close: `member-execution`'s member disposer no longer removes the centre | `centre-install.mjs:209-221` (`close()` exported beside `dispose()`), `member-execution.mjs:181` |
| **B4** an in-flight call that finishes after the close still writes its fact and settles (the execution observer is not disposed by the close) | `centre-install.mjs:209-221` |
| **B5** close is idempotent and a removed point answers nothing | `admission-port.mjs:871` (`closeSignalled`), `:850` (`didDispose`), `retired` at `:293`/`:754`/`:728` |

### The arms: `packages/runtime/test/vnext-admission.test.mjs` ADM-56 … ADM-62

| Arm | Rule | Positive control | Negative control(s) |
| --- | --- | --- | --- |
| **ADM-56** | a Stop before the body is its own refusal, `REFUSED`/`not-started`, never `UNKNOWN`, never an execution | the same call **without** a Stop is admitted, runs (body count 1) and settles `COMPLETED` | the same out-of-lane call without a Stop is `LANE_DENY` (so `ADMISSION_STOPPED` is not what this assembly always says); the same out-of-lane call **with** a Stop is `ADMISSION_STOPPED` (the stop beats the lane's answer); the code is asserted different from `LANE_DENY`, `ADMISSION_APPROVAL_DENIED/EXPIRED/FAULT`, `ADMISSION_ASK_UNWIRED`, `ADMISSION_MEMBER_CLOSED`; both guard consultations agree; `recoverUnsettled` finds nothing |
| **ADM-57** | a Stop while the ask is PENDING: the durable request is abandoned, the call refuses `ADMISSION_STOPPED`, no grant is minted, and a later approval is refused | the same wiring with **no** Stop: the ask becomes a durable allow, the grant is spent exactly once (consume count 1) and the call settles `COMPLETED` | durable state asserted (1 request, **0** decisions, 1 abandonment on that requestId); `resolveControl(allow)` afterwards → `CONTROL_REQUEST_ABANDONED` **and** still 0 decisions / 1 abandonment (the stale approval writes nothing); consume count stays 0; guard refuses |
| **ADM-58** | a Stop AFTER the approval and BEFORE the body spends nothing and closes the record with Stop evidence | the same wiring without a Stop: guard passes, grant spent once, `COMPLETED` | the Stop arm asserts body count 0, `stops: ['pre-dispatch']`, transitions `['ADMITTED','CANCELLED']` (no `RUNNING`), `dispatch`/`bodyOutcome` `not-started`, `effectEvidence` `none-confirmed`, state ≠ `UNKNOWN`, the admission decision is **not** rewritten (`allow`, `laneDecision: ask`) and the **execution** fact carries `refusalCode: ADMISSION_STOPPED`; the no-Stop arm asserts **no** Stop record is invented |
| **ADM-59** | lifecycle close: a new call is refused with its own code, not judged against a stale binding, and not `UNKNOWN` | the same call **before** the close is admitted and `COMPLETED` | after the close the binding resolver is a live counter/trap: **0** reads and the global lookup count does not move (not admitted against a stale binding); `ADMISSION_MEMBER_CLOSED` ≠ `ADMISSION_NO_BINDING`; fact + settlement `REFUSED`/`not-started`; body count unchanged; two further closes write nothing and a repeated guard consultation writes exactly one authority record |
| **ADM-60** | a call IN FLIGHT when the member closes still settles; a second dispose neither throws nor double-settles | the in-flight call's guard passed and the record is `RUNNING`; after `close()` the result settles it `COMPLETED` with transitions `ADMITTED→RUNNING→COMPLETED` and exactly one execution fact | after the close `recoverUnsettled` is empty (nothing left to call `UNKNOWN`); two more closes + two disposals leave the record byte-identical and report **no** fault; after a real `dispose()` (removal) the guard answers nothing |
| **ADM-61** | close while an ask is PENDING: the request is abandoned, the call is `REFUSED`/`not-started`, a later approval is refused, and the closed centre raises no new request | the same wiring approves and completes the first ask (1 decision, 1 consume) | durable state (2 requests, 1 decision, 1 abandonment on the pending requestId); `resolveControl(allow)` → `CONTROL_REQUEST_ABANDONED`; a call after the close is refused **without asking a reviewer** (request count stays 2); `recoverUnsettled` empty; no fault reported |
| **ADM-62** | the PRODUCT composition closes: `member-execution`'s member disposer leaves a refusal tombstone | the same read before the close is admitted and `COMPLETED` | after the disposer (called twice, second does not throw) the read is `ADMISSION_MEMBER_CLOSED`, the body does not run, the refusal fact still names `agentId: member-1`, settlement `REFUSED`/`not-started`, `recoverUnsettled` empty, no observe()'d fault |

### Mutation evidence (each control can actually fail)

Each row was applied as a temporary edit, the named arm run, and the edit reverted (`cmp` verified).

| mutation | went red |
| --- | --- |
| remove the Stop check from `evaluate` (`admission-port.mjs:471`) | ADM-56 |
| do not relabel an aborted wait to the stop/close cause (`:615-640`) | ADM-57, ADM-61 |
| remove the guard-stage Stop override (`:798-806`) | ADM-58 |
| remove both closed refusals (`:738`, `:807`) | ADM-59, ADM-62 |
| let `close()` also dispose the execution observer (`centre-install.mjs:213`) | ADM-60 |
| do not abort the port signal on close (`:876`) | ADM-61 **hangs** (bounded by the runner): without a terminal signal the durable wait never ends — which is the pre-round behaviour, not a test defect |
| remove the signal from the approval request (`:599`) | ADM-57 **hangs** for the same reason; this is why the fix is the signal, not a poll |

### Gates (this round, on this worktree)

```
node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1        → 126/126 pass, exit=0 (6 suites, set sha256:bf219e8c…)
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7 → tests=888 findings=0 uncollected=41 excluded=14 (vitest=736 files unchanged)
node scripts/ute-cut-closure.mjs --check                         → pass findings=0
node scripts/ute-p0-assets.mjs --check                           → pass findings=0
node scripts/docs-sync.mjs --check                               → findings=0 blocking=0
node scripts/place-dist-glue.mjs                                 → done (27 placements, byte-identical)
node scripts/eb3-ci-required.mjs                                 → pass findings=0
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
                                                                 → verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
```

### What is NOT proven

1. **`REFUSED` for a Stop that lands AFTER the admission recorded `allow` is impossible under the
   frozen settlement contract**, not skipped by choice. `REFUSED` may not cite an `allow`
   (`execution-settlement.ts:932-955`) and `CANCELLED` from `ADMITTED` requires a recorded
   `pre-dispatch` Stop (`:1019-1027`). ADM-58 therefore records what actually happened — the Stop
   evidence plus `CANCELLED`, `dispatch`/`bodyOutcome` `not-started` — which is the store's OWN Stop
   shape. The literal "stop before the body ⇒ REFUSED" is proven where it is expressible, i.e. where the
   Stop is the admission decision itself (ADM-56, `deny`). Reaching `REFUSED` in the post-approval
   window needs the **open** `CONTRACT-CHANGE-REQUEST-settlement-recheck.md` option A
   (allow `REFUSED` from `ADMITTED` when the observation is `dispatch: 'not-started'`); no contract
   change was made here and that escalation is untouched.
2. **"A call that was admitted (`allow`) but never ran is closed as `REFUSED`/not-started" is the same
   blocked cell.** What IS proven: a call whose **ask was still pending** at close is closed
   `REFUSED`/`not-started` (ADM-61), because the enforced decision there is a deny. An `allow`-admitted
   call that has not reached the guard when the close lands is **allowed to finish** so that its record
   settles (ADM-60's path); refusing it at the guard would hit the store's `REFUSED`-against-`allow`
   wall and leave the record `ADMITTED` → recovery `UNKNOWN`, which the round's requirement forbids.
   The two lawful alternatives are (a) option A of the open settlement-recheck escalation, or (b) a new
   terminal state for "admitted, never dispatched, authority closed" — an owner decision.
3. **No host boot / no real Stop keypress.** The arms are in-process: the host double runs the real
   waterfall order (all pre-execute listeners → guard → body → result), and the ledger, the settlement
   store and the ControlService are the product's own implementations, but a Stop delivered by a live
   run (the run-level abort controller reaching `exec.signal`) was not booted. The fs-slice world is the
   evidence that the host populates that field; this round did not boot it.
4. **The racing-decision window is coded, not deterministically exercised.** If a durable decision
   lands before the abort cascade looks, the cascade resolves with it (the service's own S6 pin) and the
   centre refuses it at `admission-port.mjs:639`; the arms abort before the wait begins (no sleeps, no
   timers), so the branch is proven by code path and by ADM-57's post-decision refusal, not by a race.
5. **A stop on a REPLAY is still `ADMISSION_REPLAY`.** A callId that already carries an authority record
   is not adjudicated again, so the stop code does not displace the replay refusal. The ordering is
   stated; "Stop beats a replay" is not claimed.
6. **Scope.** `close()` is a new method beside `dispose()`, and `dispose()` keeps its removal semantics
   (ADM-28 pins that no point answers after it) — the product's lifecycle path calls `close()` from
   `member-execution.mjs:181`. `E3`/`ESCALATION-realmless-admission.md`, the two contract-change
   requests and `ute-cut-closure`'s `distCounterpartsOf` are untouched; no row in
   `CAPABILITY-MATRIX-C.md` is upgraded.
