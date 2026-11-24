# CANDIDATE REPORT — UTE vNext A1 cut + ONE centre (PR #822, DRAFT)

**This is the one document a reviewer reads first.** It states the current truth of the candidate: what it
claims, what is measured, what is NOT measured, and what the owner must decide. It supersedes the *prose* of
`D-ACCEPTANCE-REPORT.md` (which stays as the append-only chronological record; its round sections are
historical where they disagree with this file) and it does not replace `C1-C18-SIGNOFF.md`, which is the
itemised per-contract-row sign-off this file summarises.

**Round 115, 2026-11-24.** Every number below was measured in `.worktrees/vnext-a1-cut` at the HEAD named in
§1 and is traceable to a named log or artifact. Where a claim is not measured, it says so.

---

## 1. Identity

| field | value | how to check |
| --- | --- | --- |
| branch | `vnext/a1-cut` | `git rev-parse --abbrev-ref HEAD` |
| **HEAD** | **`974c643de747d846a9ebeb2edb82677813ade467`** | `git log -1` → `974c643de chore(ute-vnext): round-114 postcommit gate logs at 194a5c3ce` |
| base | `master @ a19d1df01` (frozen A0, PR #821) | `git merge-base --is-ancestor HEAD origin/master` → false; `origin/master` = `a19d1df01` |
| PR | **#822 — DRAFT (unmerged)** | `gh pr view 822 --json isDraft,state,baseRefName,headRefOid` → `{"baseRefName":"master","isDraft":true,"state":"OPEN","headRefOid":"974c643de747d846a9ebeb2edb82677813ade467"}` |
| worktree | `.worktrees/vnext-a1-cut` (sole writer) | — |
| A0 contract implemented | `docs/plans/memo/ute-p0-20261121/` — `01-ASSET-INVENTORY.md` (37/180/69,512 census), `03-RETIRE-KEEP.md` (retire/keep map), `04-SEAMS.md` (the P1–P5 proof obligations), `06-CAPABILITY-CONTRACT.md` (the C1–C18 list A1 must dispose of); frozen evidence is read-only in this candidate | files unchanged |
| record class of every live claim | **`DEV-LIVE`** — a real booted pinned host, **not a gate** | §5, §6 |

**What this candidate claims to be.** UTE vNext — one centre, native tools. Team owns identity, binding,
admission, EffectiveIO, the OS boundary, lifecycle and settlement; the host owns execution. The A1 cut deletes
the governed-family execution plane (148 sources) and replaces its duplicated per-family policy computation
with **one** admission decision per call, compiled into a lane, executed on a substituted provider behind an
OS boundary, and closed by **one** durable settlement. No legacy plane is wrapped as an internal component, no
legacy fallback exists, and no second registry/mount/executor can be selected by configuration (§3).
The candidate is **not** a product acceptance, **not** a release, and **not** merge-ready: no row is
PRODUCT-PROVEN, the live layer is non-required by owner ruling, and the model in every boot is a scripted mock
(§8).

---

## 2. Static closure — the four zeros, the vehicle counts, and what they do NOT prove

Fresh at this HEAD (logs: `round115/gate-ute-cut-closure.log`, `round115/gate-ute-p0-assets.log`,
`round115/gate-place-dist-glue.log`):

```
$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (35 placement(s))        # every line reads (byte-identical)
```

**The numbers, and exactly what each one means.**

| number | meaning | what it does **not** prove |
| --- | --- | --- |
| **148 deleted files** | 146 files deleted + 2 entries replaced (`agent-bindings.mjs`, `root.ts`) — the frozen A0 delete/replace set, i.e. 148 sources gone | nothing about behaviour: a deletion is an absence fact |
| `prodRefs=0` | no surviving **production** import of a retired entry (`references=3` non-production references remain) | nothing about runtime reachability of the replacement |
| `distResiduals=0` | no stale dist mirror of a deleted source | not a claim that the 35 placements are behaviourally fresh — that is `check-artifacts-at-head`'s business |
| `cut(0/148)` | the closure gate finds **zero** frozen-set files still present | not "the cut was correct"; it is "the cut is complete" |
| `cut(148/148)` | the assets gate accounts for **all 148** as deleted-or-replaced | same |
| `dupNames=0` | no duplicate tool-name declarations | not a closed-set proof for the whole surface (that is `ADM-31` both directions) |
| **retiredSurfaces=12** | 12 retired surfaces carry a named successor/citation in the A0 retirement record | not a per-surface behaviour test |
| **37 / 180 / 69,512** | the frozen A0 census: 37 modules, 180 files, 69,512 lines, of which **keep=32** | the census is frozen at A0 by definition; it is not re-counted against HEAD |
| **35 dist placements** | 35 byte-identical `.mjs`/`.py` placements maintained by `place-dist-glue` | a **different measure** from A0's "52 committed dist artifacts"; the closure gate cannot see the aggregated `packages/runtime/dist/packages/<other-pkg>/…` mirrors or `.mjs` byte-copies (`CUT-BOUNDARY-ADDITIONS.md:27-32`). The two numbers are not comparable and neither is quoted as the other |

**What the static block does not prove, stated plainly:** it proves *absence and accounting*, not *behaviour*.
It cannot prove that a surviving call is admitted correctly, that a provider is confined, that a settlement is
terminal, or that anything ran. Those are §4/§6's business, at the levels those sections name.

---

## 3. Architecture — the single-authority verdict

The audit is `ARCHITECTURE-AUTHORITY-AUDIT.md` (round 103, two big assembly entries at `f880370d2`, line-exact
against this branch's code; the entries have not changed shape since — the round-114 product change is a ledger
`fsync` inside `fact-ledger.mjs`, not a wiring change).

**Verdict: `SINGLE-AUTHORITY` — no second execution authority.** 53 surfaces were classified: **25** in
`root.ts`, **26** in `agent-bindings.mjs`, **2** cross-cutting.

| verdict | count |
| --- | --- |
| CENTRE (passes through / feeds / installs the one centre) | **17** |
| CENTRE-INPUT (supplies a decision the centre still judges) | **3** |
| LAWFUL-DELIVERY (management plane; executes no tool) | **7** |
| LAWFUL-HOST (leader plane, outside the Member centre by design) | **3** |
| LAWFUL-NOEXEC (durable write / read only) | **12** |
| LAWFUL-CONTAIN / BLOCK (can only remove authority or refuse) | **6** |
| LAWFUL-REFUSAL (the outcome is a refusal, never an allow) | **3** |
| CONFIG-UNGOVERNED (owner-ruled, reported) | **1** |
| NOT-REACHED (latent shape, unreachable today) | **1** |
| **FINDING (P0/P1)** | **0** |

The law that makes the guard unavoidable is a **host public mechanic, verified in the pinned source, not
assumed**: `tools.guard()` registers a scoped guard and the shared pipeline runs `tools/pre-execute` →
`checkGuards` → dispatch for **every** dispatch, including a direct `tools.execute()`; there is no second
dispatch path in the host. Two observations are recorded and **not** fixed (neither is reachable from these
entries): `member-execution.mjs:207-224` mounts native specs without checking a centre was installed
(unreachable — production passes no `nativeSpecs`), and both entries name something called `admission` that is
not the centre (a navigation hazard, renamed in no round).

**Responsibility maps (pointers, not copies):** the audit's §9 responsibility map for navigating the two
entries; `CAPABILITY-MATRIX-C.md` for the per-tool **enforcement** axis; §8.3 of the audit states the boundary
that matters for a reviewer: *enforcement coverage is the matrix's business, not authority* — a controlled tool
whose provider was not substituted can execute on the base provider **with** a centre allow (that is the
`ENFORCE-PARTIAL` / `NOT_WIRED` axis, and `bash` is the known instance), which is a coverage question, not a
second authority.

**There is no second execution authority and no legacy fallback.** The deleted plane is not wrapped: no legacy
Plane/Family Body/Kernel/PA Bridge survives as an internal component, `prodRefs=0` says no production import of
a retired entry survives, and the A0 retirement record names a successor for each of the 12 retired surfaces.
A call that has no closed-set home is **refused by name** (`ADMISSION_TOOL_UNBOUND`), never forwarded to a
legacy or default provider (`ADM-3`, `ADM-102`).

---

## 4. The P1–P5 ladder with OS negative controls

Two obligations meet here and are kept separate: **P1–P5** are the UTE proof laws (`04-SEAMS.md:57-67`, "each
proof is a pair: an assertion that must be green and a mutation that must turn it red"), and the **six-rung
ladder** (read → write → grep → `web_fetch` → persistent `bash` → `run_code`/PTC) is where those laws become
per-tool arms. A rung is only evidence of the OS boundary when it has a **negative control that would go red if
the boundary were removed**; where the measured runner cannot produce that control, the rung is `ENV-LIMITED`
and is never counted as proven.

### 4.1 P1–P5, per obligation

| proof | obligation (verbatim subject) | mechanism arms | live judge (host · boots · verdict) | must-red negative control |
| --- | --- | --- | --- | --- |
| **P1** | Binding monotonicity: `EffectiveIO ⊆ AgentCeiling ∩ ToolRestriction` | `ADM-2`, `ADM-7`, `ADM-29/30`, `ADM-39`, `ADM-45`, `ADM-52` | `d:centre-facts` (rc.2 + rc.5 · 2 agreeing boots · **PROVEN** — one ledger holding `allow` **and** `DENY/LANE_DENY`); `d2:multi-member-concurrency` (**PROVEN**, A's read of B's in-lane file is `LANE_DENY`, zero B bytes); `d2:revocation` (**PROVEN**, widening refused) | widen one axis after approval ⇒ same call refuses (`ADM-52`); live widening refused by the durable lane (`d2:revocation` direction (d): `changed:false`, widened locator still `LANE_DENY`) |
| **P2** | Face completeness: a tool with all required faces bound runs; a tool missing one is refused **whole** | `ADM-4`, `ADM-18`, `ADM-33`, `ADM-78` | `d3:persistent-subprocess` (rc.2 + rc.5 · 2 agreeing boots · **PROVEN**) — `bash` runs only after the world declares `authorization` + `executionBoundary`; an unplaceable declaration is refused whole (`ADMISSION_EXECUTOR_UNAVAILABLE`) | bind `faces.web = null` ⇒ the whole tool refuses, never "runs without web"; the live-shaped negative is ladder rung 6 (`ADM-76`) |
| **P3** | Fail-closed: provider absent ⇒ refuse | `ADM-3`, `ADM-42`, `ADM-83`, `ADM-102`, `SLICE-9` | `d:guard-facts` (**PROVEN**, `out-lane-never-reached-provider 0` guard facts) | `SLICE-4`: **without** the realm mount the same outside read **SUCCEEDS** — the confinement arms are falsifiable |
| **P4** | One fact: one `ExecutionId`, one canonical outcome per physical attempt; a crash between emit and return leaves a recoverable fact | `ADM-21`, `ADM-79`, `ADM-80`, `ADM-81`, `ADM-84` | `d3:crash-cold-recovery` (rc.2 + rc.5 · 2 agreeing boots · **PROVEN**) — real `SIGKILL`, restart on the same home: in-flight `RUNNING` → `UNKNOWN`, no execution fact, never replayed; the completed call's fact/settlement byte-identical | kill after emit ⇒ recovery yields `unknown`, never `succeeded` from memory; `ADM-79`'s control also completes a different call before dying, which stays `COMPLETED` (no blanket rewrite) |
| **P5** | Stop is durable and non-replaying: after stop + cold start, facts are restored and nothing re-executes | `ADM-56…ADM-62` | `d2:stop` (rc.2 + rc.5 · 2 agreeing boots · **PROVEN**) through the product's own `POST /api/session/cancel`: `ADMISSION_STOPPED`, settlement `REFUSED`/`not-started`, no execution fact, never `UNKNOWN`; a second member completed with zero stops | restart and assert the previous call is not resumed (a resume attempt must red); the second Member is the live negative that Stop is not a blanket |

The mutation half of P1/P2/P4/P5 was performed and reverted in the rounds that landed them (seven and six
mutation edits, each reddening exactly its own arm); P3's mutation is the missing-mount world (`SLICE-4`).

### 4.2 The six rungs — mechanism arm, live judge, OS-level negative control, declared exception

Mechanism arms are the `ute-vnext-a1` node leg (`packages/runtime/test/vnext-b-probe-ladder.test.mjs`), which
since round 112 is **host-selectable through the one selector**: the same 18 arms measure **18/18 on rc.2 and
18/18 on rc.5** (16 pass + the same 2 declared non-runs each). Live judges are the D drivers; the OS controls
are `OS-1/2/3` plus the provider's own kernel-level refusals.

| rung | mechanism arm (positive / negative) | live judge (host · boots · verdict) | OS-level negative control (kernel evidence) | exception |
| --- | --- | --- | --- | --- |
| **1 read** | `ADM-64` positive / `ADM-71` negative (`LANE_DENY` before the body, zero provider calls) | `d:member-read-admitted` + `d:guard-facts` — rc.2 **and** rc.5, 2 agreeing boots each, **PROVEN** (2 `allow` facts `stat`/`readText`, member identity named) | `OS-1` Landlock ABI 7; `OS-2` **negative** — the confined payload CANNOT read outside its allow set; `OS-3` **positive** — it CAN read inside. Both ran in this session's leg | none |
| **2 write** | `ADM-65` positive (bytes land, `COMPLETED`) / `ADM-72` negative (file never created, zero provider calls) | `d4:ask-execute` (rc.2 + rc.5, 2 boots, **PROVEN**, 27 B, `sha256:ced10112…`) and `d4:ask-execute-2` (29 B, `sha256:2d71ffdd…`) — the write arrives only after a real Control allow + one-shot consume; `d2:revocation` for the deny/restore directions | the same Landlock pair; on the live governed face an out-of-lane write is refused by the OS profile, and the driver reading from **outside** the sandbox finds **0 bytes** | none |
| **3 grep** | `ADM-66` positive / `ADM-73` negative (`LANE_DENY`, zero confined spawns) | `d:guard-facts` + the round-64 live in-lane `grep` (`decision=allow`, `overlayOutcome=no-opinion`, a real match); `SLICE-39` parent-allow/child-deny recursive control **GREEN** | the search runs through the **confined subprocess** face, i.e. the same netns/Landlock capability the ladder probes before admitting a confined spawn (`A5SF-CAPABILITY network-deny=…`); on a runner that cannot prove it, the arm fails closed | **`ENV-LIMITED` on the hosted `ci-census` runner**: 5 arms (`OS-2`, `OS-3`, `ADM-66`, `SLICE-28`, `ADM-70`) assert the product's fail-closed refusal instead, printed as `UTE-VNEXT-A1-ENV-LIMITED` and aggregated `DSH-TEST-DISPATCH-ENV-LIMITED count=5 proven=0 env_blocks=3 fail_closed_controls=2`. Never counted as PASS |
| **4 web_fetch** | `ADM-67` positive (one transport call, loopback body) / `ADM-74` negative (`NETWORK_DENY`, zero transport calls) | **no live boot**: the web face is in-process only (`SLICE-31/32`, `ADM-67/74`) — stated as a limit, not as live evidence | the network axis is decided at the centre **before** any transport, and no fs lane can authorise the network (`ADM-111`); the OS-level `network: deny` proof is the same netns capability as rung 3 and is `ENV-LIMITED` on the hosted runner | **`ENV-LIMITED`** — no live `web_fetch` judge exists in this candidate |
| **5 persistent bash** | `ADM-125` positive (the real positive control) / `ADM-75` negative (`ADMISSION_EXECUTION_UNAUTHORIZED`, zero spawns, zero confines); `ADM-68` in the ladder is the **declared non-run** (the ladder world compiles no execution authorization) | `d3:persistent-subprocess` — rc.2 **and** rc.5, 2 agreeing boots, **PROVEN**: first call admitted (`process.exec allow`), durable shell state written, a second turn reuses the **same** shell and reads it back, both settlements `ADMITTED→RUNNING→COMPLETED` | the shell is wrapped by the host `sandbox` provider (`sandbox.confine`; bubblewrap 0.11.1 verified usable, Landlock launcher fallback): the in-lane file is written (32 B) while the out-of-lane write is refused — the shell itself reports `Read-only file system`, and the driver outside the sandbox finds no file (0 B) | `ADM-68` is a disclosed, labelled non-run (a skip that prints a machine line; never a pass) |
| **6 run_code / PTC** | `ADM-76` negative (typed `ADMISSION_PTC_UNAVAILABLE` + ruling status, zero worker, `REFUSED`/`not-started`), `ADM-79`, `ADM-87`; `ADM-69`/`ADM-147` positives are **`NOT APPLICABLE — PRODUCT UNSUPPORTED`**, asserted by `ADM-80`/`ADM-148` | **no live judge and none owed**: the product does not offer the capability, so the refusal is the deliverable | the refusal happens **before** any worker exists (zero effect); no OS profile is created for a call that never runs | **`UNSUPPORTED BY PRODUCT RULING`** (owner, 2026-11-24): `docs/reviews/20261124-0151.txt` §PTC, `ADR-ptc-unsupported.md`, `ptc-product-ruling.mjs` |

**Declared exceptions, in one place (they are promises, not gaps):**

1. **PTC / `run_code` — `UNSUPPORTED BY PRODUCT RULING`.** The refusal is typed, durable and machine-reported;
   a working `run_code` is not a goal of this generation.
2. **Per-call `ask` for process execution — `UNSUPPORTED BY PRODUCT RULING`.** `allow`/`deny` for
   Subprocess/PTY is the promised scope. The live `d4:ask-execute-process` judge is **`REFUTED` and preserved
   as REFUTED** on both hosts — the real ask→allow→consumed grant ran, then the PTY spawn failed with the
   host's `NO_BACKEND` because the v5 per-tool `bash` binding realm carries no PTY terminal spec: zero
   processes, zero bytes, settlement `FAILED`, verifier never reached. It is the **single enumerated**
   `KNOWN_REFUTED` in the candidate gate, matched by literal id, never by pattern, and never rewritten as a
   positive, as `REFUSED`, or as "not-started". Ruling: `SCOPE-subprocess-ask.md` §2/§4, review
   `20261124-2120` ruling 1.
3. **`ENV-LIMITED`, not proven:** the five hosted-runner arms above (network-deny OS enforcement) and the
   real-model layer (no `DEEPSEEK_API_KEY`, §8).

---

## 5. Required CI

### 5.1 The last fully green hosted set, with census

**Run `45429461306`, head `a4a00fc816124d3d82bbebd8d37f833d7bc172c1`, 2026-11-24T15:46:52Z — every layer and
the synthetic `ci-required` context SUCCESS, with the census actually RUN.** (Immediately preceding fully green
set: run `45424962377` @ `fc4bac62e2`, 15:23Z, same shape — two independent heads.)

| job | conclusion | what that layer covers |
| --- | --- | --- |
| `synthesize-merge-tree` | success | the candidate tree the layer jobs grade |
| `ci-fast` | success | the fast change-set legs (cheap static/graph/tooling checks) |
| `ci-product` | success | the product's own suites |
| `ci-integration` | success | the migrated UTE capability suites (`tests/checks/eb3-ute-migrated-suites.txt`, 238 tests) plus the EB tooling legs (incl. `devex-diag`, the leg that was red — §5.3) |
| `ci-security` | success | the token-runner / security layer |
| `ci-census / census-runtime` | success | the nine-root census with the pristine pinned host provisioned from `tests/paths.mjs` |
| `ci-required` | success | the synthetic context that grades **every** layer: absence, skip, cancel, ENV_BLOCK, refused and failure are all **NOT green** |
| `ci-required-deferred` | skipped | the complement job that runs only on a draft/deferred PR |

### 5.2 `ci-census` skips on a draft — by design, and it is load-bearing

`.github/workflows/ci-required.yml:150` runs census only when `!pull_request.draft && !label ci-defer-full`;
`:205` runs a complementary `ci-required-deferred` job on exactly the negated condition. So **while PR #822 is
a draft, census does not run and `ci-required` cannot be green** — the deferred job reports the skip, and
`ci-required` counts it as NOT green. That is the mechanism, not a malfunction: the owner's draft state is what
suppresses the census.

### 5.3 The honest statement about "the final head"

**The final head must re-earn the set.** At the HEAD measured by this report (`974c643de`) the hosted set is
**red**, and the two causes are named:

- `ci-census: skipped` — because the PR is a draft (§5.2). Nothing in this candidate can change that while the
  draft stays draft.
- `ci-integration: failure` — one step: `EB4-B/D/E tooling suites` → `tests/u7-3-devex/devex-integration.test.mjs`
  arms **E4/E5** with `BOUND HIT: more than maxRecords 600 committed run records … REFUSED, no partial report
  is produced` (run `45508260944`, job `138849199239`, step 19). Measured cause: the branch now carries **602**
  committed `u5-run-record/1` records (see §5.4), i.e. the audit's *capacity budget* — not an assertion — was
  exceeded. **Fixed in this round** by raising the budget **with a measurement** (the repo's own doctrine), and
  re-measured green locally: `devex-diag` leg **44 tests / 44 pass / 0 fail** and `integration-order` producing
  its report without `BOUND HIT` (`round115/gate-devex-diag.log`). The hosted leg can only be re-earned after a
  push, which is the coordinator's run.

Nothing above is a claim that the hosted set is green at the final head. It is a claim about what was measured,
where, and what is now locally green.

### 5.4 The round-115 change, and why it is not a weakened assertion

`scripts/integration-order.mjs` `BOUNDS.maxRecords` **600 → 900**. Measurement at `974c643de` (recorded in the
file's own BOUNDS header):

| measure | value |
| --- | --- |
| tracked `.json` under `dev/agent-workflow/evidence/**` (`git ls-files`) | **10,440** (12 over the 512 KiB cap, never read) |
| files mentioning `u5-run-record/1` | **623** |
| files that **parse** as `u5-run-record/1` | **602** |
| `maxCandidates` (unchanged) | 12,000 vs 10,440 measured (~1,560 headroom) |

The bound is a **capacity budget**, never a safety assertion — the script's own header says "raise the bound
with a measurement" and records two earlier raises (2026-11-13, 2026-11-22/24) done exactly this way. The
controls that make a bound-hit meaningful are untouched and were re-run green: `E7` still builds
`BOUNDS.maxRecords + 1` fixture records and still requires `BOUND HIT` (a partial audit is never a clean
report), `E8` still requires a late record to be graded without `BOUND HIT`, `E4` still requires `--strict` to
fail while any record does not bind the candidate head. **No committed evidence was deleted or trimmed to fit
the bound; no test assertion, timeout, retry or skip was widened.**

---

### 5.5 The local gate block at this HEAD, pasted verbatim

From `dev/agent-workflow/evidence/ute-a1/round115/` (each file also carries its own `EXIT=` line):

```
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
place-dist-glue: done (35 placement(s))
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
EB3-CI-REQUIRED pass workflows=11 findings=0
DSH-TEST-CATALOG tests=786 digest=sha256:8982e6e9d6c029234b185be68d97930db21d7171c0b41659e3d0a2b9c9b1fd4e refused=0 findings=0
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
  (tests 255 / pass 252 / fail 0 / skipped 3)
DSH-TEST-DISPATCH mode=run leg=devex-diag suites=2 files=2 exit=0 set=sha256:08ea42463381f08e6797e90afa6c9bc910a7dc6e4b1e3d7891f94bfce22bb3e1
  (tests 44 / pass 44 / fail 0)
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=20000
EB3-RUN-MANIFEST pass records=602 strict=0 incomplete=11 findings=0
  (UTE G1 nine-file argv: tests 89 / pass 89 / fail 0 / skipped 0)
DSH-CI-LEG leg=graph-parse verdict=pass … leg=state-freshness verdict=pass … leg=append-only-log verdict=pass
DSH-CI-LEG leg=artifacts-at-head verdict=pass … leg=census verdict=pass
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=294.9
```

`ci-pr-gate`'s own run line for that block: `DSH-CI-RUN head=974c643de mode=full node=v24.21.0 … workers=4`,
census `599f/7424l` captured twice with **identical identity sets** (comparison file
`dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/census-comparison-20261124T232818Z-3.json`).

## 6. C1–C18 sign-off

The authoritative list is `docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md:30-52` — **19 contract
rows** (C1…C18 plus the owner's `C14b` split row). The itemised sign-off is **`C1-C18-SIGNOFF.md`**, one row
per contract item with the contract requirement, the evidence, the level that evidence supports, the
limitation and whether Required CI carries it. It splits C13 into its base faces and its two ruled-out arms, so
its table has **21 sign-off rows**. That file is the measurement; this section is the summary.

| level | count (21 rows) | rows |
| --- | --- | --- |
| **MECHANISM** | **7** | C1, C4, C7, C10, C11, C15, C16 |
| **DEV-LIVE** | **8** | C2, C3, C5, C6, C8, C9, C12, C13 (base faces) |
| **ENV-LIMITED** | **1** | **C14b** |
| **UNSUPPORTED BY PRODUCT RULING** | **5** | **C13 (PTC arm)**, **C13 (process-ask arm)**, **C14**, **C17**, **C18** |
| **NOT PROVEN** | **0** | — |
| **PRODUCT-PROVEN** | **0** | — (no row claims it) |

Folded back to the contract's own granularity (18 numbered criteria + C14b = 19 rows): 7 MECHANISM,
8 DEV-LIVE, 1 ENV-LIMITED, 3 UNSUPPORTED (C13's two arms are one row, plus C14/C17/C18), 0 NOT PROVEN.

**Named explicitly, so they cannot be read as gaps:**

- **UNSUPPORTED BY PRODUCT RULING:** `C13 (PTC arm)` — `run_code` is not offered (refusal proven typed and
  durable); `C13 (process-ask arm)` — per-call `ask` for process execution is not offered (the REFUTED live
  judge is preserved, §4.2); `C14` — the old governed-family execution implementations are **dropped as ruled**
  (completion criterion = green closure + named ruling, both present, §2); `C17` — the Team's own
  `exit_plan_mode` tool is dropped by ruling (provable by absence: zero references under `packages/runtime/src`
  and `packages/tools/src`, and it is in no closed table); `C18` — `a5p5-tools` lane helpers are dropped
  (module absent, dormant, nothing dispatched).
- **ENV-LIMITED:** `C14b` — its four invariants are each carried by a positive+negative arm, but the
  **network-deny OS enforcement** cannot be proven on the hosted `ci-census` runner (netns creation succeeds,
  `/proc/self/uid_map` write is refused), so the product refuses fail-closed (`NETWORK_DENY_UNPROVEN`) and the
  arm is ENV-LIMITED. The other invariants C14b names (path bounds, Control authority, Stop) are DEV-LIVE
  through their carriers.

Two known documentation defects are named in `C1-C18-SIGNOFF.md` §6 rather than smoothed over: the d4
driver README's stale REFUTED text (**F-1**, corrected in round 114 with a dated banner and a new machine check
`tests/checks/d4-evidence-consistency.test.mjs`) and this repo's older `D-ACCEPTANCE-REPORT.md` §2.2 rows for
C6/C7 (**F-2**, stale prose; the sign-off's values are the measured ones).

---

## 7. Host modification authority

**`CORE PATCH BUDGET = 0`.** The upstream host is read, never written; every capability in this candidate is
delivered by an external plugin through a **public** seam.

Both pins measured pristine in this session, before and after all gate runs:

```
$ git -C tests/deepseek-harness-test-use rev-parse HEAD     → 639ed015397290b3745d163aafe02ffee4aa3f84   (0.2.0-rc.2, control host)
$ git -C tests/deepseek-harness-test-use status --porcelain → 0 lines
$ git -C tests/deepseek-harness-next     rev-parse HEAD     → 9c2670d3bce5275e0d1610272958121af87787bb   (dsh-v0.2.2-rc.5, TARGET host)
$ git -C tests/deepseek-harness-next     status --porcelain → 0 lines
```

The pins are not copied into this document as authority: the single source is `tests/paths.mjs`
(`TEST_USE_BASELINE_SHA`, `NEXT_HOST`), and the drivers print the candidate row they resolved on their first
log line (`host:"legacy"`/`source:tests/paths.mjs#TEST_USE_BASELINE_SHA`, `host:"next"`/`… #NEXT_HOST`).

- **No patch, no `git apply`, no `patch-package` / `pnpm patch` / postinstall rewrite, no vendored modified
  copy, no second selection mechanism.** The one-selector rule is why **40 vitest suites that load host code
  stay rc.2-only**: Vite resolves the repo install before Node's loader, and a `resolve.alias` would be a
  second selection mechanism (§8).
- **Two host shape differences required adaptation**, and the product resolves each **by public capability, not
  by emulation**:
  1. **rc.5 removed `ToolRuntime.mode`** (`z.never()`, `packages/core/tools/lib/index.js:406-409`). The product
     does not shim a `mode`; the test world mounts the host's exported **executor services**
     (`NativeToolExecutor` / `PtcExecutor`, one per scope) as plugin objects and uses the existing batch
     dispatch — the rc.5 replacement the host itself publishes. Result: the same 18 ladder arms pass on both
     hosts (round 112).
  2. **rc.5 renamed the public drain seam** `subagents.drainContinuableDescendants` →
     `subagents.drainDescendants`. `stop-drain-lane.mjs#resolveDrainSeam` resolves the seam **by public name
     capability** (rc.5 name first, then rc.2), passes parents verbatim, and a host exposing neither still fails
     closed through the same typed `recursive-drain-unavailable` path. This was the root cause of the round-105
     rc.5 `d2:remote-delivery` refutation and was fixed as a **product** defect, not by an allowance (§2 of
     `D-ACCEPTANCE-REPORT.md`, round 108).
- **Nothing in this candidate modifies the shared read-only baseline** or ships a patched host.

---

## 8. Limits and unproven claims (the candid list)

1. **The model is a scripted mock in every live boot** (`packages/tools/harness/mock-deepseek.mjs`). No
   model-driven choice, retry or adversarial tool selection is measured. **REAL MODEL = `ENV-LIMITED`**: the
   round-111 probe found no `DEEPSEEK_API_KEY` and no `DEEPSEEK_BASE_URL` in the launch environment, no provider
   credential in any of the 45 test worlds, and no local model server on the test bands; `--model real` refuses
   to proceed, writes `probe.json` + `ENV-LIMITED.txt`, exits 4, boots nothing, writes **no RUN record**. The
   real-model driver exists and is validated **`SCRIPTED-ONLY`** (20/20 judges, 2 agreeing boots). The exact
   missing item is named: **`DEEPSEEK_API_KEY`** (optionally `DEEPSEEK_BASE_URL`).
2. **No row is PRODUCT-PROVEN.** The only live layer is the candidate acceptance gate, which is
   **NON-REQUIRED by owner ruling** (`knownNonRequired` in `dev/ci/eb3-ci-manifest.json`); a green there is
   `DEV-LIVE` at most. Last dual-host verdict: **62 judges / 60 PROVEN / 2 known-refuted / 0 env-limited,
   `pass` on both hosts** at head `41d579119` (verdict
   `dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T17-17-46-158Z/verdict.json`), one
   disclosed dual-host run costing **83 m 48 s**. That verdict is **bound to `41d579119`, not to this HEAD**;
   `git diff 41d579119..HEAD -- packages/*/src` is **not** empty (the round-114 ledger `fsync` is a product
   change), so the machine record does **not** describe this head's product code. The final head must re-run it.
3. **40 host-importing vitest suites cannot be graded on rc.5 through the single selector.** Vite resolves the
   repo install before Node's loader (measured: a probe still imported `dsh-scope` `0.2.0-rc.2` under
   `TEAM_TEST_HOST=next`); a `resolve.alias` would be a second selection mechanism, so those 40 stay rc.2-only
   and are **not** counted as rc.5 coverage.
4. **The 18 B-ladder arms are green on BOTH hosts** (18/18 rc.2 and 18/18 rc.5; 16 pass + the same 2 declared
   non-runs each), but they are **in-process `MECHANISM`**, not boots; C-ptc stays unsupported.
5. **Two declared boundaries (not controls):** **SEC-03** — host-capability tools (`subagent`,
   `send_message`, `interrupt_agent`, `skill`, the 15 `team_*`) are admitted on host authority with **no managed
   fs/net lane**, so the lane algebra does not bound their effects; a hostile-code model must treat them as
   capabilities **outside** the sandbox. **SEC-04** — ungoverned rows (`centreStatePath` absent) remain a
   labelled product mode **outside every invariant**; Option B refuses a *governed* row with no confined
   provider (`MEMBER_CENTRE_UNWIRED`), it does not govern a row that never asked.
6. **Physical power-cut durability is unmeasured.** SEC-01 made the admission append `fsync`-before-return
   (file + one directory fsync on create) and the arms pin the ordering and the fail-closed refusals; a
   **physical power cut cannot be injected in-process** — a kernel/power cut is out of reach here, so the
   machine-crash claim is structural, not observed.
7. **`apply_patch` is unbound.** The R3 receipt covers `write`/`writeText`, `editText`, `patchText`,
   `deleteFile`, `moveFile` (with per-method scope binding); `apply_patch` stays unbound and the
   subprocess/PTY face is explicitly **not** covered (its authority is an OS `SandboxExecutionPolicy`).
8. **`caseId: null` for inline asks.** The receipt binds the durable request/decision identity, but an inline
   admission request mints `caseId: null` — so the receipt is not a claim that every ask is an Alpha.6 case.
9. **The operator model is per-`DSH_HOME`, not RBAC.** Every management-plane claim is scoped to one
   authenticated operator (Connection Gate); no multi-user isolation, no per-user authority, no tenant
   boundary is claimed.
10. **Sticky Stop is latch-scoped.** A machine wake does not clear a human Sticky Stop (measured,
    `d4:sticky-stop` PROVEN), but the guarantee is about the latch: an in-flight Stop whose body aborts without
    a terminal observation settles **`UNKNOWN`**, and is not a `CANCELLED` claim unless the Stop evidence
    exists.
11. **A duplicate-route attempt leaves no durable fact.** `d4:duplicate-route` PROVEN = one wake for a
    duplicate route (1 intent, 1 confirmation, 1 input); the *attempt* itself is not persisted as a fact, so
    "we can count duplicate attempts" is not a claim this candidate makes.
12. **Alpha.6 review routing is `DEV-LIVE`, not PRODUCT-PROVEN.** The routed wake is PROVEN on both hosts,
    2 agreeing boots (case created with frozen identity, router selects the unique lawful Officer, the wake is
    delivered with zero management-plane executions, the Officer decides in its own session and the decision
    precedes the settlement, duplicate route yields one wake, sticky Stop survives a machine wake) — but it
    rides the non-required gate, and the **cold-wake** half (an intent written before a restart and consumed
    after) is **not** a live judge.
13. **In-process vs live is a real distinction everywhere.** `MECHANISM` arms run in-process over real pinned
    components with named stand-ins that decide nothing; the compiled member answer is an **input**, so policy
    **compilation** is not exercised. `DEV-LIVE` boots are real host processes but not gates.
14. **No Windows deployment** (the persistent shell row is disabled on win32); no hosted third-party
    deployment; no MCP server booted live (the `ADM-96` mount is in-process over a real server object).

---

## 9. Reviewer's checklist — the exact commands and the expected verdict lines

Run in `.worktrees/vnext-a1-cut`. Every command is copy-pasteable; the expected line is what this round measured
(logs under `dev/agent-workflow/evidence/ute-a1/round115/`).

| # | command | expected verdict line |
| --- | --- | --- |
| 1 | `git log -1 --format='%H %s'` | `974c643de747d846a9ebeb2edb82677813ade467 chore(ute-vnext): round-114 postcommit gate logs at 194a5c3ce` |
| 2 | `gh pr view 822 --json isDraft,state,baseRefName` | `{"baseRefName":"master","isDraft":true,"state":"OPEN"}` |
| 3 | `node scripts/ute-cut-closure.mjs --check` | `UTE-CUT-CLOSURE pass deleted=148 … prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 … findings=0` |
| 4 | `node scripts/ute-p0-assets.mjs --check` | `UTE-P0-ASSETS pass modules=37 files=180 lines=69512 … cut=cut(148/148) findings=0` |
| 5 | `node scripts/place-dist-glue.mjs` | `place-dist-glue: done (35 placement(s))` (every line `(byte-identical)`) |
| 6 | `node scripts/docs-sync.mjs --check` | `docs:sync --check: docs=193 … findings=0 blocking=0 contracts=20 pairs compared` |
| 7 | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=11 findings=0` |
| 8 | `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` | `DSH-TEST-CATALOG tests=786 digest=sha256:8982e6e9… refused=0 findings=0` (collected 734 / uncollected 38 / excluded 14) |
| 9 | `A5SF_REQUIRE_PINNED_HOST=1 node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1` | `DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c4…` and `tests 255 / pass 252 / fail 0 / skipped 3` |
| 10 | `node scripts/dispatch-tests.mjs --run --leg devex-diag` | `… exit=0 set=sha256:08ea4246…` and `tests 44 / pass 44 / fail 0` (the round-115 bound fix) |
| 11 | `node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 20000` | `EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` |
| 12 | `node scripts/eb3-run-manifest.mjs` | `EB3-RUN-MANIFEST pass records=602 strict=0 incomplete=11 findings=0` |
| 13 | `node --test --test-force-exit --test-timeout=480000 --test-reporter=spec tests/ute1-fs/native-fs-binding.test.mjs tests/ute-g1-fs/lane-suite.test.mjs tests/ute-g1-fs/lib/refusal-categories.test.mjs tests/ute-g1-fs/product-route-image.test.mjs tests/ute-g1-search/lane-suite.test.mjs tests/ute-g1-web/lane-suite.test.mjs tests/ute-g1-process/lane-suite.test.mjs tests/ute-g1-agentctl/lane-suite.test.mjs tests/ute-g1-uistate/lane-suite.test.mjs` (the exact CI argv) | `tests 89 / pass 89 / fail 0 / skipped 0` |
| 14 | `node scripts/ci-pr-gate.mjs --full --census-captures 2` | `DSH-CI-VERDICT pass pass=10 fail=0 skip=0 … refused=0 refusedlegs=none` |
| 15 | **live drivers** (two agreeing boots each; rc.2 default, rc.5 with `TEAM_TEST_HOST=next`) — `node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2`, `run-boot-d2.mjs --boots 2`, `run-boot-d3.mjs --boots 2`, `probe-d4-routed-wake.mjs --boots 2` | each driver's own `RESULT PASS (2/2 boots; agreeing pair=true)` (d3 prints `evidence-complete=true allProven=true`, d4 `blocked=true` for the one declared refusal); the judge-by-judge verdicts are the §4 tables above and `D-ACCEPTANCE-REPORT.md` §3.2 |
| 16 | **candidate gate, both hosts** (NON-REQUIRED; ~84 min) — `node scripts/candidate-acceptance-gate.mjs --hosts both` | `CANDIDATE-GATE pass host=both judges=62 proven=60 known-refuted=2 env-limited=0` (the 2 are the single enumerated `d4:ask-execute-process`, once per host) — **must be re-run at the final head; the recorded verdict is bound to `41d579119`** |
| 17 | `git -C tests/deepseek-harness-test-use status --porcelain \| wc -l` and the same for `tests/deepseek-harness-next` | `0` and `0`; `rev-parse HEAD` = `639ed01539…` and `9c2670d3bc…` |
| 18 | `node scripts/pr-settlement-gate.mjs --pr 822` (with `GH_TOKEN=$(gh auth token)`) | `DSH-SETTLEMENT-VERDICT PASS` against the head this report names |

**What a reviewer should conclude from a green block.** Only that the *static and in-process* obligations named
in each row hold at this head. A green row 14 means the local full gate produced its verdict; it is **not**
Required CI, which only exists hosted (§5). A green row 16 would still be `DEV-LIVE`, never PRODUCT-PROVEN.

---

## 10. Boundaries in force

- **No auto-merge.** PR #822 stays **DRAFT**. Marking it ready, merging it, or moving `master` is the owner's
  act, not this branch's, not the engine's.
- **No release, no deploy, no version bump, no compatibility layer.** There is no legacy fallback and none may
  be added to make a red green.
- **No widened skips, timeouts or retries.** The three `ute-vnext-a1` skips are disclosed, labelled non-runs
  (`ADM-68` bash positive not run in that world; `ADM-69` and `ADM-147` PTC positives `NOT APPLICABLE —
  PRODUCT UNSUPPORTED`). The candidate gate has **no retries** and one un-widened driver timeout
  (`DRIVER_TIMEOUT_MS` = 45 min).
- **No edits to A0 frozen evidence.** `docs/plans/memo/ute-p0-20261121/` and the frozen A0 delete/replace set
  are cited, never edited; a scope change is an owner amendment by citation (`ADR-ptc-unsupported.md`,
  `SCOPE-subprocess-ask.md`), never a silent contract edit.
- **`UNKNOWN`, `ENV_BLOCK`, skips and refusals never count as PASS.** `ci-required` grades absence, skip,
  cancel, ENV_BLOCK, refused and failure as NOT green; ENV-LIMITED arms increment no proven counter; a
  `KNOWN_REFUTED` judge is counted as refuted, never subtracted from the requirement.
- **`CORE PATCH BUDGET = 0`** — an upstream patch is a `CORE_SEAM_BLOCKER`, not a TODO (§7).
- **:3080 and its `DSH_HOME` were never touched**; all boots use the 3181-3199 / 13000-13049 bands.

---

## What the owner must decide before merge (the exact short list)

1. **The live layer's status.** The candidate acceptance gate is NON-REQUIRED by your ruling, so no row can
   become PRODUCT-PROVEN. Decide: keep it non-required (the candidate stays `DEV-LIVE` forever, and the words
   "PRODUCT-PROVEN" never appear), or make it required (then it must be green at the final head, and its ~84 min
   dual-host cost lands on every PR).
2. **The draft → ready flip is yours, and it is what unlocks census.** While #822 is a draft, `ci-census` does
   not run and `ci-required` therefore cannot be green (§5.2). The coordinator's separate hosted run is the
   only place that can produce the final green set.
3. **The real-model gap.** `DEEPSEEK_API_KEY` (optionally `DEEPSEEK_BASE_URL`) is the single missing item for a
   real-model acceptance run. Supply it, or rule that this generation ships with `ENV-LIMITED` real-model
   evidence named as such.
4. **The two declared uncovered boundaries** — host-capability tools with no managed I/O lane (SEC-03) and
   ungoverned rows outside every invariant (SEC-04). Accept them as declared limits of this generation, or
   commission the lane work in a later phase.
5. **The round-115 capacity-budget raise** (`integration-order.mjs` `maxRecords` 600 → 900, measured at 602).
   Approve it as the maintenance it is, or rule that the devex evidence-bound audit must not gate Required CI.
   Either way, no committed evidence was trimmed and no assertion was weakened.
