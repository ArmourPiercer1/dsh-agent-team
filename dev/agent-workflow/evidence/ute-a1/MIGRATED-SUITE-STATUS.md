# The 16 migrated capability suites — measured, not assumed

**CURRENT (round 71, judge semantics): 238/238, E3 GREEN, leg green.** The latest round is at the
end (§"Round 71 (judge semantics)"); the round-30/31 narrative below is kept as history and its
counts are that round's, not the current ones.

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

## Round 53 (B stage): the probe ladder over unmodified native tools

**What was missing, measured at HEAD `ea25654e8`.** B's contract is a LADDER, not a presence list, and
nothing executed one. `vnext-fs-slice.test.mjs` proved `read`/`write`/`edit` through the realm mount and
SLICE-33 wired the PTY face for a **negative** result only (`OWNER_NOT_LIVE`); no suite ran the six
rungs in order, and no suite asserted that the facts appear in that order or that every rung resolves
the HOST module's own body. `grep`, `web_fetch` and `run_code` had never been dispatched through the
centre at all.

**How the ladder is built** — `packages/runtime/test/vnext-b-probe-ladder.test.mjs` (added to the
`ute-vnext-a1` leg's `suites[]`, population declared once):

- the PINNED host's own modules (`@deepseek-ai/dsh-tool-fs`, `-fs-search`, `-web`,
  `-bash-persistent`) mounted through the existing realm lane (`hostNativeSpecs` + `mountHostModules`);
  no fixture tool, no Team-authored body, no renamed definition;
- the product's ONE composition point, `installMemberCentre`, over a durable `openFactLedger` (read back
  FROM THE FILE in every assertion) and the product `ExecutionSettlementStore`; the admission point is
  never installed by hand and no definition is wrapped;
- TWO worlds that differ in exactly ONE thing — the compiled answer: the in-lane ceiling allows the
  network and the workspace, the out-of-lane ceiling denies the network and its probes target outside
  the fs lane. Every physical face (fs, confined subprocess, confined web, governed PTY, host sandbox)
  exists and works in BOTH worlds, so a negative refusal is the CENTRE's decision and not a provider
  that was never there;
- `web_fetch` is served by a loopback fixture declared as the composition's one `testEndpoints` origin;
  its negative uses **the same URL** under a denied network axis, so the refusal cannot be blamed on
  the destination.

### The ladder, per tool

| # | tool | positive control | negative control |
| --- | --- | --- | --- |
| 1 | `read` | **PROVEN** (ADM-64): admitted, `alpha beta` arrives, the instrumented member provider's read counters move, fact `allow`/`fs.read`, execution `completed`, settlement `COMPLETED` (`quiesced`/`completed`) | **PROVEN** (ADM-71): out-of-lane path ⇒ `LANE_DENY` before the body, zero provider calls (counters byte-identical), the secret never appears, execution `admission-refusal`, settlement `REFUSED`/`not-started`/`none-confirmed` |
| 2 | `write` | **PROVEN** (ADM-65): admitted, bytes land on disk, `writeText ≥ 1`, fact `allow`/`fs.write`, settlement `COMPLETED` | **PROVEN** (ADM-72): out-of-lane path ⇒ `LANE_DENY`, the file is NOT created, zero provider calls, settlement `REFUSED`/`not-started` |
| 3 | `grep` | **PROVEN** (ADM-66): admitted, `Found 1 match`, the confined subprocess face is actually used, fact names the judged locator, settlement `COMPLETED` | **PROVEN** (ADM-73): out-of-lane path ⇒ `LANE_DENY`, **zero confined-subprocess spawns**, the secret never appears, settlement `REFUSED`/`not-started` |
| 4 | `web_fetch` | **PROVEN** (ADM-67): admitted, the loopback fixture body arrives (`HTTP 200`), exactly ONE transport call, fact `allow`/`net.fetch`, settlement `COMPLETED` | **PROVEN** (ADM-74): denied network axis ⇒ `NETWORK_DENY` before the body, **zero transport calls**, no body bytes, settlement `REFUSED`/`not-started` |
| 5 | persistent `bash` | **BLOCKED — NOT RUN, never a pass** (ADM-68, `t.skip` + a machine-readable line): the compiled answer carries no process lane, so the centre can only answer `ADMISSION_AXIS_UNSUPPORTED`. Reason: the v4 member ceiling's frozen `io` field set is `{read, write, network}` (`blueprint-v4.ts`) and `bindingFromCompiledMember` projects only what the compiler produced — `CONTRACT-CHANGE-REQUEST-process-lane.md`, which names B's rung-6 positive control as blocked. Minting a lane in the test, or deriving one from the write lane, would be the SECOND decision authority this cut refuses | **PROVEN** (ADM-75): refused with `ADMISSION_AXIS_UNSUPPORTED` (the reason names the missing subprocess lane), zero subprocess spawns, **zero sandbox `confine` calls**, execution `admission-refusal`, settlement `REFUSED`/`not-started` |
| 6 | `run_code` | **BLOCKED — NOT RUN, never a pass** (ADM-69, same compiled process lane; `run_code` is `process.exec` and shares it). The transport itself IS present: the member resolves the registry's reserved `run_code` object | **PROVEN** (ADM-76): `ADMISSION_AXIS_UNSUPPORTED`, zero subprocess spawns, zero sandbox `confine` calls, settlement `REFUSED`/`not-started` |

**ENV_BLOCK: none.** No probe was environment-blocked on this host. The two blocked rungs are blocked by
the product CONTRACT (a missing declaration source), not by a missing capability, and they are reported
as such in the suite's own stdout (`VNEXT-B-LADDER-BLOCKED rung=5|6 … verdict=NOT_RUN`) and in the
`t.skip` reason. The leg already requires the pinned host (`A5SF_REQUIRE_PINNED_HOST=1`, absence = red)
and a Landlock-capable `python3` (that is `vnext-os-probe`'s existing precondition, which `grep`'s
positive rides); `web_fetch` needs nothing but a loopback bind.

### ORDER and IDENTITY, not presence

- **ORDER (ADM-70/ADM-77).** The durable facts are re-read from the JSONL file and must appear in ladder
  order — `[read, write, grep, web_fetch]` for the allow facts (rungs 5–6 disclosed above) and
  `[read, write, grep, web_fetch, bash, run_code]` for the refusal facts, with the refusal CODES in the
  ladder's own order. One execution fact per rung, and every negative execution fact is
  `admission-refusal`.
- **IDENTITY (ADM-63).** `read`/`write`/`grep`/`web_fetch`: the realm mount CHANGES the definition the
  member resolves, while `execute`'s source is byte-identical to the standing preset's (a Team wrapper
  would differ). `bash`: the preset scope has no `terminals`, so the host module registers nothing there
  by its own contract; the reference is the same host module applied to a collector carrying the
  member's OWN governed terminals face, and the member's `execute` source equals it. `run_code` is NOT a
  mountable module — it is the host registry's reserved transport, and the member resolves **the same
  object** the standing scope resolves (no per-scope copy, no shadow).
- **NO SECOND POLICY (ADM-78).** The binding is exactly `bindingFromCompiledMember(realm's own compiled
  answer)`; its absent axes stay absent (`process === undefined` in both worlds) and its fs/network lanes
  are the compiled lanes **by value**. A future process-lane change flips ADM-68/ADM-69/ADM-78 loudly
  instead of leaving a stale waiver behind.

### Gates (this round, on this worktree)

```
node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1        → 140 pass / 0 fail / 2 skipped (7 suites, set sha256:edd4f1c4…)
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7 → tests=889 findings=0 uncollected=41 excluded=14 (node=146, vitest=736)
node scripts/ute-cut-closure.mjs --check                         → pass deleted=148 references=163 prodRefs=0 findings=0
node scripts/ute-p0-assets.mjs --check                           → pass modules=37 files=180 cut=cut(148/148) findings=0
node scripts/docs-sync.mjs --check                               → findings=0 blocking=0
node scripts/place-dist-glue.mjs                                 → done (27 placements, byte-identical)
node scripts/eb3-ci-required.mjs                                 → pass workflows=10 findings=0
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
                                                                 → verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
```

The vitest population is unchanged at 238; the leg's node population went 126 → 140 (14 new arms, 2 of
them the disclosed skips). No existing assertion was weakened, skipped, retimed or deleted, and no sleep
or retry was added.

### What is NOT proven

1. **Rungs 5 and 6 have no POSITIVE control**, by contract rather than by environment
   (`CONTRACT-CHANGE-REQUEST-process-lane.md`, open). Until a process lane has ONE declaration source
   and the compiler emits it, "the centre admits a shell and the shell runs" is UNPROVEN. What IS proven
   is the refusal half plus the mount/identity half: the host module is mounted, the member resolves the
   host body, and the centre refuses the call for the missing lane — before any provider is touched.
2. **No live host boot.** The world is in-process: the host's real tool modules, real providers, the
   real waterfall order, the real ledger and settlement store, and a real detached `Session` for the
   `run_code`/projection services. The `agents` registry is a single-entry live-registry double (the
   pattern the pinned suite uses (`a5sf-native-bash-preservation`)); it exists so the PTY face's
   `OWNER_NOT_LIVE` rule has a live owner, and it is a registry entry, not a tool body.
3. **`run_code`'s reserved name is proven by object identity, not by a registration refusal.** The
   member resolving the registry's own transport object is the strongest available statement; "a Team
   module cannot shadow the name" is the registry's rule and was not re-driven here.
4. **`grep`'s positive runs a real confined subprocess** (the product provider + the Landlock
   pre-launcher), so on a host without `python3`/Landlock the positive would fail rather than refuse.
   That precondition is the leg's existing one (`vnext-os-probe`), not a new one, but it is a
   precondition: on such a host this arm is RED, not ENV_BLOCK.
5. **No mutation run this round.** The negative controls are falsifiable by construction (the centre's
   decision is read from the durable fact and the providers are counted), but the previous rounds'
   mutation sweep was not repeated for this file.
6. **Scope.** One test file plus one manifest line; no product source changed, `E3` and the open
   escalations are untouched, and **no row in `CAPABILITY-MATRIX-C.md` is upgraded** (`C-subprocess` /
   `C-ptc` stay `positive control UNPROVEN`).

## Round 54 (B stage): the durable half — crash/cold recovery, UNKNOWN, and no replay

**What was missing, measured at HEAD `cf2a44180`.** Rounds 51-53 proved the decision path, the Stop /
lifecycle close and the probe ladder, all **in one process**. Three claims were still only "coded":

- **crash recovery** existed as `settlementStore.recoverUnsettled(...)` in
  `member-execution.mjs:181-186` and as ADM-23, but ADM-23 recovered with the SAME store object that
  wrote the open record. No test ever let a writer die and asked a different process what was on disk.
- **no replay** existed as `isReplay: (callId) => ledger.has(callId)` (`member-execution.mjs:171`) and
  as ADM-20/ADM-38, but both replay arms shared the writer's process. A memo map and a fresh ledger
  read are indistinguishable if the same process owns both.
- **cold recovery of an open settlement** had no arm at all beyond ADM-23's in-process call, and no
  arm asserted that recovery preserves the PHASE the dead process reached.

**How it is proved now** — `packages/runtime/test/vnext-admission.test.mjs` ADM-79 … ADM-84 (node:test,
rides the `ute-vnext-a1` leg; the vitest population is untouched at 238).

- **The crash is a CHILD PROCESS.** `DURABLE_CHILD` (a `String.raw` script passed to
  `node --input-type=module -e`) resolves the SAME product modules and hooks, builds ONE member on the
  PRODUCT composition (`installMemberCentre` over a real `openFactLedger` + real
  `ExecutionSettlementStore`), writes, prints one JSON line with `writeSync` and calls
  `process.exit()` **without running a disposer**. The parent then opens fresh objects over the same
  directory. Nothing is a map that a test clears, and the writer lock on disk keeps naming the DEAD
  pid until the fresh store reclaims it (asserted: `lock.pid === crash.pid`, then
  `lock.pid === process.pid`).
- **Every assertion is a read-back from disk** by a fresh ledger instance / a fresh store / a fresh
  centre — including the settlement record's raw file bytes (`settlementRecordPath`) for the
  idempotence controls.
- **No sleep, no timer, no retry, no raised timeout.** The child's exit status is part of the
  assertion.

### Per-claim status

