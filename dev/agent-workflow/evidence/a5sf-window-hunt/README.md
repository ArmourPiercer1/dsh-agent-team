# `a5sf-window-hunt` — the activation-window defect class, hunted deliberately

**Status: produced.** Base `origin/master` = `ff04b6f41`. Branch
`task/a5sf-window-hunt-20261112`. Worktree `.worktrees/a5sf-window-hunt`.
`CORE PATCH BUDGET = 0` — the pinned Host is untouched (`git status` under
`tests/deepseek-harness-test-use` is clean; it is not in this diff).

This lane did not look for another #649. It looked for the **class** #649
documented: *in-process tests mounted after the row existed; the product mounts
before it. The fixture's ordering was kinder than production.* The class is
recorded in `docs/plans/active/alpha5-sandbox-first/PHASE-REPORT-2026-11-10.md`
appendix C.3 and in `dev/agent-workflow/evidence/a5sf-live-member/README.md` §2.

**No DEV-LIVE boot was spent.** The windows below are in-process ordering
between a mount/bind/authority read and a durable write; every one is exercised
through the real product module at the exact seam the Host calls. A boot would
re-measure the same order, not settle a different question. (The one question a
boot could add — the crash-resume path — is argued from the shipped code and
disclosed as open, §5.)

---

## 1. The enumerated windows

