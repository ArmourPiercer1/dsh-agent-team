# a5sf-p2-seam — BL-14/P2-01 follow-up: the observable guard + the cross-process transport

> **Dated 2026-11-03 (real UTC at authoring time).** Alpha.5 Sandbox-First P2
> blocking seam, after two independent reviews (`BL-14/P2-01`, merged as PR
> #546) named the same pair of gaps. Branch `task/a5sf-p2-seam-20261103`,
> worktree `.worktrees/a5sf-p2-seam`, base `origin/master` = `1ab1bff46`.
>
> **NO HOST BOOT WAS PERFORMED BY THIS PACKAGE.** No tier that spawns a Host was
> run, no port was bound, no `DSH_HOME` was created, no `tests/homes/**` was
> written, and the shared host-start budget pool was **not** consumed — the pool
> is **0** and a live run still needs a USER ruling. Every measurement below is
> host-free.
>
> **CORE PATCH BUDGET = 0.** No upstream tree was read or written; `packages/**`
> changes here are Team's OWN packages (`runtime/team-services`), not upstream.
> `scripts/a5sf-diag.mjs`, `AGENTS.md`, `docs/plans/active/**`, the authority
> pointer, `graph.yaml` and the other worktrees are untouched.

## 0. The gap this package closes

PR #546's evidence (`dev/agent-workflow/evidence/a5sf-p2-read/README.md` §6.2,
§6.3) recorded two facts:

1. `installToolBindingRealm` builds the confined Provider's guard **inside** the
   installer and never returns it (`packages/runtime/team-services/src/install.ts`
   at the base, guard construction `:293`). From outside the module, "the guard
   was consulted for this call" could only be inferred from the base Provider
   having run — not observed.
2. Neither installer had a production caller (grep: barrel re-export, the P1-05
   test, the R2 harness). The compiled realm was provable in-process and
   **inert** in a Host. A C2 suite also runs in a different process from the
   Host, so even an in-process callback could not see a Host's consultations.

This package addresses both, and adds the third leg the reviewer required: a
**plain file transport** so a suite in another process reads what the installing
process actually consulted. It does **not** boot a Host and does **not** claim
kernel enforcement.

## 1. The exact seam signatures

### 1.1 Observer input on the two installers (additive, default-preserving)

`packages/runtime/team-services/src/install.ts:73` and `:291`:

```ts
export interface InstallMemberIoProvidersInput {
  // …existing fields unchanged…
  /** P2 seam: observe every consultation of the Member-ceiling guard.
   *  Omitted = the exact original guard object and confined class, no wrapper. */
  readonly onGuardConsult?: GuardConsultObserver
}

export async function installToolBindingRealm(input: {
  readonly root: Context
  readonly spec: ToolBindingRealmSpec
  readonly providerClass?: FsProviderConstructor
  /** Same contract, for THIS binding's guard. */
  readonly onGuardConsult?: GuardConsultObserver
}): Promise<ToolBindingRealm>
```

Wiring, both sites identical in shape (`install.ts:183-190`, `:321-328`):

```ts
const guard = createMemberFsGuard(policy)            // unchanged
const observed = input.onGuardConsult === undefined
  ? guard                                            // DEFAULT: same object
  : observeGuard(guard, input.onGuardConsult, { realm: 'member'|'binding', … })
const Confined = createConfinedFileSystemClass(Base, observed)
```

`guardFactory` was considered and **not** added. It would let a caller replace
the decision function (an unreviewed allow path), which is a different guarantee
from "the same guard, observed". The observer covers the need with a strictly
smaller surface.

### 1.2 The observer wrapper

`packages/runtime/team-services/src/guard-observability.ts:149`:

```ts
export function observeGuard(
  guard: FsGuard,
  observer: GuardConsultObserver,          // (fact) => void | Promise<void>
  context: GuardConsultContext,            // realm, memberIdentity, toolBindingIdentity|null, policyRevision
): FsGuard
```

One `GuardConsultFact` per consultation, frozen, schema
`a5sf-guard-consult/1` (`guard-observability.ts:49-77`):