| # | claim | positive control | negative control(s) | NOT proven |
| --- | --- | --- | --- | --- |
| 1 | **Crash recovery**: a process that dies between the admission fact and the execution fact is recoverable from disk by a NEW process; the record is **UNKNOWN**, never silently `COMPLETED`, never dropped, never re-executed (ADM-79) | the child admits `crash-open-1` (`allow`) and dies (exit 7) with the record `ADMITTED`, the admission fact written and **zero** execution facts; a fresh store reclaims the dead lock, `settlement-port.recover()` returns exactly that record `ADMITTED → UNKNOWN` with `PROCESS_TERMINATED_WITHOUT_OUTCOME`, the missing-evidence list names `dispatch-confirmation`, `dispatch` stays `not-started`, `bodyOutcome`/`effectEvidence` are `unknown`, `stops` is `[]`, transitions are exactly `['ADMITTED','UNKNOWN']`; the fresh ledger still answers `observe('crash-open-1') = KNOWN / allow` (not dropped); a second `recover()` finds nothing and both record files are **byte-identical**; the fresh centre refuses the same callId `ADMISSION_REPLAY` (body count 0, record still `UNKNOWN`, one authority fact, zero execution facts, exactly one replay-refusal fact) | **the same child also completes `crash-done-1` before dying**: after recovery its `COMPLETED` record is *not* in the recovered set and is byte-identical (recovery is not a blanket rewrite); **a new callId in the same recovered world** is admitted and settles `COMPLETED` (the refusal is the callId's, not a broken world); mutation M1 (drop `settlement-port.recover`'s reconciliation) and M1b (`observe` never answers) each turn ADM-79 red | a teardown-free crash is `process.exit`, not SIGKILL mid-`appendFileSync`; a torn write is proved at the READ side (hand-written truncated tail, ADM-82), not by interrupting a real append. The `bootId`-changes path of the lock reclaim (a reboot with a reused pid) is code, not exercised. `member-execution`'s own bind-time call site is not booted here: the arm drives the SAME store call through the centre's writer |
| 2a | **No replay, cross-process** (ADM-80) | a first child completes `replay-1`; a SECOND child (different pid, no settlement store) reads the same file and refuses `replay-1` at pre-execute with `ADMISSION_REPLAY`, before the body (no body count), recording exactly one `replay-refusal` fact; a fresh ledger in the parent reads back exactly ONE authority fact and ONE execution fact for `replay-1`; a fresh ledger instance refuses `recordAdmission('replay-1')` with `LEDGER_REPLAY` and appends **nothing** (file bytes unchanged) | a NEW callId in the same second child is admitted and completes (the refusal is per-callId); the second child reports **no fault** (a replay is a decision, not a fault); mutation M2 (durable replay treated as a fresh call) turns ADM-80 red | the host's own `tools/result` for a refused replay is not driven: a real host that emitted a result after a pre-execute deny would hit `LEDGER_DUPLICATE_EXECUTION` on the second execution fact — that refusal is measured at the ledger (ADM-81) but not end to end through a host |
| 2b | **Duplicate execution fact on disk** is a refusal, never two answers (ADM-81) | a ledger file with two `execution` facts for one callId: a fresh ledger reports `health() = UNKNOWN / LEDGER_DUPLICATE_EXECUTION`, `readAll()` and even `has()` throw that code | **through the centre** the call is `deny` with `ADMISSION_LEDGER_UNREADABLE` (phase `replay-check`, both stages agree), **one** reported fault, **no** settlement record invented; **negative control**: the same file with ONE execution fact is `KNOWN`, and the centre admits a NEW callId which completes | a real crash that produced the duplicate (two writers) is not re-driven: the duplicate is written as data on disk, which is the state the ledger must refuse |
| 2c | **A truncated / garbage line** is a refusal, never "no opinion" (ADM-82) | three on-disk corruptions (partial JSON tail, non-JSON line, valid JSON with no `callId`): fresh `health()` is `UNKNOWN` with `LEDGER_TRUNCATED` / `LEDGER_RECORD_INVALID`, a write is refused with the same code (no second history), and the centre refuses the call `ADMISSION_LEDGER_UNREADABLE` (never `ask`), both stages agreeing, one fault reported, zero settlement records | the same wiring over a COMPLETE ledger is `KNOWN` and the centre admits and completes the same call shape | the tail is hand-written, not the product of a real interrupted append (see claim 1) |
| 2d | **An unwritable ledger** is a refusal (ADM-83) | a `chmod 0555` directory: the centre refuses `ADMISSION_LEDGER_UNWRITABLE` (phase `record`), both stages agree, one fault reported, **zero** settlement records, and nothing was created in the directory | **precondition asserted**: the test first proves *this* process cannot write there (a root runner is RED, not a silent pass); the same wiring in a writable directory records the fact and completes the call | a full disk / read-only filesystem is not exercised; `EACCES` on one directory is the instance |
| 3 | **Cold recovery of an OPEN settlement is a classification, not an invention** (ADM-84) | one child leaves three records: `cold-refused-1` (`REFUSED` at birth, closed before the crash), `cold-admitted-1` (`ADMITTED`, crash before the body), `cold-running-1` (`RUNNING`, body started). A fresh store + the centre's `recover()` reconciles **exactly the two open ones**, both to `UNKNOWN`, preserving the phase each reached (`dispatch` `not-started` vs `started`) and deriving DIFFERENT missing-evidence sets (`dispatch-confirmation` only for the ADMITTED one; `host-result` only for the RUNNING one); `stops` is `[]`, `bodyOutcome`/`effectEvidence` are `unknown` | **the refusal the dead process already decided is NOT re-classified** (`REFUSED` stays `REFUSED`, not in the recovered set); **no invented terminal**: a later `completed` settle on the `UNKNOWN` record is `SETTLEMENT_CONFLICT`, and the record file is byte-identical; a THIRD fresh store recovers nothing and rewrites nothing; mutations M1 and M6 (admission enters `RUNNING`, so the crash phase is misread) turn ADM-84 red | the "closable" half is proved as CLASSIFICATION (`UNKNOWN` is terminal and cannot be promoted). Closing an `allow`-admitted record as `REFUSED`/`CANCELLED` after the crash is **the open settlement CCR's blocked cell** (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`), and this slice deliberately does not need it: a replayed callId is refused *before* any settlement decision, so the record is left to recovery as `UNKNOWN` — which is option D of that CCR, not a workaround around it. **No contract change was requested or made.** |

### Mutation evidence (each claim can actually fail; every edit reverted and `git diff --quiet` verified)

| mutation | went red |
| --- | --- |
| M1 `settlement-port.mjs`: `recover()` returns `[]` (no cold reconciliation) | ADM-79, ADM-84 |
| M1b `fact-ledger.mjs`: `observe()` never answers (a recovered call reads as dropped) | ADM-79 |
| M2 `admission-port.mjs`: the durable replay refusal removed | ADM-80 |
| M3 `fact-ledger.mjs`: a duplicate execution fact on disk accepted | ADM-81 |
| M4 `admission-port.mjs`: an unreadable ledger read as "no replay" (i.e. no opinion) | ADM-82 |
| M5 `admission-port.mjs`: a ledger WRITE fault escapes instead of refusing | ADM-83 |
| M6 `admission-port.mjs`: admission enters `RUNNING` (the crash phase is misread) | ADM-84 |

The fabricated-`COMPLETED` direction (mutating the store's `RECOVERY_*` constants) is **not** repeated
here: it belongs to the frozen settlement contract's own mutation control, and the contract was not
edited in this round.

### Gates (this round, on this worktree, pasted)

```
node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
  → 146 pass / 0 fail / 2 skipped (7 suites), exit=0
    DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c4…
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  → tests=889 findings=0 uncollected=41 excluded=14 (node=146, vitest=736)
node scripts/ute-cut-closure.mjs --check
  → pass deleted=148 references=163 prodRefs=0 distResiduals=0 findings=0
node scripts/ute-p0-assets.mjs --check
  → pass modules=37 files=180 cut=cut(148/148) findings=0
node scripts/docs-sync.mjs --check
  → findings=0 blocking=0 contracts=20 pairs compared
node scripts/place-dist-glue.mjs
  → done (27 placements, byte-identical)
node scripts/eb3-ci-required.mjs
  → pass workflows=10 findings=0
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
  → verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
```

The leg's node population went 140 → 146 (six new arms, **no new skips**); the vitest population is
unchanged at 238. No existing assertion was weakened, skipped, retimed or deleted, and no sleep, timer
or retry was added.

### What is NOT proven

1. **No live host boot.** The crash writer is the PRODUCT composition (`installMemberCentre`) over the
   product ledger and settlement store, and the fresh reader is the product's own `recover()` /
   `ADMISSION_REPLAY` path — but no host process was booted and no real `tools/result` for a refused
   replay was driven. `member-execution`'s bind-time recovery is the same store call, not separately
   booted.
2. **The crash point is chosen, not random.** `process.exit` lands exactly between the admission fact
   and the execution fact (and, in ADM-84, after the guard). A kill inside `appendFileSync` was not
   produced; ADM-82 covers the resulting artifact (a truncated tail) from the read side.
3. **One writer at a time.** The fresh process reads only after the writer is dead. The
   `SETTLEMENT_WRITER_CONFLICT` refusal against a LIVE foreign writer is the store's own rule and is
   not re-driven here.
4. **Same boot only.** The dead-lock reclaim is proved for a dead pid in the same `bootId`; the
   reboot/reused-pid path is code.
5. **`ADMISSION_LEDGER_UNWRITABLE` rides a real permission denial.** On a runner that can write into a
   `0555` directory (root), that arm is RED by its asserted precondition rather than silently green.
6. **The open settlement CCR is untouched.** The `REFUSED`-after-`allow` cell is never needed by this
   slice and is never written; no compatibility layer, no contract edit, no new terminal state. `E3`,
   `ESCALATION-realmless-admission.md` and `CONTRACT-CHANGE-REQUEST-process-lane.md` are untouched, and
   **no row in `CAPABILITY-MATRIX-C.md` is upgraded**.
7. **Scope.** One test file (`vnext-admission.test.mjs`, plus a default-preserving extension to its
   local `centreWorld` helper so a fresh world can adopt an on-disk ledger/store) and this document.
   No product source changed.

## Round 55 (C stage): the three rows that were neither wired nor named

**The state measured at HEAD `c01500e72`.** `CAPABILITY-MATRIX-C.md` carried three rows that were
neither wired nor explicitly unavailable: C-remote ("not wired to the centre; no arms"), C-alpha6
("preserved in the assembly; no centre interaction, no arms") and C-ptc ("the escalation row survives
the A0 boundary but its adjudication is not wired to the centre"). That is the one state the A1 law
must not leave behind, because «silently absent» reads as «working» in every log that does not mention
it. Each now ends **EXPLICITLY UNAVAILABLE (b)** — the shape the contract lawfully allows when no axis
exists — not by narration but by a code, a recorded fact, a settlement record and an arm.

### Why (b) for all three, and which axis is missing

`admit()` judges a call on axes the COMPILED member contract carries (`fs.*`, `net.*`, `process.exec`,
`team.control`, `host.service`). None of the three is reachable from it:

- **C-remote** — an S6 remote command is issued by an EXTERNAL caller authorized by the server-derived
  principal (`createServerPrincipalDerivation`), not by a member binding. There is no remote-command
  axis; admitting one would need a new axis (a contract change) or a second authority (the dispatcher
  deciding for itself). The governed row therefore does not build the command plane at all.
- **C-alpha6** — review routing decides WHO may review WHOM from the trusted review facts BEFORE any
  tool call. There is no locator and no lane; the old "requires centreStatePath" rule bought a durable
  store *outside* the centre, not centre adjudication.
- **C-ptc** — `run_code` executes on `process.exec`, and there is no process lane in the frozen v4
  ceiling at all (`CONTRACT-CHANGE-REQUEST-process-lane.md`, untouched). Even with one, the surviving
  escalation row (`createPtcEscalationRouter`) mints its own one-shot grants, i.e. a second execution
  authority. The tool is therefore refused before the body, which is what makes the escalation path
  unreachable for a governed member: an escalation is only asked for a call that reached execution.

### What is now in the product

- **`packages/runtime/src/plugin/vnext/host-surface-refusal.mjs`** (new) — the ONE closed table for the
  capabilities with no member I/O axis. Each entry carries its own code, its subject's EXISTING axis
  (`team.control` / `host.service` / `process.exec`) and the measured missing axis in words. An unknown
  capability throws; it cannot be "refused generically". `refuseHostSurfaceBefore(point, input)` is the
  product's decision helper (`undefined` point = the row never configured the centre = no-op), so the
  arms drive the SAME function `root.ts` calls instead of a copy of the rule. It opens the ledger from
  `ledgerPath` itself so the typed caller does not import an untyped `.mjs`; the declaration half is
  `host-surface-refusal.d.mts`, and `scripts/dist-placements/240-ute-vnext-centre.json` ships the
  `.mjs` in the dist mirror (tsc never emits `.mjs`; omitting it would make a governed row unloadable
  at boot while every source test stayed green — the GLUE-6 RED-A class).
- **`admission.ts:318`** — `run_code` is refused with `ADMISSION_PTC_UNAVAILABLE`, distinct from the
  `ADMISSION_AXIS_UNSUPPORTED` a plain `bash`/`pwsh` carries. The code is on the `AdmissionRefusalCode`
  union and comes from the closed table (one string, two call sites).
- **`centre-config.ts:67`** — `alpha6ReviewRouting: true` is refused with `ADMISSION_ALPHA6_UNAVAILABLE`
  (the pure rule ADM-34 already exercises); **`root.ts:2500`** records the same refusal on
  `host.service` and throws a typed boot refusal for a caller that built the root directly.
- **`root.ts:4325`** — a centre-configured row does not build the S6 surfaces; the refusal is recorded
  and `root.remoteDispatcher` is absent. Rows that never configured the centre are byte-identical (the
  point is `undefined`, no file is touched).

### Per-capability evidence

| capability | code | axis recorded | arm | positive control | zero side effects |
| --- | --- | --- | --- | --- | --- |
| C-remote | `ADMISSION_REMOTE_UNAVAILABLE` | `team.control` | `ADM-86` (admission test) | the SAME helper with no point builds and dispatches (call count 1) | the dispatcher call count stays 1 after the refusal; fact + settlement `REFUSED`/`not-started` |
| C-alpha6 | `ADMISSION_ALPHA6_UNAVAILABLE` | `host.service` | `ADM-85`, `ADM-34` | no point ⇒ the wake runs (count 1) | wake count stays 1 after the refusal; config rule and recorded gate carry the same code |
| C-ptc | `ADMISSION_PTC_UNAVAILABLE` | `process.exec` | `ADM-87`, `ADM-88`, `ADM-76` | the same centre world admits an in-lane `read` and settles `COMPLETED` | body count does not move; `bash` still refuses `ADMISSION_AXIS_UNSUPPORTED`, so the two absences are distinguishable from the durable record alone |

`ADM-88` pins the table itself: exactly three capabilities, codes pairwise distinct, each reason
carrying its own missing axis, and an unknown capability throwing.

### What this round does NOT prove

1. **No host boot.** No row moved to PRODUCT-PROVEN; this worktree cannot boot the product (D owns the
   boot line). The root wiring is exercised by the 238 preserved vitest cases, not by a live host.
2. **The PTC escalation router itself is not driven.** No governed face is registered in the A1 cut, so
   the refusal proven is the TOOL admission that makes the escalation unreachable, not a router-side
   refusal. The router's own five negative controls stay where they are (`a5ptc-escalation-row`).
3. **A centre-configured row loses its remote API.** That is the honest consequence of (b), disclosed in
   the C-remote row rather than hidden. The two lawful alternatives are a remote-command axis in the
   contract, or principal-only execution declared outside the centre — neither is decided here.
4. **The Alpha.6 PA approval-fact join stays UNPROVEN (D).** Refusing the capability says nothing about
   the join the old row claimed; it stops the claim from being made without the centre.
5. **The open rulings are untouched** (`CONTRACT-CHANGE-REQUEST-process-lane.md`,
   `CONTRACT-CHANGE-REQUEST-settlement-recheck.md`, `ESCALATION-realmless-admission.md`). PTC's refusal
   names the process-lane gap but does not resolve it.

### Gates (round 55, pasted)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c4…  (150 pass + 2 disclosed skips)
DSH-TEST-CATALOG tests=889 instruments=3 refused=0 findings=0
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148) findings=0
docs:sync --check findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (28 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
```

Vitest population unchanged at **238** (no vitest file was added); the node leg gained `ADM-85`…`ADM-88`
and `ADM-76`'s rung-6 code moved to the PTC code (the B ladder's order and its «no body started»
assertions are unchanged).

