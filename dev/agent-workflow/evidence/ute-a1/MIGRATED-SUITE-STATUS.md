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
| 3 | `grep` | **PROVEN** (ADM-66): admitted, `Found 1 match`, the confined subprocess face is actually used, fact names the judged locator, settlement `COMPLETED` — on a host that proves the confined face's `network: deny` profile. **HOSTED (no such proof, round 82): ENV-BLOCK** (`NETWORK_DENY_UNPROVEN`): the spawn is refused before any process; admission `allow`/execution `failed`/settlement `FAILED`/zero spawns are asserted, the search is NOT claimed | **PROVEN** (ADM-73): out-of-lane path ⇒ `LANE_DENY`, **zero confined-subprocess spawns**, the secret never appears, settlement `REFUSED`/`not-started` (this half is capability-independent and runs on BOTH kinds of host) |
| 4 | `web_fetch` | **PROVEN** (ADM-67): admitted, the loopback fixture body arrives (`HTTP 200`), exactly ONE transport call, fact `allow`/`net.fetch`, settlement `COMPLETED` | **PROVEN** (ADM-74): denied network axis ⇒ `NETWORK_DENY` before the body, **zero transport calls**, no body bytes, settlement `REFUSED`/`not-started` |
| 5 | persistent `bash` | **BLOCKED — NOT RUN, never a pass** (ADM-68, `t.skip` + a machine-readable line): the compiled answer carries no process lane, so the centre can only answer `ADMISSION_AXIS_UNSUPPORTED`. Reason: the v4 member ceiling's frozen `io` field set is `{read, write, network}` (`blueprint-v4.ts`) and `bindingFromCompiledMember` projects only what the compiler produced — `CONTRACT-CHANGE-REQUEST-process-lane.md`, which names B's rung-6 positive control as blocked. Minting a lane in the test, or deriving one from the write lane, would be the SECOND decision authority this cut refuses | **PROVEN** (ADM-75): refused with `ADMISSION_AXIS_UNSUPPORTED` (the reason names the missing subprocess lane), zero subprocess spawns, **zero sandbox `confine` calls**, execution `admission-refusal`, settlement `REFUSED`/`not-started` |
| 6 | `run_code` | **NOT APPLICABLE — PRODUCT UNSUPPORTED** (round 92, owner ruling 20261124-0151 §PTC; ADM-69 reports the marker + status, asserted by ADM-80). The transport itself IS present: the member resolves the registry's reserved `run_code` object; what does not exist is a supported PTC governance story (`ADR-ptc-unsupported.md`) | **PROVEN** (ADM-76 and the retained-entry arm ADM-79): `ADMISSION_PTC_UNAVAILABLE` with status `unsupported-by-product-ruling` on fact + settlement, zero worker spawns, zero sandbox `confine` calls, settlement `REFUSED`/`not-started`. The out-of-lane form's code was `ADMISSION_AXIS_UNSUPPORTED` when this table was written; the PTC-specific code has been the durable one since round 85 |

**ENV_BLOCK on THIS host (round 7x, when this section was written): none** — no probe was environment-blocked
here. **ROUND 92 amends the two "blocked rungs":** rung 5 remains a disclosed bash-only skip (the compiled
answer declares no execution authorization in THIS world; its positive control is `ADM-125`), and rung 6 is
NOT a "blocked positive" any more — the owner ruled PTC NOT SUPPORTED this generation, so the arm reports
`NOT APPLICABLE — PRODUCT UNSUPPORTED` and the ladder proves the REFUSAL chain instead (§ Round 92 below;
`ADR-ptc-unsupported.md`). Neither is a silent skip: each emitted a machine-readable line and each marker is
asserted by a companion arm.

**ENV_BLOCK on the HOSTED runner (round 82): five named arms, one code.** `OS-2`, `OS-3`, `ADM-66`,
`SLICE-28` and cascade `ADM-70` ride the confined process lane's `network: deny` profile, which the
provider admits only on its own `--net-leg` proof of an unprivileged network namespace. The hosted
runner does not confirm that proof, so the product refuses the spawn before any process. `OS-2`/`OS-3`
assert that refusal as `FAIL-CLOSED-CONTROL`; the grep arms assert the admission fact + refused spawn
+ settlement `FAILED` and keep their lane controls as `ENV-BLOCK`. All five print
`UTE-VNEXT-A1-ENV-LIMITED … code=NETWORK_DENY_UNPROVEN`, skip only after their assertions, and increment
no proven counter. On THIS host the capability is present (probe `NET-DENY-CONFIRMED`), so the same five
arms run their real controls. Exact probe line and per-arm output:
`ENV-LIMITED-CAPABILITY-20261123.md`; matrix cells: `CAPABILITY-MATRIX-C.md` round-82 section.

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
   pre-launcher). Its precondition is now MEASURED rather than assumed: the leg's capability probe asks
   the product's own `runNetworkLeg` whether the confined face can prove `network: deny`. On a host
   without `python3`/Landlock the probe/provider itself fails and the arm is RED (no skip). On a host
   that HAS Landlock but cannot prove a network namespace (the hosted runner), the arm is
   **ENV-LIMITED** (`ENV-BLOCK`, `NETWORK_DENY_UNPROVEN`), the fail-closed refusal is asserted, and the
   search is NOT counted as proven — round 82. It is never silently skipped and never a pass.
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

## Round 72b (rc.5 migration) — 2026-11-22

Full evidence: `RC5-MIGRATION.md`. The external review's #1 priority was that the product is validated
only on DSH **0.2.0-rc.2** while A0 targets **0.2.2-rc.5**, so rc.2 greens cannot be promoted. This
round makes the rc.5 lane RUN (B1–B4), collects the B5 signal, and reports the truth.

**Provisioned and built.** `tests/deepseek-harness-next` (a SYMLINK into the main checkout, i.e. one
tree shared by every worktree — recorded deliberately) is now installed and built:
HEAD `9c2670d3bce5275e0d1610272958121af87787bb`, version `0.2.2-rc.5`, pnpm 11.28.5, own build
10/10 gates. Pinned native assets (`@deepseek-ai/node-addon-system-linux-x64@0.1.2`) verified:
`system.node` `54a9c25c…/17360 B/0o755`, `landlock-run` `a752bc72…/38552 B/0o755`. The tree's
`git status --porcelain` is empty: pristine upstream, no patch. (`--assets` had to be run through the
same transport anchored at the resolved tree because the CLI's containment check is lexical and a
symlinked worktree can never satisfy it; recorded, worked around, not "fixed" here.)

**Resolution is host-anchored, and a real false green is closed.** The lane's old resolver returned
the first successful `createRequire(<tree>/<anchor>)` hit **without containment**; measured, that
returns the repo's rc.2 `dsh-tool-fs`. `resolveInsideTree` now requires the realpath to be inside the
tree, skips escapes, and names them on failure. `TEAM_TEST_HOST=next|legacy` (new
`tests/next-host/host-select.mjs`) selects the host, and the test loader hook redirects TEAM bare
`@deepseek-ai/*` imports into the selected tree so the product cannot bind rc.2 scope while the world
builds rc.5 scope. Legacy is the default and inert.