The product's member-activation order is fixed and readable:
`packages/runtime/activation/provider.ts:1276` (step 13, `createChildSession`;
the child's `setup` — and therefore every mount below — runs **inside** it),
`:1288` (step 14, `bindChildSession`), `:1291` (step 15, `commitInstance`). The
child-session adapter (`packages/runtime/activation/adapter.ts:67` factory,
`:83` durability barrier) returns before the coordinator records the member row
(`packages/storage/provisioning/coordinator.ts:381` → `:404`
`ensureMemberRecord`). The governed realm mounts in the setup
(`packages/runtime/src/plugin/live/agent-bindings.mjs:2599`).

| # | Window (component asked / mounted before the durable fact) | Where | Current behaviour | Proof |
| --- | --- | --- | --- | --- |
| **W1** | child session created → **governed realm mounts and asks authority** → `MemberInstance` row written | `activation/provider.ts:1276` vs `:1291`; `adapter.ts:67-83`; `host.ts:2106-2139` (`readGovernedAuthority` → `memberInstances.get` at `:2128`); `a5sf-governed-realm.mjs:117-136` (`governedAuthorityReference`) | **(b) named narrow window.** `governedAuthorityReference({lifecycle, freshCreate})` admits only `lifecycle === undefined && freshCreate === true`; `freshCreate` is the live glue's `bindPath === 'fresh-member'` (`agent-bindings.mjs:5097`); a durable row **always wins** (`ARCHIVED`/`DISPOSED` refuse even in-window). Cold/state paths with no row refuse `AUTHORITY_REFUSED`. | `tests/world-factory/a5sf-window-taxonomy.test.mjs` W1a (through the **real** `createActivationChildAdapter`, row written **after** the adapter returns), W1b (cold, no row → refusal), W1c (durable row beats the window); `a5sf-governed-preset.test.mjs` G5/G5c |
| **W2** | **template / persona config projection** reads the durable roster before the row exists | `agent-bindings.mjs:2327` (`locateTemplate` templateId bridge), `:4477` (`installPersonaForSetup` record bridge) | **(b) named window, previously enforced twice by accident of ordering.** The bridge is legal only on `bindPath === 'fresh-member'`. The template locate already had the gate; the persona arm accepted a `templateIdHint` on **any** path — unreachable only because `resolveConsumptionViews → locateTemplate` throws first. Now both call the ONE exported rule `freshCreateHintAdmits` (`a5sf-realm-row.mjs:123`), so the invariant no longer depends on call order. | W2 (truth table + "both consumers use the ONE gate" tripwire) |
| **W3** | **tool surface before provider**: the preset's `bash` is mounted before the route-C shadow; and a governed row whose provider compiles **no** realm | `agent-bindings.mjs:2599` (realm) → `:2729` (preset mount) → `:3005` (shadow); `a5sf-realm-row.mjs:810` (`mountMemberA5sfRealm`), refusal at `:857-878` | **(a) refused closed for the ordering**: the provider is mounted **before** the surface (pinned), and the shadow is attached after the deny lane (deny-then-attach). **(c) silently proceeded for the undefined answer — FIXED, new finding §4.** | W3a (source order pin), W3b (the new pin: governed row + uncovered template ⇒ `REALM_DECLARATION_INVALID`, zero base spawns) |
| **W4** | **capability row before probe result**: the realm face is mounted before any provider probe | `a5sf-realm-row.mjs:810` mounts the face; `team-services/src/subprocess.ts:999` (`probeNetworkDenial`) is the ONLY capability-row consumer | **(a) refuses closed.** No capability claim is made at mount (the face carries no `capabilities`/`probe` key); the probe is asked at use, and absence / a throw / a refusal / an `enforced` row with no mechanism+evidence are **all** `unsupported`, never default-allow. | W4 (mount ⇒ 0 probe calls, no capability key; the full `probeNetworkDenial` truth table) |
| **W5** | **guard before policy revision**: the guard is built from the compiled policy | `team-services/src/install.ts:230` (a policy without a revision is refused), `:424` (`createMemberFsGuard`), `:432` (sink stamps `policy.revision`); `a5sf-governed-realm.mjs` compiled revision | **(a) refuses closed.** The guard cannot exist before its revision (install refuses a revision-less compiled policy), and the guard-consult fact carries THAT revision. A generation move changes a **new** attach's revision; it never relabels the mounted guard's facts. | W5 (sink fact revision === compiled revision; forged no-revision policy refuses; generation move changes a new attach) |
| **W6** | **skill/config identity before the config row**: a ceiling is a template fact; the identity comes from the creation hint, not from the row | `a5sf-governed-realm.mjs` `compiledFor` identity gate; `agent-bindings.mjs:2327` hint gate | **(a) refuses closed.** A Member with no `templateId` refuses `MEMBER_IDENTITY_INVALID` **before** the authority is read — no ceiling is guessed from a missing row. | W6 (authority-read counter unchanged on the refusal) |

Considered and **not** a window (so the enumeration is not a feeling):

- **projection / roster read** (`packages/runtime/src/plugin/projection-source.ts:709`) reads the durable roster **on demand** every time it is folded; it binds nothing at mount, so there is no mount→row order to get wrong.
- **Team bound blueprint** (BP-F) is resolved from the durable `TeamSession` row that exists before any member activation; the realm's ceiling source is not written at step 15.
- **permission-overlay generation** defaults to `0` when no snapshot exists (`host.ts:2112-2123`); that is the port's stated `latest()` law (no snapshots yet), and the compiler stamps `a4:overlay-generation:0` consistently — the activation commit adds no overlay row, so there is no post-commit change of the same fact.
- **sessionBinding row** (step 14) is consulted at tool-call time by callers that fail closed on `undefined` (`host.ts:3052-3057` binding absent ⇒ unmanaged, and the artifact authority refuses an ineligible lifecycle at `artifact-read/authority.ts:114-117`); no mount consumes it.

---

## 2. Fixtures that were kinder than production — and the durable fix

### 2.1 `tests/world-factory/a5sf-governed-preset.test.mjs` — mounted after the row existed

**The privilege it enjoyed:** `makeGovernedWorld` defaulted `state` to
`{ generation: 0, lifecycle: 'RUNNING' }` and `readAuthority` ignored the
`freshCreate` input entirely. Every governed mount in the suite therefore
happened against a roster where the MemberInstance row **already existed** —
the exact inverse of the product window, and the reason the suite could not see
#649.

**What it took to mount like the product:** one default (`lifecycle: undefined`)
plus forwarding `freshCreate` from the Member descriptor exactly as
`host.ts:2109-2139` does. The suite now mounts **inside** the window. It stays
green (14/14) and gained **G5d**, which pins the ordering itself: the fixture
starts with no row, the mount succeeds through the window, the row written
**after** the mount is read by a cold re-attach, and removing it again makes the
cold path refuse.

This is the durable fix: a class member became a regression instead of a green
instrument.

### 2.2 Two source-text pins that list the glue's import set

`a5sf-f1-ctx.test.mjs:510` and `a5sf-p2-wiring.test.mjs:462` pin the exact
`a5sf-realm-row.mjs` import list in the glue. The gate needed one new exported
symbol, so the pinned strings were updated **by adding that symbol** — the
assertions are neither removed nor weakened; they still require every previous
symbol and the single import path.

No other existing assertion was touched. In particular G5's "vanished row" arm
kept its meaning by taking the **cold** path (`bindPath: 'cold-member'`), which
is what "the row a resume expected is gone" actually is; the fresh-create path
with no row is admitted **by design** (G5c) and is now separately pinned.

---

## 3. The second real instance of the class (the prize)

**Finding (NEW, W3): a governed row could silently leave a Member ungoverned.**

- **What the product did.** `a5sfGovernedRealm: true` promises that the
  composition's provider is this row's ONLY compiled-realm source. The shipped
  preset `preset-a5sf-governed-member` is the ordinary `standard` preset minus
  `tool-pwsh`: it confines nothing by itself. The confinement lives entirely in
  the realm mount (`agent-bindings.mjs:2599`), the route-C shadow
  (`:3005`), and the faces the mount installs.
- **The window.** A `schemaVersion: 4` blueprint may declare a member template
  that has **no** `memberIoCeilings` entry (measured: the parser accepts it —
  `parseBlueprint` only requires every ceiling's `templateId` to resolve; it
  does not require every template to have a ceiling). For such a Member,
  `createGovernedRealmProvider(...).compiledFor(...)` answers `undefined`, and
  `mountMemberA5sfRealm` returned `undefined` **before** the governed-row
  refusal at `:812-828` could fire (that refusal only covered a missing
  *provider*, not a missing *compiled answer*). `agentSetup` then skipped the
  shadow (`if (a5sfRealm !== undefined)`, `:3004`) and the Member ran the
  preset's inherited, unconfined `bash` — while the row still said
  `a5sfGovernedRealm: true`. The system proceeded on `undefined`, silently.
- **Why no test saw it.** The in-process suite only ever mounted templates the
  ceiling family covered; the live driver's blueprint had exactly one Member
  template. The fixture's blueprint was kinder than a legal blueprint.
- **The pin.** `tests/world-factory/a5sf-window-taxonomy.test.mjs` W3b: a
  two-template blueprint, ceiling for `worker` only, mount as `sidekick` ⇒
  must refuse `REALM_DECLARATION_INVALID` and must record **zero** base
  subprocess spawns. Measured **RED** on the pre-fix row module
  (`Missing expected rejection`) and **GREEN** after.
- **The smallest fix.** `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:854-875`:
  when the governed key is set and `compiledFor` answers `undefined`, refuse
  with the existing typed `REALM_DECLARATION_INVALID` (the same
  "declared-but-unmounted confinement" law already used for a missing
  provider). An ungoverned row keeps `undefined` = no realm, byte-identically.
- **Scope of the fix.** One condition in our package; no Host patch, no new
  module, no default change. `CORE PATCH BUDGET` stays 0.
- **Not claimed:** this does not make the preset itself confining; an operator
  who wants a Member outside the ceiling family must not opt that row in. The
  fix converts a silent ungoverned Member into a loud mount refusal.

---

## 4. Gates

| Gate | Result |
| --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **531 tests, 527 pass, 0 fail, 4 skipped** (after the debt-register anchor re-resolve) |
| `node --test tests/world-factory/a5sf-window-taxonomy.test.mjs` | **9/9 pass**; W3b RED→GREEN on the pre-fix row module (measured) |
| `node --test tests/world-factory/a5sf-governed-preset.test.mjs` | **14/14 pass** (the pre-row ordering fixture) |
| `npx vitest run` at the repo root (contains every `packages/runtime/test` suite — activation / runtime / team-services) | **668 files: 663 pass, 5 fail; 8824 tests: 8817 pass, 7 fail** — all 7 outside this lane's modules (see §4.1) |
| `pnpm -r typecheck` | **10/10 packages pass** (after linking the main checkout's per-package `node_modules`; see §4.1) |
| `npx eslint` on the changed/new files | clean (the new `.mjs` test file is ignored by the repo's eslint ignore pattern; the changed `.mjs` sources lint clean) |
| `node scripts/check-artifacts-committed.mjs` | clean after `scripts/place-dist-glue.mjs` re-placed the two byte-identical dist mirrors in the same commit |
| `node scripts/doc-checks.mjs` | exit 0 |
| register test (`a5sf-debt-register.test.mjs`) | 10/10; PD-13's `a5sf-realm-row.mjs` anchor re-resolved `#L961-973 → #L1016-1028` (the lane's insertions moved it; symbol and status unchanged) |
| `node scripts/ci-pr-gate.mjs --only state-freshness` | **DSH-CI-VERDICT pass** (1 leg, 0 fail) |
| `p4t6` population | **unchanged** — this lane adds no scannable `.mjs` under `packages/**`; the only new file is a test under `tests/`. Anchor/digest maintenance: the ARC-A protected-center ledger gained a **named center-interface override** for `agent-bindings.mjs` (the ONE exported hint gate consumed at two call sites), as that ledger's law requires. |

### 4.1 Environment notes (recorded, not hidden)

This worktree was materialised by symlinking the main checkout's `node_modules`
(and each package's `node_modules`), and the pinned pristine host
(`tests/deepseek-harness-test-use`); the pnpm store is outside the sandbox, so
`pnpm install` cannot run here. Reported rather than hidden:

- The first `pnpm -r typecheck` failed with `TS2688: Cannot find type definition
  file for 'node'` before the per-package links existed; it is **green** after
  linking them (measured, 10/10 packages).
- The root vitest run's 7 failures are all environment/pre-existing, and none of
  the failing files imports a module this lane touched:
  - `a5sf-os-runner` P1-07 expects a network-deny spawn to be
    `ENFORCEMENT_UNAVAILABLE`; this host's Landlock advertises network
    enforcement, so the provider correctly spawns (`ok: true`). The file imports
    only `team-sandbox` / `sandbox-provider` / `member-io-policy`.
  - `a5-globoff-key` K7 and `a5rbn-runtime-base-narrow` N3 time out at vitest's
    5 s default while running **real** `grep`/`bash`/`ls` child processes in
    this sandbox.
  - `alpha5-glob-backend` X3's timeout arm settled `completed` instead of
    `cancelled` under the same real-process load.
  - `a4p7-merge-gate`'s three legs judge the **committed** tree: at the time of
    the run the dist mirror was still unstaged, `packages/client/dist` had never
    been built in this worktree, and its `check:artifacts:head` leg refuses with
    `store-not-writable` (the pnpm store path recorded in `node_modules` points
    into a different lane's scratch dir). These are commit-state/environment
    legs, not product legs.
- Everything the lane actually changed is covered by the suites above, and the
  a5sf gate is fully green.

---

## 5. What is still open and known

- **The crash-resume ordering (disclosed, not hidden).** `createChildSession`
  calls the factory **before** `ensureDurable` (`adapter.ts:67-83`). If the
  process dies after the session became durable but before the coordinator
  records the child id (`coordinator.ts:381-404`), a re-drive finds a durable
  child and takes the **cold-member** resume path; the `MemberInstance` row
  still does not exist, so `locateTemplate` (`agent-bindings.mjs:2327`) and the
  governed authority both **refuse**. That is fail-closed, not a silent
  authority hole — but it means the open fresh-create window is not re-opened on
  recovery, so such a PREPARED operation cannot converge without operator
  action. Fixing it would require the factory to distinguish "cold resume of a
  child that a still-PREPARED activation created" from "cold resume of a
  vanished member" — an activation-contract change, deliberately **not** made
  in this lane.
- **Per-template `undefined` is now a refusal, not a fallback.** A Team that
  opts a row into `a5sfGovernedRealm` must give every Member template it will
  activate a `memberIoCeilings` entry. That is the intended reading of the key,
  but it is a behaviour change for a misconfigured row (loud instead of silent).
- **The persona arm's gate is hardened, not exercised end-to-end.** The
  reachable product order still refuses earlier in `locateTemplate`; W2 pins the
  shared rule and the call sites, not a live setup rejection.

---

## 6. The sentence the phase can now print

> Of the ordering windows between a mount and the durable state it depends on,
> the activation window (realm asked for authority before the MemberInstance
> row) and the creation-hint window (template/persona projection before the row)
> are **closed by design, each through one named exception** — `freshCreate`,
> admitted only when the live glue says `fresh-member`, with the durable row
> always beating it and every cold/state path refusing a missing row; the guard,
> the capability row and the config identity are **closed by refusal** (no guard
> without its compiled revision, no capability claim without a probe that
> `enforced` it with a named mechanism and evidence, no ceiling without a
> template identity); the tool-surface ordering is closed by mounting the
> provider before the surface and shadowing after the deny; and **one window was
> still open** — a governed row whose provider compiled no realm for a Member
> template silently left the preset's unconfined `bash` in place — which this
> lane **closed** with a typed `REALM_DECLARATION_INVALID` and a RED→GREEN pin.
> The one ordering that remains knowingly open is the crash-resume path, which
> fails closed but cannot re-open the creation window.