## Round 56 (C stage) — C-tools / C-member / C-work end to end over the ONE centre

**What changed.** Three rows moved from "MECHANISM (unverified end to end)" to end-to-end in-process
over the PRODUCT's own tool surface: `ADM-89`…`ADM-95` were added to
`packages/runtime/test/vnext-admission.test.mjs` and ride the `ute-vnext-a1` leg (7 suites, now
157 pass + the 2 disclosed host skips). No new file, so the manifest leg, the workflow step and the
vitest population are unchanged (238).

**The missing seam was NOT missing.** The arm first asked whether the product installs/closes the
member's centre at the right moments. It does, on paths that already exist:

- the member centre is installed by `installMemberExecution` at the member bind
  (`agent-bindings.mjs:1852`) — the arm drives the same composition point from the child-session factory,
  which is where a created member's agent first exists;
- the lifecycle's `release-residency` step (`packages/runtime/lifecycle/quiesce.ts`, port
  `residency.dropResidency`) disposes the member handle (`agent-bindings.mjs:4122`), and that dispose runs
  the disposers `installMemberExecution` registered (`agent-bindings.mjs:1872`, `onDispose`) — one of
  which is the centre's `close()` (`admission-port.mjs:871`). So an ARCHIVE through the tool surface
  closes the member's centre; no new seam and no second authority was added.

**What each arm proves** (facts/settlements read back from DISK; real `TeamDomain` + real
`ControlService`; the product tool bodies):

| arm | claim | positive control | negative control(s) |
| --- | --- | --- | --- |
| `ADM-89` | all 15 closed tools are ADMITTED on `team.control` through `createTeamTools` over the real runtime, in declared order, each with an authority fact + execution fact + `COMPLETED` settlement, and each PRODUCT body reached | the created member is a real durable row; `team_create_member` really activates | — (the negative is `ADM-90`/`ADM-91`) |
| `ADM-90` | an UNBOUND agent is REFUSED for all 15 (`ADMISSION_NO_BINDING`), zero bodies, zero deliveries, zero creations, `REFUSED`/`not-started` settlements | restoring the SAME binding admits `team_list_members` (`COMPLETED`) | the refusal is the absent binding, not a broken assembly |
| `ADM-91` | a name outside the closed list (`team_delete_team`, `team_promote_member`, neither of which is a product tool) is refused by name (`ADMISSION_TOOL_UNBOUND`), recorded, `REFUSED`/`not-started` | the same centre admits `read` on `fs.read` | "not in the list" is not a blanket denial |
| `ADM-92` | `team_create_member` records the Leader's `team.control` allow fact; the created member's OWN centre exists (binding = member identity/session, empty ledger), and its calls are judged there — member ledger, member `policyGeneration` | the member's in-lane `read` is allowed and settles `COMPLETED` | the same locator is allowed by the Leader's centre and `LANE_DENY`ed by the member's — the judgement is that member's |
| `ADM-93` | `team_archive_member` (production step ports) commits `SETTLED → ARCHIVED`, releases residency, and the member's centre is CLOSED: the pre-close fact survives, the next call is `ADMISSION_MEMBER_CLOSED` with a `REFUSED`/`not-started` settlement (`ADMITTED → REFUSED`), never `UNKNOWN` | the same member call is ALLOWED before the archive, and the Leader's centre still admits afterwards | a second archive is not executed and commits nothing (commit count unchanged) |
| `ADM-94` | `team_delegate` → `team_collect` delivers one unit (prompt verbatim at the delivery seam, `settled: true`, terminal `succeeded` entry with the same result and a durable `settledSequence`); the collected work's own member calls are judged by THAT member's centre (its ledger/generation/lane) and never appear in the Leader's ledger | the Leader's centre allows the same locator | the member's `LANE_DENY` names the member's policy generation; the Leader's read fact is the Leader's own callId only |
| `ADM-95` | a refused delegation delivers NOTHING, admits no work unit, commits no lifecycle transition; the following `team_collect` is a zero-write read returning `unavailable` for that token | the binding is restored and the collect runs (`COMPLETED`) | `world.seam.writeCount` unchanged across the collect |

**Named host stand-ins** (each carries no policy): the agent-context double (host dispatch order
pre-execute → guard → body → `tools/result`), the member's "live handle" (its `dispose()` runs the
registered disposers), the child-session factory (member-bind moment), and the work-delivery port (the
host session-input seam). The compiled member answer is an INPUT (a ceiling), not a decision.

**What round 56 does NOT prove.** No host boot, so no row is PRODUCT-PROVEN. The archived member's
PRODUCT ROUTE refuses at the durable lifecycle gate before the centre is reached; `ADM-93` proves the
centre's tombstone on the member's layer, not the route's ordering. Policy compilation is not
exercised. The glue hops (`agent-bindings` installs the centre at every bind; the residency drop reaches
the same disposer list) are cited at file:line, not booted. The open escalations are untouched
(`ESCALATION-realmless-admission.md`, `CONTRACT-CHANGE-REQUEST-settlement-recheck.md`,
`CONTRACT-CHANGE-REQUEST-process-lane.md`).