**B3/B4 ported.** A LABELED `workingDirectory` double (the `approval` double's precedent) because
rc.5 `tool-fs` statically injects it and Cordis silently defers otherwise — measured: without the
double rc.5 registers **no** read/write/edit; with it, all three. Dispatch now has the rc.5 batch
shape (`calls:[{type:'tool-call',…}]` → `batch.results[0].result`) with
`dsh-tool-executor-native` mounted; the legacy shape is kept verbatim for rc.2.

**Measured, per suite:**

| suite | result |
| --- | --- |
| `tests/next-host` (existing lane) | **19/19 PASS**, incl. a real rc.5 boot on :13000 (boot 1255 ms, session served, session log on disk) and A1–A6 host-runtime behaviours |
| `tests/ute-g1-fs/lane-suite` (rc.5 lane) | **5/5 PASS**; 16/16 vectors reproduce the rc.2 golden through rc.5, 13/13 negative controls |
| A1 slice on rc.2 (default) | **36/36 PASS** — the port changed nothing for the legacy host |
| A1 slice on rc.5 | **33/36 PASS** — first rc.5 measurement of the product slice |

**The three rc.5 reds, named:**

1. **SLICE-35** — the confinement invariant is RED on rc.5, the intended B5 signal: the confined
   provider does not override `patchText`, `deleteFile`, `moveFile` (plus four internal helpers of the
   rc.5 concrete provider: `patchContent`, `requireFile`, `withLocks`, `writeTarget`). `apply_patch`,
   delete and move reach the backend with the Member lane never consulted. **B5 not fixed** (separate
   product task). No claim of "FS confinement holds on rc.5" may be made until it is.
2. **SLICE-21 / SLICE-30** — genuine rc.5 drift (B6), NOT a porting bug. A pre-dispatch abort on rc.5
   is settled by the batch scheduler's synthetic `ABORTED_BEFORE_DISPATCH` result and the pipeline
   never runs, so `tools/result` never fires. One probe, both hosts:
   `ABORT-PROBE mode=legacy toolsResultEvents=1` vs `mode=next toolsResultEvents=0`. The arms stay
   red on purpose: a product that keys durable Stop evidence off `tools/result` sees nothing on rc.5,
   and that needs a product decision, not a weakened assertion.

**Gates, unchanged and green:** leg 182 cases / 180 pass + 2 disclosed skips, catalog 785 tests /
38 uncollected / 14 excluded, cut-closure `cut(0/148)`, P0 `cut(148/148)`, docs-sync 0 findings,
28 placements, ci-required 10 workflows / 0 findings, bound vitest `PASS 238`. No row in
`CAPABILITY-MATRIX-C.md` was upgraded by this round — the rc.5 greens are lane evidence, and the
matrix upgrade is an owner decision.

## Round 73 (settlement Option A) — 2026-11-23

The owner ruled on the one open settlement invariant (`docs/reviews/20261122-1536.txt` §2): approve
**Option A** of `CONTRACT-CHANGE-REQUEST-settlement-recheck.md`. The call the post-approval recheck
refuses after an `allow` is no longer reported as an unclosable gap. It now settles truthfully.

**What was implemented (no host patch, no new store, no second authority).**

- `packages/runtime/settlement/execution-settlement.ts` — `RecheckDecisionReference` (decisionId,
  digest, `decision: 'deny'`, `decisionKind`, `reasonCode`, `subjectExecutionId`, `callId`,
  `policyGeneration`, `decidedAt`); `recordRecheckDecision` appends it to
  `record.recheckDecisions` and refuses with `RECHECK_NOT_BEFORE_BODY` once the record is no longer
  `ADMITTED`; `assertAdmissionCoherence` permits `REFUSED` against a cited `allow` **only** when the
  store itself holds that durable deny; `settle` writes `terminalDecision` (the deny) while
  `admission` keeps the original `allow`; `enterRunning` refuses with
  `RECHECK_DENY_BLOCKS_DISPATCH` when a deny exists; `recoverUnsettled` settles an
  `ADMITTED`-with-deny record `REFUSED`/`not-started` from the decision instead of classifying it
  `UNKNOWN`.
- `packages/runtime/src/plugin/vnext/admission-port.mjs` — `refuseBeforeBody` appends the durable
  deny at the guard, synchronously, BEFORE the settlement termination, for lane/overlay drift and for
  a grant that cannot be spent. A throw is surfaced and the refusal still stands (fail-closed).
- `packages/runtime/src/plugin/vnext/settlement-port.mjs` — `recheckDenied` writes the decision;
  `refused` keeps the `SETTLEMENT_CONTRACT_GAP` path for the no-durable-deny case.

**The decision's code is the PRODUCT's existing recheck code** (`ADMISSION_RECHECK_LANE_DENY`, …), the
same code the durable execution fact already carries — no second vocabulary was introduced.

**Arms (real store + real port + real ledger, `ute-vnext-a1` leg):**

| arm | result |
| --- | --- |
| `ADM-119` positive: allow gen-1 → durable deny gen-2 → `REFUSED`/`not-started`/`terminalDecision` = the deny; allow reference and ledger fact byte-identical; no fault | PASS |
| `ADM-120` negative 1: `REFUSED` against an allow without a durable deny still `SETTLEMENT_ADMISSION_MISMATCH`, port still reports the gap, record stays `ADMITTED` | PASS |
| `ADM-121` negative 2: `RUNNING` refuses `recordRecheckDecision`; `RUNNING → REFUSED` is `ILLEGAL_TRANSITION`; a durable deny blocks `enterRunning` | PASS |
| `ADM-122` negative 3: Stop still `CANCELLED` + `pre-dispatch` stop fact, no deny; a recheck refusal is `REFUSED` with no stop | PASS |
| `ADM-123` crash window: deny written, no termination → fresh store recovers `REFUSED`/`not-started` from the durable deny; fresh ledger refuses the callId as `ADMISSION_REPLAY`; body not re-run | PASS |
| `ADM-124` fail-closed: deny write throws → the guard still refuses, body never runs, the fault is surfaced, the terminal write reports the gap and leaves the record `ADMITTED` | PASS |

`ADM-37`'s recheck half was rewritten from the old "asserts the gap" expectation to the Option A
positive (the old assertion is false by owner ruling, not weakened).

**Gates, fresh at this HEAD:** `dispatch-tests --run --leg ute-vnext-a1` → 188 cases / **186 pass / 0
fail / 2 disclosed skips**; `test-catalog --max-uncollected 41 --max-excluded 7` → tests 785 /
collected 733 / excluded 14 / **uncollected 38**, findings 0; `ute-cut-closure --check` →
`cut(0/148)`, four zeros; `ute-p0-assets --check` → 37 modules / 180 files / 69,512 lines; `docs-sync
--check` → 0 findings / 0 blocking; `place-dist-glue` → 28 placements; `eb3-ci-required` → 10
workflows / 0 findings; bound migrated layer → **PASS 238/238** (population unchanged).

**Not proven.** The six arms are in-process mechanism evidence. No live `D` judge boots a host through
the recheck path in this round, so no matrix row becomes PRODUCT-PROVEN and the settlement row stays
MECHANISM. The Stop rule is unchanged: a refusal is never recorded as `CANCELLED`, and no Stop is
invented.

---

## Round 74 (governed management plane) — S6 Remote restored per command class

**Owner ruling:** `docs/reviews/20261122-1536.txt` §3 (裁决三). **Escalation closed:**
`ESCALATION-centre-row-creation-entrance.md` now carries the RESOLUTION section.

**What changed, and what did NOT.** The S6 Remote plane is built and installed on a centre-configured
row again, but it is **not** a second agent-tool executor. Every command is classified by its ACTUAL
effect in ONE closed table (`packages/runtime/src/plugin/s6-command-classification.ts`), and the
dispatcher refuses the `agent-execution` class BEFORE envelope/params/ports with the EXISTING
host-surface vocabulary (`ADMISSION_REMOTE_UNAVAILABLE`, axis `team.control`), including the durable
fact + `REFUSED`/`not-started` settlement. `admission.ts` was NOT touched, no new axis was added, and
no management request is routed through the member admission point. Creation authority remains the S6
Principal (`s6-principal.ts`) + TeamDomain/Control + the existing `root.ts#createAndStartTeam()`.

**The closed classification (36 catalog methods):**

| effect class | commands | authority |
| --- | --- | --- |
| `control-plane-creation` | `team.create`, `handoff.create` | S6 Principal + TeamDomain + `createAndStartTeam()` gates |
| `control-plane-read` / `control-plane-management` | every other catalog method (team reads, projection/ledger, overrides, policy state, lifecycle, control resolution, handoff prepare, catalog/intent/team roots, compatibility, intervention, legacy inspect, `member.archive/restore/dispose`) | S6 Principal + TeamDomain/Control ownership and operation authority |
| `agent-execution` (**REFUSED**) | `team.admitInitialWork`, `team.ensureRootLive`, `member.create`, `member.send`, `member.followup` | would dispatch a native tool / execute a shell / produce agent I/O ⇒ only UTE may admit a bound member's call; this plane cannot |

The table is pinned in BOTH directions against `REMOTE_METHOD_NAMES` (`ADM-86`), and an unclassified
command has no effect class: `isS6ControlPlaneCommand` returns false, so a future catalog addition can
never default to allowed.

**Arms changed (population still 238):** `ADM-86` rewritten (was the blanket "no remote-command axis"
refusal) to the per-command closed table + served control read + refused execution with zero ports +
durable fact/settlement + unauthenticated-principal refusal; `a3p4-pr4-production-entry-regression`
E3 extended (real production root on `centreStatePath`: `remoteHandlerRegistration.installed===true`,
served `catalog.list`, five agent-execution commands type-refused with facts on the row's own ledger).

**Live driver (round 74):** creation path 3 is restored to `POST /team-remote/team.create` on
`ACCEPTANCE_ROOT`; the round-60 boot-create workaround is removed. New judge `d:remote-creation`:
unauthenticated refused and mints no Team; `TEAM_REMOTE_FOREIGN_TEAM` for a foreign TeamSession; runtime
`team.create` succeeds; a duplicate mints no second Team and adds no provider request; `member.send` is
refused with zero provider requests. `D-BOOT-FEASIBILITY.md` §17 records the run; see
`D-ACCEPTANCE-REPORT.md` for the verdict and the still-unproven list.

**Not proven / not claimed:** multi-user RBAC (it is a per-DSH_HOME authenticated operator model);
`handoff.create` live (classified, not exercised); any S6 command that would execute a tool (refused by
design, so its positive path does not exist).

## Round 75 (process execution authority) — the lane was never the question

**Owner ruling:** `docs/reviews/20261122-1536.txt` §1 (裁决一). **Escalation closed:**
`CONTRACT-CHANGE-REQUEST-process-lane.md` is now **RESOLVED / SUPERSEDED**.

**Step 0 — CONTRACT FITNESS CHECK: SUFFICIENT, no schema change.** The v4 grammar already declares
process execution authority: `toolBindings[].authorization` (allow/ask/deny) and
`execution.implementationOrigin/executionBoundary`
(`packages/domain/blueprint/src/blueprint-v4.ts:100,103,123,193-204`). The chain from authored
document to decision DIED TWICE in the middle: `projectToolIoRestriction`
(`member-io-policy/src/compile.ts:237-283`) dropped both fields, and `bindingFromCompiledMember`
(`src/plugin/vnext/centre-install.mjs:64`) mapped only `effective` lanes into `perTool`. The centre,
having nothing to read, had invented a `Binding.process` path lane that no surface declared. **The
defect was carriage, not declaration.** No `io.process`, no `Binding.process`, no fourth axis.

**What the decision now keys on** (`src/plugin/vnext/admission.ts:409-452`), in order:
`perTool[tool].authorization` + `perTool[tool].execution` present, else
`ADMISSION_EXECUTION_UNAUTHORIZED`; `deny` ⇒ `ADMISSION_EXECUTION_DENIED`; the boundary must be in
the closed v4 vocabulary, else `ADMISSION_EXECUTION_UNAUTHORIZED`; the composition's
`binding.executors[boundary]` must be `ready`, else `ADMISSION_EXECUTOR_UNAVAILABLE`; `ask` ⇒ the
existing durable Control approval; otherwise allow. The cwd is RECORDED as context and is never
consulted. Readiness is a composition FACT derived from the compiled answer's own faces
(`executorReadinessOf`: `confined-subprocess` ready iff a `spawnStreaming` provider exists;
`trusted-host` ready by construction; `delegated-remote` unavailable).

**Carriage fixed, in four places (no new authority):** `member-io-policy/src/types.ts` +
`compile.ts` (the restriction keeps `authorization`/`execution`); `team-services/src/product-assembly.ts`
(forwards them into the realm binding; refuses `confined-subprocess` only when the realm installs NO
confined face, and attaches Team `toolBindings[]` to each derived Member);
`src/plugin/vnext/live/a5sf-governed-realm.mjs` (declares `availableFaces: { process: true }` because
it mounts the confined subprocess + governed PTY faces); `centre-install.mjs` / `member-execution.mjs`
(carry the fields and the executor-readiness fact, rebuilt on the post-approval recheck).

**Resource bounds unchanged, stated in code and docs:** what a process may read/write/reach is the
three existing lanes plus the OS sandbox the declared executor applies. `team-services/src/subprocess.ts`
layer 1 = admission on declared read intents, layer 2 = the Landlock profile; the in-process arm
`ADM-130` pins the PROFILE, and the OS arms/boot pin the kernel.

**`grep` was never on the process axis** (`TOOL_AXES.grep = fs.read`); `ADM-129` now pins that an
in-lane `grep` is admitted while the same binding's `bash` is DENIED, and that an out-of-lane `grep`
is `LANE_DENY`.

**PTC stays refused for one measured reason** (`admission.ts:405-407`, `ADMISSION_PTC_UNAVAILABLE`):
round 85 measured nested calls, Control escalation and Stop as passing the same governance; the
WORKER's OS profile is not — PTC resolves its policy from the HOST session, not the member's compiled
read/write lanes, and `danger-full-access` skips confinement. The code and the reason text are
distinct from the shell's; see the round-85 section below and `PTC-FOUR-PART-FINDING.md`.

**Arms (population 238 vitest unchanged; the node leg went 188 → 194):**

| arm | proposition |
| --- | --- |
| `ADM-125` | allow ⇒ body runs, fact `allow` on `process.exec`, settlement `COMPLETED`; a different cwd changes nothing |
| `ADM-126` | deny ⇒ `ADMISSION_EXECUTION_DENIED` before the body, `REFUSED/not-started`, deny outranks executor readiness |
| `ADM-127` | ask ⇒ exactly one durable Control request naming tool+boundary, then the body under a one-shot grant; a denied approval refuses before the body |
| `ADM-128` | UNKNOWN/unavailable executor ⇒ `ADMISSION_EXECUTOR_UNAVAILABLE`; `trusted-host`/`confined-subprocess` are different executors; absent declaration keeps its own code |
| `ADM-129` | `grep` needs no process authority; out-of-lane is `LANE_DENY`, not a process code |
| `ADM-130` | OS profile derives from the three lanes; an outside path is not in it; an `ask` lane is refused, never widened. Does NOT prove kernel enforcement |
| updated | `ADM-18/24/26/87/114`, ladder rung 5 (`ADMISSION_EXECUTION_UNAUTHORIZED`), `SLICE-33` (admitted, PTY owner fence still refuses), `u6-pr3-bl01-ask-door` (negative control now `deny`) |

**Live (D3, `--boots 2`, two agreeing boots, DEV-LIVE):** `d3:persistent-subprocess` is **REFUTED**,
now for a measured reason: both `bash` turns return
`ADMISSION_EXECUTION_UNAUTHORIZED … toolBindings[].authorization + execution.executionBoundary`
(both facts `decision=deny` on `process.exec`; both settlements `ADMITTED→REFUSED`; state file never
written), because the D3 world declares no `toolBindings[]` for `bash` AND the preset mounts only the
one-shot `tool-bash`. Authorizing the one-shot tool would run an UNCONFINED shell (its body injects
the host's base `ctx.shell`, not the realm's confined face), so it is deliberately not authorized.
The product-correct swap — `dsh-tool-bash-persistent` with `backendType: a5sf-governed-shell`, plus a
`toolBindings[]` entry — changes the model-visible `bash` parameter surface for every governed
deployment and is left to its own composition round. `crash` / `work` / `alpha6` stay PROVEN.

**Not proven / not claimed:** a live persistent shell (REFUTED above); a live governed PTC run (round
85 measures the four parts structurally: three hold, the worker OS profile is blocked); kernel
enforcement from an in-process arm; any remote executor (`delegated-remote` is refused rather than run
locally); a `authorization: deny` honoured for non-process tools in the realm projection (unchanged
limitation).

## Round 76 (governed persistent shell) — the last REFUTED judge is PROVEN

**Scope.** Round 75's live half. Two independent causes were closed by DECLARED composition, never by
touching a judge:

1. **The governed preset mounted only the one-shot `tool-bash`.** Round 76 adds the HOST's own
   `@deepseek-ai/dsh-tool-bash-persistent` as a TOP-LEVEL preset row (`cordis.patch.yml:363-368`,
   `config.backendType: a5sf-governed-shell` — the governed PTY face's registered backend), BESIDE the
   one-shot row, which stays as the surface baseline the lane replaces (shape A requires a
   definition-identity change and an unchanged surface NAME set; the same pattern as `tool-fs`). The row
   is `disabled` on win32. No shadow, no Team copy: the module is the pinned host's.
2. **The D3 world declared no `toolBindings[]` for `bash`.** The main blueprint now declares
   (`run-boot-d3.mjs:309-321`): `authorization: allow`, `execution: { implementationOrigin:
   'dsh-native', executionBoundary: 'confined-subprocess' }`, and `io` = the three lanes with `all` +
   empty deny (process authority is not a lane; the declaration must not become one). The v4 grammar is
   unchanged — no `io.process`, no new field.

**Deployment requirement, measured (not a fixture).** The persistent row injects `terminals`; a preset
with a pending row REFUSES to bind (`RemoteError: agent-preset/invalid: tool-bash-persistent
(@deepseek-ai/dsh-tool-bash-persistent): waiting for terminals`), and member creation fails with
`TEAM_RUNTIME_DURABLE_WRITE_FAILED … waiting for terminals`. Measured in D3 first, then reproduced in
the D1 and D2 worlds, which compose the same preset. A governed deployment must compose
`@deepseek-ai/dsh-terminal` on an ancestor scope; the test worlds add the host's module with NO backend
(inert, fail-closed: `spawn` → `NO_BACKEND`, `listBackends() === []`, zero processes). The Member's live
`bash` is the realm MOUNT of the same host module on the governed face, which carries the backend.

**Three runtime defects found by making the path real (fixed, CORE PATCH BUDGET = 0):**

| where | defect | fix |
| --- | --- | --- |
| `team-services/src/product-assembly.ts` (`projectedRestrictionOf`) | a `confined-subprocess` restriction was refused as "no realm face in this lane" although the answer HAD a confined process face (`availableFaces.process === true`) — measured as `REALM_DECLARATION_INVALID` at the durable write | `confinedProcessOwned` accepts exactly that form; a NARROWER process-class lane is still refused (`REALM_DECLARATION_INVALID`, `/process-class/`) because nothing enforces the narrowing |
| `src/plugin/live/a5sf-realm-row.mjs` (`COMPILED_REALM_ANSWERS`) | the compiled answer the centre builds admission from kept only `{members, bindings}` and dropped the mounted faces ⇒ `executorReadinessOf` said `unavailable` for a realm that HAD mounted the confined subprocess face; measured live as `ADMISSION_EXECUTOR_UNAVAILABLE` on the realm-mounted `bash` | the stored answer carries `subprocess`/`terminal`/`web` verbatim |
| `team-services/src/mount.ts` (binding loop) | a process-class `toolBindings[]` entry claimed `bash` for an `fs`-only IO binding realm ⇒ shape A's untargeted mount refused (`SERVICE_MOUNT_FAILED … registered UNCOVERED name(s) ["bash"]`) | process-class bindings get no IO realm; `compiled.bindings` remains the admission carrier |

**Arms (node leg 194 → 198; vitest population unchanged 238):** `ADM-131` (authored v4 binding →
`projectToolIoRestriction` → `compileEffectiveIo` → `bindingFromCompiledMember` → `admit`, allow/ask/deny
+ no-authority), `ADM-132` (the persistent definition: injects `terminals` not `shell`, `definition.name
=== 'bash'`, schema `{command}` only, description `/persistent/iu`, and exactly one preset row with
`backendType: a5sf-governed-shell`), `ADM-133` (`compiledFor` accepts the process-class binding when
`availableFaces.process === true`; refuses `SUBPROCESS_UNCONFINED_REALM` when the face is absent/false;
`delegated-remote` still `NETWORK_UNCONFINED_REALM`), `ADM-134` (a narrower process-class lane is
`REALM_DECLARATION_INVALID` matching `/process-class/`), plus the B-ladder arm asserting the stored
answer keeps its faces (`answer.subprocess === subprocessFace`,
`executorReadinessOf(answer)['confined-subprocess'] === 'ready'`).

**Live (D3, `--boots 2`, two agreeing boots, 2026-11-22T12:17-12:23Z):** `RESULT evidence-complete=true
allProven=true (2/2 boots; agreeing pair=true)`, exit 0. All four judges PROVEN in BOTH boots:
`persistent` (first call admitted `process.exec allow` + 32-byte in-lane state file + second turn reuses
the SAME shell and reads `DBOOT_D3_PERSISTENT_SHELL_STATE` back; both settlements
`ADMITTED→RUNNING→COMPLETED`), `crash`, `work`, `alpha6`. `confinement-probe.json` both boots:
`refusal=true wrote=false outOfLaneExists=false bytes=0 inLaneState=true`; the SHELL itself reported
`Read-only file system`, and the driver (outside the sandbox) found no out-of-lane file. The OS parts:
the PTY's `spawn` is wrapped by the HOST `sandbox` provider (`terminal-bash` → `sandbox.confine`), whose
Linux chain prefers **bubblewrap** (0.11.1 verified usable here; `--ro-bind / / --bind <in-lane>` refuses
the out-of-lane write) with the **Landlock** launcher as the fallback rung.

**Surface change (deliberate, disclosed).** The model-visible `bash` is now the persistent definition:
`{command}` ONLY — `description`/`workdir`/`timeoutMs` are gone (`ADM-132`). Assertions moved: the D3
scripted model sends `{command}` only; the preset persona says `bash` is persistent (no `workdir`, no
`timeoutMs`); `run-boot.mjs`/`run-boot-d2.mjs` compose the inert `terminals` row; the D3 `crash` judge's
`state-file-never-written` clause (an absence-as-evidence control that passed ONLY because persistence was
refuted) became `state-file-survives-restart` (the same file exists and still holds the state bytes after
the SIGKILL + cold restart — stronger, and the judge's proposition text is unchanged).

**Probes of the other worlds (measured, not hidden):** before their worlds composed the service, D1
(`run-boot.mjs --boots 1`) FAILED with `TEAM_RUNTIME_DURABLE_WRITE_FAILED … tool-bash-persistent …
waiting for terminals` and D2 (`run-boot-d2.mjs --boots 1`) FAILED at `multi-member-delegate` (a member
first turn never closed — the same refused activation). Both PASS after composing the inert
`@deepseek-ai/dsh-terminal` row.

**Not proven / not claimed:** DEV-LIVE is not a gate (no row becomes PRODUCT-PROVEN); no real-model
interleaving; the `ask`/`deny` arms are in-process only (`ADM-126/127/131`); no Windows deployment (the
row is disabled on win32); durable shell state is shell-local across two turns, not a tmux/Processo env
proof; the deployment requirement above is real (a governed deployment without `@deepseek-ai/dsh-terminal`
cannot bind the preset).

## Round 77 (rc.5 FS new-method confinement) — 2026-11-23

Full evidence: `RC5-MIGRATION.md` §6.1/§11 and `CAPABILITY-MATRIX-C.md` (round 77 section). The
external review's #1 security item: DSH **0.2.2-rc.5**'s `FileSystem` adds `patchText`, `deleteFile`
and `moveFile` (`packages/fs/fs/src/index.ts:325,345,368`), and the Team confined provider overrode
ten methods ending at `editText` — so on rc.5 `apply_patch`, delete and move reached the backend with
the Member's lane never consulted. SLICE-35 is the invariant that goes red exactly for this; it was
RED on rc.5 at round 72b (7 un-overridden names) and is now **GREEN on rc.5 AND rc.2**.

**Product change.** `packages/runtime/team-services/src/fs.ts`: `patchText` (`:365`) mirrors
`editText` (same path, same write-axis + read-if-existing admission); `deleteFile` (`:383`) is judged
like a write of the file it removes; `moveFile` (`:416`) judges BOTH paths — the source as a removal
of an existing file, the destination as a write (plus a read when it exists) — and refuses BEFORE the
provider runs, so an out-of-lane destination leaves the source in place. `WRITE_METHODS` (`:120`)
carries the three names. rc.2 compatibility is a separate `FsNewMethodSurface` (`:99`) + ONE local
commented cast (`:250-264`); a base without a method is a TYPED `IO_POLICY_UNSUPPORTED`
(`:279`), never a `TypeError` and never a fallthrough. `install.ts` passes the Member identity at
both call sites. `MANAGED_FS_METHODS` deliberately not grown (an rc.2 install must still be accepted;
the capability decision moved per call).

**Invariant work.** SLICE-35 now excludes rc.5's four TS-`private` concrete helpers
(`patchContent`/`requireFile`/`withLocks`/`writeTarget`) — the decision round 72b deferred — and makes
it **witnessed**: each excluded name must be called from a base method the class overrides, plus a
host-relative assertion that the three public names are derived and covered whenever the base
declares them. SLICE-36 keeps its exact `deepEqual`; its fixture now adds `copyFile`/`truncateFile`/
`renamePath` (names the product does NOT cover), because reusing the rc.5 names would have measured
the product's new coverage instead of the derivation. Mutation control: renaming the `patchText`
override turns SLICE-35 RED on rc.5 naming `patchText`.

**Arms (node:test, `ute-vnext-a1`, `ADM-135`…`ADM-140`).** `ADM-135` `patchText` in-lane ⇒ spy
reached exactly once with the SAME target; out-of-lane ⇒ `IO_WRITE_DENIED`, zero calls.
`ADM-136` `deleteFile` same, plus write-only lane ⇒ `IO_WRITE_REQUIRES_READ` (judged LIKE A WRITE).
`ADM-137` `moveFile` both objects delegated; out-of-lane destination ⇒ refused, zero calls, source
NOT removed, nothing published; out-of-lane source ⇒ same. `ADM-138` cross-root per the product's
own per-path rule: an existing destination in a write-only root refuses `IO_WRITE_REQUIRES_READ`,
while a fresh destination in a second allow root IS admitted (no invented cross-root ban; the lane
has no root concept beyond its `allow` subtree roots, and rc.5's move is publish-then-remove, not a
rename). `ADM-139` a base without the three ⇒ `IO_POLICY_UNSUPPORTED` naming the method, no
`TypeError`, nothing changed. `ADM-140` the REAL pinned provider, host-relative, and it asserts the
branch matches the selected host: rc.5 performs patch/delete/move (real effects), rc.2 refuses them
typed with nothing moved.

**Lanes.** rc.2 (`ute-vnext-a1`, default): **204 tests / 202 pass / 0 fail / 2 disclosed skips**,
exit 0 (was 182/180 at round 72b). rc.5 per suite (the leg cannot run as one invocation there):
realm-lane 12/12, fs-slice **34/36** (was 33/36; SLICE-21/30 remain red, genuine rc.5 drift),
admission 124 tests / 119 pass / 5 red, os-probe 3/3, work-turn-reader 7/7, template-binding 6/6,
b-probe-ladder **hangs**. The five admission reds (`ADM-96/97`: `signals[0] is not of type
AbortSignal`; `ADM-100/101/102`: preset native-module default mount) and the b-ladder hang are
**pre-existing on rc.5 — reproduced with this round's four files reverted** — and are recorded, not
bent.

**Gates, fresh at this HEAD:** dispatch `204/202/0/2` exit 0; catalog `785 tests / 38 uncollected /
14 excluded` findings 0; cut-closure `cut(0/148)` findings 0; P0 `cut(148/148)` findings 0; docs-sync
findings 0; 28 placements; ci-required `workflows=10 findings=0`; bound vitest **238 pass**;
`ci-pr-gate --full --census-captures 2` **PASS**.

**Not proven.** In-process only (no booted `apply_patch`/delete/move, no model turn); no kernel
boundary (the base provider's TOCTOU is inherited); `moveFile`'s version-guarded / patched-on-move
path is not exercised; no matrix upgrade (C-fs stays MECHANISM).

---

## Round 78 (2026-11-22) — rc.5 acceptance (host-selectable drivers)

**What changed.** The three D drivers are host-selectable through the existing
single authority: `TEAM_TEST_HOST=next` selects `tests/deepseek-harness-next`
(0.2.2-rc.5, pin `9c2670d3bc`), ports 13000-13049, DSH_HOME suffix `-next`, and
a `host-loader.mjs` preload so the booted product resolves bare
`@deepseek-ai/*` from the selected tree. rc.2 stays the default (no
`NODE_OPTIONS` change, ports 3181-3199, no suffix). Every driver prints its
`candidate` row (`host`, `pin`, `source`) before boot and re-verifies the tree
HEAD; `git status --porcelain` on the host tree was empty before and after
every boot. `--keep-home` was added to `run-boot.mjs` as a diagnostic-only flag.

**Live judges on rc.5, two agreeing boots each** (same commands with
`TEAM_TEST_HOST=next`): `run-boot.mjs` 6/6 PASS, `run-boot-d2.mjs` 3/3 PASS,
`run-boot-d3.mjs` 4/4 PASS (`evidence-complete=true allProven=true`). Every
counted fact is identical to rc.2 (allowFacts 2; a/bAdmissions 9/9;
a/bGuardFacts 14/14; stopSettlementState REFUSED; aAdmissions 4 / bAdmissions
3; bash states COMPLETED; transcriptSourceCount 2). Side-by-side tables and the
full drift record: `RC5-ACCEPTANCE.md`.

**rc.5 drifts ported (no judge weakened, no upstream patch).** (1) rc.5 needs a
model at Agent creation (`AgentOptions` from the host's `agentDefaultModel`);
product fix in `packages/runtime/src/plugin/host.ts` (dep + pass site) and
`vnext/agent-bindings.mjs` (`teamAgentOptions()` on create/resume). (2) rc.5
registers only `provider`/`model` as prompt variables, so `{{cwd}}` in the
governed preset's persona suffix failed every member turn with `unknown prompt
variable "{{cwd}}"`; the suffix now names "the session workspace". (3) The
in-process ADM-100 world needs rc.5's `workingDirectory` service, executor and
batch `tools.execute` shape — added host-conditionally in
`vnext-admission.test.mjs` with the assertions untouched.

**Suite census.** NOT re-run in full on rc.5 this round. `ADM-100` was run
individually and is now **PASS on rc.5 and rc.2** (it was one of the five
pre-existing rc.5 admission reds; `ADM-101/102`, `SLICE-21/30` and the
`vnext-b-probe-ladder` hang were not re-examined). rc.2 lanes: the three drivers
above, unchanged verdicts. No vitest population change (still 238).

**Not proven.** Only three scripted drivers ran on rc.5; the scripted mock, no
real model/MCP/PTY backend/Windows/hosted deployment; `d3` `inflightAfter` is
UNKNOWN by contract; Alpha.6 routing unavailable by design; the `{{cwd}}`
removal changes persona text on both hosts (verdicts unchanged); the runtime
context stating the same working directory on rc.5 is assumed, not judged.

---

## Round 79 (rc.5 pre-dispatch abort) — 2026-11-23

**What changed.** rc.5's batch scheduler cancels a call before dispatch WITHOUT running the tool
pipeline: `BatchSettlement.skip()` synthesizes `ABORTED_BEFORE_DISPATCH` (`batch.ts:225-229`,
`:271-280`) and `ToolsService.execute` returns the batch (`index.ts:375-377`), so `tools/result`
never fires. The centre observed only the pipeline event, so a pre-dispatch cancellation on rc.5
produced no fact, no settlement and no report — SLICE-21/SLICE-30 red (they pass on rc.2, whose
pipeline emits the event). The centre now ALSO reads the value the host returns:
`vnext/pre-dispatch-abort.mjs` (new) selects only entries carrying the host's own code;
`execution-facts.mjs` writes the SAME canonical fact through the SAME ExecutionId-keyed dedupe map
from `observeExecutorCompletion`, with `abortPhase:'pre-dispatch'`; `centre-install.mjs` /
`member-execution.mjs` wire and expose the observer; `settlement-port.mjs#stoppedBeforeBody` records
`Stop(pre-dispatch)` + `CANCELLED` when an admission record exists and otherwise writes NO
settlement and REPORTS `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION`. No scheduler was intercepted or
replaced, no `tools/result` was fabricated, no allow/deny was invented.

**Durable facts for a pre-dispatch abort.** No admission record (the case the arms drive): ONE
execution fact (`outcome:'aborted'`, `abortPhase:'pre-dispatch'`, product ExecutionId), **no**
settlement, a visible `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` naming the ExecutionId; in a world
with the product ledger the ledger itself refuses the unbound fact (`LEDGER_EXECUTION_UNBOUND`) and
that refusal is reported, not written. Record exists: the same fact plus a recorded pre-dispatch
Stop and `CANCELLED` — never `UNKNOWN`.

**Arms.** SLICE-21/SLICE-30 keep their assertions verbatim and are GREEN on rc.5 and rc.2.
`SLICE-37` (new) pins one fact / zero settlements / a visible gap report for the abort,
`deduped:1` when the same completion is delivered again (the both-paths-fire case), and `observed:0`
for a call that entered the pipeline. `SLICE-38` (new) pins the durable edge: no execution record,
no settlement, no invented admission record, the refusal reported with the callId, and an admitted
control call still recorded and `COMPLETED`. Full slice: **38/38 on rc.2 and rc.5**.

**Lanes and gates, fresh at the code commit `274aec2cc`.** `ute-vnext-a1` **206 tests / 204 pass /
0 fail / 2 disclosed skips**, exit 0 (was 204/202). rc.5 per suite: fs-slice **38/38** (was 34/36),
admission 124 tests / 122 pass (ADM-96/97 red: pre-existing rc.5 MCP `AbortSignal.any` shape,
reproduced unchanged), realm-lane / os-probe / work-turn-reader / template-binding green as at round
78. vitest population **238 pass** (unchanged; the new arms are node:test). Catalog `785 / 38
uncollected / 14 excluded` findings 0; cut-closure `cut(0/148)` findings 0; P0 `cut(148/148)`
findings 0; docs-sync findings 0; **29** placements; ci-required `workflows=10 findings=0`;
`ci-pr-gate --full --census-captures 2` **PASS pass=10 fail=0** at `64a841c72` (census 2 captures,
identity set IDENTICAL to the published baseline). Its FIRST run at the code commit was red on the
p4t6 scannable-surface ledger (the new module was unbooked); booked with measured delta
1311 -> 1312, no assertion relaxed — the red and the fix are in `RC5-ACCEPTANCE.md` §7.

**D drivers, both hosts, `--boots 2`, re-run at the code commit** (transcripts:
`dev/agent-workflow/evidence/ute-a1/rc5/round79/*.log`): `run-boot.mjs` PASS 2/2, `run-boot-d2.mjs`
PASS 2/2, `run-boot-d3.mjs` PASS 2/2 `evidence-complete=true allProven=true`, on rc.2 AND rc.5, every
counted fact identical to round 78 (`RC5-ACCEPTANCE.md` §2.5). No row differs between hosts or boots.

**Not proven.** The production `tools.execute` call site belongs to the host agent loop; the observer
is exported and driven end to end in the slice composition but is NOT yet wired into a booted rc.5
member turn (an upstream seam — `CORE_SEAM_BLOCKER` for that leg). No real interleaving that aborts
between admission and dispatch was produced. The drivers exercise the pipeline path, so their re-run
proves no regression, not a live pre-dispatch observation. No matrix row upgrade (C-member (Stop)
stays MECHANISM + lane evidence).

## Round 80 (hosted-CI closure) — 2026-11-22, `vnext/a1-cut`

**§6.2's open choice is taken: option (a), the fixture base is rebuilt on the A0 frozen tree — and the
instruments are cut per subject, not skipped.** Full evidence: `ROUND80-CI-CLOSURE.md`.

The review's second P0 was not a product defect: at `5cf7cba8a3` the cut was green and complete while
four instruments still graded the retired plane (`eb3-family-definitions` 473 findings,
`eb3-tool-acceptance` 31 unbacked claims, five negative controls staged on deleted files, twelve
census-lane tests bound to the pre-cut tree) and the census baseline still booked the deleted files
(`POPULATION_SHRANK`). Every red is decomposed, and each disposition is per subject with a citation
into `ute-g1`'s frozen evidence and the round-72 per-file retirement record:

- **RETIRED per subject (licence, not silence).** `ute-cut-closure.allow.json#retiredSurfaces` (new,
  `ute-a0-retired-surfaces/1`, frozen tree `a19d1df018e772f20602f93bc726694524bdeb2f`) books **12
  subjects**: the 9 Family Contribution subjects (8 booked families + the ARC-A probe lane) and the
  three instrument subjects (`tool-acceptance-claims`, `family-lane-edges`,
  `family-inventory-records`), each with frozen modules, citations and successors. `--check` refuses
  an untracked citation / non-frozen module / unknown kind / missing successor (`A0_RETIRED_*`), and a
  family whose surface is not wholly frozen grades as LIVE (`INVENTORY_RETIREMENT_UNEARNED`). The
  per-file `retiredSubjects` record grew 107 → 110 (the three probe-lane files).
- **RE-POINTED.** Acceptance claims now read the frozen A0 blob; 31 cited suites are discharged only
  because they are booked in `retiredSubjects`. Controls C3/C3c/C4 stage on A0 blobs, C3b is
  re-expressed (frozen deletion = cut-discharged; the unlicensed-deletion law is staged on a
  non-frozen declared file), C20 consumes the leg's `retiredSuitePaths` — **35/35**.
- **FIXED (a real instrument bug).** `ute-cut-closure`'s placement arm graded a foreign `--root`
  fixture with THIS repo's build face; now scoped to `self` and reported as `placements=self|fixture`.
- **RE-BASED, mutation batteries intact.** `ute-p0-assets.test` derives from A0 and grades in a
  materialised throwaway repo (5 → 0 failures); `ute-family-inventory.test` (2 → 0, mutants 32/32),
  `ute-cut-closure.test` (3 → 0), `ute-retirement-gate.test` (2 → 0, 45 pass) read the frozen tree by
  object id; LIVE arms restate the post-cut facts (`retiredFiles=0`; the seeded rows add
  `UTE_OLD_PATH_PARTIALLY_REMOVED`, which is the cut — the frozen twin still grades each row's terms
  narrowly and positively).
- **REQUIRED CI grew by two successors**, because the guarantee has to live somewhere: `ute-p0-assets
  --check` (frozen 37 modules / 180 files: delete 146, replace 2, keep 32, `cut(148/148)`) and
  `ute-cut-closure --check` (148 deleted sources, 0 prod refs, 0 dist residuals, 0 duplicate
  declarants + the retirement record). Both were previously executed by NO CI layer; they are now
  `ci-integration` legs in `dev/ci/eb3-ci-manifest.json` and steps in the workflow, and
  `eb3-ci-required` stays `workflows=10 findings=0`.
- **Census re-earned.** Baseline regenerated through the instrument's attributed path (712 → 599
  files, 11 roots, `accepted_by round80-a1-cut`, reason naming the cut). The population shrank by the
  licensed deletion, not by omission.

The vitest population stays **238** (the `ute-vnext-a1` leg: 7 suites / 206 tests / exit 0; the
bound `ci-integration` leg: 15 files / 238 passed). Nothing was restored, no skip widened, no
negative control removed, no A0 evidence edited.

### Round 80, second pass — the six reds the first red was hiding

The hosted `ci-integration` red at `5cf7cba8` was `eb3-family-definitions`; the layer stops at its
first failure, so nothing downstream had run at HEAD. Replaying the layer's own step list found six
more failures, and one of them was not a stale test:

- **A REAL REGRESSION, FIXED IN THE PRODUCT.** `a5sf-native-route-c` N5's structural half read a
  deleted file, so it was vacuous; re-pointing it to the A1 survivor
  (`packages/runtime/src/plugin/vnext/agent-bindings.mjs`) showed that the successor mounted a
  row's `nativeToolModules` from inside `installMemberExecution` — BEFORE `agentPresets.mount` and
  BEFORE `applyBuiltInToolDeny`. An own-scope registration outside `tools.restrict` created before
  the deny lane survives it, which is the fail-open route-C exists to prevent. The fix restores the
  pre-cut order: the row's modules are attached by the surviving
  `attachA5sfNativeToolModules(a5sfMountedRealm, …)` AFTER the deny, and the F1 disclosure (sibling
  `isolate()`, deny-then-attach) is back beside the call. N5 now passes because the order is right.
- **FIVE STALE/PATH-BOUND ARMS, re-pointed or retired per subject**, each with its citation in
  `ROUND80-CI-CLOSURE.md` §2.1: W6/N5/TA5/W3a/PD29 structural pins (survivor path), W2 (the hint
  gate moved to `vnext/bind-path.mjs`; the ONE-gate law now spans two files), TA12 (the refusal's
  inject key set is a host detail — the law is the public state + each name + no upstream error
  text), W5 (the legacy appended shell shadow is a retired surface; the revision-identity arm and
  the forged-revision refusal stay), PA15 (stale since round 75: Team-scoped `toolBindings` are
  carried VERBATIM onto every Member by design — asserted, with the residual still named).

### Round 80, final pass — the tinf layer closes; the census layer's next exposure is named

The tinf leg is **GREEN**: `803 tests / 797 pass / 0 fail / 6 skipped` over the same 51-file set
(`sha256:6954daa6…`), from `805 / 784 / 15` at `8428c9d72`. The 15 red arms were all fixtures built on
the appending mechanism the A1 cut deleted; the two count/closure instruments §2.4 named were
re-pointed instead of retired. Full disposition (arm → subject → citation → successor) is
`ROUND80-CI-CLOSURE.md` §3.1; the shape is the same in all six files: 12 retired blocks collapse into
4 `RETIRED-BY-A0` pins that assert (a) the retired surface stays absent, (b) the post-cut mechanism
directly (attach appends nothing, surface unchanged, zero confined calls, zero read facts), (c) every
named successor exists. `ute-vnext-a1` stays 238 in the vitest population / 206 in the dispatch leg
(204 pass, 2 declared skips) and `eb3-security-run --layer ci-integration` stays `passed=238 failed=0`.

Re-pointed, not retired: `binding-digests` C1-F1a (the closure must still FOLLOW a literal dynamic
import out of `tests/world-factory`, must FAIL CLOSED and NAME the deleted target, and a surviving
consumer — `tinf-observer-closeout` → `packages/testkit/src/{effect-witness,contract-oracle}.ts` —
carries the positive half); `a5sf-instrument-graph` PD32-GRAPH (`./web-tool` → the shipped
`./web-transport`, plus a negative assertion that the retired subpath resolves nowhere);
`a5sf-pd13` C2/C6 (locus and the DECLARED dynamic-read weakness kept verbatim; only the executor
sentence moved from `delta.confined===1` to `delta.base===1`); `a5sf-p01` seven of eight arms kept by
dropping a single dead import.

Two `ute2-settlement` pins the hosted `ci-census` job died on were stale, not regressed, and are
re-pointed: the settlement store's exact recorder set gained `recordRecheckDecision` (round 73 option
A, `710edb87f`, `CONTRACT-CHANGE-REQUEST-settlement-recheck.md`, arms ADM-119…ADM-124 — a recorder,
still covered by the forbidden-grant regex), and the dispatch wrapper's "off by default" arm now
splits production/test references and asserts EVERY production referrer names only the pure
`dispatchExecutionId` (the two legitimate consumers are the A1 centre, `4fd8f8e75`, and the host
refusal entry, `d2453e45d`), with the retired `tool-dispatch/install.ts` seam asserted ABSENT.

Census population: **unchanged, 11 roots / 599 files**, `accepted_by round80-a1-cut`. Regenerating the
baseline at this tree reproduces the committed file byte for byte except `generated_at`; every file
this pass edits is a `node:test` suite outside the vitest census population, so there is no honest
"599 → lower" to record and no baseline commit was made.

**Not closed:** the hosted `ci-census` job aborts before its own later steps, and running those steps
locally exposes 18 arms in 5 route-C lane suites (`tests/ute-g1-{search,web,process,agentctl,uistate}`)
that die on the same deleted append (`assert.ok(Array.isArray(fibers), 'the attach must answer the
fibers it created')`). Their goldens were recorded WITH the shadow, so reproducing them requires
either re-recording five corpora against the A1 composition or retiring five Required-path steps —
an owner ruling, named in `ROUND80-CI-CLOSURE.md` §3.6, not an instrument fix. `ci-census` /
`ci-required` therefore stay RED at this head, and no claim to the contrary is made anywhere.

---

**Hosted (`ci-required` / `ci-census`), round-81 heads.** UTE G1 layer: 71/89 → 86/89 → 88/89 → **89/89
hosted at `003c407ff`**, with the census population 22/22 on both captures and the 184-test `next-host`
step green. Full detail and the four-head table: `ROUND80-CI-CLOSURE.md` §4.6. The job's remaining red is
the `ute-vnext-a1` dispatch leg (`ripgrep provider failure` + `IO_POLICY_UNSUPPORTED` for the OS realm),
on seven files this round does not touch and which pass locally 204/2-skip; it therefore makes
`ci-required` UNPROVEN overall, while the UTE G1 layer itself is proven. See §4.6 for the exact log
lines and why repairing it is outside this disposition.

## Round 81 — the five route-C lane suites, disposed per subject (not re-recorded)

The "**Not closed**" paragraph above is now closed, and its framing was wrong in one respect worth
recording: the five red lane suites were **not** an owner ruling between "re-record five corpora" and
"retire five steps". They were the same per-subject disposition §3.1 applied to the tinf leg. Round 81
applied it arm by arm (18 hosted arms), and the result is:

| suite | tests now | old-path arms disposed | corpora re-recorded | verdict line |
| --- | --- | --- | --- | --- |
| `ute-g1-process` | 8/8 | PROC-1 capture RETIRED, PROC-5 battery RETIRED per subject (9 controls incl. a real `NC-MEMBER bash`), PROC-6 probe REPOINTED (host-free), PROC-8 input REPOINTED | 0 | `PROC-GOLDEN vectors=14 state=FROZEN re-records=0`, `NC-VERDICT GREEN controls=8 failed=0` |
| `ute-g1-search` | 8/8 | old capture RETIRED, old NCs REPOINTED (2) / KEPT (2) / added (3), VERDICT term REPOINTED | 0 | new path reproduces 15/15 vectors byte-for-byte; `oldBaseline=RETIRED-BY-A0` |
| `ute-g1-web` | 9/9 | capture RETIRED, socket witness REPOINTED to real undici, battery RETIRED per subject (10 controls incl. one `NC-MEMBER` per member), semantic measurement RETIRED (declaration KEPT) | 0 | `UTE-G1-WEB-CONTROLS GREEN controls=8 transcript=exact mutated=RED` |
| `ute-g1-uistate` | 9/9 | capture RETIRED (two subjects), 13-arm battery RETIRED per member (15 controls: one `NC-MEMBER` per member of both units), semantic measurement RETIRED (declaration KEPT) | 0 | `UTE-G1-UISTATE-CONTROLS verdict=GREEN controls=8 transcript=exact` |
| `ute-g1-agentctl` | 7/7 | capture RETIRED, 24-arm battery RETIRED per member (14 controls: one `NC-MEMBER` per each of the seven members), semantic measurement RETIRED (declaration KEPT), Stage-0 descriptor re-derivation REPOINTED to the committed transcript | 0 | `UTE-G1-AGENTCTL-VERDICT RETIRED-BY-A0 rows=42`, `NC-VERDICT GREEN controls=8 failed=0` |

The census argv is now **89 tests / 89 pass / 0 fail** locally, with the pinned rc.5 tree materialized
in the worktree (`tests/deepseek-harness-next`, gitignored; as a symlink its canonicalized resolution
tripped `ute1-fs`'s "resolved OUTSIDE the pinned next-host tree" refusal — an environment artifact, not
a test change).

Two invariants this round refused to trade away, and both are now gate-visible:

1. **No golden was re-recorded.** The four lanes without a post-cut path keep their historical
   baselines (14 / 15 / 69 / 42 rows) and assert the fact (`NC-GOLDEN-FROZEN`). Re-recording them
   would have matched the product after the mechanism was deleted.
2. **No retirement is un-cited or successor-less.** Every pin names the deleting commit
   (`5d1349767`/`93ba0a1d1`) and the frozen licence row; `assertSuccessorsExist()` turns a lane RED if
   a named successor disappears, and `assertNoAppendedShadow()` re-reads the route-C row so a
   resurrected `confined*SpecOf` (or a vanished `a5sfConfig?.nativeToolModules` seam) is a hard fail
   rather than a stale citation.

The frozen licence (`dev/agent-workflow/ledgers/ute-cut-closure.allow.json`) was **not edited**: every
row already books its lane suite as a successor, and every lane suite survives with live arms. `dev/agent-workflow/ledgers/ute-retirement.json` WAS
updated in exactly one place: each of the seven `negativeControlsPass.evidence.expect` lists now pins
the re-recorded transcript's tokens (the old lists pinned the retired batteries, so the gate reported
`UTE_EVIDENCE_CONTRADICTED` — correctly). The rows' `verdict: true`, unit membership and every other
term are unchanged, and each unit keeps one real post-cut `NC-MEMBER <member>` control, so
`coverage.negativeControlsPass` still equals the unit's members. The gate still refuses every family,
and the agentctl lane's test 7 grades that refusal against the committed transcript.

Full arm-level table (arm → subject → citation → action → successor): `ROUND80-CI-CLOSURE.md` §4.


---

## Round 82 (2026-11-23) — the `ute-vnext-a1` leg: one capability probe, five named ENV-LIMITED arms, zero false gates

The hosted red was not five defects. `OS-2`, `OS-3`, `ADM-66`, `SLICE-28` and `ADM-70` all ride ONE
capability: the confined process lane's `network: deny` profile, admitted only on the product's own
`--net-leg` proof (unprivileged `CLONE_NEWUSER|CLONE_NEWNET` per child, distinct namespace inodes,
kernel errnos on tcp/udp, listener counters unchanged). The GitHub-hosted runner does not confirm it;
this worktree does. The leg now asks that probe once per process (reusing `runNetworkLeg`; no second
probe), prints `A5SF-CAPABILITY network-deny=present|absent …`, and each affected arm takes the
truthful branch:

| arm | capability present (this host) | capability absent (hosted) | code |
| --- | --- | --- | --- |
| `OS-2` | kernel denies the out-of-allow read (GREEN) | FAIL-CLOSED-CONTROL: `IO_POLICY_UNSUPPORTED`, no plan, no payload | `NETWORK_DENY_UNPROVEN` |
| `OS-3` | same payload reads inside the allow set (GREEN) | FAIL-CLOSED-CONTROL: the positive payload is refused before any plan | `NETWORK_DENY_UNPROVEN` |
| `ADM-66` | `Found 1 match`, settlement `COMPLETED` (GREEN) | ENV-BLOCK: admission `allow`, execution `failed`, settlement `FAILED`, zero spawns, no fabricated match | `NETWORK_DENY_UNPROVEN` |
| `SLICE-28` | in-ceiling search GREEN + lane negative GREEN | ENV-BLOCK for the search; the lane negative control is still GREEN and asserted | `NETWORK_DENY_UNPROVEN` |
| `ADM-70` | 4-rung positive ladder order GREEN | ENV-BLOCK: runnable-rung + durable admission order asserted; the 4-rung positive ladder not claimed | `NETWORK_DENY_UNPROVEN` |

`t.skip` is called only AFTER the assertions, so a regression in the fail-closed path still turns the
arm RED. The dispatcher aggregates the records into
`DSH-TEST-DISPATCH-ENV-LIMITED count=5 proven=0 env_blocks=3 fail_closed_controls=2`. The count is
small, named and stable; none of the five is counted as proven on an incapable runner, and the vitest
population stays 238. `A5SF_FORCE_NETWORK_DENY_ABSENT=1` is the documented PROBE override that forces
the absent path on this capable machine (it replaces only the net VERDICT at the provider's
`deps.probeFacts` seam; the ABI and the three enforcement legs stay real). It is not an environment
fake and it is disclosed in every printed line.

---

## Round 83 — the delivery boundary: population unchanged, one node arm rewritten and strengthened

Round 83 turned the round-74 refusal of three member commands into lawful **work DELIVERY**
(`work-delivery` effect class) and rewrote **ADM-86** in `packages/runtime/test/vnext-admission.test.mjs`
(the `ute-vnext-a1` node leg). The vitest population is **unchanged at 238** (15 migrated files, all
passing) and the bound `ci-security` vitest layer is **unchanged at 216** (14 suites / 14 files /
61 describes); no new test file was added, so the `test-catalog` population (785) and the p4t6 scan
surface are unchanged (the p4t6 scan test passes with no new booking).

| runner | before | after | note |
| --- | --- | --- | --- |
| `ute-vnext-a1` node leg | 206 (204 pass + 2 disclosed skips) | 206 (204 pass + 2 disclosed skips) | ADM-86 rewritten in place (stronger: literal delivery/refusal sets, three handovers, no tool port, seam-unwired fail-closed, 512-char cap) |
| migrated vitest population | 238 | 238 | E3 (`a3p4-pr4-production-entry-regression.test.ts`) updated in place: only the two root commands refuse; the delivery handover is pinned at the production port |
| bound `ci-security` layer | 216 | 216 | no file added or removed |
| `test-catalog` | 785 | 785 | no new file |
| p4t6 booking scan | pass | pass | no new scannable surface to book |

Distinct from the population: the **live** D2 driver gained a fourth judge (`d2:remote-delivery`),
PROVEN on two agreeing DEV-LIVE boots (`evidence/d-boot-feasibility/d2/README.md` "Judge 4"). That is
not a vitest population change — it is the live row — and it does not move any cell to PRODUCT-PROVEN.


Two disclosed follow-ups landed in the same round, both for cross-cut instruments rather than the
product: the D2 driver now declares its FULL case set (a subset record must name its arms, and the
driver has none to name), and `a6-pr1-lane-hygiene`'s package-wide import scan tolerates a temp file
that another suite removes mid-walk (the walk already did; the read now does) — the census measured
that race once in two captures, and the fix removes it without relaxing any assertion.

## Round 84 (Alpha.6 formal routing — the positive path)

The 20261122-2305 review (§4.3) found Alpha.6 in a one-sided state: the REFUSAL path was proven
(config gates, recorded refusal, live D3 measurement) while the FORMAL routing was only assembled in
tests. This round implements it through the ONE centre interface — and, as the pre-code determination
records (`ALPHA6-FORMAL-ROUTING.md`), **no `CORE_SEAM_BLOCKER` was needed**.

### What was actually missing (determined before coding)

1. **The routing axis.** None is lawful and none is needed: a routing decision EXECUTES nothing, so it
   has no locator/lane for the centre to judge; `ADM-99` had already measured what happens when one is
   driven anyway (`ADMISSION_TOOL_UNBOUND`, recorded on the FABRICATED fallback axis `fs.read`). The
   decision stays a projection of the durable control row through the ONE shared policy.
2. **The wake path.** `deliverReviewWake` resolved the live agent and wrote a hand-built message
   (`followup`/`steer`) — skipping the durable intent fact, the correlation token, the
   requirement-aware final-input verdict, the A56 machine attribution and the confirmation fact that
   round 83 built for `member.send`. A review wake is INPUT to the Officer's session, so it is now
   delivered by the SAME mechanism.
3. **The enablement config.** Two unconditional gates refused the opt-in on every row, so no
   configuration could ever be coherent. Enablement is now a coherence question with a typed answer.

### The change

- `packages/runtime/src/plugin/vnext/review-wake-delivery.mjs` (new) — the ONE governed wake
  delivery: durable `team-review-wake-routed` intent → `SessionInputPort.submitAttributedInput` →
  `team-review-wake-delivered` confirmation, in the row's own TeamDomain ledger, correlated by the
  wake token; a duplicate converges on the existing confirmation; an unknown/unbound recipient is a
  typed refusal BEFORE any write.
- `packages/runtime/src/plugin/vnext/agent-bindings.mjs` — `deliverReviewWake` delegates to it (the
  seam keeps its four non-empty-string validations and its signature gains optional
  `recipientInstanceId`/`requestId`/`requesterInstanceId`); a session that is not a bound Member child
  session is refused rather than treated as a recipient.
- `packages/runtime/src/plugin/vnext/centre-config.ts` — `alpha6EnablementRefusal` (coherent ⇒
  admitted; otherwise the FIRST missing piece with its own code) and the widened
  `centreConfigViolation`.
- `packages/runtime/src/plugin/vnext/root.ts` — the direct-root gate uses the same rule and records
  the piece code through the row's own point (reason kept under the 512-char settlement cap).
- `packages/runtime/alpha6/notifier.ts` + `packages/runtime/src/plugin/types.ts` — the routed reviewer
  and the durable leg ride the delivery seam instead of being re-derived by it.

### Arms

`ADM-141` (positive enablement; each piece refused AND recorded), `ADM-142` (officer route over the
shared policy; nothing executed, input frozen), `ADM-143` (intent + confirmation + machine attribution
+ ZERO tool executions), `ADM-144` (Officer's own `team_resolve_control` admitted on `team.control`
under ITS binding; unbound ⇒ `ADMISSION_NO_BINDING`), `ADM-146` (duplicate ⇒ ONE confirmation; unknown
recipient ⇒ typed refusal with zero facts), `a6-pr4-review-wake-glue` (real glue: one attributed inbox
input, facts read back), `a6-pr7-merged-wake-host` (three asks ⇒ ONE inbox input), `a6-root-wiring` (a
PRODUCTION root boots a coherent Alpha.6 row). The existing refusal arms were re-stated, not weakened:
`ADM-34/85/99/116/117/118` still prove denial + typed code + recorded fact + `REFUSED`/`not-started` +
zero wakes, and the D3 live driver still measures the row refusal.

### Level

**MECHANISM, proven over the real ports** (routing policy, centre admission, delivery port, production
root boot). The **LIVE** routed wake is NOT proven: the D3 world's blueprint is v4 with one worker
member and no Officer/approval case, and the mock model resolves no control, so that world can express
only the refusal side. No cell is upgraded to PRODUCT-PROVEN.

| runner | before | after | note |
| --- | --- | --- | --- |
| `ute-vnext-a1` node leg | 129 tests in `vnext-admission` | 134 (129 + 5 new arms) | +ADM-141/142/143/144/146 |
| migrated vitest population | 238 | 238 (unchanged count) | `a6-pr4` gained two arms in place; `a6-pr7`/`a6-root-wiring` adapted to the governed delivery (stronger: recipient identity is now real) |
| `test-catalog` | — | unchanged file population | no new test FILE; two arms added to an existing one |


## Round 85 (2026-11-23) — PTC four-part re-measurement: three hold, the WORKER OS profile is a CORE_SEAM_BLOCKER

**Task.** Round 75 refused `run_code` on a four-part missing proof (worker process, nested tool calls,
escalation path, Stop). Round 85 re-opened it as a SEPARATE mechanism (review `20261122-2305 §4.3`),
measured each part in order, and either implemented the governed path or narrowed the refusal to the
part(s) that fail. The finding, with file:line evidence, is
`dev/agent-workflow/evidence/ute-a1/PTC-FOUR-PART-FINDING.md` (written before any product edit).

**Measured status.**

| part | status | decisive evidence (pinned host) |
| --- | --- | --- |
| (a) worker process | **FAILS** | `core/tools/src/index.ts:948-951` resolves the PTC policy from `ctx.get('sandboxPolicy').resolve({session})`; `sandbox-policy/src/index.ts:164-169` returns only `{mode, session.header.cwd}`; `sandbox/src/index.ts:40-53` has no per-path rules; `ptc-runtime-node/src/index.ts:224` skips `confine` under `danger-full-access`. The declared `confined-subprocess` executor (the realm face) never runs this worker. |
| (b) nested calls | **HOLDS** | `ptc.ts:538-625` builds `${callId}:ptc:${n}` with `agent: exec.agent` and calls the registry scheduler; `core/tools/src/index.ts:1504-1508` dispatches `tools/pre-execute` on `scopeTarget(exec.agent)`, i.e. the same agent context where `installAdmissionPoint` listens. |
| (c) escalation | **HOLDS** | `escalation.ts:171-226` asks `ctx.approval.request` with `escalate sandbox to <mode>: …`; `user-approval/src/index.ts:270-285` runs the `approval/request` waterfall; `ptc-escalation-row.mjs:334-465` opens a ControlService durable request, awaits the decision, and mints/consumes exactly ONE one-shot grant (nothing on a non-allow). |
| (d) Stop | **HOLDS** | `ptc.ts:412-414` maps `exec.signal` → `runController`; `:553-554`/`:697-705` pass that signal to nested calls and the runtime; `ptc-runtime-node:153-201` terminates the child; `execution-facts.mjs` maps `signal.aborted` to `aborted`, settlement `CANCELLED`. |

**Decision.** Refuse; `CORE_SEAM_BLOCKER` on (a). The refusal text in `host-surface-refusal.mjs` /
`admission.ts` is narrowed to the worker's OS profile and names the needed seam: a per-execution
`SandboxExecutionPolicy` (per-path rules, not only `{mode, workspaceRoot}`) supplied by the governing
layer, or execution through the declared `confined-subprocess` executor. `run_code` stays refused
before the body with `ADMISSION_PTC_UNAVAILABLE`, fact `deny` on `process.exec`, settlement
`REFUSED`/`not-started`, zero worker spawn/confine.

**Arms / gates.** `ADM-87`/`ADM-88`/`ADM-76` were re-stated, not weakened, to the narrowed reason
(`WORKER process` + `per-execution policy seam`; the old `second execution authority` phrase is gone).
Vitest population stays 238; the node leg count is unchanged.

Gate outputs at the code commit (`ab7442`):

```
node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
  DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c4…
  tests 211 pass 209 fail 0 skipped 2
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  DSH-TEST-CATALOG tests=785 refused=0 findings=0 (collected 733 / excluded 14 / uncollected 38)
node scripts/ute-cut-closure.mjs --check
  UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
node scripts/ute-p0-assets.mjs --check
  UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
node scripts/docs-sync.mjs --check
  docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
node scripts/place-dist-glue.mjs
  place-dist-glue: done (30 placement(s))
node scripts/eb3-ci-required.mjs
  EB3-CI-REQUIRED pass workflows=10 findings=0
pnpm -r run typecheck
  clean (all packages)
node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
  EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
node --test (the census-runtime UTE G1 argv)
  89/89 pass, exit 0
```

The full `ci-pr-gate --full --census-captures 2` at `ab7442` returned pass=9 fail=1: the ONLY red was
`blueprint-fence`, because this round's 4 added test lines moved the one pre-existing v5 literal
(L4567 → L4571). The baseline was re-recorded in the open from the verifier's own report; the fence leg
then passed, and the final full run at the head carrying this section is pasted in the round-85
settlement comment. The census leg itself passed with 2 identical captures (identity set identical to
the published baseline).

**NOT proven.** No live governed `run_code` run, so no live nested-call/Stop arm; the durable facts do
not yet project `rootCallId`/`parentCallId` (product work, not a host seam); the worker's OS
enforcement was not measured on this kernel (the finding is about the WRONG policy, not about a broken
sandbox). No upstream patch was attempted.

---

## Round 87 (2026-11-23) — D4: the live routed review wake is BLOCKED, by measurement

**What changed.** A fourth live driver-class artefact,
`tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs`, written to the D3 template
(same harness, DEV-LIVE lease/grant, archive-before-start, host-selectable through
`tests/next-host/host-select.mjs`, own DSH_HOME under `tests/homes/`, ports 3194/3195) and run with
`--boots 2` against rc.2 (`639ed015397290b3745d163aafe02ffee4aa3f84`; host tree porcelain empty before
and after). It is a **probe, not `run-boot-d4.mjs`**: the judge a D4 acceptance driver would carry
cannot be satisfied by this tree, and a driver whose central case always reads REFUTED is not an
acceptance instrument. Evidence: `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md`.

**The world (the configuration the round asked for).** Authored **v5** `team.dboot.d4.v5` with
`reviewRouting {enabled: true, officerTemplateId: "officer", ordinaryToolApprovals.default: "officer",
whenOfficerUnavailable: "hold"}`, templates `leader`/`officer`/`worker`, a worker `write` lane whose
authored disposition is `ask`, row opt-in `alpha6ReviewRouting: true` + `centreStatePath` + an
ABSOLUTE `alpha6WakeIntentPath`, and the shipped `a5sf-governed-member` preset. The product's own
`centreConfigViolation` admits exactly this document and refuses both incoherent variants by name
(`plan/enablement-rule.json`, host-free).

**Live judges, two agreeing boots** (`agreeing=true differing=[]`):
`d4:enablement` **PROVEN** (coherent row admitted, host boots, TeamSession served, zero refusal
facts — the first live boot of a COHERENT Alpha.6 row), `d4:officer-up` **PROVEN**, `d4:officer-binding`
**PROVEN** (the Officer's own `read` admitted under ITS binding, settlement
`ADMITTED→RUNNING→COMPLETED`), `d4:refusal` **PROVEN**, `d4:routed-wake` **REFUTED**; overall
**BLOCKED**. Counters identical across boots: `askAppeared=true`,
`pendingRequestId=ctrl-1xxrzo21k29yc31rawhls0qn`, `wakeFacts=0`, `wakeIntentFiles=0`,
`reviewWakeHits=0`, `officerAllowFacts=1`.

**Why `d4:routed-wake` is REFUTED — the product's own answer.** The worker's authored `ask` lane
creates a real durable `leader-approval` row (`control-request-recorded`, `actionName: admission-ask`,
`toolName: write`) with **no `approvalCaseId`/`legOrdinal`/`reviewAuthority`**; the product's own
`createAlpha6RootRouter.route()` answers `null` for it with `memberListCalls: 0`; the world's durable
fact census holds zero `team-review-wake-routed`/`-delivered` facts, the wake-intent directory does not
exist, and a disk-wide scan for `[team-review-wake` finds nothing. The **Leader** receives the plain
C1 ask (`[team-control … waiting for Leader approval`) and its `allow` is durably recorded — the world
is coherent; the ROUTE is missing.

**Two Team-side seams are missing; NEITHER is a `CORE_SEAM_BLOCKER`** (no upstream patch, no private
API, no host change; host porcelain empty):

1. **No live producer of a case-bearing ordinary ask.** `route()` requires `approvalCaseId` +
   `legOrdinal` (`alpha6/root-router.ts:209`); the case-less branch wakes the Leader by design
   (`alpha6/notifier.ts:159-169`); the only live leg producer `requestApprovalLeg`
   (`control/service.ts:5607`) is called solely for `envelope-mutation` (`governance/service.ts:1016`),
   which `isDelegableOrdinaryToolAsk` excludes (`review-router/policy.ts:68`); both ordinary-ask
   producers are case-less (`src/plugin/vnext/admission-port.mjs:155-165`; `packages/tools/src/tools.ts:973-1000`);
   the Alpha.4 PA ask lane was deleted by the A1 cut (`1617d5839`), leaving `routeOperationApproval` /
   `createOperationApprovalFactsReader` pure/test-only or consumption-only (`root.ts:3268`).
   **Minimal lawful fix:** open the admission ask through the case-forming call with the operation
   identity Alpha.6 already requires (the "Alpha.6-aware ask lane" of the J06 comment,
   `root-router.ts:212-216`). No new axis.
2. **No consumer for an `ask`-disposition call even after an allow.** The centre refused the granted
   call verbatim: *"…has the disposition 'ask', but this admission plane has no approval consumer
   (`resolveAskClassCall` has no production caller); refusing rather than auto-approving"*
   (`member-io-policy/src/provider-capabilities.ts:315`; comment `:200-205` names **BL-30**;
   `ALPHA5-SANDBOX-BACKLOG.md:559` BL-30 READY, `:562` BL-33's consumption half blocked on it).

**Docs updated truthfully, no level moved.** `ute-a1/ALPHA6-FORMAL-ROUTING.md` gained a round-87
section; `ute-a1/CAPABILITY-MATRIX-C.md` C-alpha6 and `ute-a1/D-ACCEPTANCE-REPORT.md` C6/§6.5 carry the
measured result. **Level stays MECHANISM**; the live ROUTED wake remains UNPROVEN — now by measurement.
Duplicate-route (ONE wake) and machine-wake-vs-Sticky-Stop stay unreachable (in-process
`ADM-143`/`ADM-146` unchanged).

**NOT proven.** The live routed wake and everything downstream of it (duplicate route ⇒ ONE wake; a
human Sticky Stop not cleared by a machine wake; a routed decision taken *from* a case-bearing durable
row on a booted host). No leg was fabricated, no control route was added to the harness, no wake file
was written by the driver, no upstream patch was attempted, and `run-boot.mjs` / `run-boot-d2.mjs` /
`run-boot-d3.mjs` were NOT re-run this round (no product or test code changed; the probe is additive).

---

## Round 88 (BL-30, the ask consumer) — MEASURED, NOT WIRED; no level moved

**2026-11-23 · branch `vnext/a1-cut` · PR #822 (DRAFT) · evidence
`dev/agent-workflow/evidence/bl-30-ask-consumer/README.md`.**

The round's task was the FIRST of the round-87 D4 gaps: wire the `ask`-disposition approval consumer
(`resolveAskClassCall`, `member-io-policy/src/approval-takeover.ts:206`) so a granted `ask` executes.
**The wire-up is blocked by a product invariant, and the blocker was measured rather than argued, so the
round STOPPED instead of bending it** (the round's own rule 5).

**The measurement (two new arms, real `ControlService`, same admission-shaped scope, only the durable
row's coupling differs — `packages/runtime/test/a5sf-approval-takeover.test.ts`,
`describe('BL-30 · the admission ask is INLINE, and an inline allow is not a guard token')`):**

| durable row | `guardOperation(scope)` | `resolveAskClassCall` | consumption rows |
| --- | --- | --- | --- |
| `executionCoupling: 'guarded'` | allows, then `allow-consumed` | **ok** (one `ask → allow`) | **1** |
| `executionCoupling: 'inline'` (production) | **`no-request`** | **`APPROVAL_DENIED`** | **0** |

**The invariant** (B2 / plan §D.4 lane disjointness): an INLINE durable allow is the frozen invocation's
own continuation and is NEVER a guard token — `control/service.ts:4155-4165` states it, `:4289-4291`
enforces it (`continue` → `NO_REQUEST`); `admission-port.mjs:76-79` states the same law from the
producer's side. The only production ask producer hard-codes `executionCoupling: 'inline'`
(`admission-port.mjs:163`), which the round-87 live D4 row confirms
(`d4/runs/boot01/control-ask.json`). In addition, the one-shot grant that DOES authorize the call is
spent at the host tool guard (`admission-port.mjs:770-784`) BEFORE the body reaches the refusing Provider
plane (`provider-capabilities.ts:315`), so a Provider-level consumer would be a second consumption of one
approval (or a second authority over the same one-shot bit), and `team-services/**` holds no Control
reference, no TeamSession root, no compile tuple and no call identity.

**Deliberately NOT done:** no product source change, no coupling flip, no second approval authority, no
per-call registry/grant ledger, no change to `provider-capabilities.ts` behaviour, no widened timeout, no
weakened assertion, no upstream patch. Suite population for the touched file: 23 → **25** (both new arms
pass; no existing assertion edited).

**Level: unchanged.** `ask` still refuses at every Provider plane until an owner decides between the two
lawful routes named in the evidence README §3 (flip the ask to `guarded` and lose the Stop-cancels-the-
pending-ask law `ADM-57`; or give the OS plane a read port onto the centre's already-enforced per-call
decision). BL-30 stays open; BL-33's consumption half stays blocked on it; the round-87 `d4:routed-wake`
stays REFUTED and was not re-driven (no product byte changed — a boot could only re-measure the same
refusal).

**Not proven:** any configuration in which a granted `ask` executes; a live `ask → grant → execute` arm;
the routed Alpha.6 wake; the BL-33 consumption half; and routes (a)/(d) of the evidence README are
designs, not implementations.

---

## Round 90 (behaviour-preserving decomposition of `agent-bindings.mjs`) — NO level moved, no population moved

**2026-11-23 · branch `vnext/a1-cut` · PR #822 (DRAFT) · evidence
`dev/agent-workflow/evidence/ute-a1/round90/`.**

The round's task was reviewability, not capability: the A1 cut left the two entry files at 4,967
(`agent-bindings.mjs`) and 5,239 (`root.ts`) lines, and a reviewer cannot hold a 5,000-line closure in
view. Four cohesive spans of `agent-bindings.mjs` moved **verbatim** into sibling modules and are
imported back:

| moved span | new module | moved lines |
| --- | --- | --- |
| governed preset row module specifiers + declared row configs (SHAPE A) | `governed-preset-modules.mjs` | 127 |
| MCP capability witness (telemetry, F15 tool-surface readers, fiber retirement) | `mcp-witness-lane.mjs` | 158 |
| Root input delivery ports (shared real-input path + B6/TCM-M3/C1 callers) | `root-delivery.mjs` | 208 |
| Member stop lane (interrupt + PD-29 disarm, recursive drain, residency) | `stop-drain-lane.mjs` | 205 (3 chunks) |

`agent-bindings.mjs` **4,967 → 4,301** lines (4,302 before the one-line lint follow-up). The byte-identity receipt
(`round90/byte-identity.txt`) is a two-way substring test — each of the six original ranges is present in
its module AND absent from the rewritten glue (698 lines, all `True`). The exported surface is unchanged.

**Suite populations and digests are UNCHANGED, which is the whole proof.**

- `dispatch-tests --run --leg ute-vnext-a1`:
  `suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975`
  — identical before and after.
- bound vitest leg (`eb3-security-run --layer ci-integration --list-file
  tests/checks/eb3-ute-migrated-suites.txt`): `verdict=PASS suites=15 files=15 describes=76 passed=238
  failed=0` — identical before and after. **No test file, assertion, skip or timeout was edited.**
- catalog `785 / 38 uncollected / 14 excluded`, cut-closure and p0-assets lines identical to the round-89
  head; `place-dist-glue` 30 → **34** placements (all `(byte-identical)`); the p4t6 ledger gained ONE
  booking (`round90decomposition.json`, measured delta **1313 → 1317** — the four new scannable files,
  no arm relaxed).
- D drivers on rc.2, `--boots 1` each, before and after: `run-boot` **FAIL** (5 PASS / 1 FAIL
  `d:remote-creation`), `run-boot-d2` **PASS 4/4**, `run-boot-d3` **allProven 4/4** — identical verdicts.

**Not moved, with the reason.** `observeMcpOperationalWitness`, `deliverRootWorkCompletionNotification`
and `deliverReviewWake` read the row's `closing` primitive (`let closing`), which cannot be passed by
reference, so moving them would have forced a logic edit. `reconcileMcpSet` + the reconnect/cooldown
constants stay because `f15-mcp-live-loss.test.ts` §9.2 is a STATIC witness over `agent-bindings.mjs`
that pins the one mount call site and the literal constants; moving it would have required a test edit,
which the round forbids. That is the one span the round could not take, reported rather than worked
around.

**Not proven:** nothing new — no behaviour changed, so no level, matrix row or capability claim moves. The
moved modules have no separate unit test (they are exercised through the same glue suites; adding one
would be new surface, not preservation); `root.ts` was not decomposed, so its 5,239 lines remain; and the
`d:remote-creation` red on `run-boot` is untouched and still open.


---

## Round 91 (2026-11-23) — `d:remote-creation` red: the JUDGE was stale, not the product

**Branch `vnext/a1-cut` · PR #822 (DRAFT) · head `b67a3eb38` + this round's repair · evidence
`dev/agent-workflow/evidence/ute-a1/round91/`.** The round-90 live re-run recorded
`run-boot.mjs --boots 1` → `overall=FAIL`, `5 PASS / 1 FAIL`, `d:remote-creation` FAIL
(`round90/drivers-before.log:27`). This round reproduced it with the real driver, found the mechanism,
and repaired the instrument.

**Reproduction.** `node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2` on the
unmodified tree → `RESULT FAIL (2/2 boots; agreeing pair=true)`, both boots on port 3194; the case's own
record named exactly one failing clause:
`no-execution-without-admission: member.send ok=undefined code=undefined provider requests added=0`
(`round91/repro-run-boot.log`; pre-fix artefacts in
`d-boot-feasibility/archive/2026-11-23T09-54-52-433Z/`).

**Cause: a round-83 driver refactor left its judge behind.** `5c09cbd82` (round 83) reclassified
`member.send` as `work-delivery` and changed the driver's refusal sample from `{status, code, ok,
mockRequestsAdded}` to `{rootWork, rootLive, delivery, mockRequestsAdded}`, but the
`no-execution-without-admission` clause still read `execution.ok`/`execution.code`. Both are `undefined`
on the new shape, so `undefined === false` made the clause REFUTED unconditionally. Not a round-90
decomposition defect (`bde902939` touched no driver source; its before/after pair was identical), not a
product regression (the FAIL run and the PASS run carry the identical product answer: two ROOT commands
refused with `ADMISSION_REMOTE_UNAVAILABLE`, `member.send` served as a typed
`TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED` with **0** provider requests, `team.create` 200 + runtime root),
not a flake (2/2 identical boots before and after), and not a port/home collision (the **same port
3194** produced FAIL before and PASS after; the created Team's `defaultWorkspace` is the boot's own
home; homes are stamp-bumped on collision).

**Fix (instrument layer only).** `tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs#judgeRemoteCreation`
now judges the measured shape, keeping the clause id and adding conditions: both ROOT commands
`ok:false` + `ADMISSION_REMOTE_UNAVAILABLE`; delivery HTTP 200, served, `ok:false` with a typed non-empty
code that is not the execution refusal; `mockRequestsAdded === 0`. Strictly stronger than the old
single-command clause. No timeout, retry, skip, weakened assertion, compatibility shim or upstream patch.

**All four live drivers re-run on rc.2 at this head.** `run-boot` **PASS 6/6** (`d:remote-creation`
PASS on two agreeing boots), `run-boot-d2` **PASS 4/4** (2/2 agreeing), `run-boot-d3`
`evidence-complete=true allProven=true` **4/4** (2/2 agreeing), `probe-d4-routed-wake --boots 1`
**BLOCKED** with `d4:enablement`/`d4:officer-up`/`d4:officer-binding`/`d4:refusal` PASS and
`d4:routed-wake` **REFUTED** (the known open gap, unchanged). All driver hosts leased port 3194.

**Gates at this head.** catalog `785 / 38 uncollected / 14 excluded` (bounds 41/7) findings=0; cut-closure
`cut(0/148)` findings=0; p0-assets `37/180/69512` findings=0; docs-sync `193 docs / 0 findings`;
`place-dist-glue` 34 placements, every line byte-identical; eb3-ci-required 10/0; bound vitest
`verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0`; `dispatch-tests --run --leg
ute-vnext-a1` `tests 211 / pass 209 / fail 0 / skipped 2`, digest unchanged; UTE G1 argv 89/89. Full
`ci-pr-gate --full --census-captures 2` transcript: `round91/ci-pr-gate-full.log`.

**Not proven:** no product byte changed, so no capability or matrix row moves. The row remains a
scripted-mock, per-DSH_HOME-operator measurement; the judge's `delivery.ok:false` is specific to this
member-less probe; `d4:routed-wake` stays REFUTED; no row is PRODUCT-PROVEN.


## Round 92 (2026-11-24) — PTC / `run_code`: NOT SUPPORTED BY PRODUCT RULING (scope reduction, not deletion)

**Decision.** Owner ruling `docs/reviews/20261124-0151.txt` §PTC formally closes PTC / `run_code` for this
generation. The amendment instrument is `ADR-ptc-unsupported.md` (it CITES the frozen A0 contract; no frozen
file was edited). No upstream patch, no fork, CORE PATCH BUDGET = 0.

**What changed (product).**
- `host-surface-refusal.mjs` `ptc` row: `status: 'unsupported-by-product-ruling'` + a reason that NAMES the
  ruling (and still names the measured WORKER-process/per-execution-seam basis). The reason stays under the
  512-char settlement cap (longest path 511), so the refusal is RECORDED, not merely thrown.
- `admission.ts`: the `run_code` refusal keeps `ADMISSION_PTC_UNAVAILABLE`, and the invocation-authority fact
  gains a `status` FIELD (derived from the closed table, so fact and table cannot disagree).
  `execution-facts.mjs` carries the same field into the execution fact; the settlement `terminalReason`
  carries the token via the reason.
- `ptc-product-ruling.mjs` (new): the machine declaration — marker `NOT APPLICABLE — PRODUCT UNSUPPORTED`,
  status, the CLOSED list of the two not-applicable arms, the refusal controls, the amended positive ladder,
  and the reported-line emitter the marker arms assert.
- `cordis.patch.yml` governed-preset comment, `row-refusal-entry.ts`, `agent-bindings.mjs`, `host.ts` and
  `ptc-escalation-row.mjs`: the ruling recorded, and the KEPT shared escalation wiring documented.

**What did NOT change.** DSH host PTC (host smokes untouched), native `bash`, persistent bash, PTY, Control,
Stop, every lane/invariant, and every frozen A0 evidence file.

**Tests (the amendment, arm by arm).**
- `ADM-69` (B ladder rung 6 positive) — `NOT APPLICABLE — PRODUCT UNSUPPORTED`, emits
  `VNEXT-PTC-PRODUCT-UNSUPPORTED … status=unsupported-by-product-ruling … verdict=NOT_APPLICABLE`, asserted by
  `ADM-80` (the marker MUST have been reported; the not-applicable list is CLOSED — a new skipped positive
  cannot borrow the status; the refusal control `ADM-76` must still exist).
- `ADM-147` (the declared-world governed PTC positive the A1 header described as needing a world that
  declares the authorization) — same marker; it BUILDS that declared world (`perTool.run_code` allow +
  ready executor) and proves the DECLARATION cannot make PTC supported (typed refusal, zero body), then
  reports; asserted by `ADM-148`.
- `ADM-76` (out-of-lane) and `ADM-87` (the ONE centre) — the refusal controls, KEPT and extended with the
  `status` assertions on fact + execution + settlement.
- `ADM-79` (new, real composition, BOTH presentations): `tools.schemas(member)` contains no `run_code` and
  the per-member definition does not resolve it under the SHIPPED `native` presentation; in a
  PTC-presenting deployment the host RETAINS the transport and an accidental call through it is the typed
  refusal with zero worker spawn / zero `confine`, and both durable shapes carry the ruling status.

**Counts that moved.** `ute-vnext-a1`: `tests 211 → 215`, `pass 209 → 212`, `skipped 2 → 3` — four arms
ADDED and one skip ADDED (the second ruled marker, `ADM-147`); the pre-existing bash disclosure `ADM-68`
is unchanged and no other skip was widened. Suite/file set unchanged (7 files), so the leg set digest is
unchanged. Catalog/file counts are unchanged in KIND (no test FILE added or removed).

**Wiring audit.** Nothing was deleted: the refusal table row and the admission branch ARE the enforcement;
`ptc-escalation-row.mjs` (+ its `host.ts` install line and `agent-bindings.mjs` re-export) is a SHARED
`approval/request` escalation control (every sandbox-escalation prefix, host bash/pwsh included), and
deleting it would remove a second-authority control the ruling explicitly preserves. Full rationale:
`ADR-ptc-unsupported.md` §6.

**Not proven / not claimed.** No governed PTC positive is claimed. PTC is verified ONLY as
`run_code → typed refusal → zero worker execution → REFUSED/not-started`. The revisit path is an upstream
per-execution policy seam with the acceptance criteria in `ADR-ptc-unsupported.md` §7.

---

## ROUND 93 — the Alpha.6 CASE PRODUCER (R1), and the five arms that pin it

Owner ruling: review `20261124-0151` §1 (R1 = APPROVED). The ask→case conversion is implemented in
`packages/runtime/src/plugin/vnext/alpha6-ask-case.mjs` (the closed rule `ALPHA6-ORDINARY-CASE-Q`) and
consumed by the EXISTING ask port (`admission-port.mjs`, calling `ControlService.requestApprovalLeg`) —
**no new ask producer, no new UTE I/O axis, no new admission duty.**

**Arms added to `packages/runtime/test/vnext-admission.test.mjs` (the `ute-vnext-a1` leg).**

| arm | what it proves over the REAL ports |
| --- | --- |
| `ADM-149` | A QUALIFYING ask (declared `toolBindings` coordinate + canonicalizable call + Leader rung + the shared predicate) creates a REAL durable Alpha.6 **case**: `case-…`, `legOrdinal: 1`, `executionCoupling:'inline'`, `reviewPayload.authorityScope`, `operationToolDefinitionIdentity:'dsh.fs/write'`, `perEffectRequiredAuthorities:['leader']`, one pending request, zero decisions; aborting the wait is `ADMISSION_APPROVAL_WAIT_ABORTED` and leaves the leg pending. |
| `ADM-150` | The PRODUCT's own `createAlpha6RootRouter` selects the **Officer** for that durable row, and the round-84 governed delivery (`dispatchLatch` + the file wake-intent directory) writes the intent + confirmation and wakes the Officer's session; the leg stays pending. |
| `ADM-151` | A NON-qualifying ask (same world, tool NOT declared in `toolBindings`, ceiling `ask` on `read`) keeps the **plain** `leader-approval` path byte-identically: no case, no `reviewPayload`, no `approvalCaseId`, `ordinaryAsk: null`. |
| `ADM-152` | An ask that qualified up to the requesting Member's identity but whose `templateId` cannot be sourced is a **typed refusal** (`ADMISSION_ALPHA6_CASE_IDENTITY_INCOMPLETE`, naming `requesting-member-identity`) with **zero** durable rows written — never a defaulted identity. |
| `ADM-153` | The Officer's OWN operation is never routed to the Officer (self-review refusal kept). |

`ADM-54`'s static witness was updated (the port now constructs with `controlOf` + an optional lazy
`alpha6CaseOf`; the pin asserts exactly ONE construction and the unchanged `controlOf` first key), so the
glue-shape guarantee is kept rather than loosened.

**Counts that moved.** `ute-vnext-a1`: `tests 215 → 220`, `pass 212 → 217`, `skipped 3 → 3`
(no new skip; the five arms all RUN). File set unchanged (7 files) so the leg digest is unchanged
(`sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975`). Catalog KIND unchanged
(no test file added).

**Not proven / not claimed.** (1) `d4:routed-wake` stays **REFUTED** live, for a NEWLY measured reason
`G11` — a live v5 world cannot carry BOTH an ordinary `ask` and a trusted `ToolBinding`; see
`ALPHA6-FORMAL-ROUTING.md` §R1-D. (2) **R3 is untouched**: even after an allow, the provider still
refuses the `ask`-disposition call (`BL-30` / `IO_ASK_REQUIRES_APPROVAL`), so the grant→execute half is
still not reachable. The in-process arms prove the CASE and the ROUTE, not an executed body.

## Round 94 (R3 PoC + G11) — the granted `ask` now EXECUTES for `write`, at mechanism level

Owner ruling `20261124-0151` §2: **R2 REJECTED**, **R3 approved only with a small ADR + executable PoC
first**, **R4 stays the fail-closed interim**. This round delivers exactly that, and fixes G11.

**ADR:** `dev/agent-workflow/evidence/ute-a1/ADR-approved-ask-receipt.md` (the ApprovedAskReceipt: binding
fields, lifetime, mint/read points, scoping, non-forgeability, no cross-Member/call/async leak, rejected
alternatives, failure modes).

**G11 — DEFECT, fixed.** `intersectPathRuleSets`' ask-survival required coverage by the intersection of
the two allow sets, so a legal pure-ask lane (`{allow:[], ask:[p]}`, accepted by `validateLane`)
collapsed to an empty deny lane when intersected with a tool restriction. Correct law: an `ask`
survives iff neither side answers `deny` for that locator, and it stays `ask` (never promoted to
allow). `approvedOnce:false` was not the cause; the compiler never reads it. Two new arms in
`a5sf-member-policy.test.ts` pin the pure-ask + non-disjoint tool allow case (`{allow:[], ask:[p]}`,
`matchLocator` ask for the target, deny for a non-covered path) and the disjoint case (ask coverage
drops, target denied). Suite `19/19`.

**The PoC — eight arms, `ADM-154`…`ADM-161`.** Over the REAL confined `fs` Provider, REAL binder, REAL
`ControlService`, REAL admission port and REAL settlement store; only the host loop is a double (pinned
`pre-execute → guard → execute → result`). Positive: `ask` → inline durable `allow` → grant consumed →
receipt minted → Provider writes real bytes, settlement `COMPLETED`. Negatives all PASS: second effect
in the same body (`RECEIPT_REUSED`); cross-path (`RECEIPT_OPERATION_MISMATCH`); revoked after spend
(`RECEIPT_REVOKED`, zero bytes); replay after completion (scope gone, captured receipt `CLOSED`); deny
lane wins over a live unused receipt; cross-Member Provider inside the same body
(`RECEIPT_MEMBER_MISMATCH`); and phase honesty — a post-body Provider refusal settles
`FAILED`/`quiesced`/`failed`, never `REFUSED`/`not-started`.

**Counts that moved.** `ute-vnext-a1`: `tests 220 → 228`, `pass 217 → 225`, `skipped 3 → 3`. File set
unchanged (7 files) ⇒ leg digest unchanged
(`sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975`). Catalog unchanged
(`tests=785`, uncollected 38, excluded 14). New scannable file
`packages/runtime/member-io-policy/src/approved-ask-receipt.ts` is booked p4t6
(`1319 → 1320`, measured by the scanner).

**Not proven / not claimed.** (1) No live v5 boot was re-run: `d4:routed-wake` stays REFUTED and
`C-alpha6` stays MECHANISM (G11 is fixed, the boot is not). (2) Production wiring of the Provider
authority is absent — the real mount passes no third argument, so a product turn still fails closed at
`IO_ASK_REQUIRES_APPROVAL`. (3) Only `write`/`writeText` is covered; every other FS method, subprocess
and tool keeps R4. (4) The receipt binds `caseId:null` for an inline admission request, which is the
identity it actually has.

## Round 95 (2026-11-24) — R3 is WIRED INTO THE PRODUCTION MOUNT and PROVEN LIVE for `write`

The round-94 PoC proved the receipt mechanism but left the production mount passing no Provider
authority, so a booted product turn still failed closed. This round wires the REAL invocation binder
into the real mount for `write`/`writeText` only, and proves it on a booted rc.2 host.

**Production wiring (no invariant moved).** `agent-bindings.mjs:1771-1790` passes
`approvedAskAuthority: { binder: grantBinder }` to the member-realm mount **only when the row's Control
service is wired** (`grants !== undefined`); the realm row (`835,968`), `mount.ts` (`796,896,965`) and
`install.ts` (`104,513,880`) forward it to `createMemberFsGuard(policy, undefined, authority)` on the
member face and the binding-realm face. A row without Control keeps the byte-identical fail-closed
mount. `guard-observability.ts:280-305` now forwards the optional `FsGuardOperation` verbatim (the
wrapper had dropped `writeText`'s content, which made a governed realm refuse a valid receipt with
`RECEIPT_CONTENT_UNAVAILABLE`). No `guarded` coupling, no global callId map, no attribution-ALS reuse,
no second authority, no admission-duty expansion, no upstream patch.

**New regression arms.** `a5sf-service-install.test.ts` `R3 production wiring: the mount passes the
invocation binder` — authority ⇒ bytes written; no authority ⇒ `IO_ASK_RECEIPT_REFUSED` /
`RECEIPT_AUTHORITY_UNAVAILABLE`, ENOENT; outside scope ⇒ `RECEIPT_NOT_IN_SCOPE`, ENOENT — plus the
`observeGuard` operation-forwarding arm. File `20/20`.

**LIVE — `probe-d4-routed-wake.mjs --boots 2`** (real rc.2 host, DEV-LIVE, scripted model only; every
judge is the probe's own and none was weakened). Target inside the Member's own workspace (the host
sandbox root), so the measured effect is the lane/receipt, not a sandbox accident.

| judge | boot1 | boot2 |
| --- | --- | --- |
| `d4:ask-execute` | **PROVEN** — real ask → real Leader allow → one-shot consume → receipt verified → 27 bytes, `COMPLETED` | **PROVEN** — same bytes, same `sha256`, `COMPLETED` |
| `d4:ask-denied` | **PROVEN** — 0 bytes, `REFUSED`/`not-started` | **PROVEN** — 0 bytes, `REFUSED`/`not-started` |
| `d4:ask-stopped` | **PROVEN** — Stop via public `session/cancel`, 0 bytes, `REFUSED`/`not-started` | **PROVEN** — same |
| `d4:enablement` / `d4:officer-up` / `d4:officer-binding` / `d4:refusal` | PROVEN | PROVEN |
| `d4:routed-wake` | **REFUTED (unchanged)** — the ordinary ask carries no approval CASE | **REFUTED (unchanged)** |

Two-boot agreement: `agreeing=true`, `differing=[]`; `askExecuteBytes 27/27`,
`askExecuteSha256` identical, `askExecuteSettlement COMPLETED/COMPLETED`, deny/Stop `REFUSED` both
boots.

**Counts that moved.** `ute-vnext-a1`: unchanged `tests 228 / pass 225 / fail 0 / skipped 3`; leg
digest unchanged `sha256:edd4f1c4…c8a975` (7 files). Catalog unchanged (`tests=785`, uncollected 38,
excluded 14, digest `sha256:da8a452d…5f5ed32`). Bound vitest: `ci-security 218 → 222` (the four new
arms), `ci-integration 238` unchanged. UTE G1 argv `89/89`. No new scannable file ⇒ no p4t6 delta.

**Not proven / not claimed.** (1) `C-alpha6` stays MECHANISM and `d4:routed-wake` stays REFUTED — R3 is
not routing evidence. (2) No row is PRODUCT-PROVEN: DEV-LIVE is a record, not a gate. (3) Only
`write`/`writeText` is covered; `editText`/`patchText`/`deleteFile`/`moveFile`, subprocess and every
other tool keep R4 (`IO_ASK_REQUIRES_APPROVAL`). (4) The receipt binds `caseId:null` for an inline
admission request. (5) The live run uses the scripted model; no real-model interleaving was measured.


## Round 96 (2026-11-24) — the R3 receipt extended to EVERY FS mutation; subprocess deliberately untouched

Owner ruling: extend R3 **method by method, each with its own proof**, and do NOT assume an
OS-sandbox approval path inherits the FS proof. Round 96 extends the ONE receipt to `editText`,
`patchText`, `deleteFile` and `moveFile` and states the subprocess/PTY face as the next step.

**One receipt, five operation kinds** (`a5sf-approved-ask-receipt/2`). The operation is now a
discriminated union; the verifier requires an EXACT method↔kind match
(`RECEIPT_OPERATION_MISMATCH`) BEFORE any binding check, then binds:

| tool → Provider method | kind | corridor | fingerprint is a `sha256` of | cannot say |
| --- | --- | --- | --- | --- |
| `write` → `writeText` | `fs-write` | target | the exact content string | nothing about the file's prior content |
| `edit` → `editText` | `fs-edit` | target | the requested `(oldString,newString,replaceAll)` transformation (+ `editSha256` of the triple) | not the prior or resulting bytes — the Provider's literal-match/version guard decides those, after the receipt |
| `patch_text` → `patchText` | `fs-patch` | target | the exact `PatchHunk[]` payload (canonical JSON) | not prior/resulting bytes, not that the hunks apply |
| `delete_file` → `deleteFile` | `fs-delete` | target | nothing but the path (`bytesReadBack:false` is recorded) | nothing about the deleted bytes — none are read back, by design |
| `move_file` → `moveFile` | `fs-move` | **both** paths | source AND destination, authored and canonical | (a→b) can never authorize (a→c) |

**Provider.** `moveFile` is ONE guard over the path PAIR: deny on either path wins before any receipt
consult, then ONE receipt verification covers both paths, then the native read-before-mutate rule
runs for the source and for an existing destination. `editText` forwards the literal triple,
`patchText` the hunk payload, `deleteFile` the path only. The centre's `prepareApprovedFsOperation`
prepares the five declared shapes: a name outside the table yields NO receipt (R4), a recognised but
malformed call is refused at admission (`IO_ASK_RECEIPT_UNPREPARABLE`), never forwarded.

**Arms — `ADM-162`…`ADM-173`** (`packages/runtime/test/vnext-admission.test.mjs`), over the REAL
confined Provider on the PINNED hosts (`editText` on rc.2; `patchText`/`deleteFile`/`moveFile` on
rc.5 through the same host selector the rc.5 lane uses), REAL binder, REAL durable `ControlService`,
REAL settlement store; only the host loop is a double.

| arm | what it measures | result |
| --- | --- | --- |
| `ADM-162` edit positive | ask → allow → receipt verified for THAT edit → real Provider writes `gamma beta\n`, `COMPLETED` | PASS |
| `ADM-163` edit content binding | receipt for edit X, body applies Y ⇒ `RECEIPT_CONTENT_MISMATCH`, 0 bytes, `FAILED` at the body phase | PASS |
| `ADM-164` cross-operation | a `writeText` receipt on `editText` ⇒ `RECEIPT_OPERATION_MISMATCH` | PASS |
| `ADM-165` lifecycle | revoked-after-consumption ⇒ `RECEIPT_REVOKED`; one consumed grant authorizes exactly one effect ⇒ `RECEIPT_REUSED` | PASS |
| `ADM-166` delete positive (rc.5) | ask → allow → receipt → file REMOVED (absence verified), `COMPLETED` | PASS |
| `ADM-167` delete negatives | another path ⇒ `OPERATION_MISMATCH` (both files intact); delete receipt on `writeText` ⇒ `OPERATION_MISMATCH` | PASS |
| `ADM-168` move positive (rc.5) | ask → allow → receipt bound to BOTH paths → source gone, destination holds the exact bytes, `COMPLETED` | PASS |
| `ADM-169` move cross-path | receipt (a→b) used for (a→c), with c inside the live ask class ⇒ `OPERATION_MISMATCH`, a intact, c absent, `FAILED` | PASS |
| `ADM-170` deny wins (move) | explicit deny on the destination refuses BEFORE any receipt consult, even with a live unused receipt ⇒ `IO_WRITE_DENIED`, nothing moved | PASS |
| `ADM-171` patch positive (rc.5) | ask → allow → receipt for the hunk payload → `one\nTWO\n`, `COMPLETED` | PASS |
| `ADM-172` patch content binding | receipt for payload X, body applies Y ⇒ `RECEIPT_CONTENT_MISMATCH`, byte-identical file, `FAILED` | PASS |
| `ADM-173` declared-shape honesty | a NON-mutation approval (`read`) mints NO receipt ⇒ a write in its body is `RECEIPT_NOT_IN_SCOPE`, 0 bytes | PASS |

**LIVE — `probe-d4-routed-wake.mjs --boots 2`** (real rc.2 host, DEV-LIVE, scripted model only; every
existing judge is unchanged and none was weakened). The probe now performs a SECOND real mutation: a
second `write` from the same worker, on a different path with different bytes, raising its OWN
durable Control request, approved through the real control path, judged by `d4:ask-execute-2`.

| judge | boot1 | boot2 |
| --- | --- | --- |
| `d4:ask-execute` | **PROVEN** — 27 bytes, `sha256:ced10112…`, `COMPLETED` | **PROVEN** — identical |
| `d4:ask-execute-2` | **PROVEN** — NEW request `ctrl-1u9ufbv1rss8va1kc1szx1d5`, real allow, 29 bytes, `sha256:2d71ffdd…`, first file byte-identical, digests differ, `COMPLETED` | **PROVEN** — identical |
| `d4:ask-denied` / `d4:ask-stopped` | **PROVEN** — 0 bytes, `REFUSED`/`not-started` | **PROVEN** — identical |
| `d4:enablement` / `d4:officer-up` / `d4:officer-binding` / `d4:refusal` | PROVEN | PROVEN |
| `d4:routed-wake` | **REFUTED (unchanged)**, same 8 failing clauses: the ordinary ask carries no approval CASE | **REFUTED (unchanged)** |

Two-boot agreement `agreeing=true differing=[]`; `askExecuteBytes 27/27`, `askExecute2Bytes 29/29`,
both settlements `COMPLETED/COMPLETED`. The probe's own ledger positive control was tightened rather
than relaxed: it now requires the durable reader to see exactly the control requests the world
OBSERVED (2 requests / 2 decisions), so a reader that misses one still fails.

**Counts that moved.** `ute-vnext-a1`: `tests 228 → 240`, `pass 225 → 237`, `skipped 3 → 3`, file set
unchanged (7 files) ⇒ leg digest unchanged `sha256:edd4f1c4…c8a975`. Catalog unchanged (`tests=785`,
uncollected 38, excluded 14, digest `sha256:da8a452d…5f5ed32`). Bound vitest unchanged
(`ci-security 222`, `ci-integration 238`) — this round adds node:test arms only. UTE G1 argv `89/89`.
`ute-p0-assets` unchanged (`modules=37 files=180 lines=69512`) ⇒ no new scannable file, no p4t6 delta.

**Not proven / not claimed.** (1) The **subprocess/PTY face has NO receipt** — its authority is the
`SandboxExecutionPolicy`, not a file lane, and an OS-sandbox approval is not assumed to inherit this
proof; it keeps R4 and is the named next step. (2) rc.5's real multi-file `apply_patch` stays
UNBOUND (R4): one receipt binds ONE operation, and admitting a multi-file patch would either
duplicate upstream's parser or let one approval authorize N effects. (3) `patch_text`/`delete_file`/
`move_file` are DECLARED argument shapes with no shipped tool this round: the arms drive the real
admission port, Provider, binder, Control and settlement, but no preset mounts those names, so no
model can reach them live. (4) No row is PRODUCT-PROVEN — DEV-LIVE is a record, not a gate.
(5) `d4:routed-wake` stays REFUTED; a receipt is never routing evidence.

## Round 97 (2026-11-24) — `d4:routed-wake` is PROVEN LIVE; the D4 driver gains seven judges

Round 97 is measurement-only: **no production code changed**. The D4 driver
(`tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs`) now measures the Alpha.6
routed wake as seven named judges instead of one monolithic pair, and its world satisfies
`ALPHA6-ORDINARY-CASE-Q` in one coherent row (declared `dsh.fs/write` binding with
`authorization:'ask'`, the pure-ask lane kept by the round-94 algebra, `reviewRouting.enabled`).

The pre-existing eight judges are byte-identical and still PROVEN; the two negative live arms
(deny / Stop-while-pending) are unchanged. New judges, each with its own `verdict-*.json` and clause
detail in `runs/boot0{1,2}/routed-judges.json`:

| judge | clauses | what changed on disk |
| --- | --- | --- |
| `d4:case-created` | 9 | the durable row now carries `approvalCaseId` + `legOrdinal` + frozen operation/blueprint identity |
| `d4:router-officer` | 4 | the product router selects the Officer; the self-ask control routes to the Leader |
| `d4:wake-delivered` | 6 | intent + correlated confirmation + `plugin:dsh-agent-team` attribution + 0 executions |
| `d4:officer-decides` | 5 | the Officer's own resolve is admitted under its own binding and settles the case |
| `d4:ask-executes-after-review` | 6 | decision precedes settlement; approved bytes land |
| `d4:duplicate-route` | 5 | leg 2 routed by both real call sites ⇒ one intent / one confirmation / one input |
| `d4:sticky-stop` | 5 | a machine wake does not clear a human Stop; only a human claim resumes |
| **`d4:routed-wake`** | conjunction | **PROVEN** |

**Live evidence (two agreeing boots, DEV-LIVE, world `u5a5sfdev1`, grant `devlive-fs-search-1`).**
The three live mutations wrote `27` / `29` / `29` bytes (`sha256:ced10112…` / `2d71ffdd…` /
`2b28991b…`), all `COMPLETED`. `managementExecutions=0`. Sticky marker `stopped-20765e07.json` written by
a real `session/cancel`, survived the machine attempt with 0 wake inputs, cleared only by a human
prompt. Two-boot agreement `agreeing=true differing=[]`.

**Measurement bug fixed in the driver (not in the product).** The second ask was waited for on the
`/__p6t6/state` PENDING projection; the Officer can settle a leg inside one 300 ms poll, so the ask was
missed although the durable row and its decision existed. The wait now reads the durable ledger
(`control-request-recorded`), which cannot be missed. The census control was tightened accordingly
(it now expects exactly the asks this world observed: 3 requests / 3 decisions).

**Counts.** No test file was added or removed, so the `ute-vnext-a1` leg and catalog counts are
unchanged from round 96; the probe is an existing scannable-surface file, so `ute-p0-assets` has no new
delta. Gate evidence for this round is pasted in the settlement comment.

**Not proven / not claimed.** (1) The level is **DEV-LIVE**, not PRODUCT-PROVEN: no bound executable
gate exercises this row, and `V@B=yes` requires one. (2) Only `write`/`writeText` carry the live R3
receipt; subprocess/PTY and `apply_patch` remain R4. (3) The duplicate-route attempt itself leaves no
durable fact; the judge proves convergence (one wake) and records the two product call sites. (4) The
scripted model is the only double.

## Round 98 (2026-11-24) — the two older owner rulings implemented: realmless Option B + the Shape-B search negative control

**Owner ruling `docs/reviews/20261124-0151.txt` §4. No level moved; no population deleted; no assertion
weakened.** This round implements the two rulings that had been carried as open decisions and supplies
the negative control the search ruling explicitly required.

### Realmless admission = OPTION B, on the MOUNT RESULT (not the declaration)

- **Bug closed (placement, not policy):** the round-35 `MEMBER_CENTRE_UNWIRED` check ran BEFORE the mount
  attempt and only asked whether the row DECLARED a realm source. A governed row that declared one but
  whose provider compiled no realm for this template (`compiledFor → undefined`; a v4 template outside
  `memberIoCeilings`) slipped past it and ran with no centre. `memberAdmissionGate`
  (`packages/runtime/src/plugin/vnext/centre-config.ts`) now runs AFTER `mountMemberA5sfRealm` on
  `a5sfMountedRealm`, before `installMemberExecution`, the preset mount, the deny lane and every tool
  body. The typed code stays `MEMBER_CENTRE_UNWIRED` (justified in `OWNER-DECISIONS.md`: the ruling
  allowed `ADMISSION_PROVIDER_UNCONFINED`, but the string is not in a closed refusal table and renaming
  would buy wording, not enforcement).
- **The ungoverned path is reported, not invented away:** a row without `centreStatePath` keeps DSH's own
  permission model and the live bindings answer
  `admissionModeOf(sessionId) → { mode: 'ungoverned', uteProtected: false }`, with one
  `UTE-GOVERNANCE ungoverned` observation. It is never reported as UTE-protected.
- **Arms:** `ADM-44` (pure rule) + `ADM-44b` in `packages/runtime/test/vnext-admission.test.mjs`:
  governed+unconfined ⇒ typed refusal, zero files under the centre state dir; governed+realm ⇒
  `{mode:'governed', uteProtected:true}`; ungoverned ⇒ allowed and reported ungoverned; source-placement
  pin that the gate reads the MOUNT RESULT and runs before the preset/tool surface.

### Search face = Shape B declared; the parent-allow / child-deny recursive control is GREEN

`SLICE-39` (`packages/runtime/test/vnext-fs-slice.test.mjs`) is the required control over the REAL search
tool paths (`@deepseek-ai/dsh-tool-fs-search` + the real confined P1-07 provider):

1. **POSITIVE CONTROL:** parent allowed, NO child deny — `grep` returns the protected child's token
   (`secret.txt`), proving the child is reachable without the deny.
2. **NEGATIVE:** same parent allowed, child DENIED — `grep` returns an error with **no token and not even
   the child path**; the error is the confined launch refusal. The centre's fact is `decision=allow` for
   the ROOT (Shape B judges the root) and the execution fact is `failed`; the protected file is
   unchanged.

**Why it passes (and why that is not root-only checking):** `grep`/`glob` spawn the packaged ripgrep
through the Member realm's confined `subprocess` face; that face compiles the effective lane once with
`compileExecutionProfile`. Landlock is additive, so a deny nested inside an allowed subtree is
`PATH_NESTED_DENY_UNEXPRESSIBLE` and `createConfinedSubprocessClass` remembers the refusal — every spawn
from that realm is refused before a process exists. The dangerous scope is **FORBIDDEN wholesale**, not
filtered, and this is a stronger answer than "forbid only this search root".

**Limits (stated, not softened):** Shape B is the declared support level and is **NOT full dynamic
permission governance** — a durable Overlay deny aimed at ordinary file reads does not deny `grep`/`glob`
(`overlayOutcome=no-opinion`). The nested-deny answer is a refusal of the whole confined process face for
that realm (a shell on the same realm is refused too), not per-file carving; Shape A (a subtree search
face in the closed vocabulary) remains the only shape that can express a nested deny precisely.

**Not proven:** a boot-level AgentSetup arm for the realmless refusal (in-process rule + source placement
only); any PRODUCT-PROVEN status (no bound executable gate exercises these rows; the level is MECHANISM).

## Round 99 (2026-11-24) — the R3 receipt reaches the PROCESS face: MECHANISM proven, the LIVE process leg blocked by a named assembly gap

Owner ruling: extend `ApprovedAskReceipt` to the process face (persistent `bash` / governed shell,
disposition `ask`) as the operation kind `process-exec`. Nothing was relaxed: no new authority, no lane
promotion, no widened assertion, no widened timeout.

**What the receipt binds on this face.** `toolName`, the COMPILED `executionBoundary`,
`implementationOrigin`, the composition's fixed shell class (`program`/`programs`), the exact
`commandSha256` (or `null` when the call carried no command), and the authored `cwd` as CONTEXT only.
The fingerprint is a `sha256` over exactly those fields.

**Where it is verified (before any process exists).** `team-services/src/subprocess.ts`
(`createConfinedSubprocessClass`'s spawn admission, `shellInvocation` branch) and
`team-services/src/terminal-pty.ts` (`createGovernedPtyTerminalFace.spawn`, before `raw.spawn`).
`deny` is decided first; an ask receipt that does not cover THIS spawn refuses with
`SUBPROCESS_PROCESS_RECEIPT_REFUSED` / `PTY_PROCESS_RECEIPT_REFUSED`, and the provider is never called.

**What is proven (MECHANISM, real parts).** `ADM-174` positive chain (ask → inline allow → consumed
grant → receipt → spawn → real bytes → `COMPLETED`, ONE provider call); `ADM-175` cross-execution /
cross-face / reuse; `ADM-176` no widening (out-of-lane write refused by the OS, exit≠0, no file; the
request's `allowPaths` deep-equal the lane-compiled profile); `ADM-177` no escalation
(`danger-full-access` still clamps to at most `workspace-write`, a pure-ask lane stays `read-only`);
`ADM-178` deny wins before any receipt and revocation refuses, both with ZERO provider calls;
`ADM-179` phase honesty (a command different from the approved one refuses pre-spawn with
`RECEIPT_COMMAND_MISMATCH`; a post-spawn kernel denial settles by its real phase). Full
`vnext-admission.test.mjs`: exit 0, 162 pass, 0 fail.

**What is NOT proven, and why (LIVE).** `d4:ask-execute-process` is **REFUTED**: on two D4 boots the ask
chain is REAL (durable Control request → Alpha.6 case → Officer allow → grant consumed) and then the
persistent `bash` tool fails at ITS OWN backend lookup with
`no PTY backend registered for "a5sf-governed-shell"` — before the governed PTY face's `spawn`, i.e.
before the receipt verifier. Zero bytes, no process, settlement `FAILED` (fail-closed). Two world-shape
fixes were measured and recorded as failures, not worked around: `a5sfNativeToolModules: []` breaks
Member activation; a ceiling that asks inside an allow is not expressible and the Member never
activates. The FS live arms are unaffected and remain PROVEN.

**Final two-boot evidence (`--boots 2`, booted rc.2 `639ed015…`).** `allBooted=true`,
`evidence-complete=true`, agreeing pair with `differing=[]`. **Thirteen named judges PROVEN on both
boots** (`officer-up`, `officer-binding`, `ask-execute`, `ask-execute-2`, `case-created`,
`router-officer`, `wake-delivered`, `officer-decides`, `ask-executes-after-review`, `duplicate-route`,
`sticky-stop`, `routed-wake`, `refusal`, `enablement`, `ask-denied`, `ask-stopped`), and exactly ONE
REFUTED — the process arm, with the three clauses that follow from the named backend gap. Counters on
both boots: `askExecuteBytes=27` / `COMPLETED`; `askExecuteProcessInLaneBytes=null`,
`askExecuteProcessOutLaneExists=false`, `askExecuteProcessSettlement=FAILED`; `askDeniedBytes=null`
/`REFUSED`; `askStoppedBytes=null`/`REFUSED`.

**Two driver MEASUREMENT fixes were needed to make that evidence deterministic, and both are
disclosed as such (no assertion changed):**
1. leg 1's ask is now discovered on the DURABLE ledger as well as the pending projection. Measured: a
   boot where the ask was already decided before the projection was read; the judge then reported "no
   request raised" while the write really executed (27 bytes) — the same fix round 97 applied to the
   second ask.
2. the routed CASE row is snapshotted the moment its id is known (a disk read, no HTTP), before any
   reviewer can decide it. Measured: reading it after the ask-appearance HTTP roundtrip let the Officer
   settle first, so the round-97 clause "the case has no decision yet" failed on a correct product.
The two-boot agreement table also no longer compares the freshly minted `ctrl-…` request id (volatile
by construction); it compares the stable facts about the same execution (bytes/sha/out-of-lane/settlement).

**Levels.** No row moves to PRODUCT-PROVEN. FS: unchanged. Process: MECHANISM only. The live process
gap is the next owner-ruled step and is stated verbatim in `ADR-approved-ask-receipt.md`
§"LIVE status of the process face".

---

## Round 101 (2026-11-24) — the ask-under-allow reds: ONE product defect, TWO stale oracles, ONE stale pin

Branch `vnext/a1-cut` · PR #822 (DRAFT) · evidence `dev/agent-workflow/evidence/ute-a1/round101/`.
The D4 manifest fix (round 100) unmasked a pre-existing red on the hosted `tinf-instruments` leg
(`803 tests / 788 pass / 9 fail`): the ask-under-allow arms plus the `DP*` / `PD29-*` aggregates.
Each arm was adjudicated against the owner ruling `docs/reviews/20261124-0151.txt` §2 (R3) and the
round-94 G11 law, not by reading the failure message alone.

| arm | oracle | product | verdict | change |
| --- | --- | --- | --- | --- |
| `read-binding-subtree-ask-only` | `ask/deny/deny` (EX-3) | `ask/ask/deny` | **oracle stale** (pre-G11 collapse) | case → `ask/ask/ask` AGREE, cited to G11 + R3; the independent oracle's `intersectDeclaredLanes` now keeps an ask iff **neither** lane answers `deny`, matching the shipped `intersectPathRuleSets`; EX-3 rewritten to the surviving drop reason (a real deny on either side). |
| `write-binding-subtree-ask-under-allow` | `ask/ask/ask` | `ask/deny/ask` | **product wrong (observability)** | `fs.ts` correctly refuses the ask on the R3 receipt path (`IO_ASK_RECEIPT_REFUSED`); `guard-observability.ts#laneOfRefusal` mislabelled that refusal `deny`, erasing the lane. It now maps `IO_ASK_RECEIPT_REFUSED` → `ask`. No lane was promoted to allow and no declared deny was lost. |
| `write-binding-subtree-allow-symlink-into-ask` | `ask/ask/ask` | `ask/deny/ask` | **product wrong, same mapping** | symlink resolution was verified INTACT (authored decision → `realpath` → precedence re-applied on the resolved identity → receipt verifier); only the fact's lane was mislabelled. Zero writes / unchanged disk / code-equals-fact all still asserted. |
| `write-member-subtree-ask-under-allow` | `ask/ask/ask` | `ask/deny/ask` | **product wrong, same mapping** (member realm) | same fix. |
| `DP1` / `DP-SUM` / `DP-REFUSE` | reviewed triples / table / one-`ask`-fact rule | dependent on the four arms; DP-REFUSE also demanded the R4 code on every face | **dependent aggregates** | DP-REFUSE now pins the code PER FACE: read ⇒ `IO_ASK_REQUIRES_APPROVAL` (R4), write ⇒ `IO_ASK_RECEIPT_REFUSED` (R3); every other clause (ONE fact, zero bytes, zero writes, unchanged disk, AGREE) is unchanged. The case space grew 42 → 45. |
| `PD29-STOP-SEQUENCE` / `PD29-MUTATION` | the stop facts read from `agent-bindings.mjs` | no `interrupt`/`disarmStoppedGoal` there | **STALE PIN — not a Stop regression** | round 90 moved the lane VERBATIM into `stop-drain-lane.mjs` (`createStopDrainLane`, constructed once by the glue); the sequence `cancel(hook) → disarm → durable CAS pause` is intact. The pin reads the owning module; new `PD29-WIRING` proves the glue mounts it; `PD29-PIN` also proves the module is new at the base commit; `PD29-MUTATION` mutates the owning file. |

**Not a weakening.** The new expectation is strictly more permissive ONLY for the legal pure-ask case
the ruling requires: an ask at a location BOTH lanes permit is preserved as `ask` instead of collapsing
to `deny`. It grants nothing (`ask` still requires approval and the guard still refuses without a
receipt) and every other locator stays denied. Three controls keep what the old expectation protected:
`read-binding-subtree-pure-ask-lane` (G11's `{allow:[], ask:[p]}` survives as `ask`),
`read-binding-subtree-pure-ask-lane-outside` (the same lane still DENIES a locator it does not cover),
and `read-binding-subtree-ask-dropped-by-ceiling-deny` (a real deny on either side still drops the ask).

**Counts that moved.** `tinf-instruments`: `tests 803 → 807`, `pass 788 → 801`, `fail 9 → 0`,
`skipped 6 → 6` (four new tests: three case-space controls + `PD29-WIRING`; no arm skipped). Catalog
unchanged (`tests=785`, uncollected 38, excluded 14; no test file added). `ute-vnext-a1`: 248 / 245 /
0 / 3, leg digest unchanged. `dev/agent-workflow/evidence/ute-a1/round101/` carries the gate logs.

**Levels.** No level moves: no capability was added or removed. FS ask-under-allow remains at its
existing level; the product change only makes the OBSERVED LANE honest after R3 made the write-face
refusal code richer. The R3 receipt contract, the pure-ask law and the G11 fix are unchanged.

---

## Round 102 (2026-11-24) — the D4 acceptance is measured on the TARGET host (rc.5)

Branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · measured at
`10d8a67aeb7e189011faf2c131a73aa33b76fac3` · evidence `dev/agent-workflow/evidence/ute-a1/round102/`.
The single current verdict table lives in `D-ACCEPTANCE-REPORT.md` (first section); this section is
the suite-status delta.

All prior D4 evidence was rc.2. This round makes `probe-d4-routed-wake.mjs` host-selectable the same
way the three D drivers already are, and runs it on **0.2.2-rc.5** with `--boots 2`:

* **The porting bug was real and one line**: the probe mounted the governed realm's native
  `tool-fs` from the literal `tests/deepseek-harness-test-use/…` path. rc.5's `tool-fs` injects
  `workingDirectory` and rc.2's does not (rc.2 `…/tool-fs/lib/index.js:1176-1180` vs rc.5
  `…/index.js:2003-2008`), so under `TEAM_TEST_HOST=next` it graded an rc.5 Host with an rc.2
  module. The path now comes from the SELECTED tree. Nothing else probe-side was host-specific:
  ports/home suffix/child loader/pin all already follow the selector.
* **Result**: 16 of the 17 judges **PROVEN on rc.5** with counters and bytes identical to rc.2
  (`askExecuteBytes=27`/`sha256:ced10112…`, `askExecute2Bytes=29`/`sha256:2d71ffdd…`, 8 wake facts,
  4 routed / 4 delivered, 0 management executions, 0 wake-intent files, deny/Stop zero bytes and
  `REFUSED`), `runRecordsValid=true`, world ids `…-next`, port `13000`. The two per-host
  `agreement.txt` files are **byte-identical**.
* **One REFUTED on both hosts, for a product reason**: `d4:ask-execute-process` —
  `Error: no PTY backend registered for "a5sf-governed-shell"` (host:
  `packages/terminal/terminal/src/index.ts:140`; product: the governed PTY face is created only with
  a PTY terminal spec, `packages/runtime/team-services/src/install.ts:609-619`, and the v5 per-tool
  `bash` binding realm carries none). Zero bytes, settlement `FAILED`, fail-closed. Owner decision.
* **One measurement oracle made deterministic** (disclosed): `d4:case-created`'s
  `case-has-no-decision-yet` read the ledger AFTER the capture and so measured the Officer's speed —
  boot 2 at `5952c84` had the decision 176 ms after creation, faster than the probe's 300 ms poll,
  and REFUTED a correct product. It is now `captured-case-precedes-any-decision`: the captured row
  is the `control-request-recorded` fact and every decision has a strictly later ledger sequence.
  No wake/byte/settlement clause changed.
* **P0-2 is classified OPEN, not closed**: `pre-dispatch-abort.mjs` is not production-wired (the
  host's agent loop owns `tools.execute`). Classified **OPEN TARGET-HOST ACCEPTANCE BLOCKER**; it
  closes with a public batch-completion observation seam, or an owner ruling on the lawful
  "no settlement" boundary for a call that never entered admission / started a body.

**Levels**: no row moves. C-alpha6 and the R3 `write` receipt remain **DEV-LIVE** (now on both
hosts). The governed process face remains **NOT-PRODUCT-PROVEN**. No row is PRODUCT-PROVEN.

## Round 105 (2026-11-24) — the candidate acceptance gate: one executable layer, one verdict, and the rc.5 `d2` red it exposed

Branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · measured at
`65481f2f6eb0bd684e83cfa1e43e3c5268eb9de9` · evidence
`dev/agent-workflow/evidence/candidate-acceptance-gate/<stamp>/` + `dev/agent-workflow/evidence/ute-a1/round105/`.
The single current verdict table and the layer's precise scope live in `D-ACCEPTANCE-REPORT.md`
(the candidate-gate section); this section is the suite-status delta.

Review `20261124-1341` §4.4 asked for the key DEV-LIVE scenarios as an executable, reviewable
candidate gate. `scripts/candidate-acceptance-gate.mjs` now:

* runs `run-boot.mjs`, `run-boot-d2.mjs`, `run-boot-d3.mjs` and `probe-d4-routed-wake.mjs` with
  `--boots 2`, sequentially, on `legacy` (rc.2) and/or `next` (rc.5) through the existing
  `TEAM_TEST_HOST` selector (`--hosts both` for the pair);
* reads the drivers' OWN artifacts (`run-record.json`, `agreement.json`, `results.json`,
  `routed-judges.json`) and requires the 31 enumerated judges to be present with `agreement=true`
  and records valid under `scripts/eb3-run-manifest.mjs`; the ONLY allowed non-PROVEN verdict is the
  literal enumerated `d4:ask-execute-process` (`SCOPE-subprocess-ask.md` §2/§4);
* has no retries and no timeout widening: `DRIVER_TIMEOUT_MS` = 2,700,000 ms, a hung driver is a
  FAIL naming that value;
* snapshots each driver's artifacts per host so a later host's run cannot overwrite the evidence
  the verdict was computed from.

**Population delta:** no test file added, removed or reclassified; no dispatch leg changed; the
`ute-vnext-a1` leg digest is untouched. The gate is a `scripts/` runner, not a suite. The CI shape
gate moves `workflows=10 → 11` because the new workflow is a real file, and it is registered in
`dev/ci/eb3-ci-manifest.json#knownNonRequired` — `ci-required`'s layer list is unchanged.

**Round-105 verdicts (both hosts were run in one invocation):**

```
CANDIDATE-GATE pass host=legacy judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
CANDIDATE-GATE fail host=next  judges=31 proven=29 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
  d2: d2:remote-delivery REFUTED — archived-member-refused-typed: lifecycle=SETTLED code=null requestsAdded=0 (both boots)
CANDIDATE-GATE fail hosts=legacy,next judges=62 proven=59 known-refuted=2 env-limited=0
```

**The rc.5 red is a new measured fact, not a gate defect.** `d2:remote-delivery` passed on rc.2 and
was previously **NOT RECORDED** on rc.5. The gate's first dual-host run records it as REFUTED in
exactly one of its 19 clauses (`archived-member-refused-typed`); every other clause is PROVEN, and
the two boots agree. The proposition is that an archived member's `member.send` is refused with a
TYPED code and zero executions; on rc.5 the acknowledgement settles with `code=null` while
`requestsAdded=0` — the refusal is not typed. This is a driver judge whose clause expectation may
need an rc.5-shape repair OR a product/owner decision; round 105 does not guess which, and it does
NOT add the id to `KNOWN_REFUTED` (only `d4:ask-execute-process` is enumerated).

**Levels:** no row moves. The gate is non-required; rc.2 is green and rc.5 is FAIL. C-alpha6 and the
R3 `write` receipt remain **DEV-LIVE** on both hosts. The governed process face remains
**NOT-PRODUCT-PROVEN**. No row is PRODUCT-PROVEN, and no row becomes gate-backed without an owner
decision to make the gate required.

---

## Round 108 — the rc.5 re-runs: `d:remote-creation` and `d2:remote-delivery` are PROVEN, and the rc.5 refutation was a product defect

Round 108 re-ran the two remaining rc.5 gaps of the round-106 single table
(`TEAM_TEST_HOST=next`, `--boots 2`), after fixing the defect the round-105 candidate gate had
measured.

**Population delta:** no test file added, removed or reclassified; no dispatch leg changed. One new
evidence arm pair lives INSIDE the already-collected vitest file
`packages/runtime/test/t12a-m3-recursive-drain.test.ts` (M3-6, M3-7), so the catalog identity and the
`ute-vnext-a1` leg digest are unchanged by construction. `place-dist-glue` re-placed the 35 dist
files byte-identically (the glue source changed). The scripted driver observation gained two fields
(`archiveCode`/`archiveMessage`) and a longer judge detail — no predicate was relaxed.

**The measured facts.**

```
d    (rc.5, 2 boots) RESULT PASS (2/2 boots; agreeing pair=true)
  d:member-read-admitted PASS/PASS  d:member-read-denied PASS/PASS  d:native-read-surface PASS/PASS
  d:guard-facts PASS/PASS  d:centre-facts PASS/PASS  d:remote-creation PASS/PASS (8/8 clauses each)
d2   (rc.5, 2 boots) RESULT PASS (2/2 boots; agreeing pair=true)
  d2:multi-member-concurrency PASS/PASS (18/18)  d2:revocation PASS/PASS (18/18)
  d2:stop PASS/PASS (11/11)  d2:remote-delivery PASS/PASS (20/20)
  archived-member-refused-typed: archiveOk=true lifecycle=ARCHIVED code=TEAM_RUNTIME_WORK_STATE_REJECTED requestsAdded=0
```

**Who was wrong: the product.** `member.archive` returned its own typed refusal
(`archiveOk=false`) on rc.5 and the durable row stayed `SETTLED`; the round-105 observation discarded
that reply's error code, so only the consequence was visible (`member.send` → `ok=true code=null
requestsAdded=0`). The send itself was correct — `SETTLED` is work-accepting, so an un-archived
member lawfully accepts a delivery. Root cause: rc.5 renamed the PUBLIC
`subagents.drainContinuableDescendants` to `subagents.drainDescendants` (same signature, same
aggregate-after-settle contract, same internal manager call) and the drain seam
(`packages/runtime/src/plugin/vnext/stop-drain-lane.mjs`, pre-fix lines 194/201) required only the
rc.2 name → `recursive-drain-unavailable` → `LIFECYCLE_LIVE_EFFECT_FAILED` at `drain-descendants` →
zero durable writes.

**The fix.** `resolveDrainSeam` (`stop-drain-lane.mjs:177`) accepts either public name and passes the
parents verbatim; a host exposing neither still fails closed typed (`:241`). M3-6 asserts the rc.5
name drives the same drain; M3-7 asserts the neither-name shape still refuses. No upstream patch
(CORE PATCH BUDGET = 0), no skipped/weakened judge, no exemption added to `KNOWN_REFUTED`.

**Positive control.** On the same rc.5 boots the same `member.send` channel is accepted for a LIVE
member (`ok=true`, `deliveredSeq=40`) and again after `member.restore`; it refuses only the ARCHIVED
target. The clause predicate was not relaxed — it grew strictly more observability.

**Levels:** no row moves. Both rows stay DEV-LIVE on rc.5. The gate remains non-required, so no row
becomes PRODUCT-PROVEN.

---

## Round 110 (2026-11-25) — the rc.5 test POPULATION, measured (not the four drivers)

Review `20261125-0058` Stage B asked for the broader rc.5 matrix, not a fifth driver round. The
measured table, the enumeration method and every failure disposition are in
[`RC5-TEST-MATRIX.md`](./RC5-TEST-MATRIX.md); this entry records the outcome and the counts.

**Population, enumerated from code** (imports of bare `@deepseek-ai/*` *values*, `tests/paths.mjs`
pins, the host loader, `TEAM_TEST_HOST` reads): the catalog's **785 entries** (733 collected, 38
uncollected, 14 excluded) were classified over its **771 non-excluded** files. **93 carry a host
signal** (47 host-import, 41 host-tree, 13 boot); **678 are host-free** and are not counted as rc.5
coverage. The matrix keeps three populations apart: host-generic (boots/imports the *selected* host),
rc.2-subject (pins the legacy host as its subject), rc.5-pinned (imports `NEXT_HOST` directly).

**Executed on rc.5: 759 tests / 737 pass / 21 fail / 1 skip.** Breakdown and every red:

| population | rc.2 | rc.5 |
| --- | --- | --- |
| `ute-vnext-a1` leg (7 files, selector) | 251 / 248 / 0 / 3 skip | 251 / 232 / 18 / 1 skip |
| UTE G1 exact CI argv (9 files, rc.5-pinned) | N/A | **89 / 89 / 0 / 0** |
| `tests/next-host` + boot/provisioning (2 files) | N/A | **26 / 26** |
| next-host/settlement/closure lane as CI (11 files) | N/A | **184 / 184 / 0 / 0** |
| leg-declared `node:test` under the selector (14 files) | green in `ci-integration` | 232 / 3 / 0 |

- **18** = all `vnext-b-probe-ladder` arms: `vnext-b-probe-ladder.test.mjs:273` mounts
  `ToolRuntime { mode: 'both' }`, rc.5 `packages/core/tools/lib/index.js:407` declares `mode:
  z.never()`. The `before` hook rejects → deterministic **failure in ~0.5 s**, not a hang. The
  historical hang is that rejection with no per-test timeout; with `--test-timeout=45000` the bundled
  leg completes (251/232/18/1). **No gate timeout changed, no suite skipped.** Adaptation surface
  (executor service instead of `mode`, batch dispatch, `PtcExecutor.requirePtcTransport()`) is an open
  arm design, deliberately not rewritten inside a matrix round.
- **1** = `a5sf-fs-contract` FSB-IMG-1b: measures the **rc.2** tool package (`:297`) → rc.2-subject.
- **2** = `m7a-real-slice-host-state`: boots the **rc.2 census** slice in a child process → rc.2-subject.

**Two rc.5 drifts adapted, observation only (assertions untouched):**

1. `packages/runtime/test/vnext-admission.test.mjs` ADM-96/97: the fabricated `exec` frame now carries
   `signal: new AbortController().signal`; rc.5's MCP client calls `AbortSignal.any` (`mcp-client/lib/
   index.js:496`) and rejects a missing signal (`ERR_INVALID_ARG_TYPE`). `admission` → **163 tests /
   162 pass / 0 fail / 1 skip on BOTH hosts**.
2. `tests/world-factory/a5sf-harness.test.mjs:243` now asserts the candidate pin equals the **selected**
   pin (`selectedHostPin(REPO_ROOT).sha`) and that the 40-hex literal is absent, instead of comparing to
   the rc.2 constant → **10/10 both hosts**.
3. `tests/world-factory/a5sf-native-route-c.test.mjs`: host modules now resolve through
   `resolveSelectedHostModule` under the selector (the rc.2 `createRequire` had put two `dsh-scope`
   namespaces in one process → `scopeOf` undefined → `a5sf-realm-row.mjs:782`), the rc.5 executor is
   mounted as its exported `{ name, inject, apply }` plugin (the bare class skips `inject` →
   `tool-executor-native/lib/index.js:10`), and dispatch uses the **existing**
   `executeToolDispatch(..., { hostMode })` helper. → **8/8 both hosts**.

**Not covered, stated:** 18 B-ladder arms (above); **40 vitest suites that load host code** — Vite
resolves the repo install before the Node loader (measured: a probe imported `@deepseek-ai/dsh-scope`
`0.2.0-rc.2` under `TEAM_TEST_HOST=next` + host-loader), so rc.5 cannot grade them without a Vite alias
= a second selection mechanism; 38 uncollected files (catalog ratchet); the remaining leg-declared node
suites that are rc.2-lane by design.

**Counts that moved:** none in the catalog — `test-catalog` is **byte-identical** to round 109
(`tests=785`, digest `sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32`).
`ute-vnext-a1` leg digest unchanged (`sha256:edd4f1c4…`). No new scannable test file (three edited
files are existing; the evidence is markdown) ⇒ no p4t6 booking delta. `ute-p0-assets`
`modules=37 files=180 lines=69512` unchanged.

**Levels:** no row moves. No PRODUCT-PROVEN row is added; the four D drivers were not re-run and their
round-109 verdicts stand.