| field | meaning |
|---|---|
| `realm` | `'member'` (ceiling) or `'binding'` (narrower effective lane) |
| `memberIdentity`, `toolBindingIdentity` | the compiled identity; `toolBindingIdentity` is `null` for the ceiling realm |
| `policyRevision` | the compiled revision of THAT realm |
| `method` | the Provider method that asked the guard (`readText`, `writeText`, …) |
| `locator` | the provider-resolved host path |
| `decision` | `'allow'` \| `'deny'` \| `'ask'` — the guard's own lane |
| `decidedBy` | `ALLOW`, or the guard's own `TeamIoDenial` code (`IO_READ_DENIED`, `IO_WRITE_DENIED`, `IO_WRITE_REQUIRES_READ`, `IO_POLICY_UNSUPPORTED`) |
| `sequence` | 1-based per observed guard (per realm) |
| `observedAt` | ISO timestamp |

`decision` is a **mapping of the guard's own typed code**, not a re-decision:
`*_DENIED ⇒ deny`, `IO_POLICY_UNSUPPORTED ⇒ ask` — the same mapping the R3
chain recorder already uses (`tests/world-factory/lib/a5sf-evidence.mjs`). A
non-`TeamIoDenial` error is rethrown **unrecorded**: it is not a decision.

The record is written **after** the guard decided and **before** the confined
Provider delegates to the base implementation — so an `allow` record means the
admission was made and no I/O has happened yet; a `deny` record carries the code
of the refusal that is about to be rethrown.

### 1.3 The transport

`guard-observability.ts:215` and `:238`:

```ts
export function createGuardConsultFileSink(options: { readonly path: string }): GuardConsultFileSink
// record(fact): Promise<void>   — append-only JSONL, appends serialised in call order

export async function readGuardConsultFile(path: string): Promise<GuardConsultFact[]>
// strict: missing file rejects (ENOENT); a line that is not valid JSON of the
// schema rejects with CONSULT_FILE_INVALID — garbage never reads as "nothing".
```

A line is `JSON.stringify(fact) + "\n"`; the fact already carries its schema.
The sink owns **no counter, no ledger and no oracle**; each line is the fact it
was handed. The parent directory must exist — a write failure is the caller's
signal (see §3).

### 1.4 The ONE mount entry point

`packages/runtime/team-services/src/mount.ts:84`:

```ts
export async function mountA5sfRealm(input: {
  readonly root: Context
  readonly members: readonly A5sfRealmMember[]          // identity + CompileResult<MemberPolicy>
  readonly bindings?: readonly A5sfRealmBinding[]       // identity + toolBindingIdentity + EffectiveIoPolicy
  readonly providerClass?: FsProviderConstructor
  readonly onGuardConsult?: GuardConsultObserver
}): Promise<MountedA5sfRealm>                            // { members, installation, bindings, dispose() }
```

It **composes the two existing installers only**: `installMemberIoProviders`
first (the ceiling), then one `installToolBindingRealm` per admitted binding. It
compiles nothing (it consumes the `CompileResult<MemberPolicy>` /
`EffectiveIoPolicy` objects P1-02 produced), launches nothing, owns no budget or
oracle. If a later binding mount refuses, every binding and the Member
installation are disposed before the typed installer error propagates.

## 2. Why default behaviour is unchanged (and how that is proved)

The only behavioural branch is `input.onGuardConsult === undefined`. On that
path the installer uses the **same** guard object returned by
`createMemberFsGuard` and the **same** `createConfinedFileSystemClass(Base,
guard)` call as before: no wrapper function, no extra call, no extra allocation.
The return values (`ToolBindingRealm`, `MemberIoInstallation`) are the same
frozen objects with the same fields; the observer options are optional and are
not present in either returned shape.

