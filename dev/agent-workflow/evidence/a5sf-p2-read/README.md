# a5sf-p2-read — BL-14 / P2-01: the native `read` representative mechanism

> **Dated 2026-11-03 (real UTC, `date -u` at authoring time).** Alpha.5 Sandbox-First work
> package **BL-14 / P2-01** (`docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md:43`,
> `current-implementation-plan.md` §3 item 2: "BL-14..BL-18 (P2 representative mechanisms) … one
> integrable minimal vertical slice each"), the FIRST P2 slice and the template for BL-15…BL-20.
> Branch `task/a5sf-p2-read-20261103`, worktree `.worktrees/a5sf-p2-read`.
>
> **NO HOST BOOT WAS PERFORMED BY THIS PACKAGE.** No tier that spawns a Host was run, no port was
> bound, no `DSH_HOME` was created, and the shared host-start budget pool was **not** consumed —
> the pool is 0 and a new boot needs a USER ruling. Every measurement below is host-free.
>
> **CORE PATCH BUDGET = 0.** No upstream tree was read or written, nothing under
> `tests/deepseek-harness-test-use/` was touched, `packages/**` was **not** modified (so
> `packages/testkit/test/p4t6-bookings/a5sf.json` keeps its existing measured tie), and
> `scripts/a5sf-diag.mjs`, `tests/world-factory/lib/a5sf-harness.mjs`, `AGENTS.md`,
> `docs/plans/active/**`, the authority pointer and the other worktrees are untouched.

## 0. Base and the one branch dependency (read this before reviewing the diff)

The worktree was created from `origin/master` = `f0215bdf5` (#544) as instructed, and then
**rebased onto `origin/pr545` = `d58f07873`** (PR #545, R3/BL-11 — the per-call evidence chain).
BL-14 cannot wire the evidence chain without the BL-11 recorder: the task's own instruction is
"wire the evidence chain (BL-11 recorder) and the diag reader into the suite", and PR #545 was
still **OPEN** when this package was cut (checked with `gh pr view 545`: `state=OPEN`,
`mergeCommit=null`). The rebase is a fast-forward of my base, not a rewrite: my commits sit on
`d58f07873` and touch only the files in §9. **When #545 merges, this branch rebases onto
`origin/master` with no content change** — the dependency is on `tests/world-factory/lib/a5sf-evidence.mjs`
and `tests/world-factory/lib/oracle.mjs` as merged. The residual risk (the recorder's row shape
changing during #545's review round) is the single risk in §10.

## 1. What this package is

One vertical slice, not a module:

1. **A budget pre-registration gate** for the suite (`preRegisterReadBudget`), because the shared
   host-start pool is 0 and a new boot requires a USER ruling. It takes a **recorded grant** and
   refuses with ONE typed code `BUDGET_NOT_GRANTED` when the grant is absent / unreadable /
   ambiguous / malformed / too small / bound to another commit, or when the **shared** ledger is
   exhausted. A refusal happens **before any World exists and before any ledger write**.
2. **The C2 scenario** for the native `read` tool: allow inside the compiled ceiling (the read
   reaches the Provider), deny outside it (typed refusal, zero bytes, before the read), a >10MiB
   file, and two Members that do not share authority. The scenario code is shared by both modes.
3. **The evidence chain + the diagnostics reader wired into the suite itself**: every call the
   suite performs emits R3 chain rows (`ceiling` / `call`, additive `provider`/`effect` fields),
   and the suite finishes by running **`scripts/a5sf-diag.mjs` over its own run rows** and
   requiring `verdict=NO_BYPASS_FOUND` — plus a **synthetic out-of-ceiling allow** in its own
   file that the same reader must report as a bypass (the negative control that proves the reader
   is sensitive, not decorative).
4. **A host-free `--dry` mode that runs the whole slice except the Host**: the REAL P1 compiler,
   the REAL shipped guard, the REAL locator algebra, the REAL R3 recorder and the REAL R4 reader
   are all executed. The read itself is performed by a `dry-node-fs` driver — **it is not the
   native `read` tool**, and the evidence says so on every row (`provider.kind=dry-node-fs`,
   `provider.native=false`).
5. **A live driver contract** for the one thing that needs the Host (`A5SF_READ_DRIVER`), and a
   **fail-closed refusal** (`LIVE_SEAM_UNAVAILABLE`, zero starts) while that seam does not exist
   in this tree — see §5/§6.3.

### File-name note

The backlog names the suite `tests/world-factory/suites/a5sf-read.mjs`, but the collected-suite
loader (`tests/world-factory/lib/suites.mjs`) enumerates `^(\d{3})-([a-z0-9][a-z0-9-]*)\.mjs$`
and requires the suite name to equal the file's name part. The file is therefore
`suites/150-a5sf-read.mjs` (150 = next free after 140) and its **suite name is `a5sf-read`** —
the name the backlog, the gate and the RUN record all use. The loader was not edited.

## 2. Status: what is proven today, and what is not

| half | tier | run today? | evidence |
|---|---|---|---|
| budget gate: every refusal arm + the granted lease (one reservation row before the boot, one boot, second boot refused) | C1, host-free `node --test` | **YES — 10/10** | [`green-tests.log`](./green-tests.log) §1, [`red-test.log`](./red-test.log) |
| the slice's policy path: real compile → real guard → typed allow/deny → real recorder → real diag + real chain reader, two-Member isolation, >10MiB policy admission, synthetic bypass caught | C1.5 host-free `--dry` | **YES — 11/11 assertions** | [`green-tests.log`](./green-tests.log) §2 |
| native `read` tool reading through the mounted Provider **inside a booted Host**, the >10MiB native window/stream, a Host-attributable effect | C2, needs ONE Host boot + the live driver | **NO — not run, not claimed** | §5 procedure; §8 limits |

## 3. Scenario table (each row = one case id of the suite)

Acceptance criterion per row, the mode that can decide it, and the state today. "Dry" means the
row is decided host-free by the real compiler/guard/algebra/reader; "live" means it needs the
booted Host.

| # | case id | acceptance criterion | mode | state today |
|---|---|---|---|---|
| 1 | `read:allowed-inside-ceiling` | the compiled ceiling admits the locator (`matchLocator` = `allow`), the shipped guard returns without throwing, the Provider is consulted and returns exactly the file's bytes; the chain's four links agree on member/generation/invocation/binding | dry **and** live | **dry PASS**: guard allow, 55/55 bytes, chain `CHAIN_BROKEN(link=effect, EFFECT_NOT_OBSERVED)` — the ONE link that needs the Host pid |
| 2 | `read:denied-outside-ceiling` | the compiled ceiling denies the locator; the guard throws the P1 typed denial (`IO_READ_DENIED`), the Provider is **never** consulted, and the chain still aligns (a refusal needs no effect) | dry **and** live | **dry PASS**: denial code `IO_READ_DENIED`, `consulted=false`, chain `CHAIN_ALIGNED` |
| 3 | `read:denied-zero-bytes` | the refused read returns zero bytes and the denied locator's content appears in **no** evidence artifact (no leak) | dry **and** live | **dry PASS**: `bytes=0`, `text=null`, content absent from the chain JSONL |
| 4 | `read:window-over-10mib` | a **>10MiB** file (strictly greater: 10 MiB + 1) is admitted by the compiled ceiling and read through the **native window/stream** returning the window, not the whole file | live only | **dry PARTIAL**: size 10 485 761 B admitted, `windowed=true` via node:fs read; the NATIVE tool's window/stream is **not** exercised — recorded `NOT_REACHED` in a live run |
| 5 | `read:two-member-isolation` | Member A's allowed locator is **denied for Member B** under the SAME tool binding (two different compiled ceilings; authority is per Member) | dry **and** live | **dry PASS**: `mi-alpha-1` allow vs `mi-beta-1` deny on the same path |
| 6 | `read:chain-diag-no-bypass` | `scripts/a5sf-diag.mjs` over the suite's own rows exits 0 with `verdict=NO_BYPASS_FOUND`, **AND** over the synthetic out-of-ceiling allow exits 1 with `ALLOW_OUTSIDE_COMPILED_CEILING` | dry **and** live | **dry PASS**: `SUMMARY … findings=0 … verdict=NO_BYPASS_FOUND`; synthetic → `APPROVAL_BYPASS … code=ALLOW_OUTSIDE_COMPILED_CEILING`, exit 1 |
| 7 | `read:leak-check` | the evidence dir contains no fixture content from a refused locator | dry **and** live | **dry PASS** |

## 4. The budget pre-registration gate

### 4.1 The grant (a recorded ledger file)

One JSON object file, or a JSONL ledger with **exactly one** grant row (two rows ⇒
`GRANT_AMBIGUOUS`, no winner is chosen because the two could differ in `maxStarts`):

```json
{"grantId":"grant-a5sf-p2-read-001","maxStarts":2,"grantedBy":"<who ruled>","boundCommit":"<40-hex HEAD>"}
```

* `grantId` non-blank · `maxStarts` positive integer · `grantedBy` non-blank · `boundCommit` a
  full 40-hex commit. Any violation ⇒ `BUDGET_NOT_GRANTED reason=GRANT_MALFORMED`.
* `boundCommit` must equal the run's own `git rev-parse HEAD`; otherwise
  `reason=GRANT_FOREIGN_COMMIT` (a grant issued for another tree authorises a different artifact).
  An unresolvable HEAD is `reason=GRANT_HEAD_UNKNOWN`, never a pass.
* The grant path comes from `--grant <file>` / `A5SF_BUDGET_GRANT`.

### 4.2 `maxStarts` counts SHARED-LEDGER ROWS, not spawns

The shared ledger has ONE counter (`run-record.mjs#ledgerStartCount`) and ONE gate
(`run-record.mjs#hostStartBudgetPosition`, imported — never restated). This suite keeps **no
counter of its own and no ledger of its own**. Its pre-registration row is itself a row on that
ledger (a **reservation**, `kind:"budget-intent"`, tagged with `grantId`/`grantedBy`/
`boundCommit`/`plannedStarts`), so:

> **`maxStarts = 1 reservation row + N boots`.** BL-14 needs ONE boot ⇒ `maxStarts: 2`.

Ordering is the law: **intent row → (`lease.boot` re-verifies it, re-asks the one gate) → start
row (written by `harness.boot()` through the same `logHostStart`) → `world.startHost()`**. A
crashed run therefore over-counts by one reservation (fail-closed: the pool can only look MORE
spent, never less). This is disclosed, not hidden.

### 4.3 The refusal arms (all C1-tested, zero boots)

`BUDGET_NOT_GRANTED` with a closed reason: `GRANT_ABSENT`, `GRANT_UNREADABLE`, `GRANT_AMBIGUOUS`,
`GRANT_MALFORMED`, `GRANT_TOO_SMALL`, `GRANT_EXHAUSTED`, `GRANT_FOREIGN_COMMIT`,
`GRANT_HEAD_UNKNOWN`, `LEDGER_UNAVAILABLE`, `INTENT_NOT_RECORDED`. A refusal **creates no World,
writes no ledger row and calls no factory** — the C1 suite proves the ledger file is
byte-identical after each refusal (`readonly` arms 1–7) and that the suite's `run()` records no
case verdict and touches no factory on an absent grant (arm 9).

## 5. The C2 procedure — the one command, and exactly what it spends

**Prerequisite (not satisfied at this base): a live read driver.** The command below is the
procedure a budget holder runs once the driver exists; today it refuses before spending anything
(§6.3).

```bash
# 1. a recorded grant is REQUIRED (the pool is 0; a boot needs a USER ruling).
cat > /tmp/a5sf-read-grant.json <<'JSON'
{"grantId":"grant-a5sf-p2-read-001","maxStarts":2,"grantedBy":"<user ruling id>","boundCommit":"<git rev-parse HEAD of this worktree>"}
JSON

# 2. ONE command, ONE World, ONE boot. The runner does not forward --grant/--driver
#    to a collected suite, so both travel in the environment the child inherits.
A5SF_BUDGET_GRANT=/tmp/a5sf-read-grant.json A5SF_READ_DRIVER=<module> \
node tests/world-factory/u5-canary-runner.mjs --suite a5sf-read \
  --line a5sfread --evidence <gitignored evidence dir> \
  --run-record <dir>/run.json --budget-ledger <shared ledger.jsonl> --max-host-starts 2
```

**What it will spend:** exactly **one Host start** (one `startHost()`, one World, one boot) plus
one budget-reservation row on the shared ledger; `maxStarts: 2` = 1 reservation + 1 boot. The
runner's own gate still applies: if the shared ledger already holds `>= 2` rows, both the runner
and this suite refuse (`BUDGET_EXHAUSTED` / `GRANT_EXHAUSTED`) and nothing is spawned. Without a
grant the suite refuses `BUDGET_NOT_GRANTED` and spends **zero**. Without the driver it refuses
`LIVE_SEAM_UNAVAILABLE` **before** the gate and spends **zero rows** (test arm 10).

**What CI runs today (no grant, no driver, no Host):**

```bash
node --test tests/world-factory/a5sf-read-gate.test.mjs     # 10/10
node tests/world-factory/suites/150-a5sf-read.mjs --dry     # 11/11 assertions
```

## 6. Mechanically produced vs lane-claimed — and the exact seam gap

### 6.1 Per fact

| fact in the chain row | produced by | mechanical? |
|---|---|---|
| `ceiling.tools[].read/write` | `compileMemberPolicy` ∩ `projectToolIoRestriction` via `compileEffectiveIo` (the ONE computation) | **mechanical** (real P1 modules) |
| `call.disposition` | `path-rules.ts#matchLocator` over the compiled `EffectiveIo` — the same function the R4 reader uses | **mechanical** |
| `call.lane` | the shipped `createMemberFsGuard`'s outcome, mapped from its typed `TeamIoDenial` code (`*_DENIED` ⇒ `deny`, `IO_POLICY_UNSUPPORTED` ⇒ `ask`); never an allow/deny guess | **mechanical** |
| `call.provider.consulted` | dry: the `dry-node-fs` driver's own call count. live: the live driver's report | **mechanical for the DRY driver; a DRIVER CLAIM in live mode** — see §6.2 |
| `call.effect` | `lib/oracle.mjs` sound conjunction (marker ∧ `body-ran` ∧ live pid) | **mechanical** (and in dry mode it correctly answers `false`, because there is no live pid) |
| `call.toolBindingIdentity`, `instanceGeneration`, `policyRevision` | the compiled objects | **mechanical** |
| approval link (`kind:"approval"`) | **absent in this package** — no ControlService call is made (no Alpha.4 ask lane is exercised in BL-14; a `read` allow needs none) | n/a — an allowed plain-`allow` call needs no durable row, and the chain says so |

### 6.2 The R3 reviewer's key finding, restated honestly

`consulted` and (in the R3 sense) `disposition` were **lane-claimed** booleans. This package makes
`disposition` mechanical (it calls the shipped algebra itself) but **cannot** make the *native
tool's* `consulted` mechanical without touching shipped code:

* the confined Provider is constructed **inside** `installToolBindingRealm`
  (`packages/runtime/team-services/src/install.ts:260`): it does
  `const guard = createMemberFsGuard(spec.effective); const Confined = createConfinedFileSystemClass(Base, guard)`
  and returns `{ identity, toolBindingIdentity, policyRevision, ctx, fs, dispose }`.
* the guard closure is **not** returned, not observable, and the base `providerClass` the caller
  may pass is the *unconfined* base class — so from outside the module there is no way to observe
  "the Provider called the guard for this call". The only honest inference available is
  "`fs.<method>` returned the base implementation's result ⇒ the guard admitted it", which is a
  property of `createConfinedFileSystemClass`'s code, not an observation.
* in `--dry` mode the suite therefore labels the fact exactly: `provider.kind=dry-node-fs`,
  `provider.native=false`, and the assertion message says "the DRY driver". In live mode,
  `consulted` is whatever the driver contract reports — i.e. **still a claim** until the seam
  below exists.

**The smallest honest instrumentation point (proposed, NOT applied — `CORE PATCH BUDGET = 0` and
`packages/runtime/**` would be a SCOPE EXPANSION):**

```ts
// packages/runtime/team-services/src/install.ts — 3 lines, no behaviour change
export async function installToolBindingRealm(input: {
  readonly root: Context
  readonly spec: ToolBindingRealmSpec
  readonly providerClass?: FsProviderConstructor
  /** NEW: optional observer of the guard the confined Provider actually calls. */
  readonly onGuardConsult?: (fact: { method: string; target: string; decision: 'allow' }) => void
  /** NEW: optional factory so the caller can wrap/decorate the one guard. */
  readonly guardFactory?: (policy: EffectiveIoPolicy) => FsGuard
}): Promise<ToolBindingRealm>
// …
const guard = (input.guardFactory ?? createMemberFsGuard)(spec.effective)
const Confined = createConfinedFileSystemClass(Base, input.onGuardConsult === undefined ? guard : wrapGuard(guard, input.onGuardConsult))
```

`wrapGuard` records `(method, target)` **before** delegating and the delegation's typed outcome
after — so `consulted` becomes "the guard was invoked" and `disposition` becomes the guard's own
allow/deny/ask, both mechanically. Two alternatives were considered and rejected: emitting a new
`kind:"provider"` row (the R4 reader silently `ignored`s unknown kinds — invisible evidence, the
parallel schema the reclamation registry forbids), and returning `guard` on the already-frozen
`ToolBindingRealm` (the Provider captured the original closure at construction, so a late wrapper
observes nothing). The seam gap is filed here, not patched.

### 6.3 The other seam gap: the a5sf realm is inert in a booted Host

`grep -rn "installMemberIoProviders|installToolBindingRealm" packages/ --include=*.ts` shows
**only** `team-services/src/index.ts` (the re-exports) — no production plugin, no
`packages/runtime/src/**`, no row ever mounts a Member realm or a tool-binding realm. The P1
realm is provable in-process and inert in a Host, and a suite cannot reach a child Host's Cordis
root across the process boundary. That is why the live path is a **documented driver contract**
(`A5SF_READ_DRIVER`) and why live mode refuses `LIVE_SEAM_UNAVAILABLE` before the budget gate.
Turning this into a boot is P2 wiring in `packages/runtime/**`, i.e. a SCOPE EXPANSION this lane
must not take; the proposed patch is to have the production Team row call
`installMemberIoProviders` / `installToolBindingRealm` for each admitted Member (the P1-05/06
installers already exist), and to expose the driver as an env-selected row so a suite never needs
in-process access to the Host root.

## 7. CI enrolment (one step + one undroppable leg, exactly the R2/R3 shape)

* `.github/workflows/ci-integration.yml` — ONE step
  `a5sf read budget gate C1 (P2-01/BL-14 …)` running
  `node --test tests/world-factory/a5sf-read-gate.test.mjs`, after the R4 diag step.
* `dev/ci/eb3-ci-manifest.json` — ONE `ci-integration` leg `a5sf read budget gate C1` whose
  `check[]` holds that same path, so dropping the file is `CI_LAYER_LEG_WEAKENED`, not a silent
  gap.

Measured at this base: `node scripts/eb3-ci-required.mjs` → `pass workflows=9 findings=0`;
`node scripts/eb3-ci-negative-controls.mjs` → `24/24 control(s) behaved as required`;
`node scripts/doc-checks.mjs` → exit 0.

The gate suite is deliberately **bare-checkout-safe** (no workspace runtime dependency): it
imports only `lib/run-record.mjs` (node builtins) and the suite module, whose top level does not
import the Host machinery (the harness is a dynamic import inside `run()`). This is why it can be
green in CI *and* in an uninstalled worktree, unlike the R2/R3 suites that need
`pnpm install --frozen-lockfile` (`pnpm install` is broken in this environment:
`ERR_SQLITE_ERROR`). The `--dry` scenario also avoids the harness for the same reason: it
deep-imports `team-services/src/fs.ts` (the module the P1-05 test itself imports), never the
barrel, so the `@deepseek-ai/cordis-plugin-include` dependency is never pulled.

## 8. What is NOT proven without the boot (do not read any of this as C2)

1. **The native `read` tool**. Dry mode reads through `node:fs` in the suite process. No Host
   tool, no model-facing tool_result, no native `read` code path.
2. **"the tool reads through the Provider" inside a Host.** No a5sf realm is mounted by any
   production code (§6.3), and no live driver exists. The **Provider-consulted** link is exactly
   the one link the dry chain reports broken, by design.
3. **The >10MiB native window/stream** (`read` tool `offset`/`limit`, spill/stream behaviour).
   Dry mode proves only that a 10 MiB + 1 B file is *admitted by the compiled ceiling* and that a
   64 KiB window can be read from it.
4. **A Host-attributable effect**: the sound oracle's third conjunct is a live host pid, so dry
   mode answers `effect=false`. This is why the dry chain's allowed calls are
   `CHAIN_BROKEN(link=effect, EFFECT_NOT_OBSERVED)` and the run's chain verdict is
   `CHAIN_BROKEN` while the **bypass** question (the R4 reader) is clean. The two readers answer
   different questions; neither is collapsed into the other.
5. **An Alpha.4 approval lane.** BL-14 exercises the plain `allow` and `deny` lanes only; no
   `ask` + durable-consumption row is recorded (the R1 adapter is PR #541's surface, not this
   slice's). A narrowed allow is therefore untested here.
6. **The two-Member isolation at the *Host* level**: dry mode proves two compiled ceilings and
   two guard instances disagree about one locator; it does not prove the Host routes Member B's
   call to B's realm (that is the same missing mount as (2)).
7. **Tamper-evidence**: the chain rows are not signed; a writer with the file can edit them.

## 9. Files

| file | why |
|---|---|
| `tests/world-factory/suites/150-a5sf-read.mjs` | the `a5sf-read` collected C2 suite: pre-registration gate (`preRegisterReadBudget` / `lease.boot`), the shared allow/deny/>10MiB/two-Member scenario, the R3 recorder + R4 reader round-trip, the synthetic bypass control, the host-free `--dry` CLI and the documented live driver contract. `150-` is the loader's required ordering prefix (suite name stays `a5sf-read`). |
| `tests/world-factory/a5sf-read-gate.test.mjs` | 10 host-free `node:test` arms: absent/malformed/ambiguous/foreign-commit/too-small/exhausted/no-ledger refusals leave the ledger byte-identical and spend zero starts; a granted lease appends its reservation BEFORE the boot, boots once via a stub and refuses the second boot; the suite's `run()` refuses before touching a factory and records no verdict; the missing live driver refuses before reserving budget. |
| `.github/workflows/ci-integration.yml` | ONE `ci-integration` step for the gate suite (the layer lists its `node:test` files explicitly, so an unlisted file runs nowhere). |
| `dev/ci/eb3-ci-manifest.json` | ONE required `ci-integration` leg for that step, so dropping it is `CI_LAYER_LEG_WEAKENED`. |
| `dev/agent-workflow/evidence/a5sf-p2-read/README.md` | this account. |
| `dev/agent-workflow/evidence/a5sf-p2-read/red-test.log` | the RED capture: the gate module absent (all arms red) + two mutations (foreign-commit check deleted ⇒ arm 4 red; exhaustion refusal deleted ⇒ arm 6 red), each restored byte-for-byte with the sha256 re-checked. |
| `dev/agent-workflow/evidence/a5sf-p2-read/green-tests.log` | the GREEN transcript: gate 10/10, dry 11/11, the inherited R4 suite 11/11, `eb3-ci-required`, `eb3-ci-negative-controls`. |

No file under `packages/**` was added or modified, so
`packages/testkit/test/p4t6-bookings/a5sf.json` was **not** touched (the measured-tie duty does
not apply).

## 10. The single risk for the reviewer

**The live half is a contract, not a measurement** — and it depends on the unmerged PR #545.
Concretely: the suite's C2 path cannot be exercised at this base because no production code
mounts the a5sf realm in a Host (§6.3) and `consulted` is not observable at the installer seam
(§6.2), so the strongest claim this package makes about a real Host is "refused before spending".
Because the seam probe refuses before the gate, the **live body of `run()` has never executed** —
not even its first scenario line. It is reviewed by reading, not by running: the policy/evidence
half it calls is the half the `--dry` mode actually executes (same `runScenario`), but the
World-creation / `startMock` / `harness.boot` / driver-install sequence is unexercised, and a live
run may need the driver contract tightened. Do not read "the suite implements C2" as "C2 ran".

If the reviewer requires a booted proof for BL-14, the prerequisite work is (a) merge #545,
(b) land the `install.ts` guard observer + the production realm mount, then (c) run the §5
command with `maxStarts: 2`. Until then the honest grade for BL-14 is **C1 + host-free dry PASS,
C2 NOT RUN** — not a G2 pass, and this package does not claim one.