### Gates (round 56, pasted)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494…  (157 pass + 2 disclosed skips)
DSH-TEST-CATALOG tests=889 instruments=3 refused=0 findings=0
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148) findings=0
docs:sync --check findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (28 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
```

Vitest population unchanged at **238**; the node leg gained `ADM-89`…`ADM-95` (7 arms), and the
`vnext-admission` suite now runs 79 cases in ~1.3 s.

## Round 57 (C stage) — C-mcp's MOUNT path and C-alpha6's reachable path

**C-mcp.** `ADM-96` mounts the product's own mini-MCP server (real HTTP) through the exact production
mount call (`mcpClient.apply` with the byte-same seven-field literal `reconcileMcpSet` passes), reads
the model-visible `mcp__p5t5mini__ping` off the surface, and the ONE centre admits it on `net.mcp`
with the SERVER as locator — fact read back from disk, settlement `ADMITTED → RUNNING → COMPLETED`,
and the real server answers `pong:mounted`. The mount target is the product's own
`configuredMcpServers` → `filterMcpServers`. `ADM-97` pins the negatives: a MOUNTED tool denied by
the compiled tool-level answer or the ceiling is `NETWORK_DENY` with zero body and a REFUSED
settlement (mounting is not permission), the sibling tool of the same server still runs, `mcp__` and
`mcp__<server>` are `ADMISSION_TOOL_UNBOUND` (no prefix matching), and an ungranted configured server
contributes no name to the surface. **New LIMIT:** the centre is not mount-aware (the binding is
installed at the bind, the mount target computed later), so a well-formed name for a never-mounted
server is decided on the network axis alone; `ADM-97` pins that current answer so it cannot change
silently. The product excludes such calls at the tool registry.

**C-alpha6.** The row stays `MECHANISM (explicit unavailability)`, with the measurement sharpened:
`ADM-99` shows the config rule refuses the opt-in on EVERY row (including one with no
`centreStatePath`), so no product-config path reaches Alpha.6; `ADM-98` shows the machinery is not the
missing piece — composed directly, the real wiring + router take a routing decision from a durable
control row and the real dispatcher persists an intent row that names exactly that reviewer, read back
from a fresh directory object. The missing seam is the CENTRE JOIN: no review-routing axis exists in
`admission.ts`, and a review-routing subject at the centre is `ADMISSION_TOOL_UNBOUND` recorded on the
fallback axis `fs.read`. The two lawful shapes (compiled review-routing axis via contract change; or a
ruling that a record-only `host.service` approval fact is adjudication + the PA join) are named in the
matrix; neither is wiring-only, and no review-routing policy was invented.

**New arms:** `ADM-96`, `ADM-97`, `ADM-98`, `ADM-99` (node:test, this leg). The shared
`centreWorld` double gained an optional `tools` input and the Cordis extras the upstream MCP client
reads; no existing arm changed its world.

### Gates (round 57, pasted)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494…  (161 pass + 2 disclosed skips)
DSH-TEST-CATALOG tests=889 instruments=3 refused=0 findings=0
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148) findings=0
docs:sync --check findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (28 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
```

Vitest population unchanged at **238**; the node leg gained `ADM-96`…`ADM-99` (4 arms), and the
`vnext-admission` suite now runs 83 cases in ~1.5 s. No host boot, so no row is PRODUCT-PROVEN. The
open escalations are untouched (`ESCALATION-realmless-admission.md`,
`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`, `CONTRACT-CHANGE-REQUEST-process-lane.md`).

## Round 59 (D stage) — the centre-configured host now BOOTS; team creation has no non-remote entrance

**Verdict: PARTIAL — the host half is LIVE on a centre-configured row, the Member half is BLOCKED at
team creation.** No Member turn ran; all five judges are unmeasured (fail-closed `FAIL`). Nothing here
is candidate evidence: every record is `recordClass: DEV-LIVE` and no `CAPABILITY-MATRIX-C.md` row is
upgraded to PRODUCT-PROVEN (that needs the reviewed acceptance report at D, which this run is not).

### What was run (exact)

```
# 1. provisioning: the stale committed dist (round 58's fourth blocker)
node /home/armourpiercer/projects/dsh-agent-team/node_modules/typescript/bin/tsc \
  -p packages/runtime/tsconfig.build.json                       # exit 0
node scripts/place-dist-glue.mjs                                 # exit 0, 28 placements, byte-identical

# 2. the acceptance arm: the driver UNMODIFIED as to composition, no env switch, two boots
env -u DBOOT_WITHOUT_CENTRE -u A5SF_WF_NO_INSTALL_GRAPH \
  node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2
```

`--plan` (host-free) was run first and passed: both blueprints parsed through the dist domain facade,
rows = `dsh-agent-team,preset-a5sf-governed-member,p6t6-team-tools`, **`composition drops: []`**, the
shipped governed preset carries 14 plugins including `tool-fs`.

**One driver defect had to be corrected before the acceptance could run at all** (disclosed, not a
weakening): the committed driver wrote its disclosure fields to `record.bindings`, but `createRunRecord()`
returns `{record, …}` — the object is `record.record.bindings`. First attempt died at
`run-boot.mjs:886` `TypeError: Cannot set properties of undefined (setting 'compositionDrops')`. Round 58
ran a pre-commit working copy (its archived run record has `bindings` WITHOUT `layout`/`installGraph`; the
committed file has the extra `runBindings` fields), which is why the divergence was not seen. The fix is
two receiver names (`record.bindings` → `record.record.bindings`); **no assertion, judge, timeout or
composition changed**. Everything else in the driver is byte-identical.

### What is now LIVE (the three fixed blockers, observed on a real host)

| Fact | Value |
| --- | --- |
| HEAD | `2e2d36543ab2d34bb6cbaac476cda39582765e50` |
| Host | `639ed015397290b3745d163aafe02ffee4aa3f84` (`0.2.0-rc.2`), porcelain empty before and after |
| World creation | succeeds with the install graph **provisioned** — `A5SF_PROFILE_GRAPH_UNRESOLVED` is gone |
| Composition drops | `[]` (the dead `tool-web` row is gone from the product, not dropped by the driver) |
| Host boot | `dsh web` on leased port 3187, mock on 3497, `p6t6 health=true` |
| Centre bootstrap | **no `TeamPluginError`**: a centre-configured row now boots; the fix's skip path is exercised |
| Remote mount | `[dsh-agent-team] remote mount: SKIPPED — the root refused the remote surface (C-remote: a centre-configured row has no remote-command axis); the refusal is on the durable record` |
| Leader surface | 43 model-visible tools, incl. the host's native `read` and all 15 `team_*` tools |
| Teardown | `portFree=true`, world home deleted, host pid killed by identity, `:3080` still `401` |

So blocker 4 (stale dist) is **provisioned and validated**: `host.js` imports, the host boots, and the
three fixes from `2e2d36543` hold on a real web host.

### The exact blocker (new, and deeper than provisioning)

```
[boot1] team.create status=405 ok=false null
FAILED at team-create: Error: team.create failed: status=405 body=null
  at bootOnce (.../tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs:991:26)
```

Cause, with file:line:

- the driver reaches a team through exactly one entrance: `remoteCall(...)` →
  `POST /team-remote/team.create` (`tests/world-factory/lib/u6-fs-assembly.mjs:505-510`);
- `/team-remote` is the S6 remote command plane. On a centre-configured row C-remote refuses that surface
  outright: `remoteRefused` is taken at `packages/runtime/src/plugin/vnext/root.ts:4324-4331`, so
  `createS6RemoteSurfaces()` is never called and `seams.remoteHandlerRegistration.install(...)` is skipped
  at `root.ts:4722-4730`;
- `host.ts:1631-1641` (the round-58 fix) now correctly records `skipped` instead of dereferencing the
  absent seam — which is why the boot succeeds — but no dispatcher is registered, so the HTTP channel has
  no route and `team.create` answers 405.

This is the already-disclosed product consequence of C-remote ("a centre-configured row has no remote
API"), now observed at the driver level: **a centre-configured row has no entrance that creates a Team
other than the boot-created one**, and the driver's acceptance team is created at runtime from a v4
blueprint written after the discovery turn. The A/B is unambiguous: round 58's *no-centre* arm got
`team.create status=200` on the same driver because there the remote plane exists — and that same arm
refused the Member for want of a centre.

### Judges (all five unmeasured)

| judge | verdict | why |
| --- | --- | --- |
| `d:member-read-admitted` | **FAIL** (fail-closed, never ran) | no Member exists |
| `d:member-read-denied` | **FAIL** (fail-closed, never ran) | no Member exists |
| `d:native-read-surface` | **FAIL** (fail-closed, never ran) | no Member surface was captured (the Leader's surface carries the native `read`, which is not the judge) |
| `d:guard-facts` | **FAIL** (fail-closed, never ran) | zero guard facts |
| `d:centre-facts` | **FAIL** (fail-closed, never ran) | no member ledger, no admission/execution facts |

The two-run agreement is `boots=1`, `agreeing=false` (the driver correctly refuses to call a single boot a
pair). Record: `dev/agent-workflow/evidence/d-boot-feasibility/runs/boot01/run-record.json`
(`overall=FAIL`, `partial=true`, `abortedAt=team-create`). Round 58's run artifacts are preserved under
`archive/2026-11-21T21-31-24-221Z/` (archive-before-start); the two attempts of this round are under
`archive/2026-11-21T21-32-33-226Z/` (the crash) and `runs/boot01` (the boot).

### Matrix rows that now have a LIVE line (none upgraded)

| row | what is live | what is still NOT proven |
| --- | --- | --- |
| **C-remote** | a centre-configured row BOOTS, the refusal is durable, and the mount is `skipped`; the remote API is measurably absent (`team.create` → 405) | — (this is the refusal itself; the row stays `MECHANISM (explicit unavailability)`) |
| **C-tools** | the boot Leader's model-visible surface carries all 15 `team_*` tools, at boot, on a centre row | no tool was called, so no admission fact, no `team.control` allow, no settlement |
| **C-fs** | the boot Leader's surface carries the host-native `read` (one definition, 43-tool surface) on a centre-configured boot | the Member-scoped `read`, its controlled Provider, the guard facts and the typed `IO_READ_DENIED` are all unmeasured |
| C-member / C-work / C-mcp / C-ptc / C-alpha6 | untouched this round | everything |

### What must be ruled before this acceptance can run (not implemented; each is a product decision)

1. **A centre-governed creation entrance.** Make Team creation (`team.create`/`handoff.create`) a
   centre-adjudicated command instead of part of the refused S6 plane. C-remote's own reasoning says a
   remote command has no axis the compiled ceiling can speak for, so this is a **contract change** (new
   axis or a ruling that creation is not a member-scope decision), not wiring.
2. **A non-remote product entrance.** Expose creation on a local product route/seam that the centre can
   adjudicate. This is a new product surface; it is not a small fix.
3. **A driver redesign** that uses the boot-created TeamSession (`root.ts:4888-4925` really does mint
   TeamSession + binding + Leader at boot) and binds the v4 `main.yaml` at boot instead of after the
   discovery turn. That changes the measured composition and loses the measured-deny-list step; it needs
   an owner ruling, and this round did not take it.

Options 1 and 2 would weaken C-remote unless a centre join is designed with them, so neither was a
"small, in-repo, non-weakening" fix; the run stopped here as instructed rather than working around the
invariant.

### Gates (round 59, pasted)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494…  (161 pass + 2 disclosed skips)
DSH-TEST-CATALOG tests=889 instruments=3 digest=sha256:3e409a68e913… refused=0 findings=0 (uncollected=41 ≤ 41, excluded=14 with reason)
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (28 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
```

Vitest population unchanged at **238**; the node leg is unchanged at 161 pass + 2 disclosed skips. This
round added no test arm: it is a boot/provisioning round. **No row is PRODUCT-PROVEN.**

## Round 61 (D stage) — shape A: governed members mount their preset's native modules by default

The round-60 finding (`FINDING-native-tool-provider.md`) was that a governed Member's native `read` ran on
the preset standing scope's BASE provider with zero guard consults. Round 61 implements **shape A** and
re-measures:

- `packages/runtime/src/plugin/vnext/realm-lane.mjs` — `mountGovernedNativeToolModules`: candidate modules
  derived from the preset's own rows (`compositionInventory`), each row's own `config` from the declared
  document (`readDocument`), ownership observed per module, faces the realm does not own skipped and
  recorded, typed refusals for unresolved/invalid/empty/conflicting/ambiguous/changed mounts, and the host's
  own module mounted through `mountHostModules` (definition identity; NO shadow).
- `packages/runtime/src/plugin/vnext/agent-bindings.mjs` — the governed default mount, applied AFTER
  `applyBuiltInToolDeny` (own-scope registrations sit outside `tools.restrict`), only when the row does not
  configure `a5sfNativeToolModules`, with its disposer registered.
- `packages/runtime/src/plugin/host.ts` — the lazy `agentPresets` accessor exposes `compositionInventory()`
  and `readDocument()` (public seam, same as the persona observer).
- `packages/runtime/test/vnext-admission.test.mjs` — `ADM-100`…`ADM-102`, in process on the real pinned host:
  (a) governed default mount, and the admitted read is served by the realm's confined provider (guard
  consulted, allow fact names the member; the out-of-lane call is refused by the PROVIDER lane with no secret
  bytes); (b) an ungoverned row mounts nothing and keeps the base provider; (c) an unresolvable preset
  module is a typed `GOVERNED_NATIVE_MODULE_UNRESOLVED` refusal, never a silent base-provider fallback.

### The live driver, UNMODIFIED, two boots

`d:guard-facts` went from REFUTED (0 facts) to **PROVEN** — 2 allow facts for the in-lane locator
(`stat`, `readText`), `memberIdentity=inst-0pe2z220bhfb`, `decidedBy=ALLOW` — and `d:member-read-admitted` /
`d:centre-facts` stay PASS. Two clauses remain REFUTED and are recorded as findings, not relaxed:

- `d:member-read-denied`: the out-of-lane call is refused by the CENTRE (`LANE_DENY`) before the tool body,
  so the provider's `IO_READ_DENIED` is unreachable on that path (0 deny facts). The provider-side typed
  refusal is proven in process by `ADM-100`.
- `d:native-read-surface`: its `native-description` clause reads the top-level description while the native
  marker lives in the `file_path` parameter description (instrument defect, unchanged since round 60).

Full judge-by-judge: `D-BOOT-FEASIBILITY.md` §13. `CAPABILITY-MATRIX-C.md` records the provider boundary as
DEV-LIVE only; no row is upgraded to PRODUCT-PROVEN.

### Gates (round 61, pasted)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494…  (164 pass + 2 disclosed skips; +3 ADM arms)
DSH-TEST-CATALOG tests=889 instruments=3 digest=sha256:3e409a68e913… refused=0 findings=0 (uncollected=41 ≤ 41, excluded=14 with reason)
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (28 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
```

The vitest population is unchanged at **238**; the node leg is **164 pass + 2 disclosed skips** (the three
new arms). `test-catalog` still reports 889 tests: the three arms live inside the existing
`vnext-admission.test.mjs` file, whose collected count is per file. **No row is PRODUCT-PROVEN.**

## Round 64 (D stage) — shape B of the search-face CCR: the overlay abstains, the lane admits an in-lane `grep`

The round-63 D3 run measured an in-lane `grep` refused by the durable overlay with
`laneDecision=allow`, `refusalCode=ADMISSION_OVERLAY_FAULT`, reason
`canonicalization failed for tool "grep": tool-unsupported`. Shape B of
`CONTRACT-CHANGE-REQUEST-search-face.md` is implemented with **no contract change**:

- `packages/runtime/src/plugin/vnext/overlay-decision.mjs` — the supplier classifies the tool by CLOSED
  VOCABULARY membership (`isPermissionToolName`) before canonicalization. A tool it cannot express is stored
  as `noOpinion` and never canonicalized; `decide()` returns `'no-opinion'`, so the overlay neither denies
  nor throws and the compiled lane alone judges the call. A tool INSIDE the vocabulary is canonicalized and
  faults exactly as before (a fault is still stored and still refused).
- `packages/runtime/src/plugin/vnext/admission-port.mjs` — `'no-opinion'` is an abstention, not a fault. The
  durable fact now carries the overlay's own answer as `overlayOutcome: 'deny' | 'no-opinion' | 'fault'`
  (`invocationFactsOf` in `admission.ts` declares it). A lane DENY never consults the overlay, so its fact
  carries no `overlayOutcome` — "the lane refused first" is distinguishable from "the overlay abstained".
- `packages/runtime/test/vnext-admission.test.mjs` — `ADM-103`…`ADM-106`, using the REAL
  `installMemberCentre`, the REAL `createOverlayDecisionProvider` and the REAL canonicalizer (the only double
  is the durable overlay PORT, the supplier's declared input boundary):
  (a) covered tool + matching stored deny still refuses (`ADMISSION_OVERLAY_DENY`, `overlayOutcome=deny`);
  (b) covered tool whose fs seam cannot canonicalize still refuses with `ADMISSION_OVERLAY_FAULT`
  (`overlayOutcome=fault`, reason names `resolver-threw`) — faults are NOT silenced generally;
  (c) in-lane `grep` is ADMITTED, `overlayOutcome=no-opinion`, and the fs seam is never consulted;
  (d) out-of-lane `grep` is `LANE_DENY` with no `overlayOutcome`, never an overlay fault.
- `tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs` — probe comments/record fields now name
  the admitted search probe (`bGrepFacts`/`bGrepResult`); the crash judge's in-flight call remains the
  `edit`. No other judge's assertions changed.

Live re-measure (`--boots 2`, after the implementation commit `6252e829e` and the driver instrument fix
`af51d7a5a`, so `driver-digest.json` binds the committed driver): two agreeing boots. B's in-lane `grep` is
admitted and completes —
`decision=allow`, `overlayOutcome=no-opinion`, execution fact `outcome=completed`, tool result
`Found 1 match … team-b/corpus/huge-7.txt`; the fact is byte-identical before/after the SIGKILL cold
restart. The four judges are unchanged: `persistent-subprocess` REFUTED, `crash-cold-recovery` / `work-
delivery` / `alpha6` PROVEN. Full detail: `D-BOOT-FEASIBILITY.md` §16.

### Gates (round 64, pasted)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975  (168 pass + 2 disclosed skips; +4 ADM arms, ADM-103…106)
DSH-TEST-CATALOG tests=889 instruments=3 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67 refused=0 findings=0 (uncollected=41 ≤ 41, excluded=14 with reason)
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (28 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

The vitest population is unchanged at **238**; the node leg is **168 pass + 2 disclosed skips** (the four
new arms). `test-catalog` still reports 889 tests: the arms live inside the existing
`vnext-admission.test.mjs` file, whose collected count is per file. **No row is PRODUCT-PROVEN; the search
face is lane-governed only.**

## Round 65 (D report) — the owner-facing D acceptance report, and the checklist source it found

Documentation-only round. `dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md` is now the single
reviewable document for the candidate: HEAD/scope facts, the C1–C18 checklist, the P1–P5 ladder and OS
negative controls, all eight required-CI lines, the host-modification-authority statement, the limits, and
a verdict that does not round up.

**The C1–C18 source is authoritative, not reconstructed.** It is
`docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md` §"The list (A1 must dispose of every row)"
(`:30-52`), and the report quotes its capability/disposition wording verbatim. One structural detail is
stated in the report rather than smoothed over: that table has 19 rows — C1…C18 **plus C14b**, the owner's
split of C14 into "drop the implementations" and "preserve the safety invariants" (`:26`, `:54-63`).

Three measurements this round worth keeping:

- the required-CI command for the migrated population has an `eb3-` prefix in the committed filename. As
  specified (`--list-file tests/checks/ute-migrated-suites.txt`) the token runner answers
  `verdict=REFUSED reason=suite list absent`; with `tests/checks/eb3-ute-migrated-suites.txt` it is
  `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0`. Both lines are pasted in the report,
  because a typo that graded green would be the defect.
- `place-dist-glue` now reports **28** placements (the HANDOFF's `26` and rounds 49-50's `27` are stale).
  This is not the frozen A0 "52 committed dist artifacts" measure; `CUT-BOUNDARY-ADDITIONS.md:27-32`
  explains why the two are not comparable.
- the pinned host was re-verified pristine at `639ed015397290b3745d163aafe02ffee4aa3f84`
  (`git -C tests/deepseek-harness-test-use status --porcelain` → 0 lines), equal to `TEST_USE_BASELINE_SHA`
  in `tests/paths.mjs`, so the CORE PATCH BUDGET = 0 statement in the report is measured, not asserted.

`PR-BODY-draft.md` gained a five-line pointer to the report (not a duplicate). No product code, no test,
no gate-definition change. The vitest population stays 238; the node leg stays 168 pass + 2 disclosed skips.

## Round 66 (C11) — state projections: the Team-owned projection gets its arm, and its host half stays named

C11 was the one checklist row with **no arm at all** (`D-ACCEPTANCE-REPORT.md` §2.2). The frozen row
(`docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md:44`) is capability "state projections
(`sessionProjections`)", where it lives "`projection/**` + `todo`/`goal` faces", disposition
**preserve**. Three node:test arms now ride the `ute-vnext-a1` leg (`ADM-107`…`ADM-109` in
`packages/runtime/test/vnext-admission.test.mjs`), built exactly the way the entry builds the
projection — `createTeamDomainReadPort(domain, readPortDeps)` → `createProjectionService(…,
<live overlay>, { clock, schemaVersion: 2 })` (`root.ts:4275-4279`) — over the REAL durable
`TeamDomain`.

- **`ADM-107` (positive).** The projection is the durable TeamDomain's own facts: identity core,
  every member row and the ledger summary checked field-by-field against the durable rows (including
  the leader's production `childSessionId === root` shape and the invariant-14 omission). A real
  `team_create_member` through the product tool surface is what the **next** reader sees through a
  FRESH port + service, and every durable value survives a **cold domain reopen**
  (`restartP6T1World`). The "before the fact exists" control lives in the same arm: the `scout`
  TEMPLATE is visible while no `scout` MEMBER is, so nothing is presaged.
- **`ADM-108` (negative).** A mutation **REFUSED at the ONE centre** (`ADMISSION_NO_BINDING` and
  `LANE_DENY`) leaves the projection **byte-identical** and the durable store untouched — no member
  row, no ledger entry, no generation move — with a same-world positive control proving the same tool
  DOES move both once the binding is restored. A refused call is a centre fact, never a TeamDomain
  fact, so it cannot appear in a reader's projection.
- **`ADM-109` (negative).** The live overlay is not a second authority: a live handle for a session
  with no durable member row invents no member, and dropping a real handle moves only `liveActivity`,
  never lifecycle / `createdAt` / generation / ledger. An absent TeamSession **fails closed**
  (`TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT`), never an invented empty team. A projection pass
  writes nothing (`seam.writeCount` unchanged).

**Falsifiability, measured not assumed:** stamping the projection v1 reds `ADM-107`; returning zero
template rows reds all three arms. Neither mutation was left in the tree.

**The other owner named by the row is NOT claimed.** The host's native `sessionProjections` service
(behind the `todo`/`goal` faces, `host.service`, `ADM-32`) is preserved **by construction**: neither
the retired entry (`live/agent-bindings.mjs`, `root.ts` at `1617d5839^`) nor the new one references it
(`grep -c sessionProjections` → 0 in all four), so the entry replacement cannot have un-wired it. The
Team-side uses are pass-through **reads** of the HOST service, never a registration of its own — the
PTY facade hands it to the pinned backend (`team-services/src/terminal-pty.ts:400`) and the P5-T5
real-instance harness restores the durable model selection with `stateOf(session, 'modelSelection')`
(`root-binding/harness/plugin.mjs:969-982`). Reading `stateOf` for a Member's todo/goal state is a
**host-boot** measurement and stays on the D list — no in-process arm can read the host's service.

One fixture fact is disclosed in the arm rather than hidden: `cStage` gained
`leaderChildSessionIsRoot`, which seeds the LEADER row with its child session equal to the ROOT — the
shape the production boot world writes and the durable read port normalizes. The P6-T2 seed's synthetic
leader child id is a shape production never writes, and the frozen DTO contract rightly rejects it
(invariant 14), so the projection arms ask the fixture for the production shape instead of teaching the
projection to tolerate a fake one.

### Gates (round 66, pasted)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
  (node:test file: tests 173 / pass 171 / fail 0 / skipped 2; +3 ADM arms, ADM-107…109)
DSH-TEST-CATALOG tests=889 instruments=3 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67 refused=0 findings=0 (uncollected=41 ≤ 41, excluded=14 with reason)
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (28 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

The vitest population is unchanged at **238**; the node leg is **171 pass + 2 disclosed skips** (the
three new arms). `test-catalog` is unchanged at 889 tests (the arms live inside the existing
`vnext-admission.test.mjs`, whose collected count is per file). **No row is PRODUCT-PROVEN; C11's host
`sessionProjections.stateOf` half remains unproven pending a live boot.**

## Round 67 (C14b + audit) — the invariants the implementation drop must not take, and a row-by-row audit of the C1–C18 table

C14 drops **implementations**; C14b preserves the safety invariants they enforced
(`docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md:26`, `:40`, `:54-63`; owner ruling
`dev/agent-workflow/SESSION_ROUTER_LOG.md:9810`). This round proves the second half and audits the
first.

### The dropped implementations (enumerated, not summarised)

The frozen text plus the retirement inventory (`03-RETIRE-KEEP.md:21-22`,
`01-ASSET-INVENTORY.md:14-21`) name eight governed-family bodies — `family-fs` (17 files),
`family-search` (9), `family-web` (10), `family-process` (11), `family-ui` (9), `family-inspect` (10),
`family-agent-control` (14), `family-agent-state` (7) — plus the retired pre-execution/dispatch
components (`pa-mount-registry`, `pa-control-bridge`, `pre-execute-adapter`, `native-tool-admission`,
`governance-center` + `tool-dispatch`, the five `confined-*` shadows, `family-assembly`, the
`team-tool-plane`). The full drop→owner table with `file:line` is `D-ACCEPTANCE-REPORT.md` §2.3.

### The preserved invariants and their arms

Six new node:test arms ride the `ute-vnext-a1` leg (`packages/runtime/test/vnext-admission.test.mjs`,
`ADM-110`…`ADM-115`). Each one (a) witnesses the C14 body is gone, (b) proves the invariant POSITIVELY
(the allowed case executes and settles) and NEGATIVELY (the violating case is refused with its own code
before the body, with a CLOSED settlement).

- **`ADM-110` — path read/write upper bounds.** In-lane `read` + `write` allowed and `COMPLETED`;
  out-of-lane both `LANE_DENY`, `REFUSED`/`not-started`, body never entered. Second layer, real
  filesystem: `evaluateLocatorAccess` allows an in-lane file and an in-lane symlink resolving inside,
  refuses an outside path (`PATH_NOT_ALLOWED`), a symlink resolving outside
  (`PATH_SYMLINK_ESCAPE`), and an authored `inside/../outside` path that AUTHORED containment admits
  but the RESOLVED path refuses — the division of labour the deleted body used to perform.
- **`ADM-111` — network allow/deny.** Explicit allow admits `net.fetch` and runs the body once; an
  unset axis and an explicit deny are `NETWORK_DENY` with zero body and `REFUSED`; a tool-level
  `unsupported` narrows a network-wide allow to a refusal.
- **`ADM-112` — Control authority.** An ask with no grant half is `ADMISSION_ASK_UNWIRED`; the REAL
  durable `ControlService` DENIES one ask (`ADMISSION_APPROVAL_DENIED`, zero body, zero spend) and
  ALLOWS the next (one request, one decision, one one-shot spend, body once). Two durable requests and
  the leader's own decision rows, not a second approval authority.
- **`ADM-113` — Stop.** Without a Stop the call `COMPLETED`; with the host's abort it is
  `ADMISSION_STOPPED`, `REFUSED`/`not-started`, transitions `ADMITTED → REFUSED`, one execution fact,
  and a FRESH settlement store over the same directory re-reads `REFUSED` with nothing open to recover
  as `UNKNOWN`.
- **`ADM-114` — process fail-closed.** The same binding still admits `fs.read` (so the refusal is not
  a blanket), while `bash` is `ADMISSION_AXIS_UNSUPPORTED` on `process.exec` before any body and
  `run_code` carries its own `ADMISSION_PTC_UNAVAILABLE`.
- **`ADM-115` — dropped-name discipline.** `skill`/`subagent`/`todo_write`/`get_goal` are admitted on
  `host.service`; `ask_user_question`/`present`/`exit_plan_mode`/`team_skill` have no preserved home
  and are `ADMISSION_TOOL_UNBOUND`, `REFUSED`, body never entered.

### The finding question, answered by measurement

The brief's failure mode is an invariant enforced only by a component that is itself gone. **None of
C14b's four invariants is in that state**: every one has a surviving owner on both layers (centre lane
+ provider face), named in §2.3 with `file:line`. The `confined-*` shadows were checked against the A0
tree rather than assumed: they were mounted by the realm row itself (`a5sf-realm-row.mjs`, A0,
`A5SF_CONFINED_FS_TOOL`), so a member with no realm never had them as its enforcement. The residual is
the **ungoverned row** (never set `centreStatePath`), which stays outside the centre by design; an
asked-but-realm-less row is refused `MEMBER_CENTRE_UNWIRED` (`centre-config.ts:36-49`, `ADM-44`). The
report states this as a limit, never as preserved enforcement.

### Audit of the C1–C18 table (D-ACCEPTANCE-REPORT §2) — mismatches found and corrected

- **C1:** the live "surface carries all 15" claim cited `ESCALATION-centre-row-creation-entrance.md:12`,
  which is the **405** line. Corrected to `:8-9`, where the 43-tool surface is recorded.
- **C5:** said `d2:stop` "resolved" the pending `admission-ask` request through `session/cancel`. A
  cancel is a **Stop, not an approval** — the live record shows `status=pending` and an
  `ADMISSION_STOPPED` fact, with no decision row. Corrected to "stopped", and the unproven
  approval/consume legs stay named.
- **C15:** cited `scripts/place-dist-glue.mjs`'s "placement list" for `a5sf-skill-provider`. The loader
  holds no list (placements are data files); the citation now names
  `scripts/dist-placements/190-a5sf-pd29-service-seam.json:5-6` and the realm mount at
  `a5sf-realm-row.mjs:989`.
- **§6.9:** said a member with `centreStatePath` but no realm "runs unmediated and unreported". The
  round-35 rule refuses exactly that member (`MEMBER_CENTRE_UNWIRED`, `ADM-44`); the section is
  corrected, and the same stale statement in `CAPABILITY-MATRIX-C.md`'s OPEN section is corrected with
  a dated banner.
- **§7:** "Four live judges are PROVEN" listed **nine**. Corrected to nine; no status changed.
- **No row was upgraded.** No row claims PROVEN where its artifact says REFUTED or vice versa: the
  three REFUTED judges stay REFUTED in §3.2/§7, and `C6/C9` stay REFUSED-BY-DESIGN.

### Gates (round 67, pasted)

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 179
ℹ pass 177
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
DSH-TEST-CATALOG tests=889 instruments=3 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67 refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

The vitest population stays **238**; the node leg is **177 pass + 2 disclosed skips** (the two `bash` /
`run_code` positives are still NOT RUN, never passes). **No row is PRODUCT-PROVEN**; C14b's arms are
in-process, the OS probe is a node-leg measurement, and a product-entry drive of each invariant is still
missing.

## Round 68 (Alpha.6 recorded refusal)

Shape A of the recorded escalation: C-alpha6 is EXPLICITLY UNAVAILABLE and stays that way, but its
**recorded-fact half was unreachable at the host entry** — the config gate (`centre-config.ts:67`)
ran at row validation (enforced by `host.ts`), before the root existed, so
`createHostSurfaceRefusalPoint` was never built and the typed refusal wrote no durable fact and no
settlement (round-63 live verdict: PROVEN as the typed-refusal shape, "no fact file").

### The change (one decision, one record)

- `packages/runtime/src/plugin/vnext/row-refusal-entry.ts` (new) — `createCentreHostSurfacePoint`
  (the ONE point construction, now shared by the entry and `root.ts`), `recordAlpha6RowRefusal`
  (records only when the rule's violation IS the Alpha.6 code and the row has a `centreStatePath`),
  and `createAlpha6RowRefusalHook` (the hook `host.ts` passes to the validator).
- `packages/runtime/src/plugin/host.ts` — `validateTeamPluginConfig(raw, hooks?)`: the unchanged
  `centreConfigViolation` decision runs first, then `hooks.onCentreRefusal` records it, then the
  unchanged typed `fail()` throws. `bootstrap()` passes `createAlpha6RowRefusalHook`.
- `packages/runtime/src/plugin/vnext/root.ts` — builds its refusal point through the same
  `createCentreHostSurfacePoint`, so the entry's record and the root gate's record name the same
  ledger/settlement files and identity scheme.

The refusal is NOT weakened: the rule and its throw are byte-identical, the gate still fires on every
row, Alpha.6 remains unreachable, and a row with no `centreStatePath` is still refused (unwritten —
there is no durable directory). No new axis/grant/policy, no retry, no widened timeout, no upstream
patch.

### Arms (ute-vnext-a1 node leg; `packages/runtime/test/vnext-admission.test.mjs`)

- **`ADM-116` (a)** — an Alpha.6-configured row is still refused (`ADMISSION_ALPHA6_UNAVAILABLE` +
  "no review-routing axis"), and the hook the entry wires records through the product point: the fact
  is read back from DISK (`decision=deny`, `refusalCode=ADMISSION_ALPHA6_UNAVAILABLE`,
  `axis=host.service`, `toolName=alpha6.review-routing`) and the settlement reads `REFUSED` with
  `dispatch`/`bodyOutcome` `not-started` and `ADMITTED → REFUSED` transitions. Source-shape pins: the
  validator hook call site and the shared constructor in `root.ts`.
- **`ADM-117` (b, positive control)** — the same valid row WITHOUT the Alpha.6 opt-in passes the
  centre rule, the entry hook is inert, no refusal fact/settlement is created, and the centre
  composition still admits an in-lane call to `COMPLETED` (it binds; nothing else changed).
- **`ADM-118` (c)** — a covered-face fault elsewhere is untouched: the shared constructor still
  records the `remote` refusal into `remote.host-surface.facts.jsonl` (and not the Alpha.6 file), and
  a non-Alpha.6 centre violation (invalid `centreStatePath`) is refused with its own message while
  the recorder writes nothing.

### Live measurement (driver probe adjusted; judge unchanged)

`node tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs --boots 2` — two boots, agreeing.
**Before:** `d3:alpha6` PROVEN, typed refusal, `no-silent-route` satisfied only because no fact file
existed (`recordedFactReachable=false`), round-63 evidence. **After:** `d3:alpha6` PROVEN both boots
with `refusalFactCount=1`, `nonRefusalFactCount=0`, `refusalSettlement.state=REFUSED`
(`not-started`/`not-started`, `ADMITTED → REFUSED`), the entry's "row refused at validation and
RECORDED" log line present, and the same typed refusal / no-team-row outcome
(`/__p6t6/state` 404, `liveMembers=0`, no decision, no wake intent). Probe change only: the probe now
reads the fact and raw settlement envelope from disk (`no-silent-route` is evaluated as "no
ROUTE-claiming fact"; the judge condition is untouched) and avoids opening a competing settlement
store while the host owns the writer lock. The other three judges are unchanged
(`persistent-subprocess` REFUTED, `crash-cold-recovery` PROVEN, `work-delivery` PROVEN; overall=FAIL,
`evidence-complete=true allProven=false`).

### Gates (round 68, pasted)

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 182
ℹ pass 180
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=889 instruments=3 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67
  DISCOVERED_AND_COLLECTED 834
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              41
DSH-TEST-CATALOG tests=889 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67 refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

The vitest population stays **238**; the node leg is **180 pass + 2 disclosed skips** (the three new
arms). **No row is PRODUCT-PROVEN; C-alpha6 remains REFUSED-BY-DESIGN and no routed path is proven.**

### Test-infrastructure note (disclosed)

This worktree's `tests/deepseek-harness-test-use` was a **symlink** to the main checkout's tree; the
host-sandbox preflight refuses a launcher whose realpath escapes the runtime tree
(`LAUNCHER_PATH_OUTSIDE_TREE`). It was replaced with a real, self-contained copy of the same
porcelain-empty tree at the pinned baseline (`639ed01539`), which is what TEST_METHODS §1 describes
per worktree. No tracked file and no shared baseline was written.

## Round 70 (consistency audit)

Adversarial read of the reviewable set at HEAD `189d6cabca5b4de9ec3059f9949ab9302364f789`: every count
in `PR-BODY-draft.md` and `D-ACCEPTANCE-REPORT.md` re-measured, every capability claim traced to the
path that says it, every citation resolved, and two reviewer aids added (the "what this candidate is"
paragraph in the PR body and the readiness checklist in the D report). Docs/evidence only — no gate,
no test, no product code was touched.

### Gates at this HEAD (fresh, round 70)

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 182
ℹ pass 180
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=889 instruments=3 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67
  DISCOVERED_AND_COLLECTED 834
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              41
DSH-TEST-CATALOG tests=889 refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000

$ node scripts/ute-a1-window.mjs --check
UTE-A1-WINDOW pass branch=vnext/a1-cut red=0/0 cut=(148/52) findings=0
```

`git rev-list --count a19d1df01..HEAD` = 144 at the measured commit `189d6cab`; `git diff --stat` = 1643
files, +107914 / −79603. This audit's docs-only commits sit on top (no code, no gate change).

### Mismatches found and fixed (numbers)

| document | was | is (fresh) |
| --- | --- | --- |
| PR body, verification table | `suites=6 files=6`, no test counts | `suites=7 files=7`, `tests=182 pass=180 fail=0 skipped=2` |
| PR body, verification table | `tests=888` | `tests=889` |
| PR body, verification table | `done (26 placement(s))` | `done (28 placement(s))` |
| PR body, A1 bullet | "146 legacy files and 52 dist artifacts retired" | 148 sources gone (146 deleted + 2 replaced) and 200 stale dist mirrors, 28 placements restored |
| PR body, B slice 1 / 2 / durable half | "119 pass", "126 pass", "146 pass" (unqualified) | marked "at that round", with 180 today |
| PR body, migrated-suite section | "Now 237/238" against the later 238/238 | that first run was 237/238; today 238/238 |
| PR body, limits | `agent-bindings.mjs` "4,499 lines" | 4,780 lines (`wc -l`), down from 5,301 at plan start |
| D report §1 | HEAD `ef2ddbff7`, 137 commits, 1568 files, +101557/−79598, 1125 A/75 M | HEAD `189d6cab`, 144 commits, 1643 files, +107914/−79603, 1199 A/76 M |
| CAPABILITY-MATRIX, round 56/57/64/67 rows | 157 / 161 / 168 / "tests 179 pass 177" | marked per-round; 182 tests / 180 pass at this HEAD |

### Claims corrected (stated more strongly, or more weakly, than the evidence)

- **"No approval binder is wired in the product, so every ask lane is a hard refusal."** False at this
  HEAD: the product installs the grant binder and the durable Control approval port when the row has a
  `controlServiceRef` (`agent-bindings.mjs:688-706`); rows without one still refuse
  `ADMISSION_ASK_UNWIRED`. The true limit is that no live *approval/consume* has been observed (the live
  ask only reaches its Stop terminal). Fixed in the PR body limits, D report C5 and matrix round-28 text.
- **"No arm here has booted a real host process"** (PR body, why-draft). Refuted by this branch's own
  D records (two agreeing `dsh web` boots per driver). Replaced with the accurate statement: the D boots
  are `DEV-LIVE` records, not gates, and no row is PRODUCT-PROVEN.
- **"No real host boot ... all step D"** (PR body limits). Same stale carry-over; replaced with the real
  limits (no gate-grade acceptance, no load, scripted mock, no live approval).
- **"Every capability row is MECHANISM or UNPROVEN"** (PR body). The matrix also carries
  REFUSED-BY-DESIGN/BLOCKED rows; the traceable claim is "no row is PRODUCT-PROVEN"
  (`CAPABILITY-MATRIX-C.md:71-74`).
- **"Two contract questions are escalated"** — there are three CCRs; the third (search face) already has
  shape B implemented. The PR body now says three, with the search-face state named.
- **Matrix `d3:alpha6` round-63 row** said "no fact file" and the round-63 NOT-PROVEN list included the
  recorded-fact path; round 68 recorded it at the host entry. Both now carry the round-68 correction;
  the verdict is unchanged (typed refusal, routed path still unproven).
- **`FINDING-native-tool-provider.md` and the matrix still said two judge clauses were REFUTED.** Round
  62 repaired `d:native-read-surface` (instrument re-anchored, PROVEN with all six clauses), so only
  `d:member-read-denied` remains REFUTED; the FINDING header, its round-61 table, its residuals and the
  matrix's round-60/61 bullets now record the repair and the reason it is kept as history.
- **Matrix round-28 "there is no approval binder wired at all"** — qualified as the round-28 state.

### Links/citations fixed

- `admission.ts:318` → `:326` for the PTC refusal (D C13/C16 area, §6.3, matrix C-ptc and round-55 table).
- `centre-config.ts:67` → `:73` and `root.ts:2500` → `:2496` in the PR body's round-55 table.
- `root.ts:4325` → `:4322` for the remote-surface refusal.
- `admission.ts:110-119` → `:114-122` for `HOST_CAPABILITY_TOOL_NAMES` (D C15/C16/C17).
- `a5sf-realm-row.mjs:989` → `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:989` (the file is not
  under `scripts/`).
- `agent-bindings.mjs:1852`/`:2049` → `:2006`/`:2241` for the bind/mount ordering (D §6.12, matrix C-mcp).
- `PR-BODY-draft.md:113,161` pointed at unrelated lines; replaced by the two section names (the §"B stage,
  second slice" and §"The durable half of B" mutation counts).
- All `.../d-boot-feasibility/...` ellipsis citations expanded to `dev/agent-workflow/evidence/...`; both
  documents now state that `path:line` citations are repo-root-relative.
- `MIGRATED-SUITE-STATUS.md` header said "CURRENT (round 49)" and pointed at a round-49 section while
  round 68 existed; it now points here.

### Could not substantiate (deleted or demoted, not softened)

- Nothing was deleted outright. One stale sentence was unsupportable at this HEAD and was **removed**
  rather than reworded: the PR-body limit "No approval binder is wired in the product…". Its replacement
  states the narrower, checkable fact.
- The PR body's rounds-30-32 statement "The leg is not bound to a Required layer yet" was true only at
  that round. It is now in `dev/ci/eb3-ci-manifest.json` (the migrated-suite leg in layer
  `ci-integration`; the node leg is `layers[4].legs[11]`), and the fresh `eb3-ci-required` run confirms
  `workflows=10 findings=0`. The text now says so instead of reading as a current gap.

## Round 71 (judge semantics) — two REFUTED judges were measuring the judge, not the product; both rewritten to the contract and PROVEN

Two live judges were REFUTED for reasons that were about the JUDGE. Both clauses were rewritten to be
strictly MORE specific (never weaker), and both now measure the contract at the layer where it decides.
**No product code and no test file changed for this round**; the node leg and the vitest population are
untouched.

### `d2:revocation` — the four directions, and the widening direction measured

The old REQUIRED clause demanded that removing a durable deny REFUSE the previously succeeded call with
a NEW compiled generation — i.e. that the overlay WIDEN authority, which the contract forbids
(`overlay-decision.mjs:9`, `admission-port.mjs:498-521`, `permission-mutation.ts:435-436`). Rewritten,
all four required:

- **(a)** a durable DENY lands (`changed:true`) → the previously admitted call is refused
  `ADMISSION_OVERLAY_DENY`, **zero body**, settlement `REFUSED`/`not-started`; the durable fact names
  the overlay as the deciding authority (`overlayOutcome=deny`, `laneDecision=allow`,
  `refusalCode=ADMISSION_OVERLAY_DENY`) and carries a `policyGeneration`;
- **(b)** removing that deny restores the call (admitted + `COMPLETED`/`quiesced`) as a **NEW fact** in
  the same `call-d2-b-` family (pre/mid/post facts distinct);
- **(c)** an untouched in-lane read is admitted with its bytes and settles `COMPLETED` at **every**
  phase — pre / deny / restore;
- **(d)** **widening is refused, MEASURED:** `team_grant_permission` asked for `effect:'allow'` on a
  locator outside the compiled lane answered
  `{"status":"permission-mutated", …, "changed":false, "reason":"mutation-proposal-pending"}` (a durable
  proposal, not minted authority); the widened locator then stayed `LANE_DENY` with zero foreign bytes.
  The judge accepts a typed refusal or a no-op and fails a `changed:true` expansion; the answer shape is
  recorded verbatim.

### `d:member-read-denied` — the deciding channel, at each channel's own layer

The old clause required the provider's `IO_READ_DENIED` on the live path; the centre decides BEFORE
execution, so an out-of-lane call is `LANE_DENY` and never reaches the provider. Rewritten, all
required: a typed refusal whose code names the channel (`LANE_DENY` or `IO_READ_DENIED`); **lane
channel** ⇒ result carries `LANE_DENY` AND **zero provider guard facts for that exact call id**;
**provider channel** ⇒ result carries `IO_READ_DENIED` AND that call's own guard `deny` fact
(`decidedBy=IO_READ_DENIED`); zero secret bytes and not-ENOENT on BOTH; plus a separate clause running
the provider channel in its own in-process population (`node --test --test-name-pattern ADM-100`, pass
AND the provider-deny assertion present), recorded at
`runs/boot0N/in-process-provider-channel.json`.

### Measured live (two agreeing boots each, HEAD `82dfda0c3`, host pin `639ed01539`)

```
$ node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2
overall                 PASS    PASS     (agreement agreeing=true differing=[])
admittedVerdict         PROVEN  PROVEN
deniedVerdict           PROVEN  PROVEN
surfaceVerdict          PROVEN  PROVEN
factsVerdict            PROVEN  PROVEN
centreVerdict           PROVEN  PROVEN
=> RESULT PASS (2/2 boots; agreeing pair=true)

$ node tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs --boots 2
overall                 PASS    PASS     (agreement agreeing=true differing=[])
multiMemberVerdict      PROVEN  PROVEN
revocationVerdict       PROVEN  PROVEN
stopVerdict             PROVEN  PROVEN
=> RESULT PASS (2/2 boots; agreeing pair=true)
```

`denyFacts=0` on the run-boot agreement is CORRECT and now required: the provider guard is never
consulted for the out-of-lane call (the centre refused first), which is exactly what the lane-channel
clause asserts. Both drivers remain `DEV-LIVE` records, not gates; `run-boot-d3.mjs` still records
`overall=FAIL` (the absent process lane).

### Gates at this HEAD (fresh, round 71)

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 182
ℹ pass 180
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=889 instruments=3 digest=sha256:3e409a68e913fbcb68f2ea73f1cb5068bc1690c6eabd4ddfcbd47ebf80694e67
  DISCOVERED_AND_COLLECTED 834
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              41
DSH-TEST-CATALOG tests=889 refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

**Population unchanged:** vitest **238/238** (`verdict=PASS`), node leg **180 pass / 0 fail / 2
disclosed skips**. Nothing here upgrades any capability row to PRODUCT-PROVEN, and nothing here claims
the overlay can widen or that the live path reaches the provider.

---

## Round 72 (hosted-CI repair) — 2026-11-22

**Why this round exists.** Rounds 70–71 were green *locally* because the local legs ran only a slice:
`dispatch-tests --run --leg ute-vnext-a1` (180 pass + 2 disclosed skips) and the migrated vitest
population (238). Hosted CI at `b5bbb0a9` ran the *other* legs and was RED in five jobs:

| hosted job | verdict at `b5bbb0a9` | what it actually said |
| --- | --- | --- |
| `ci-fast` | PASS | docs tooling only — never touched the code this cut changed |
| `ci-integration` | FAIL | `EB3-TRUSTED-SOURCES`: 5 MCP tool names the migrated tests exercise were not booked |
| `ci-product` | FAIL | `ReferenceError: skillSpec is not defined` (a REAL code bug, see §1) |
| `ci-security` | FAIL | 7 of 29 suites: the old `governance-center` U6 fitness files |
| `pr-gate` | FAIL | Typecheck, Blueprint Fence, Lint identities |
| `ci-required` | FAIL | aggregate of the above |

This round runs the SAME commands the workflows run, in the workflows' own order, and records each
one below with the before/after verdict. **Nothing was repaired by deleting an assertion**: every
suite that survives still asserts the same claim, and where a claim's *subject* was retired by the
UTE A0/A1 cut the disposition says so per file, in §4.

### 1. The `skillSpec` ReferenceError — a real bug, repaired at its source

* File: `packages/runtime/src/plugin/live/a5sf-realm-row.mjs`
* Line: `1206` (the computation), consuming `1199` (the module load) and the file's own helpers
  `a5sfSkillProviderSpecOf` (`1048`) and `hostPresentSpecOf` (`1104`).
* Before: `const appended = [skillSpec, presentSpec].filter(...)` used two names that were **never
  computed**. `cf2003019` had removed the two `const` lines while leaving the consumers; every test
  that reached this row died with `ReferenceError: skillSpec is not defined` (that is exactly why
  `ci-product` reddened: its L1 contract set reaches the row).
* After:

  ```js
  const configuredModules = await Promise.all(nativeSpecs.map(loadNativeModule))
  const skillSpec = a5sfSkillProviderSpecOf(realm, nativeSpecs, before, configuredModules, a5sfConfig?.skillCatalog)
  const presentSpec = hostPresentSpecOf(realm, nativeSpecs, before, configuredModules)
  ```

* **Why this shape** (and not a stub, a `?` chain, or a deleted branch): `a5sfSkillProviderSpecOf` is
  the PD-29 tool row — it must see (a) the realm, (b) the agent's native `toolModules` specs, (c) the
  **post-deny** surface (`before`; the row is assembled after the deny union, so a denied native module
  can never become a skill provider), (d) the already-imported modules (import once, mount twice) and
  (e) the row's declared `skillCatalog` from config. Those are precisely the parameters the helper is
  named for and the only inputs the file carries that can produce a real spec. `loadNativeModule` is
  the file's existing loader and validates that an entry evaluates to a Cordis plugin module, so the
  import cannot be dropped in silently. No new behaviour was invented; a deleted computation was
  restored from the helpers that were still there.

The same defect class was found in one more place and repaired the same way:
`packages/runtime/src/plugin/vnext/agent-bindings.mjs` called four helpers (`disarmStoppedGoal`,
`recursiveDrainUnavailable`, `memberBaseToolsUnavailable`, `rootBaseToolsUnavailable`) that `cf2003019`
had deleted — restored from their call sites' own documentation. Two unused imports
(`root.ts`, `realm-lane`, the admission port's `join`) were dropped, and `admission-port.mjs` now hands
`commit()` the **minted grant** it builds the entry from rather than the raw exec.

### 2. Every hosted-CI command, and its verdict before and after

Legend: **before** = the state the reviewer reported at `b5bbb0a9` / the state this worktree was in when
round 72 opened; **after** = measured on this branch after the round. Commands are quoted from the
workflow files (`.github/workflows/*.yml`), not paraphrased.

| # | job | command (from the workflow) | before | after |
| --- | --- | --- | --- | --- |
| 1 | `pr-gate` | `node scripts/ci-pr-gate.mjs --full --census-captures 2 --allow-refused census` (10 legs) | FAIL — typecheck 58 files, lint `new 14`, fence 2 new paths, census red | typecheck **pass**, lint **pass** (`new 0, resolved 13`), fence **pass** (no new path; baseline 20), artifacts-at-head **pass**, kit-home-guard/state-freshness/append-only-log/install/graph-parse **pass**, census **pass** (§5) |
| 2 | `ci-product` | `node scripts/contract-tiers.mjs --run --tier L1` | FAIL — `ReferenceError: skillSpec` | **PASS** — `contracts=6 files=8 exit=0`, 64 tests |
| 2b | `ci-product` | `pnpm run build` + `pnpm build:composition` | build FAIL (typecheck red) | **BUILD_EXIT=0**, `COMPOSITION_EXIT=0`, `place-dist-glue` 28 placements |
| 2c | `ci-product` | `node scripts/ci-pr-gate.mjs --full --only graph-parse,kit-home-guard,state-freshness,append-only-log,install,blueprint-fence,typecheck,lint-identities,artifacts-at-head` | FAIL (3 of 9) | **pass=9 fail=0** |
| 2d | `ci-product` | `node scripts/ci-pr-gate.mjs --check-transcript` | — | pass (no missing token) |
| 3 | `ci-integration` | `node scripts/eb3-trusted-sources.mjs` | FAIL — 5 unbooked MCP names | **pass** (27 tools booked; `dev/ci/eb3-trusted-tool-sources.json`) |
| 3b | `ci-integration` | `node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | FAIL (suite absent / retired rows) | **PASS 238** — `suites=15 files=15 describes=76 passed=238 failed=0` |
| 3c | `ci-integration` | `node scripts/eb3-ci-negative-controls.mjs` | FAIL (markers in deleted suites) | **pass** — the two migrated suites carry `'non-Team native read rides on, unchanged'` / `'non-Team native bash rides on, unchanged'` verbatim |
| 3d | `ci-integration` | `node scripts/eb3-tool-acceptance.mjs`, `node scripts/tinf-instruments.mjs`, `node scripts/contract-tiers.mjs --check` | — | **pass** — `contracts=6 met=6 excepted=0 unmet=0 findings=0` |
| 3e | `ci-integration` | `node --test tests/next-host/boot.test.mjs` | — | **environmental** — see §6 |
| 4 | `ci-security` | `node scripts/eb3-security-run.mjs --layer ci-security` | FAIL — 7 of 29 suites (U6 fitness, retired subject) | **PASS 216** — `suites=14 files=14 describes=61 passed=216 failed=0` |
| 5 | `ci-fast` | `node scripts/docs-probe.mjs --base $CI_BASE` | pass | **pass** — `blocking=0 non_blocking=0 advisories=2` |
| 5b | `ci-fast` | `node scripts/docs-sync.mjs --check` | FAIL — 2 dangling links to a deleted suite | **pass** — `docs=193 notes=4 plans=152 findings=0 blocking=0 contracts=20` |
| 5c | `ci-fast` | `node scripts/eb3-impact.mjs --base $CI_BASE` | pass | **pass** |
| 6 | `ci-required` | `node scripts/eb3-ci-required.mjs` | FAIL — `CI_SUITE_ABSENT layer ci-census` | **pass** — `workflows=10 findings=0` |

Local gates re-measured after every deletion in this round:

```
dispatch-tests --run --leg ute-vnext-a1   su=7 fi=7 exit=0   (180 pass + 2 disclosed skips)
test-catalog --max-uncollected 41 --max-excluded 7          tests=785 refused=0 findings=0
ute-cut-closure --check                                     pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
ute-p0-assets --check                                       pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148) findings=0
docs-sync --check                                           findings=0 blocking=0
place-dist-glue                                             done (28 placements)
eb3-ci-required                                             pass workflows=10 findings=0
check-artifacts-committed                                   verdict=ok compared=1935 glue=28
```

**Two seed figures changed and both are disclosed here:**

* `blueprint-fence` baseline `dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt`
  was **re-recorded openly** (dated header, 20 identities) because the cut moved two offending paths.
  The leg still fails only on `new > 0`.
* `scripts/integration-order.mjs` `BOUNDS` were raised `maxCandidates 6000 → 8000` and
  `maxRecords 400 → 600`, with the measurement recorded in the BOUNDS header (6832 tracked JSON under
  the evidence root, 461 mentioning `u5-run-record/1`, 440 parsing as records). The tree had simply
  outgrown a capacity budget that is meant to be raised — never trimmed.

### 3. The 5 MCP tool names — booked fixtures, not a security relaxation

`dev/ci/eb3-trusted-tool-sources.json` now books `mcp__github__search`, `mcp__github__search_code`,
`mcp__p5t5mini__alpha`, `mcp__p5t5mini__beta`, `mcp__ghost-srv__ping` (27 tools total) and drops five
rows whose servers no longer exist on this tree. These are **test fixtures** the migrated suites build
in-memory (`multi-mcp-wiring`, the p5t5mini MCP legs, the ghost-server harness): the list is an
allowlist of *names the product may surface*, so adding a name the tests construct is exactly the
booking it exists for. No tool gained a capability, no lane was widened, and the list is still a
closed set (`eb3-trusted-sources` fails on an unbooked name).

### 4. Per-file disposition of the retired `governance-center` U6 / fleet suites

Law applied: a suite whose **subject** was retired is deleted **with** its subject and recorded in the
cut-closure allow ledger's `retiredSubjects` (101 entries); a suite that tests a **preserved**
capability is migrated and keeps asserting. No blanket skip, no empty suite list, and
`packages/runtime/src/plugin/live/agent-bindings.mjs` was **not** re-created.

| file | disposition | proof of retirement |
| --- | --- | --- |
| 83 allow-listed `retired-module` suites (governance-centre U6 fitness, tool-dispatch, `*-family`, `a5p5-tools`, centre-shadow-row) | **deleted** (99-file `git rm` batch) | each booked in `ute-cut-closure.allow.json#retiredSubjects` as `retired-subject` |
| 15 `alpha.2` pre-execute-adapter suites | **deleted** | all import `packages/runtime/src/plugin/pre-execute-adapter.ts` (deleted by the cut) |
| `u6-arc-a-fitness.test.ts` + `tests/u6-arc-a-probe-family/` (dir) | **deleted** | imports `tests/u6-arc-a-probe-family/src/probe-assembly.mjs`, which imports the retired `families` plane |
| `alpha5-glob-backend-adversarial.test.ts`, `alpha5-g6b-rc-first.test.ts`, `u7-g6b-late-stream.test.ts` | **deleted** | drive the retired `tools/pre-execute` waterfall |
| `a6a-production-wiring`, `alpha2-explicit-agent-setup`, `rc2a1-fs-containment`, `a3p3-governance-lane-hygiene`, `u6-pr5-search-move-law`, `u7-f-agent-control-native-output-schema-c1` | **deleted** | local `drivePreExecute` helpers / `root.ts` / `search-family` / `agent-control-family` sources — all retired |
| `u6-pr2-review-r1.test.ts` (302→100 lines), `u6-pr3-bl01-ask-door.test.ts` (180→90) | **migrated** | rewritten onto `test/native-ride-double.mjs` (new host double with `tools/pre-execute` + `tools.guard`); keeps the non-Team native ride, the negative `LANE_DENY` control and the dispose leg, with the two marker strings the negative-control gate requires |
| `a5-pindir-reserved-native.test.ts` (305→200) | **re-anchored** (preserved control) | left side is now the reviewed authority artifact `dev/engineering/tool-obligations/authoritative-tool-sources.v1.json` (75 rows / 69 distinct names + host pins); right side is the pinned host catalog (66 names). Bidirectional drift, pin agreement, per-booking provenance over 2457 host files, the `subagent_fork` registration and two in-memory falsifiability mutations. Its plane-assembly legs retired with `team-tool-plane.mjs` and are recorded as such |
| `a5p7-lane-hygiene` | **re-pinned** | dropped the file `6f0dd3f1b` deleted (17→16); GLUE-5(b) now asserts the truthful post-cut shape (entry absent, mounted by nobody, barrel never leaks) |
| `bp1-dual-team-gate` | **re-anchored** | `hasPermissionListener` → `hasEnforcementSurface`: accepts `ctx.tools.guard` **or** the retired listener, and still reddens a member with neither |
| `multi-mcp-wiring` | **re-pinned** | the delta is declared by name (`mcp_alpha_probe`, `mcp_beta_probe`) and cross-checked against the final surface; the retired `w10PreSurface`/`a2c2PreMcpSurface` hooks are gone |
| `a4p75-composition-smoke-classification` (54/54), `a4p7-merge-gate` (35/35), `pbf-default-artifact-urls` (9/9) | **re-pointed** | glue path `live/agent-bindings.mjs` → `vnext/agent-bindings.mjs`, the path `place-dist-glue` actually places |
| `rc2-persona-probe` | **re-pointed** | the OPEN DEFECT row (non-persona slot name) moved with the glue; the defect itself is unchanged |
| `a6-pr3-lane-hygiene`, `a3p5-permission-notification-lane-hygiene`, `a4p2-dual-envelope-mutation` | **re-pointed** | the consumer pin `src/plugin/root.ts` → `src/plugin/vnext/root.ts`, still *exactly one* consumer |
| `a4p3-intervention-lane-hygiene` | **re-anchored** | walk anchor `operation-permission/pre-execute-adapter.ts` → `operation-permission/canonical-operation.ts` (the surviving file); the non-vacuity law is unchanged |
| `a5sf-pd20-closed-arguments` | **split** | the closed-argument algebra legs stay; the two legs loading the retired route-C shadows (`confined-terminal-tool.mjs`, `confined-bash-tool.mjs`) retire with their subject |
| `a5g6-install-face-render` | **split** | LEG A (upstream-resolver face) stays; LEG B (`createTeamToolPlaneAssembly` render arms) retires with `team-tool-plane.mjs` |
| `a5intr3-kit-runner` | **deleted** | its kit (`dev/agent-workflow/evidence/alpha5/int-r3/a5intr3-plane-mount-kit.mjs`) imports the retired plane; the kit is evidence and is not edited |
| `p4t6-session-event-scan` | **re-baselined** (20/20) | all 553 booked paths and the 983-path A4-PR1 base had been deleted with the cut → the ledger asserted 553 absences. Re-baselined into ONE lane (`round72relive.json`, 1309 paths, base 0) with the law unchanged: base + Σ booked must equal the scan, and the RED-first controls (unbooked path, doubly-booked path, dropped booking, reappearing retires, skewed tie, stray entry, malformed booking) still redden — one control is now planted because the live lane legitimately books no retirements |
| `a4p7-blueprint-version-clean` (60/60) | **recorded** | two files author a blueprint literal as their subject (`a3p4-pr4-production-entry-regression` v4, `vnext-admission.test.mjs` v5); entered in the deferral map with the subject-based reason the map demands, exactly like the other 20 rows |
| `a5p0-layer-audit`, `a5p7-lane-hygiene` | **re-pinned** | the consumer set is the 14 live files; findings 19 → 0 |

### 5. The census leg

`ci-census` grades the nine-root vitest population against the frozen baseline
`dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md`. On a **hosted
runner** the pristine DSH host is absent, so the leg is `REFUSED` and `pr-gate --allow-refused census`
accepts the refusal — which is why the reviewer never saw these reds. On this workstation the host is
present, so the leg actually graded and reported **55 NEW RED(S) across 26 files + 4 collection
errors**. All 26 are dispositioned in §4 and the 4 collection errors were suites deleted with their
subjects. The re-run after the round is the last line of this section (a full census run takes ~38
minutes; the transcripts are in `.artifacts/round72/transcripts/`).

### 6. What is still red, and exactly why

1. **`next-host` legs (ci-integration, environmental).** `node --test tests/next-host/boot.test.mjs`
   fails with `NextHostMissingError: NOT_BUILT: the host tree at tests/deepseek-harness-next is not
   BUILT (apps/cli/lib/bin.js missing) — run: node scripts/provision-next-host.mjs --materialize`.
   That tree is gitignored by design (`docs/TEST_METHODS.md`): it is a materialized, built *pristine
   upstream* checkout, not repo content. The failure is **environmental** — it needs
   `provision-next-host --materialize` plus a DSH build in this worktree, which exceeds this round's
   scope and cannot be produced by a code change.
2. **`scripts/ute-family-inventory.test.mjs` — 27 pass / 10 fail.** The instrument's fixture battery
   (`the committed inventory grades clean (9 families, no findings)` and S5/S10/S15/S17/S19/S32/S33/
   S36/S37) is bound to the **pre-cut** tree: it builds synthetic family manifests that mirror the
   retired `families` plane and grades the committed `ute-family-inventory.json` against them. The
   family system is retired, so its inventory ledger is a `retired-subject` and the fixture base no
   longer exists. This leg lives in `ci-census`, not in any of the six jobs above. Two lawful shapes,
   both recorded rather than taken unilaterally: **(a)** record the retirement in the cut-closure
   ledger and rebuild the fixture base synthetically (a dedicated instrument round), or **(b)** retire
   the instrument together with the family system and keep `eb3-family-definitions` (which now passes
   with 0 findings) as the family-side law. It is disclosed here so the next round can choose.

**Census re-run after the round (clean tree, nothing else running):**

```
DSH-CI-LEG leg=census verdict=pass
detail[census]: roots: nine (packages/*/test) via the root vitest config; baseline
nine-root-u7-1-old-reds.md = 0 titled reds + 0 collection files;
captured 598f/7383l, 598f/7383l vs baseline-declared 626 / 7936;
2 captures, identical identity sets — COUNTS MOVED, SET DID NOT
```

`NEW RED(S) 0`, `NEW COLLECTION-ERROR FILE(S) 0`, both captures identical. The first two census
attempts in this round were taken while the tree was still being edited (they reported 55 then 3
reds and differing identity sets); the run above is the one that counts, and its transcript is
`.artifacts/round72/transcripts-clean2/`. With the census green, `ci-pr-gate --full` is now
**pass=10 fail=0** on this tree (all ten legs).

**One ordering fragility disclosed** (pre-existing, not repaired here): in the full-file run of
`packages/testkit/test/a4p7-merge-gate.test.ts` the leg `the scratch the commit-level instrument
builds cannot change another instrument's measurement` fails after ~37 s, while the SAME leg passes
when selected alone (`-t "cannot change another instrument"` → 1 passed, 34 skipped). It builds and
deletes `scripts/lint-scratch-control-{a,b}.mts` and re-measures lint identities; a preceding leg in
that 2000-line file leaves residue it reads. The census above ran the same file in the nine-root
population and saw no red, so this is an intra-file ordering effect, not a product regression.

**Final `pr-gate --full` on this tree (the command `ci-product` runs, all ten legs, census included):**

```
DSH-CI-LEG leg=graph-parse        verdict=pass
DSH-CI-LEG leg=kit-home-guard     verdict=pass
DSH-CI-LEG leg=state-freshness    verdict=pass
DSH-CI-LEG leg=append-only-log    verdict=pass
DSH-CI-LEG leg=install            verdict=pass
DSH-CI-LEG leg=blueprint-fence    verdict=pass   (no new offending path; dirty 20 files/54 sites; baseline 20)
DSH-CI-LEG leg=typecheck          verdict=pass   (all packages, tests included)
DSH-CI-LEG leg=lint-identities    verdict=pass   (new 0, resolved 13)
DSH-CI-LEG leg=artifacts-at-head   verdict=pass  (HEAD carries its own build)
DSH-CI-LEG leg=census             verdict=pass   (598f/7383l, identical captures, counts moved set did not)
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none
```

And the other hosted layers, re-measured after the last edit: `ci-security`
`PASS suites=14 files=14 describes=61 passed=216 failed=0`; `ci-integration`
`PASS suites=15 files=15 describes=76 passed=238 failed=0`; `ci-product` L1
`contracts=6 files=8 exit=0` (64 tests). `ci-fast` is docs-only: `docs-probe blocking=0`,
`docs-sync findings=0 blocking=0`. The one hosted leg this workstation cannot run is `next-host`
(§6.1) and the one instrument still red is `ute-family-inventory.test.mjs` (§6.2).