Proof in the C1 suite: `A1` mounts the same effective lane three ways — omitted,
`onGuardConsult: undefined`, and a real observer — and asserts (a) identical
sorted key set and frozen flag on the returned realm, (b) the identical allow
result, (c) the identical `IO_READ_DENIED` refusal, and (d) that only the
observed path produced facts (2, exactly the 2 consultations it made). The
package-level vitest block (`a5sf-service-install.test.ts`, "default path: no
observer ⇒ same frozen shape and same allow/deny outcomes") pins the same law
next to the existing P1-05 suite.

## 3. What the transport proves — and what it does not

**Proves:** the process that mounted the realm reported, per consultation, the
method, locator, member, binding, policy revision, the guard's own decision and
the code that decided it; another process can read those records from a plain
file. A8 spawns a **child node process** that mounts the compiled realm through
`mountA5sfRealm` (two admitted reads + one refused read) and writes the sink;
the parent test reads the file back and asserts 3 ordered records, the child pid
differing from its own, and the decision sequence `allow, allow, deny`.

**Does not prove:**
- kernel / OS-level enforcement (no Landlock/seccomp claim; that is the
  `team-sandbox` lane's evidence, not this transport);
- that a **booted Host** mounted the realm — the boot budget is 0, no Host was
  started;
- a **native** `read` tool path or a model-facing `tool_result`;
- a Host-attributable **effect** (the sound oracle's live-pid conjunct is
  absent host-free);
- tamper-evidence: the file is unsigned and a writer with the file can edit it.
  It is **evidence transport, not authority**: it grants nothing, and no reader
  may treat its presence as a policy decision.

**Fail-closed on transport:** if an observer/sink rejects while recording, the
observed call is refused with `GUARD_OBSERVATION_FAILED`
(`GuardObservationError`, `guard-observability.ts:100`) which carries the
decision (`decision`, `decidedBy`, the original `denial`) **and** the transport
failure (`cause`). A5 proves an unrecorded **allow** never reaches the base
Provider (`providerReads === 0`); A5b proves an unrecorded **deny** keeps its
`IO_READ_DENIED` on the error and is never converted to an allow.

## 4. The mount: who calls it, and where product wiring would call it

**Called today by the world-factory harness**: `tests/world-factory/lib/a5sf-harness.mjs:436`
`mountRealm({ root, members, bindings, providerClass, onGuardConsult })`
delegates to `team-services#mountA5sfRealm`; `installBindingRealm`
(`:419`) now forwards `onGuardConsult` to the installer's own input. This CI
suite (A6, A7, A8) calls both. The harness edit is additive and disclosed here:
the R2 owner's file keeps its "no second launcher / no second compiler" shape.

**Product wiring — exact place, and why it is NOT wired in this package.** The
production Member setup path is `packages/runtime/src/plugin/live/agent-bindings.mjs`
(the live row `packages/runtime/src/plugin/host.ts:807` dynamically imports): the
per-agent setup callback receives the agent's Cordis `agentCtx` (the same scope
the existing `fsBackend(agentCtx)` accessor uses, `agent-bindings.mjs:171-198`).
The call belongs there, immediately after the MemberInstance row is admitted and
its compiled ceiling/effective lane are resolved:

```js
// packages/runtime/src/plugin/live/agent-bindings.mjs — member setup callback
const realm = await mountA5sfRealm({
  root: agentCtx,
  members: [{ identity, policy: compiledCeiling }],
  bindings: admittedBindings.map((b) => ({ identity, toolBindingIdentity: b.id, effective: b.effective })),
  onGuardConsult: evidenceSink === undefined ? undefined : (fact) => evidenceSink.record(fact),
})
state.realmDisposers.push(() => realm.dispose())
```

It is **not wired here** for three reasons, stated plainly:

1. **No boot budget.** The pool is 0 and a live run needs a USER ruling. A mount
   in the live row is a Host behaviour change; it cannot be verified host-free,
   and shipping it unverified would be exactly the "driver self-report" problem
   inverted into a product claim.
2. **One-writer/lane ownership.** `agent-bindings.mjs` / `host.ts` are built into
   `host.js` and are owned by the live-composition lane; a mount there is that
   lane's PR with its own review, not a silent edit from this seam package.
3. **No second launcher.** The wiring is a call to the entry point, not a new
   composition; keeping the entry point importable (barrel export) and leaving
   the call site to the composition owner is the smallest honest step.

`mountA5sfRealm` is exported by the `team-services` barrel, so the row can
import it from the built runtime without a deep path.

## 5. C1 arms and the RED → GREEN capture

`tests/world-factory/a5sf-p2-seam.test.mjs` — 11 `node:test` arms, all
host-free (an in-process Cordis unit root, `mkdtemp` fixtures, no boot/port/
DSH_HOME):

| arm | law |
|---|---|
| A1 | default path unchanged (shape + behaviour), `undefined` ≡ omitted |
| A2 | one frozen record per consultation, call order, guard's own code; `realm=binding` |
| A2b | Member-ceiling realm reports `realm=member`, `toolBindingIdentity=null` |
| A3 | append-only valid JSONL + `readGuardConsultFile` round-trip |
| A4 | negative control: zero consultations ⇒ no file; reader rejects ENOENT |
| A5 | sink failure on **allow** ⇒ `GUARD_OBSERVATION_FAILED`, Provider never asked |
| A5b | sink failure on **deny** ⇒ refusal preserved on the error, never an allow |
| A6 | `mountA5sfRealm` mounts ceiling + bindings, idempotent dispose |
| A6b | a refusing binding rolls the whole realm back (Member remount succeeds) |
| A7 | harness `mountRealm()` calls the entry point and carries the observer; `installBindingRealm` forwards it |
| A8 | **cross-process**: child mounts the realm, parent reads the JSONL back |

**RED** (`red-test.log`) — the C1 suite run against the BASE package source
(`git stash push -u -- packages/runtime/team-services/src`, test + harness
wiring kept), so the failure is the missing seam, not a missing test:

```
$ node --test tests/world-factory/a5sf-p2-seam.test.mjs
A5sfHarnessError: a5sf harness SEAM_UNAVAILABLE: P1 seam 'mountA5sfRealm' is not a function at …/a5sf-p2-seam
ℹ pass 0  ℹ fail 1
```

**GREEN** (`green-tests.log`), the exact commands and their real tails:

```
$ node --test tests/world-factory/a5sf-p2-seam.test.mjs
✔ A1 … ✔ A8    ℹ tests 11  ℹ pass 11  ℹ fail 0

$ node --test tests/world-factory/a5sf-harness.test.mjs   # existing R2 suite, unchanged
$ node --test tests/world-factory/a5sf-evidence.test.mjs  # existing R3 suite, unchanged
$ node --test tests/world-factory/a5sf-read-gate.test.mjs # existing BL-14 gate, unchanged

$ ../../node_modules/.bin/vitest run a5sf
 Test Files 11 passed (11)   Tests 166 passed (166)

$ ../../node_modules/.bin/vitest run packages/testkit/test/p4t6-session-event-scan.test.ts
 Test Files 1 passed (1)   Tests 20 passed (20)

$ pnpm -r typecheck            # all 9 packages
$ node scripts/eb3-ci-required.mjs         -> pass workflows=9 findings=0
$ node scripts/eb3-ci-negative-controls.mjs -> 24/24 control(s) behaved as required
```

## 6. The measured p4t6 tie (`packages/testkit/test/p4t6-bookings/a5sf.json`)

Two NEW scannable files under `packages/**`
(`team-services/src/guard-observability.ts`, `team-services/src/mount.ts`); the
edits to `install.ts`, `index.ts` and `a5sf-service-install.test.ts` ride
already-counted paths.

Measured on THIS worktree, not copied — with the two new modules on disk and the
old booking still at `{1396, 1425}`:

```
scanner counts 1427, ledger derives 983 + 442 = 1425
```

Both paths were added by name and the tie re-anchored to the booking's own
31-path sum: `expectedDelta {from: 1396, to: 1427}`. Re-run: 20/20 pass
(`green-tests.log`). `tieNote`/`reason` in the booking carry this measurement.

## 7. CI enrolment (the R2/R3 shape: one step + one undroppable leg)

* `.github/workflows/ci-integration.yml` — ONE step
  `a5sf P2 seam C1 (… node:test, zero Host boots, host-free, cross-process transport)`
  running `node --test tests/world-factory/a5sf-p2-seam.test.mjs`, after the
  BL-14 budget-gate step.
* `dev/ci/eb3-ci-manifest.json` — ONE `ci-integration` leg `a5sf P2 seam` whose
  `check[]` holds that path, so dropping the file is
  `CI_LAYER_LEG_WEAKENED`, not a silent gap. `node scripts/eb3-ci-required.mjs`
  → `pass workflows=9 findings=0`.

Vitest files ride the existing list (no new enrolment needed).

## 8. How BL-14's live mode would consume it

BL-14 (`tests/world-factory/suites/150-a5sf-read.mjs`) refuses with
`LIVE_SEAM_UNAVAILABLE` while no live driver exists. Once the product wiring of
§4 exists, the live mode consumes this seam as follows — **no new ledger, no
second oracle**:

1. the suite passes a `createGuardConsultFileSink({ path })`-backed
   `onGuardConsult` to whatever mounts the Member realm (the product row would
   read its transport path from a row config/env; the suite passes the path it
   will read);
2. after the live call, the suite calls `readGuardConsultFile(path)` and derives
   `call.provider.consulted = facts.some(f => f.method === 'readText' && f.locator === expected)`
   and `call.provider.decision = facts.at(-1).decision` — mechanically, from the
   Host PROCESS's report, instead of from the driver contract;
3. the R3 chain recorder keeps its shape; `consulted` stops being a lane claim
   and becomes a transported observation (the recorder still copies facts; it
   does not re-decide);
4. the suite would additionally assert the **negative control at live scope**:
   a denied locator must produce a `deny` record and zero bytes, and a call that
   never happens must leave the file absent/unchanged.

The transport path must live outside `tests/homes/**` (the live runner's
gitignored evidence dir is the natural home), and the file's provenance must be
recorded in the RUN record — the file is transport, not authority.

## 9. Remaining gaps before a live run (do not read any of this as C2)

1. **Boot budget is still 0** and this package did not boot. A live BL-14 run
   needs a recorded USER grant and the single boot the lease pays for.
2. **The product call site (§4) is not wired.** Until
   `agent-bindings.mjs`'s member setup calls `mountA5sfRealm`, the realm is still
   inert in a real Host — this package makes the seam *available and proven
   host-free*, not *live*.
3. **Native `read`** remains BL-14's own C2 half (window/stream, >10MiB); this
   package does not touch it.
4. **Enforcement** (kernel sandbox, real refusal of an out-of-ceiling read with
   zero bytes) is BL-14 live + the `team-sandbox` lane, not this transport.
5. **Host attribution**: "the Host process" here is whichever process mounts the
   realm. A8 proves the transport, and the process identity within it (child
   pid), but not that the process was a booted Host.
6. **Multi-realm ordering**: `sequence` is per realm; cross-realm order is the
   file's append order. If a future consumer needs a global order, that is a
   schema addition, not a re-interpretation of this one.

## 10. Files

| file | why |
|---|---|
| `packages/runtime/team-services/src/guard-observability.ts` | NEW — `observeGuard` (one fact per consultation, guard's own decision), `GuardObservationError` (fail-closed transport), JSONL sink + strict reader, closed transport vocabulary |
| `packages/runtime/team-services/src/mount.ts` | NEW — `mountA5sfRealm`, the ONE mount entry point composing the two existing installers with rollback; compiles/launches nothing |
| `packages/runtime/team-services/src/install.ts` | additive `onGuardConsult` on both installer inputs; default path keeps the original guard object (zero wrapper) |
| `packages/runtime/team-services/src/index.ts` | barrel re-exports (so the product row can import the entry point / transport) |
| `packages/runtime/test/a5sf-service-install.test.ts` | package-side P2 block: default shape parity, observer + sink round-trip, fail-closed transport (existing suite, already in the p4t6 booking) |
| `tests/world-factory/a5sf-p2-seam.test.mjs` | NEW — 11 host-free `node:test` arms incl. the child-process transport |
| `tests/world-factory/lib/a5sf-harness.mjs` | **disclosed edit to the R2 owner's file** (additive): `mountRealm()` calls `mountA5sfRealm`; `installBindingRealm`/`mountRealm` forward `onGuardConsult`; seam loader exposes the entry point + transport + `GuardObservationError` |
| `packages/testkit/test/p4t6-bookings/a5sf.json` | measured tie `{1396, 1427}` + the two new paths by name |
| `.github/workflows/ci-integration.yml` | ONE step for the node:test C1 suite |
| `dev/ci/eb3-ci-manifest.json` | ONE `ci-integration` leg pinning that file |
