# D acceptance report — UTE vNext A1 cut + centre (candidate)

> ## ⚠️ ENTRY POINT — read [`CANDIDATE-REPORT.md`](CANDIDATE-REPORT.md) first (round 116, 2026-11-25)
>
> **This file is the append-only CHRONOLOGICAL RECORD, not the current truth.** The single current statement
> of the candidate — identity/HEAD/base/PR state, the static closure and exactly what its numbers do and do not
> prove, the single-authority verdict, the P1–P5 ladder with the OS negative controls and the declared
> exceptions, Required CI (**the final hosted Required set is green at `5cb5c6062`, with `ci-census` executed:
> 2 captures, 599 files / 7,424 assertions each, identical identity sets; the PR was restored to DRAFT
> immediately after**), the C1–C18 summary with every UNSUPPORTED/ENV-LIMITED row named, host-modification
> authority (`CORE PATCH BUDGET = 0`, both pins pristine), the candid limits list, the reviewer's exact
> reproduction commands, and the boundaries in force — lives in **[`CANDIDATE-REPORT.md`](CANDIDATE-REPORT.md)**.
>
> **Round 116 additions folded into that report:** the two hosted reds found and fixed in this stretch (the
> devex `maxRecords` capacity bound, measured; the dispatch-parity evidence regenerated deliberately); the fresh
> dual-host candidate-gate verdict at `92be91dfb` (`62 judges / 60 PROVEN / 2 known-refuted / 0 env-limited`,
> `pass` on both hosts) with the explicit proof that `packages/*/src` is unchanged up to `5cb5c6062`, so the
> verdict is representative — and is **not** claimed to have run at `5cb5c6062`; the rc.5 matrix outcome
> (18/18 B-ladder arms on both hosts; the 40 host-importing vitest suites **still not gradable** through the
> one selector — now measured as `ENV-LIMITED` at the Vite layer, `round116/VITEST-HOST-PROBE.md`); and the
> security findings' dispositions (SEC-01 fixed, SEC-02 fixed with history retained, SEC-03/SEC-04 declared).
>
> Nothing below is deleted, corrected retroactively, or re-ordered: the round sections (114 → 55) keep the
> numbers of the head they were measured at, and they are **historical where they disagree with
> `CANDIDATE-REPORT.md`**. The itemised per-contract sign-off is [`C1-C18-SIGNOFF.md`](C1-C18-SIGNOFF.md); the
> adversarial audit is [`SECURITY-REVIEW-20261125.md`](SECURITY-REVIEW-20261125.md); the independent authority
> audit is [`ARCHITECTURE-AUTHORITY-AUDIT.md`](ARCHITECTURE-AUTHORITY-AUDIT.md).

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- ROUND 109 — THE HISTORICAL ACCEPTANCE TABLE. Current truth = CANDIDATE-REPORT.md. -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->

## ROUND 114 — the three security findings are dispositioned (no capability row moves)

Round 113's review (`SECURITY-REVIEW-20261125.md`) left SEC-01/SEC-02/SEC-03 open. This round closes them;
the review's §3 carries the per-finding disposition table and its verdict section is updated. **No
capability level moves and no row becomes PRODUCT-PROVEN.**

- **SEC-01 → FIXED.** `packages/runtime/src/plugin/vnext/fact-ledger.mjs` now fsyncs the file (and the
  directory when it creates it) **before `record()` returns**, and registers the admission in memory only
  after that durable append. Policy is fsync-before-return, not a batching window: at most one extra
  directory fsync for the file's first record. A refused fsync is a named fail-closed refusal; the bytes
  are rolled back and **the settlement record is never opened** (`admission-port.mjs#commit` writes the
  durable fact first). Format, ordering, digest and the replay rule are unchanged. Arms `SEC-01a…d`.
- **SEC-02 → FIXED (with history retained).** `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md`
  is corrected 2026-11-25 to the `results.json` truth (`d4:routed-wake` **PROVEN**), with a dated correction
  banner and the round-87/88 text kept as explicitly marked history. A new arm,
  `tests/checks/d4-evidence-consistency.test.mjs`, fails when that README contradicts `results.json`
  (head, judge set, any verdict, `overall`, or a current-tense REFUTED outside a `[HISTORICAL]` block);
  mutation control: RED on the pre-correction README.
- **SEC-03 → DECLARED (no behaviour change).** The single table now has **row 35** and
  `CAPABILITY-MATRIX-C.md` has the **C-host-capability** row: host-capability tools (`subagent`,
  `send_message`, `interrupt_agent`, `skill`, the 15 `team_*`) are admitted on host authority with **no
  managed fs/net lane**, so the lane algebra does not bound them. The boundary is named so it cannot be
  read as a control.
- **SEC-04 → DECLARED (unchanged, informational).** Ungoverned rows remain a labelled product mode.

Gate re-runs and the new scannable-surface delta (test-catalog tests 785 → 786) are recorded in
`round114/README.md`.

## ROUND 113 — the C1–C18 sign-off and the adversarial security review (counts; no capability row moves)

Review `20261125-0058` Stage C. Two independent documents were produced this round, both evidence-bound
and both stricter than this report's historical prose:

- **[`C1-C18-SIGNOFF.md`](C1-C18-SIGNOFF.md)** — one row per item of
  `docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md` (the authoritative 19-row list: C1–C18 plus
  the contract's C14b split row; C13 is further split into its base faces and its two ruled-out arms, so the
  table has **21 sign-off rows**), with capability, contract requirement, evidence (test ids /
  run records / live judges + paths), level, limitation, and required-vs-candidate gate status.
- **[`SECURITY-REVIEW-20261125.md`](SECURITY-REVIEW-20261125.md)** — an adversarial audit of Admission,
  Provider/OS boundary, Settlement, Control and Stop: the claimed invariants, an attempted break for each
  (code reading + throwaway probes + existing arms), and findings with `file:line` and severity. **No fix
  is included**, by instruction.

**Counts over the 21 sign-off rows (this is the number to quote):**

| level | count | rows |
| --- | --- | --- |
| **MECHANISM** | **7** | C1, C4, C7, C10, C11, C15, C16 |
| **DEV-LIVE** | **8** | C2, C3, C5, C6, C8, C9, C12, C13 (base faces) |
| **ENV-LIMITED** | **1** | C14b (network-deny on the hosted runner; the other invariants it names are DEV-LIVE) |
| **UNSUPPORTED BY PRODUCT RULING** | **5** | C13 (PTC arm), C13 (per-call process-ask arm), C14, C17, C18 |
| **NOT PROVEN** | **0** | — |
| **PRODUCT-PROVEN** | **0** | — (no row claims it) |

Folded back to the contract's own granularity (18 numbered criteria + C14b = 19 rows): 7 MECHANISM,
8 DEV-LIVE, 1 ENV-LIMITED, 3 UNSUPPORTED (C13 contains both ruled-out arms, plus C14/C17/C18), 0 NOT
PROVEN. The two ruled-out arms are the owner decisions already recorded in this report (PTC:
`ADR-ptc-unsupported.md`; process `ask`: `SCOPE-subprocess-ask.md`), not gaps.

**Corrections this round (do not read the old rows instead):**

- §2.2's **C6/C7 rows below are stale**: they say the live routed wake is "not proven" / "a remaining gap".
  The routed sub-judges have been PROVEN on both hosts since round 87's machine artifacts
  (`d-boot-feasibility/d4/results.json`, candidate `verdict.json`), while the d4 area's own `README.md`
  still prints REFUTED. **F-1** (stale README) and **F-2** (stale §2.2 rows) are recorded in
  `C1-C18-SIGNOFF.md` §6. The sign-off rows C6 = DEV-LIVE and C7 = MECHANISM (cold-wake half only) are the
  measured values.
- **No row is upgraded** by the candidate gate. It is `knownNonRequired`; a green there is DEV-LIVE at most.

**Security findings (not fixed):** SEC-01 the admission-ledger append has no `fsync`
(`fact-ledger.mjs:126`; process-crash durable, machine-crash not), SEC-02 the stale d4 README inverts the
routed-wake verdict, SEC-03 host-capability tools have no managed I/O lane, SEC-04 ungoverned rows are
outside every invariant. **No managed Admission / Provider-OS / Settlement / Control / Stop invariant was
found BROKEN at this head.**

Gate block for this head: `round113/` (all green; `ci-pr-gate --full --census-captures 2` included) — see
the PR body's round-113 row for the pasted numbers.

## ROUND 111 — REAL-MODEL acceptance: the probe answered ENV-LIMITED; the harness is complete

Review `20261125-0058` Stage B, second item: *every booted-host proof so far uses a scripted model; a
controlled real-model scenario is required before any real-model claim may be made.* This round does
**not** make a real-model claim. It (a) probes the environment instead of assuming a route, (b) builds the
real-model scenario driver, and (c) validates that driver on the scripted model, **labelled
`SCRIPTED-ONLY`**.

1. **The probe (runs before any boot, in the driver, in both modes).** No `DEEPSEEK_API_KEY` and no
   `DEEPSEEK_BASE_URL` in the launch environment; all **21** `tests/homes/*/.credentials.yaml` files carry
   only `client-connection/browser-session` records — no provider/key record in any of the **45** worlds;
   the only wired model deployment is the in-process mock (`startMock`), which is *not* evidence of a real
   model; both pinned hosts ship the `deepseek-official` provider whose `apiKeyEnv` defaults to
   `DEEPSEEK_API_KEY`; no local model server listens on the test bands. The stable `:3080` profile is out
   of scope and was not read. **Level: `ENV-LIMITED`; exact missing item: `DEEPSEEK_API_KEY`** (a real
   credential, optionally with `DEEPSEEK_BASE_URL`), suppliable to the driver process or as a test-home
   `.credentials.yaml` record. `--model real` refuses to proceed: it writes `probe.json` +
   `ENV-LIMITED.txt`, exits `4`, boots nothing and writes **no RUN record**.
2. **The driver** `tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs` is host-selectable
   (rc.2 default / rc.5 via the one selector), runs `--boots 2`, emits one `u5-run-record/1` per boot
   through the same contract and machine judges, and binds the **model axis** (`mode`, `label`, base URL
   presence, key-env name, `keyConfigured`, mock path) into every record. It covers the required chain —
   **Leader creates Worker → Worker asked for a write requiring approval → real Control case → Officer
   (own session, own binding) reviews → grant → execution with bytes verified OUTSIDE the sandbox →
   collect** — plus the negatives: **denied ask** (zero bytes), **Stop while pending** (zero bytes,
   terminal `CANCELLED`), **duplicate approval** (one decision, one execution, bytes unchanged) and
   **restart recovery** (same home, `create-or-open`, no replayed grant).
3. **Measured, `--model scripted --boots 2`:** each boot **20/20 judges PROVEN, overall PASS**, RUN-record
   self-check `cases=20 subset=false`; the pair agrees (`agreeing=true differing=[]`). Full evidence and the
   judge-by-judge values: `dev/agent-workflow/evidence/d-boot-feasibility/real-model/` and its
   `REAL-MODEL-ACCEPTANCE.md`. The **process/PTY arm is not in this driver's declared case set** (its
   subject is `UNSUPPORTED BY PRODUCT RULING` and absent here: `no PTY backend registered`); it still runs
   as an observation and its REFUTED verdict is recorded — no red is converted to green.
4. **No row above is upgraded, no real-model claim is made, and the candidate gate is unchanged
   (NON-REQUIRED).** This section is the only change: row 34 is new and is `ENV-LIMITED` with its missing
   item named.

## ROUND 112 — the B ladder's rc.5 cell closes (no capability row moves)

The last red the round-110 population carried — 18 `vnext-b-probe-ladder` arms — is **closed**. The
ladder's world is now host-selectable through the ONE selector (`tests/next-host/host-select.mjs`), not
host-doubled: the SAME 18 arms, with the SAME assertions, measure **18/18 on rc.2 and 18/18 on rc.5**
(16 pass + the same 2 declared non-runs each: `ADM-68` bash positive not run in this world, `ADM-69` PTC
positive NOT APPLICABLE by ruling). rc.5's replacement for `ToolRuntime { mode }` is an EXECUTOR SERVICE
(`NativeToolExecutor` / `PtcExecutor`, one per scope), a BATCH dispatch, and
`PtcExecutor.requirePtcTransport()` for the reserved `run_code` entry; the world mounts the exported
`{name, inject, apply}` plugin objects and uses the existing `executeToolDispatch` batch/legacy split.

**No level moves and no PRODUCT-PROVEN row is added.** The ladder is in-process `MECHANISM` evidence, not
a boot; C-fs keeps the level it had and C-ptc stays `UNSUPPORTED BY RULING` (the refusal is what the arm
proves, on both hosts). **No product file changed** — the only edit is the test world in
`packages/runtime/test/vnext-b-probe-ladder.test.mjs`; no `mode` shim, no widened timeout, no retry, no
weakened assertion. Full reading and the 18-row table: `RC5-TEST-MATRIX.md` §9.

## ROUND 110 — the rc.5 TEST MATRIX (no capability row moves)

Round 110 (review `20261125-0058` Stage B) did **not** re-run the four D drivers and did **not** move
any row below. It answered the different question the review asked: *what is the whole test population,
and what does rc.5 do to it?* The measured table is
[`RC5-TEST-MATRIX.md`](./RC5-TEST-MATRIX.md).

Executed on rc.5 through the ONE selector (or the suite's own rc.5 pin): **759 tests, 737 pass, 21 fail,
1 skip**. The 21 reds are dispositioned, not hidden:

- **18** = every arm of `vnext-b-probe-ladder`, which still mounted `ToolRuntime { mode: 'both' }`
  (`vnext-b-probe-ladder.test.mjs:273`) — rc.5 removed `mode` (`packages/core/tools/lib/index.js:407`).
  **CLOSED in round 112 (18/18 on both hosts; see the round-112 section above).**
  The recorded "hang" is this `before`-hook rejection; with `--test-timeout=45000` it is a deterministic
  failure in ~0.5 s, and the world rewrite (executor + batch dispatch + PTC transport) is an open arm
  design, not a timeout. **No gate timeout was changed.**
- **1** = `a5sf-fs-contract` FSB-IMG-1b, which measures the **rc.2** tool package (`:297`) → rc.2-subject,
  N/A for rc.5.
- **2** = `m7a-real-slice-host-state`, the **rc.2 census** slice in a child process → rc.2-subject.

Two genuine rc.5 drifts were adapted with the **observation only** (assertions untouched): the ADM-96/97
fabricated `exec` frames gained a real `AbortSignal` (rc.5 `AbortSignal.any` rejects a missing one), and
two leg suites now resolve the **selected** host modules / mount the rc.5 executor plugin / use the
existing batch-dispatch helper. Result: `admission` 162 pass / 1 skip / **0 fail on both hosts**;
`a5sf-harness` **10/10 both**; `a5sf-native-route-c` **8/8 both** (route C is now measured on rc.5, not
just rc.2).

Disclosed gap, unchanged by this round: **40 vitest suites that load host code** cannot be graded on
rc.5 through the selector — Vite resolves the repo install before Node's loader (measured: a probe still
imported `dsh-scope` `0.2.0-rc.2` under `TEAM_TEST_HOST=next` + host-loader). A `resolve.alias` would be
a second selection mechanism, so those 40 stay rc.2-only and are **not** counted as rc.5 coverage.

**Levels: no row moves.** No PRODUCT-PROVEN row is added; the D-driver verdicts below remain the
round-109 ones.

## CURRENT ACCEPTANCE STATUS — the single table (round 109, 2026-11-24)

> **This table is the current verdict. Every later section of this file is HISTORICAL.** Where a
> later section disagrees with this table — the round-78 rc.5 note that "only these three scripted
> drivers ran on rc.5", the round-87/93 `d4:routed-wake` **REFUTED** rows, the round-89 §6.5/§10
> G1/G2 register, the round-97 "rc.2 only" statements, the round-99 "BLOCKED" process row — **this
> table wins**. The older text is kept unchanged as the record of what was measured then; it is not
> a current claim and must not be quoted as one.

**HEAD measured:** `41d5791195d199190c8d808d321aaa8e4dbca030` **plus the round-109 arm** (the
observation-only `d2` driver record + the workflow/manifest trigger change and docs; this commit is
their child, named in the settlement comment). **Round 109 ran the candidate gate on BOTH pinned
hosts in ONE run and it is `pass` on both.** Round 108 (below) had already closed the two rc.5 gaps
(`d:remote-creation`, `d2:remote-delivery`) with a product fix — rc.5 renamed the public
`subagents.drainContinuableDescendants` to `subagents.drainDescendants` and the drain seam required
only the rc.2 name, so `member.archive` aborted at `drain-descendants` with
`LIFECYCLE_LIVE_EFFECT_FAILED`; the seam now resolves by capability
(`stop-drain-lane.mjs` `resolveDrainSeam`). Round 109 also made the `d2` driver record the **full
typed** `member.archive` / `member.send` / `member.restore` replies (rpcId + verbatim
`result.error`/`result.value`), so a future refusal cannot be reduced to a boolean again. Round 102's
judge-by-judge table below was measured at `10d8a67aeb7e189011faf2c131a73aa33b76fac3` and is unchanged.
Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, PR **#822 DRAFT — unmerged**.
Record class: `DEV-LIVE` for every boot, in-process `MECHANISM` where marked. **No row is
PRODUCT-PROVEN.** The candidate gate is **NON-REQUIRED by owner ruling**, so a green dual-host gate is
still `DEV-LIVE` evidence: a row becomes gate-backed only when the gate is REQUIRED by branch
protection **and** green at the final head.

Hosts, exactly as the drivers printed them (`candidate:` row, first log line of every boot):

| | rc.2 (control) | rc.5 (TARGET host) |
| --- | --- | --- |
| selector input | `TEAM_TEST_HOST` unset | `TEAM_TEST_HOST=next` |
| candidate row | `host:"legacy"`, `source:"tests/paths.mjs#TEST_USE_BASELINE_SHA"` | `host:"next"`, `source:"tests/paths.mjs#NEXT_HOST"` |
| pin | `639ed015397290b3745d163aafe02ffee4aa3f84` (`0.2.0-rc.2`) | `9c2670d3bce5275e0d1610272958121af87787bb` (`dsh-v0.2.2-rc.5`) |
| tree | `tests/deepseek-harness-test-use` | `tests/deepseek-harness-next` |
| world / home | `u5u5a5sfdev1-…` / `tests/homes/<world>` | `u5u5a5sfdev1-…-next` / `tests/homes/<world>-next` |
| port leased | `3195` (band 3181-3199) | `13000` (band 13000-13049) |
| porcelain before/after | `[]` / `[]` | `[]` / `[]` |

### Levels — the closed vocabulary used below

| level | meaning |
| --- | --- |
| **MECHANISM** | Proven in-process over the REAL pinned components (product provider/binder/Control/settlement, real host modules); no boot. |
| **DEV-LIVE** | Proven on a BOOTED, pinned host by a driver with two agreeing boots. Development evidence; never candidate evidence, never a gate. |
| **ENV-LIMITED** | The host/platform genuinely lacks the capability (e.g. a kernel/OS feature absent); recorded as a limit, not as a pass. |
| **REFUSED BY RULING** | The cut's ruling IS that the surface refuses; the judge asserts the refusal shape, not a working capability. |
| **NOT-PRODUCT-PROVEN** | No live proof at the pin (refuted, unrecorded, or observation exists but is not production-wired). Carries the open item that would prove it. |

### The table

> **Round 112 does NOT move any row of this table.** It closes the rc.5 test-population red (the 18 B
> ladder arms) with an observation-only world rewrite; see the round-112 section above. The levels,
> verdicts and open items below are unchanged.

| # | capability | level | rc.2 verdict | rc.5 verdict | open item |
| --- | --- | --- | --- | --- | --- |
| 1 | `d:member-read-admitted` (`run-boot.mjs`) | DEV-LIVE | **PROVEN** (2/2 boots) | **PROVEN** (2/2, round 78) | no bound gate ⇒ never PRODUCT-PROVEN |
| 2 | `d:guard-facts` / `d:centre-facts` | DEV-LIVE | **PROVEN** — 2 allow facts, 2 admissions, 2 executions | **PROVEN** — same counters | same |
| 3 | `d:native-read-surface` | DEV-LIVE | **PROVEN** (6 clauses) | **PROVEN** | same |
| 4 | `d:member-read-denied` | DEV-LIVE | **PROVEN** (deciding channel + zero bytes/not-ENOENT) | **PROVEN** (round 78 port: batch + `workingDirectory`) | provider-channel refusal is in-process only (`ADM-100`) |
| 5 | `d:remote-creation` | DEV-LIVE | **PROVEN** (round 91 judge repair) | **PROVEN** (round 108 rc.5 re-run, 2/2 boots, 8/8 clauses each) | no bound gate ⇒ never PRODUCT-PROVEN |
| 6 | `d2:multi-member-concurrency` | DEV-LIVE | **PROVEN** | **PROVEN** (round 78/79) | no bound gate |
| 7 | `d2:revocation` (4 directions) | DEV-LIVE | **PROVEN** | **PROVEN** (9/9 + 9/9, 14/14 guard facts) | same |
| 8 | `d2:stop` | DEV-LIVE | **PROVEN** | **PROVEN** (`stopSettlementState=REFUSED`) | same |
| 9 | `d2:remote-delivery` | DEV-LIVE | **PROVEN** (round 83) | **PROVEN** (round 108 rc.5 re-run after the drain-seam fix, 2/2 boots, 20/20 clauses each; archived send refused typed `TEAM_RUNTIME_WORK_STATE_REJECTED`, `requestsAdded=0`; **round 109** records the full typed `member.archive`/`member.send`/`member.restore` replies, rpcId + verbatim error/value — gate green on both hosts) | no bound gate ⇒ never PRODUCT-PROVEN; the round-105 rc.5 refutation is **closed by a product fix**, not by an allowance (see the round-108 section) |
| 10 | `d3:persistent-subprocess` | DEV-LIVE | **PROVEN** (round 76) | **PROVEN** (round 78/79) | same |
| 11 | `d3:crash-cold-recovery` | DEV-LIVE | **PROVEN** | **PROVEN** | same |
| 12 | `d3:work-delivery` | DEV-LIVE | **PROVEN** | **PROVEN** (`collectStatus=succeeded`; `inflightAfter=UNKNOWN` by contract) | cross-process in-flight truth not established |
| 13 | `d3:alpha6` (the V4 path's typed refusal) | REFUSED BY RULING | **PROVEN** | **PROVEN** | `ADMISSION_ALPHA6_UNAVAILABLE` is the cut's ruling; the D4 rows below are the lawful v5 replacement |
| 14 | `d4:enablement` | DEV-LIVE | **PROVEN** (round 102) | **PROVEN** (round 102) | no bound gate |
| 15 | `d4:officer-up` | DEV-LIVE | **PROVEN** | **PROVEN** | same |
| 16 | `d4:officer-binding` | DEV-LIVE | **PROVEN** (1 allow fact, its own instanceId) | **PROVEN** (identical) | same |
| 17 | `d4:routed-wake` (conjunction of the 7 rows below) | DEV-LIVE | **PROVEN** | **PROVEN** | same |
| 18 | `d4:case-created` (9 clauses) | DEV-LIVE | **PROVEN** | **PROVEN** | the `captured-case-precedes-any-decision` clause was made deterministic this round (§round-102 note) |
| 19 | `d4:router-officer` | DEV-LIVE | **PROVEN** (`recipient`/`officer`; self-ask → `leader`) | **PROVEN** (identical) | same |
| 20 | `d4:wake-delivered` | DEV-LIVE | **PROVEN** — 8 wake facts, 4 routed, 4 delivered, **0** wake-intent files, **0** management executions | **PROVEN** — identical counters | the management plane executed zero tools, by design |
| 21 | `d4:officer-decides` | DEV-LIVE | **PROVEN** (`COMPLETED`, its own session + binding) | **PROVEN** (identical) | same |
| 22 | `d4:ask-executes-after-review` | DEV-LIVE | **PROVEN** — 27 bytes, `sha256:ced10112e5b82a2b1b6bca1b85b1dff242db7e9820aa4a1b6332f3096bdf28c3` | **PROVEN** — byte-identical | same |
| 23 | `d4:duplicate-route` | DEV-LIVE | **PROVEN** (1 intent, 1 confirmation, 1 input) | **PROVEN** (identical) | same |
| 24 | `d4:sticky-stop` | DEV-LIVE | **PROVEN** (marker survives a machine wake; human resume only) | **PROVEN** (identical) | same |
| 25 | `d4:refusal` (incoherent v5 row) | DEV-LIVE | **PROVEN** | **PROVEN** | same |
| 26 | `d4:ask-execute` (`write`, 27 B) | DEV-LIVE | **PROVEN** (`COMPLETED`) | **PROVEN** (identical bytes) | other FS methods are MECHANISM (§6.15) |
| 27 | `d4:ask-execute-2` (`write`, 29 B, different path) | DEV-LIVE | **PROVEN** — `sha256:2d71ffdd499955a34ec86af1c25c00f83c068fbe40f5fa3481f6a3752046442f` | **PROVEN** — byte-identical | same |
| 28 | `d4:ask-denied` | DEV-LIVE | **PROVEN** — 0 bytes, settlement `REFUSED` | **PROVEN** (identical) | same |
| 29 | `d4:ask-stopped` | DEV-LIVE | **PROVEN** — 0 bytes, settlement `REFUSED` | **PROVEN** (identical) | same |
| 30 | `d4:ask-execute-process` (governed `bash` under an approval) | **NOT-PRODUCT-PROVEN** (REFUTED) | **REFUTED** | **REFUTED — same 3 clauses, same error** | **product assembly gap**: no PTY backend on the v5 per-tool `bash` binding realm (`Error: no PTY backend registered for "a5sf-governed-shell"`, thrown by the host at `tests/deepseek-harness-next/packages/terminal/terminal/src/index.ts:140`; rc.2 `…test-use/…/index.ts:159`). The governed PTY face is created only when a PTY terminal spec is passed (`packages/runtime/team-services/src/install.ts:609-619`), and this realm carries none. Zero bytes, settlement `FAILED` — fail-closed. Owner decision required; **not** an rc.5 drift. The real ask→approval→grant consumption DID occur; then the PTY spawn failed with `NO_BACKEND` **before any process existed**. **Declared scope — `UNSUPPORTED BY PRODUCT RULING` (APPROVED BY OWNER 2026-11-24, review `20261124-2120` ruling 1; same class as PTC): this generation promises `allow`/`deny` for Subprocess/PTY; per-call `ask` for process execution is NOT supported and remains fail-closed — see `SCOPE-subprocess-ask.md`.** |
| 31 | P0-2 pre-dispatch abort observation (`pre-dispatch-abort.mjs`) | **MECHANISM** | **MECHANISM** (`SLICE-21/30/37/38`, assertions unchanged) | **MECHANISM** (same arms, both hosts; round 106 adds the ruled-law controls `SLICE-40/41/42` on both hosts) | **CLOSED BY OWNER RULING (round 106, review `20261124-2120` ruling 2)** — the lawful no-settlement boundary is ruled and tested; `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` remains a diagnostic report, never a settlement. The observer is still not wired into a booted host's own agent loop: a coverage limit, not an acceptance blocker |
| 32 | OS confinement negative controls (§3.1) | ENV-LIMITED where the OS capability is absent | measured | measured (round 78 shape) | the host/OS limit is the limit; no product switch exists |
| 33 | search face, Shape B (in-lane `grep`, out-of-lane refused) | DEV-LIVE | **PROVEN** (round 64/98) | **PROVEN** (round 78) | Shape B is the declared support level; not full dynamic permission governance |
| 34 | REAL-MODEL acceptance harness (`run-real-model.mjs`, 20 judges) | **ENV-LIMITED** (harness `SCRIPTED-ONLY`) | **20/20 PROVEN, 2/2 agreeing boots — SCRIPTED-ONLY** (round 111) | not run | the ENVIRONMENT: no real model route for a test host; the exact missing item is **`DEEPSEEK_API_KEY`** (optionally `DEEPSEEK_BASE_URL`), resolved by the pinned `llm-deepseek-api-key` adapter (`deepseek-official`) in both pinned hosts. `probe.json` is the machine record. With that credential the same command becomes the real acceptance run and only then may the level become `DEV-LIVE-real-model` |
| 35 | **host-capability tools** (`subagent`, `send_message`, `interrupt_agent`, `skill`, the 15 `team_*`) | **DECLARED UNCOVERED BOUNDARY (SEC-03)** | **n/a — not a confinement claim** (admitted on `team.control`/host authority; probe A15 measures the only `allow` with no lane) | **n/a** | **The declared boundary: these tools have NO managed fs/net lane.** Their effects are performed by host services, so the centre's lane algebra does not bound them; they are closed and admitted (`ADM-31`/`ADM-32`) but a hostile-code model must treat them as capabilities outside the sandbox (`SECURITY-REVIEW-20261125.md` §6 item 4). Named here so the boundary cannot be read as a control; **never counted as PROVEN for confinement.** |

**The dual-host candidate gate — ROUND 109 result (NON-REQUIRED; this fact does not upgrade any row).**
`node scripts/candidate-acceptance-gate.mjs --hosts both` at `41d579119` + the round-109 arm is
**`pass` on both hosts**:

| host | judges | proven | known-refuted | env-limited | verdict |
| --- | --- | --- | --- | --- | --- |
| rc.2 (`legacy`) | 31 | **30** | **1** | 0 | **pass** |
| rc.5 (`next`) | 31 | **30** | **1** | 0 | **pass** |
| **both** | **62** | **60** | **2** | **0** | **pass** |

The only non-PROVEN verdict is the single enumerated literal `d4:ask-execute-process` (counted once per
host). Nothing was added to `KNOWN_REFUTED`. Machine verdict
`dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T17-17-46-158Z/verdict.json`; full
transcript `round109/README.md` §2. **The gate stays NON-REQUIRED by owner ruling** — `ci-required`'s
layer list is untouched and the job is `knownNonRequired` — so **no row in this table becomes
PRODUCT-PROVEN until the gate is REQUIRED by branch protection AND green at the final head**. Measured
cost of one dual-host run: **83 m 48 s** (round 109), deliberately heavier than the whole daily
Required set.

**P0-2, visible in this status table — CLOSED by the owner's ruling (review `20261124-2120` ruling 2):**

- **`P0-2` — CLOSED — the lawful no-settlement boundary is ruled.** The owner chose the ruling route (b),
  so no upstream seam and no second authority is needed. The law, recorded verbatim in
  `OWNER-DECISIONS.md` (round 106):

  ```
  No Admission + No Body Start  =>  No UTE Settlement   (lawful)
  Admission Exists              =>  Terminal Settlement Required
  Body started + unconfirmable  =>  UNKNOWN (existing rule)
  ```

  See row 31. `packages/runtime/src/plugin/vnext/pre-dispatch-abort.mjs` is still not wired into a real
  host's own agent loop (the product does not own that `tools.execute` call site) — that is now recorded
  as a **coverage limit**, not an acceptance blocker, because the ruling states exactly what the product
  owes a reader when the host owes it no event.
- **What is tested (both pinned hosts):** the host's `ABORTED_BEFORE_DISPATCH` return is read and never
  replaced (no fabricated `tools/result`); `LEDGER_EXECUTION_UNBOUND` still refuses an execution fact
  without an admission; `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` is a **report only**; a pre-admission
  cancel leaves no body, no provider call, no grant consumption and no centre state row (`SLICE-40`); an
  admitted-then-stopped call records its Stop and reaches the terminal `CANCELLED` settlement, impossible
  to classify as "no settlement" (`SLICE-41`); a source-level pin makes "no execution fact without an
  admission" structural (`SLICE-42`). No existing refusal code was removed or renamed.

**The process-face scope, visible here too:** this generation promises **`allow`/`deny`** for
Subprocess/PTY; **per-call `ask` for process execution is `UNSUPPORTED BY PRODUCT RULING`** (APPROVED BY
OWNER 2026-11-24, the same class as PTC) and remains fail-closed. The refusal in row 30 is the promise,
not a pending fix; the real ask→approval→grant consumption is preserved as measured. Wording, the proven
process behaviours and the two preconditions a future generation would need — a new product contract and
a process boundary design — are in `SCOPE-subprocess-ask.md` (APPROVED BY OWNER) and
`OWNER-DECISIONS.md` (round 106).

### The P0-2 item — CLOSED (round 106), and what remains

`packages/runtime/src/plugin/vnext/pre-dispatch-abort.mjs` **exists, is exported by the product
composition, and is driven end to end in the slice composition — but it is NOT wired into a real host's
own agent loop.** In a real host the caller of `tools.execute` is the host's own agent loop, which the
product does not own; the observer is never invoked there. The owner ruled route 2 of the former ask
(review `20261124-2120` ruling 2): **the lawful "no settlement" boundary is defined**, so this is no
longer an acceptance blocker. It is recorded as:

> **COVERAGE LIMIT** — a booted rc.5 (or rc.2) member's pre-dispatch cancel is not recorded by
> production wiring; the ruled law and its tested controls say what is owed when the host owes no event.
> This table does not claim the wiring exists.

The law and its implementation are recorded verbatim in `OWNER-DECISIONS.md` (round 106) and driven by
`SLICE-40`/`SLICE-41`/`SLICE-42` on both pinned hosts. No `CORE_SEAM_BLOCKER` remains, no upstream patch
is proposed, and no second authority is introduced.

### What moved in round 106 — the two owner rulings implemented

1. **Ruling 1 — the Subprocess/PTY scope is APPROVED (product scope only).**
   `SCOPE-subprocess-ask.md` is **APPROVED BY OWNER (2026-11-24)** with the exact promise: `allow`/`deny`
   for Subprocess/PTY supported; per-call `ask` for process execution **NOT supported and fail-closed**.
   Process Ask is now **`UNSUPPORTED BY PRODUCT RULING`**, the same machine-visible class as PTC. Every
   document that named the scope changed from PENDING to APPROVED (this table's rows 30/31, the process
   paragraph above, `CAPABILITY-MATRIX-C.md` C-subprocess/C-pty/`ask`, `ADR-approved-ask-receipt.md`,
   `OWNER-DECISIONS.md`, `PR-BODY-draft.md`), and the candidate gate's `knownRefuted` citation now names
   the APPROVED ruling (still a literal id, never a pattern).
   **The round-102 REFUTED evidence is preserved verbatim: 16/17 PROVEN, 1 REFUTED, zero process, zero
   bytes, settlement `FAILED`.** The real ask→approval→grant consumption DID occur; the PTY spawn then
   failed with `NO_BACKEND` **before any process existed**. It is not a positive test, it is not
   `REFUSED`/`not-started`, and no historical row was rewritten.
2. **Ruling 2 — P0-2 is CLOSED by the lawful no-settlement boundary** (review `20261124-2120` ruling 2).
   The owner's law is recorded verbatim in `OWNER-DECISIONS.md` (round 106) and implemented as tested
   behaviour by three new arms in the `ute-vnext-a1` leg, green on **both** pinned hosts:
   - **`SLICE-40`** — a pre-admission cancel (on the ASK leg and on an effect-bearing `write`) leaves no
     body, no provider call, no approval request, no minted/spent grant, no written byte and no centre
     state row; the durable ledger keeps refusing (`LEDGER_EXECUTION_UNBOUND`) and
     `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` is reported as a **diagnostic**, never as a settlement.
   - **`SLICE-41`** — the exception cannot be used once an admission exists: an admitted-then-stopped call
     records its Stop (`phase: 'pre-dispatch'`) and reaches the terminal `CANCELLED` settlement, with the
     no-record report absent and no route to classify it as "no settlement".
   - **`SLICE-42`** — a source-level pin that no code path can create an execution fact without an
     admission: one execution-row writer in the durable ledger, guarded before its append; one production
     call site; one `record(fact)` in the fact builder, after `admissionOf`.
   No refusal code was removed or renamed; the host's `ABORTED_BEFORE_DISPATCH` return is untouched and no
   `tools/result` is fabricated.

### What moved in round 108 — the two rc.5 gaps re-run, and the `d2` refutation was a PRODUCT defect

Review `20261124-2120` §3 (first P0) named two rows the round-106 table still carried as rc.5 gaps:
`d:remote-creation` (not re-run on rc.5 since the round-91 judge repair) and `d2:remote-delivery` (no
rc.5 verdict recorded, plus the round-105 candidate-gate MEASURED refutation). Both were re-run on
rc.5 (`TEAM_TEST_HOST=next`, `--boots 2`) and both are **PROVEN**.

**The rc.5 refutation was the product's fault, not the judge's.** The chain, measured:

1. `member.archive` on rc.5 returned a **typed refusal of its own** (`archiveOk=false`) and the
   durable member row stayed `SETTLED` (`/__p6t6/state` read-back). The round-105 driver observation
   discarded that reply's error code, so only the *consequence* was visible:
   `member.send` → `ok=true code=null requestsAdded=0`.
2. The send was **correct**: `SETTLED` is work-accepting (`WORK_ACCEPTING_STATES`), so an un-archived
   member lawfully accepts a delivery. Nothing was silently dropped — the archive had never happened.
3. Root cause (rc.5 host-compat seam): the upstream PUBLIC service renamed
   `subagents.drainContinuableDescendants` (0.2.0-rc.2) to `subagents.drainDescendants`
   (0.2.2-rc.5) — same signature, same aggregate-after-settle contract, the very same
   `manager.drainDescendants` underneath. The drain seam hard-required the rc.2 name
   (`packages/runtime/src/plugin/vnext/stop-drain-lane.mjs` pre-fix lines 194/201), so on rc.5
   `recursive-drain-unavailable` → `LIFECYCLE_LIVE_EFFECT_FAILED` at step `drain-descendants` →
   **zero durable writes** → the member stayed `SETTLED`.
4. So the judge's expectation was RIGHT and the product was wrong: an archived member's delivery must
   be refused typed, and it is — once the member can actually be archived.

**The fix (arm, no patch of the host, CORE PATCH BUDGET = 0).** `stop-drain-lane.mjs:177`
(`resolveDrainSeam`) now resolves the drain seam by PUBLIC NAME capability — `drainDescendants`
(rc.5) first, then `drainContinuableDescendants` (rc.2) — and passes the parents verbatim (`:238`,
`:248`). A host exposing neither still fails closed through the same typed
`recursive-drain-unavailable` path (`:241`). The evidence arm sits in the already-collected vitest file
`packages/runtime/test/t12a-m3-recursive-drain.test.ts`: **M3-6** drives a double that exposes ONLY
the rc.5 name and asserts the same drain + honest count (`:171`), and **M3-7** asserts that a service
with `listDescendants` but neither public drain name still refuses (`:181`). The driver observation
also records the archive reply's own typed channel (`archiveCode`/`archiveMessage`, `run-boot-d2.mjs`
`:1760`), so a future archive failure can never again present only as "the send was accepted".

**Positive control (required before any observation change — and none was made).** On the SAME rc.5
boots, the same `member.send` channel is accepted for a LIVE member (`member.send ack: status=200
ok=true`, `deliveredSeq=40`) and for the RESTORED member after `member.restore`
(`restore-reenables-delivery` PROVEN; `restored.lifecycle=SETTLED ok=true`). The channel is not
blanket-refusing; it refuses exactly the ARCHIVED target. The clause was **not** relaxed — its
predicate grew strictly more observability (`archiveOk`/`archiveCode` in the detail), not a weaker
`ok`.

**rc.5 measurements (HEAD `e30d22c60` + the round-108 seam arm), driver `run-boot.mjs`:**

| judge (`d:`) | boot 1 | boot 2 | clauses |
| --- | --- | --- | --- |
| `d:member-read-admitted` | PASS | PASS | 7/7 |
| `d:member-read-denied` | PASS | PASS | 11/11 |
| `d:native-read-surface` | PASS | PASS | 6/6 |
| `d:guard-facts` | PASS | PASS | 5/5 |
| `d:centre-facts` | PASS | PASS | 9/9 |
| `d:remote-creation` | PASS | PASS | 8/8 |

Two-run agreement `agreeing=true differing=[]`; `RESULT PASS (2/2 boots; agreeing pair=true)`.
Counters identical on both boots (`allowFacts=2`, `denyFacts=0`, `centreAdmissions=2`,
`centreExecutions=2`, `governedSurface=true`, `admittedBytes=true`, `deniedSecretAbsent=true`).

**rc.5 measurements, driver `run-boot-d2.mjs`:**

| judge (`d2:`) | boot 1 | boot 2 | clauses |
| --- | --- | --- | --- |
| `d2:multi-member-concurrency` | PASS | PASS | 18/18 |
| `d2:revocation` | PASS | PASS | 18/18 |
| `d2:stop` | PASS | PASS | 11/11 |
| `d2:remote-delivery` | PASS | PASS | **20/20** |

`d2:remote-delivery`'s `archived-member-refused-typed`, both boots:
`archiveOk=true archiveCode=null archiveMessage=null lifecycle=ARCHIVED
code=TEAM_RUNTIME_WORK_STATE_REJECTED requestsAdded=0` — archived, and the delivery refused with a
typed code and zero added requests. Two-run agreement `agreeing=true differing=[]`;
`RESULT PASS (2/2 boots; agreeing pair=true)`; admissions/guard facts identical on both boots
(`aAdmissions=10`, `bAdmissions=10`, `aGuardFacts=14`, `bGuardFacts=16`).

**The rc.5 candidate gate is green at this head** (`acc72e58e`):
`CANDIDATE-GATE pass host=next judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8
agreement=true` — the only non-PROVEN id is the enumerated `d4:ask-execute-process`
(`dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T16-32-03-294Z/verdict.json`). The
round-105 rc.5 column that read `fail` is therefore closed **by the product fix**, not by an allowance:
`KNOWN_REFUTED` still holds exactly one literal id. All other round-108 gates (dispatch leg 251/248/0/3,
catalog 785/38, cut-closure, p0-assets, docs-sync, place-dist-glue 35, eb3-ci-required 11, bound
`ci-integration` 238, UTE G1 argv 89/89, run-manifest 552, window red=0/0, `ci-pr-gate --full
--census-captures 2` PASS 10/10) are tabulated in
`dev/agent-workflow/evidence/ute-a1/round108/README.md` §6, including the one disclosed
`u6-mcp-017-regression` loopback-timeout flake on the first `ci-pr-gate` attempt.

**Levels:** no row moves. Both rows stay **DEV-LIVE**; neither becomes PRODUCT-PROVEN (no bound,
required gate exercises them). The rc.5 column of the single table is now green for every row except
the enumerated/ruled refusal (`d4:ask-execute-process`, row 30) and the ENV-LIMITED OS controls.

### Still open — the owner's next list (NOT done this round)

These are recorded so the candidate does not read as finished; none was attempted in round 106:

- ~~re-run `d:remote-creation` and `d2:remote-delivery` on rc.5 through the candidate gate, including the
  round-105 rc.5 refutation~~ — **DONE in round 108.** Both are PROVEN on rc.5; the refutation was a
  product/host-compat defect (rc.5's public drain rename), fixed and armed. See "What moved in
  round 108" above;
- run the **full rc.5 test population** (the candidate gate currently exercises the four live drivers, not
  the whole suite map on the target host);
- a **real-model smoke test** (every live row still uses the scripted mock; no real-model interleaving of
  any call is measured);
- **C1–C18 sign-off** (the contract rows are disposed but not signed off as a closed set).

### What moved in round 102

1. **The D4 acceptance now exists on the TARGET host.** All 17 D4 judges were run on rc.5
   (`--boots 2`, `TEAM_TEST_HOST=next`): 16 of the 17 judges PROVEN with facts and bytes **identical** to rc.2, one
   REFUTED for the product reason above. The two `agreement.txt` files are **byte-identical**.
2. **The probe is host-selectable** through the ONE selector (`tests/next-host/host-select.mjs`),
   including its realm `tool-fs` module, which used to be hardcoded to rc.2 (§RC5-MIGRATION §13).
3. **One measurement oracle was made deterministic** (`d4:case-created`), because it had been
   refuting a correct product for a 176 ms race (§RC5-MIGRATION §13.3).
4. **P0-2 is classified as an open blocker** instead of being described as closed.
   *(Round-106 update: the owner has since CLOSED P0-2 by ruling the lawful no-settlement boundary; this
   line records what round 102 did, and the current status is row 31 above.)*

### What did NOT move

No level was upgraded. No row is PRODUCT-PROVEN. `d4:ask-execute-process` is still REFUTED (and is now
`UNSUPPORTED BY PRODUCT RULING`, round 106). The two
driver judges that needed an rc.5 re-run are now recorded by the candidate gate (round 105):
`d:remote-creation` is **PROVEN** on rc.5, and `d2:remote-delivery` is **REFUTED** on rc.5 in ONE
clause (`archived-member-refused-typed`: `lifecycle=SETTLED code=null requestsAdded=0`, both boots)
— a new measured rc.5 gap, not a documentation defect. The gate section below states exactly what
that means and what it does not mean.

### The candidate acceptance gate — round 105 (NON-REQUIRED layer)

Review `20261124-1341` §4.4 asked for the key DEV-LIVE scenarios to become "an executable,
reviewable candidate gate". `scripts/candidate-acceptance-gate.mjs` is that layer. It is a runner,
not a new judge: it runs the four D drivers (`run-boot.mjs`, `run-boot-d2.mjs`, `run-boot-d3.mjs`,
`probe-d4-routed-wake.mjs`) with `--boots 2` on the host selected by the existing `TEAM_TEST_HOST`
machinery (`--hosts legacy|next|both`), then reads each driver's OWN emitted artifacts
(`run-record.json`, `agreement.json`, `results.json`, `routed-judges.json`) and requires:

1. every one of the **31** enumerated judges is present in both boots (a dropped or renamed judge
   fails; the set is pinned in the script, not derived from what the driver happened to write);
2. every judge is **PROVEN** except the exact enumerated `KNOWN_REFUTED` entry
   `d4:ask-execute-process`, whose citation is `SCOPE-subprocess-ask.md` §2/§4 (a REFUTED judge not
   in that literal map fails; nothing is matched by pattern);
3. the driver's own `agreement.agreeing === true` with zero differing rows;
4. every RUN record is valid under `scripts/eb3-run-manifest.mjs` (the SAME validator the hosted
   `EB3-RUN-MANIFEST` leg runs), non-partial and non-subset, and was written by THIS run (`mtime`,
   so yesterday's bytes cannot pass).

Any unexpected verdict, invalid record, stale artifact, disagreement, driver failure or timeout is a
FAIL. There are **no retries** and **no timeout widening**: the one timeout is
`DRIVER_TIMEOUT_MS` = 2,700,000 ms (45 min), and a hung driver is killed and reported as a FAIL that
names it. The machine verdict is `verdict.json`; the human summary is `summary.txt`; both live under
`dev/agent-workflow/evidence/candidate-acceptance-gate/<stamp>/`, with each driver's artifacts
snapshotted per host under `<stamp>/<host>/<driver>/`.

**Round-109 verdicts (HEAD `41d579119` + the round-109 arm — the CURRENT gate state):**

| host | selector | judges | proven | known-refuted | env-limited | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| rc.2 (control) | `TEAM_TEST_HOST=legacy` | 31 | **30** | **1** | **0** | **pass** |
| rc.5 (target) | `TEAM_TEST_HOST=next` | 31 | **30** | **1** | **0** | **pass** |
| **both** | one run, both hosts | **62** | **60** | **2** | **0** | **pass** |

Measured wall clock **83 m 48 s** (`17:17:46 → 18:41:34`), machine verdict
`dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T17-17-46-158Z/verdict.json`; the
single non-PROVEN id on each host is the enumerated `d4:ask-execute-process`. **The gate remains
NON-REQUIRED by owner ruling**, so this green result still upgrades no row.

**Round-105 verdicts (HEAD `65481f2f6`, kept as history — superseded by round 108's product fix):**

| host | selector | judges | proven | known-refuted | env-limited | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| rc.2 (control) | `TEAM_TEST_HOST=legacy` | 31 | **30** | **1** | **0** | **pass** |
| rc.5 (target) | `TEAM_TEST_HOST=next` | 31 | **29** | **1** | **0** | **FAIL** |

rc.5's round-105 FAIL was the honest verdict: `d2:remote-delivery` was REFUTED and a judge outside the
enumerated known-refuted list may not pass. The failing clause was `archived-member-refused-typed`
(`lifecycle=SETTLED code=null requestsAdded=0`), identical on both boots. Round 108 fixed the PRODUCT
(the rc.5 public drain rename) rather than the judge, and round 109 re-ran the whole layer on both
hosts: pass.

**What the layer DOES change:** the whole acceptance set is now ONE command with ONE machine-readable
verdict and one human summary; the drivers' two-boot agreement, RUN-record validity and known-refuted
scope are checked in one place, and a stale artifact cannot be quoted as a fresh run.

**What it does NOT change:**

- It is **NOT Required CI**. `ci-required`'s layer list is untouched; the workflow
  `.github/workflows/candidate-acceptance.yml` runs on `workflow_dispatch` and on
  `pull_request: [labeled, synchronize, reopened]` for a PR that CARRIES the `candidate-acceptance`
  label (round 109 / review `20261125-0058` §4.2: a later push to a labelled PR now produces its own
  result for the new HEAD). Its job is registered in
  `dev/ci/eb3-ci-manifest.json#knownNonRequired` (with the reason, which names the trigger) so
  `eb3-ci-required` sees it as an explicitly non-required job. It is not a branch-protection context.
- **HEAD binding (round 109).** The check name and the artifact name carry the graded SHA; the job
  checks out `github.sha`, and a `Bind the graded head` step fails the run unless both the checked-out
  HEAD and the verdict's own `head` equal `github.sha` and the artifact was written by this run. A
  stale verdict from another commit can therefore not be read as this HEAD's result.
- **Cost (round 109, measured).** One dual-host run is **83 m 48 s** of wall clock — deliberately
  heavier than the whole daily Required set, which is why this layer must not be a merge gate.
- It does **not** upgrade a row. Every row in the table above stays at the level it had. A row
  becomes **gate-backed only when the gate is REQUIRED by branch protection AND green** — that is an
  owner decision, and this round does not claim it. A green non-required gate (rc.2 is green here)
  is still DEV-LIVE evidence in the vocabulary of this report.
- It does **not** re-implement, weaken or relax any driver judge; it reads the verdicts those judges
  already emit, and validates the records with the repository's existing validator.
- It does **not** turn `d4:ask-execute-process` into a pass. The refutation stays enumerated with its
  citation, and removing the enumeration makes the gate red.
- It does **not** upgrade rc.5 by itself: the round-105 rc.5 FAIL was closed by the round-108
  product fix (the drain seam), not by a rule or an exemption, and round 109's dual-host `pass` is
  still non-required evidence.

**Worktree:** `.worktrees/vnext-a1-cut` · **Branch:** `vnext/a1-cut` ·
**HEAD measured for every number below (round 89):**
`97d7d7c8d1bb0410dac9dedac77dee97143851bf` · **Base for the cut:** `a19d1df01` (frozen A0, PR #821) ·
**Record class of everything below:** in-process `MECHANISM` + `DEV-LIVE`. Never candidate evidence,
never a gate.

> **Round 89 documentation-integrity round — read this block with `CANDIDATE-AUDIT.md`.** The round-86
> audit measured at `c29da52d3`; rounds 87 (the D4 live probe) and 88 (the BL-30 boundary measurement)
> then landed **5 commits** of NEW measured facts (`git rev-list --count c29da52d3..HEAD` = **5**). This
> revision re-measured every number the report and the PR body assert — scope counts, entry-file line
> counts, all ten local gates, the bound vitest/migrated/UTE-G1 legs, and the hosted verdicts — and folds
> in the two new in-repo seams. What changed materially: (a) the scope block (§1) is re-measured at this
> HEAD; (b) **`d4:routed-wake` is REFUTED on a live boot** and the two Team-side seams behind it are now
> named with `file:line` evidence (§6.5, new **§10**); (c) the live consequence of BL-30 — *a Member can
> ASK, be GRANTED, and still not run the granted call in production* — is stated in the C5/C6/C7 rows
> (§2.2) and **§10**; (d) **hosted `ci-integration` is FAILURE at this HEAD** (leg `tinf-instruments`;
> `EB3-REQUIRED fail layers=6 green=4 nongreen=ci-integration:failure,ci-census:skipped`), so the old
> "six layer jobs green" claim no longer holds. The hosted red is NOT reproduced by the same leg locally
> (§9.4) and is carried as an open item in §10, not papered over. Nothing is upgraded anywhere; the
> corrections total **19** (worst five listed in §11).

This is the single reviewable document for the candidate. It is written to be audited line by line:
every product claim carries a `file:line` or an evidence path, and every row that is not proven says
what would prove it.

> **Read this first, it is the conclusion.** The candidate implements **A1 + B + C** and carries **live
> D evidence** for the items listed in §3. It is **not a completed product acceptance**. **Round 76
> closed the last REFUTED D-driver judge**: `d3:persistent-subprocess` is **PROVEN** in two agreeing
> DEV-LIVE boots (a persistent, OS-confined shell across two turns, with the in-lane write succeeding and
> the out-of-lane write refused by the kernel). **Round 87 then REFUTED one D4 probe judge**
> (`d4:routed-wake`) — a blocker measurement, not a driver acceptance — because the product's own durable
> ask carries no Alpha.6 case (§6.5/§10 G1). Several product-entry gaps remain unreachable, and **no
> capability row is PRODUCT-PROVEN** (`CAPABILITY-MATRIX-C.md:71-74`) because a DEV-LIVE boot is not a
> gate. §6 lists the remaining limits; **§10 is the complete open-gap register**; §7 states the verdict
> without rounding up.

> **Round 66 addendum (C11).** Three node:test arms were added after the HEAD measurement in §1:
> `ADM-107`…`ADM-109` prove the **Team-owned** projection (`projection/**`) is preserved in the new
> assembly and derives only from durable TeamDomain facts (positive control: a real
> `team_create_member` is what the next reader sees, read back across a cold reopen; negatives: a
> centre-REFUSED mutation moves nothing, the live overlay invents nothing, an absent TeamSession fails
> closed, and a projection pass writes nothing). The §2 C11 row, §4.1 leg counts and §7 counts are
> refreshed for those arms; §1's HEAD/diff facts stay as measured. C11's **host**
> `sessionProjections.stateOf` half is still unproven and needs a live boot. Nothing is upgraded to
> PRODUCT-PROVEN.

> **Round 67 addendum (C14b + audit).** The owner's C14b row now carries its own proof: six node:test
> arms (`ADM-110`…`ADM-115`) witness that the eight deleted family bodies are gone and that each
> preserved safety invariant — path bounds, network allow/deny, Control authority, Stop, plus the
> process family's fail-closed rule and dropped-name discipline — still holds in BOTH directions at its
> new owner. §2.2's C14b row, the new §2.3 drop→owner table, §3, §4.1/§4.2 and §7 are refreshed. The
> same round audited §2 row by row: three evidence citations were corrected (C1's live line number,
> C5's "resolved" wording, C15's placement path), §6.9's stale realm-less sentence was corrected (the
> code refuses that member), and §7's "Four live judges" was corrected to the nine it lists. Nothing is
> upgraded to PRODUCT-PROVEN.

> **Round 71 addendum (judge semantics).** Two judges were REFUTED for reasons about the JUDGE, not the
> product, and both clauses were REWRITTEN to measure the contract strictly rather than relaxed:
> `d2:revocation` now asserts the four directions (durable deny refuses with `ADMISSION_OVERLAY_DENY` +
> zero body + settlement `REFUSED` + overlay named + policy generation; deny removal restores the call
> as a NEW fact and `COMPLETED`; the in-lane control is admitted at every phase; and widening beyond the
> compiled ceiling is refused, with the product's own answer measured) and `d:member-read-denied` now
> measures the DECIDING CHANNEL (`LANE_DENY` with ZERO provider guard facts for that call, or
> `IO_READ_DENIED` with its own guard deny fact), plus zero secret bytes, not-ENOENT, and a separate
> in-process `ADM-100` clause for the provider channel. Both are **PROVEN on two agreeing boots** at
> HEAD `82dfda0c3`; `run-boot.mjs` and `run-boot-d2.mjs` now exit 0 with their full clause sets. The two
> rows in §3.2, §6.6, §6.13, §7 and the checklist are refreshed. Nothing is upgraded to PRODUCT-PROVEN,
> and no product code changed for this round.

> **Round 74 addendum (governed management plane).** The owner ruled on the round-59 escalation
> (`docs/reviews/20261122-1536.txt` §3): S6 Remote is restored as an authenticated **management control
> plane**, not a second agent-tool executor. A centre-configured row now builds/installs the S6 plane;
> `POST /team-remote/team.create` mints the Team at runtime through `createAndStartTeam()`. Commands are
> classified by ACTUAL EFFECT in one closed table (`s6-command-classification.ts`); the
> `agent-execution` class (`team.admitInitialWork`, `team.ensureRootLive`, `member.create`,
> `member.send`, `member.followup`) is refused with the existing `ADMISSION_REMOTE_UNAVAILABLE` on
> `team.control`, with a durable fact + `REFUSED`/`not-started` settlement. The round-60 boot-create
> workaround in the D driver is REMOVED; a new live judge `d:remote-creation` is **PROVEN on two
> agreeing boots** (`RESULT PASS 2/2`). §2 C1/C4/C9, §3.2, §6.2, §7 and the checklist are refreshed;
> the escalation is RESOLVED. This is not multi-user RBAC, and no S6 command may execute a model tool.

---

## 1. HEAD, branch, and scope facts

Round 70 measured the table below; **round 89 re-measured every row at `97d7d7c8d`** (the round-86
values are superseded: the branch grew from 205 to 210 commits and from 3,377 to 3,476 file paths, all
of it the rounds 87–88 product, test and evidence work). Citation convention: a path
containing `/` is repo-root-relative; a bare filename in a row or section is shorthand for the full path
named in that same row/section (the reviewable set uses this to keep the tables readable).

| fact | value | how measured |
| --- | --- | --- |
| HEAD sha (measurement commit) | `97d7d7c8d1bb0410dac9dedac77dee97143851bf` | `git rev-parse HEAD` |
| branch | `vnext/a1-cut` | `git rev-parse --abbrev-ref HEAD` |
| commits since A0 `a19d1df01` | **210** | `git rev-list --count a19d1df01..HEAD` |
| working tree at measurement start | clean | `git status --porcelain` (empty) |
| diff vs A0 | **3,476** files changed, **+249,967 / −160,719** | `git diff --shortstat a19d1df01..HEAD` |
| file-status counts vs A0 | **2,646 A · 616 D · 211 M · 2 R094 · 1 R095** | `git diff --name-status a19d1df01..HEAD \| awk '{print $1}' \| sort \| uniq -c` (git warns that exhaustive rename detection was skipped; the rename counts are a lower bound) |
| entry files | `agent-bindings.mjs` **4,301** lines (round 90: was 4,967; four cohesive spans moved VERBATIM into the sibling modules listed in §6.16) · `root.ts` **5,239** lines (unchanged) | `wc -l` on `packages/runtime/src/plugin/vnext/{agent-bindings.mjs,root.ts,governed-preset-modules.mjs,mcp-witness-lane.mjs,root-delivery.mjs,stop-drain-lane.mjs}` |
| `master` containment | `git merge-base --is-ancestor HEAD origin/master` → **false** | `origin/master` = `a19d1df01`, the A0 PR #821 |

### 1.1 Cut closure (fresh runs, this HEAD, pasted verbatim)

```
$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
```

```
$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
```

Reading the two together, precisely:

- **146 files deleted** and **2 entries replaced** — the frozen A0 delete/replace set.
- **148 sources gone** (`deleted=148`): 146 deleted + the 2 replaced entries.
- **32 files kept**, out of **180** across **37** modules; **69,512** lines in the frozen census.
- `cut=cut(0/148)` means the closure gate finds **zero** frozen-set files still present, and
  `cut=cut(148/148)` in the assets gate means all 148 are accounted for. `prodRefs=0` = no surviving
  production import of a retired entry; `distResiduals=0` = no stale dist mirror of a deleted source;
  `dupNames=0` = no duplicate tool-name declarations.

### 1.2 Dist mirror placement count

```
$ node scripts/place-dist-glue.mjs
place-dist-glue: done (34 placement(s))
```

**34** byte-identical `.mjs`/`.py` placements — round 90 added the four decomposition modules
(`scripts/dist-placements/260-ute-a1-decomposition.json`; 30 → 34). Every line at the run reads
`(byte-identical)`; the
`artifacts-at-head` leg independently reports 1,941 files and 30 glue placements). This is a *different measurement* from the frozen A0 figure: A0 counted **52 committed dist artifacts**, and the
closure gate cannot see the aggregated `packages/runtime/dist/packages/<other-pkg>/…` mirrors or `.mjs`
byte-copies — `CUT-BOUNDARY-ADDITIONS.md:27-32` explains the mapping. The two numbers are not comparable
and neither is quoted here as the other. (The `artifacts-at-head` "30 glue placements" figure in this
sentence is that leg's own class count at the round-89 head and was not re-measured this round; the
authoritative placement number is the `place-dist-glue` line above.)

### 1.3 A0 frozen numbers (for comparison)

| measure | A0 frozen (`a19d1df01`) | this HEAD | source |
| --- | --- | --- | --- |
| modules / files / lines | 37 / 180 / 69,512 | unchanged (37 / 180 / 69,512) | `docs/plans/memo/ute-p0-20261121/01-ASSET-INVENTORY.md:8` |
| files deleted | 146 (wave 1 = 146, wave 2 = 0) | 146 deleted + 2 replaced = 148 sources gone | same; `ute-p0-assets` line above |
| entries replaced | 2 (`agent-bindings.mjs`, `root.ts`) | 2 (both replaced wholesale) | same |
| files kept | 32 | 32 | same |
| dist artifacts | 52 committed (A0 accounting) | 52 A0-accounted + **151 additional** stale mirrors deleted by the boundary completion = 203; `place-dist-glue` now maintains **30** byte-copied placements (a different measure) | `CUT-BOUNDARY-ADDITIONS.md:27`; `place-dist-glue` line above |

---

## 2. The C1–C18 acceptance checklist

### 2.1 Where the list came from (authoritative, not reconstructed)

The owner's D requirement names "C1–C18 状态". The authoritative enumeration **exists** and is frozen:
`docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md`, section **"The list (A1 must dispose of
every row)"** (lines 30–52). It is the UTE P0 capability contract; the rule that makes it enforceable is
at `:86-90` ("A1 may not merge while a row is blank … 'dropped' must name the owner ruling"). Its own
phase split is at `:16-28`, and the "A1 must dispose of every row" framing is at `:30`.

**One structural detail, stated rather than smoothed over:** that table has **19 rows** — C1…C18 **plus
`C14b`**, because the owner split C14 into "drop the implementations" and "preserve the safety
invariants" (`06-CAPABILITY-CONTRACT.md:26`, `:54-63`, and the decision record at
`dev/agent-workflow/SESSION_ROUTER_LOG.md:9810`). So the 18 numbered criteria are all present, and C14b
is an additional sub-row of the same frozen contract. It is included below as its own row, labelled.

The **capability** and **disposition** columns below quote that table's wording verbatim. The **status**
and **what would prove it** columns are this report's honest measurement; they are not from the frozen
list.

### 2.2 The checklist (18 numbered rows + the contract's C14b split row)

Status vocabulary — these are not interchangeable:

- **MECHANISM** — the centre-side guarantee is implemented with passing in-process arms
  (`CAPABILITY-MATRIX-C.md:5`).
- **DEV-LIVE** — additionally measured on a real booted host by a live judge; a `DEV-LIVE` record is
  **not** a gate and upgrades no row (`CAPABILITY-MATRIX-C.md:7`, `:71-74`).
- **PRODUCT-PROVEN** — MECHANISM **and** a real product assembly exercised it end to end. **No row is in
  this state.**
- **REFUSED-BY-DESIGN** — the call is refused with its own typed code on its own axis; this is the A1 law
  working, not a defect (`CAPABILITY-MATRIX-C.md:72-74`).
- **DROPPED-AS-RULED** — deleted under an owner ruling named in the contract.
- **UNPROVEN** — nothing here should be reported as working.

| # | capability (verbatim) | disposition (verbatim) | status at this HEAD | evidence | what would prove it (if not PRODUCT-PROVEN) |
| --- | --- | --- | --- | --- | --- |
| **C1** | the **15** `team_*` tools (member/template/delegation/control board) | **preserve** — not the retired plane; the earlier draft credited the plane, which was wrong | MECHANISM + DEV-LIVE surface. The closed list is `CENTRE_TOOL_NAMES` (`packages/runtime/src/plugin/vnext/admission.ts:86-102`); `ADM-31` pins it against `createTeamTools` **in both directions**; `ADM-89/90/91` admit all 15 on `team.control`, refuse all 15 unbound, and refuse an unlisted name. Live: the booted centre row's model-visible surface carries all 15 (`ESCALATION-centre-row-creation-entrance.md:8-9`) | `packages/runtime/test/vnext-admission.test.mjs`; `ESCALATION-centre-row-creation-entrance.md:8-9` | a governed row that **creates and drives** the board end to end through a product entrance with a real model. **Round 74 removed the entrance blocker** (`POST /team-remote/team.create` mints the Team at runtime on a centre row); the live driver still uses the product's scripted mock, so a **real model** remains unproven |
| **C2** | member create / resume / archive | **preserve** | MECHANISM. `ADM-92` creates through `team_create_member` and installs the **member's own** centre at its bind; `ADM-93` archives through `team_archive_member` (production step ports: quiesce → settle-then-archive → `release-residency`), and the next call is `ADMISSION_MEMBER_CLOSED`. **DEV-LIVE (create only):** the D3 delegate produced a real `member-activated` effect with `instanceId`/`childSessionId` (`d3:work-delivery`, §15) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md` §15; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` | a live **archive** and a live **resume** on a booted host. Archive's live path currently refuses **earlier**, at the durable lifecycle gate (`LIFECYCLE_ADMISSION_CLOSED` / `memberResumeRefusal`) — `CAPABILITY-MATRIX-C.md:61-64`. Resume is not measured live at all |
| **C3** | work delegation + delivery receipts | **preserve** | **DEV-LIVE PROVEN** (`d3:work-delivery`, two agreeing boots). `team_delegate` → `effect.kind=member-activated`, prompt delivered **verbatim** as the Member's first user message, final text and `memberResult.body` both exactly `DBOOT_D3_DELIVERED_UNIT_ALPHA`; `team_collect` returns the terminal `succeeded` entry, **byte-identical when collected again after a SIGKILL cold restart**; the unit is on disk; every member call fact is in the member's own ledger. `ADM-94/95` carry the in-process positive and negative | `D-BOOT-FEASIBILITY.md:618-628`; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md`; `packages/runtime/test/vnext-admission.test.mjs` | a **real-model** interleaving (the current model is the product's scripted mock, §6.7) and a delivery driven at a product entrance rather than the driver's boot-bound team |
| **C4** | Blueprint binding + identity generation | **preserve** (KEEP module) | MECHANISM. `ADM-26` maps a compiled member onto a binding by reference, never by re-interpretation; `TB-1…TB-6` pin the durable-row resolution and the four typed refusal reasons with **no** legacy degradation. Live: the round-60 path-3 boot binds a v4 blueprint at boot and reaches a governed Member (`CAPABILITY-MATRIX-C.md:137-141`) | `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/test/vnext-template-binding.test.mjs`; `CAPABILITY-MATRIX-C.md:137-141` | an identity generated for a member **created at runtime** on a governed row — **round 74 now has the runtime Team/Leader identity** (`team.create` → `createAndStartTeam`); a runtime-created **Member** (`member.create` is SERVED as `work-delivery` since round 83 but has **no live proof** — §9.5) and a real-model identity are still unproven |
| **C5** | Control: ask / grant / deny / consume | **preserve** (KEEP module), fed by the three contracts | MECHANISM. `ADM-46…ADM-55` cover wiring, deny, expired, fault, the **real** `ControlService` (one request → one durable allow → one-shot spend), a real service deny, generation drift, incomplete identity, and the supply-chain pin. Live: `d2:stop` parked a Member turn at a durable `admission-ask` Control request `status=pending` and **stopped** it through the public `session/cancel` RPC — a Stop, not an approval (no decision row is granted; the live record stops at the pending request and the `ADMISSION_STOPPED` fact) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493` | a live **approval** (leader allows) and a live **consume** of the one-shot grant. Today the live ask is only exercised in its Stop terminal. The product *does* install the grant binder and the durable approval port when the row has a `controlServiceRef` (`agent-bindings.mjs:692-710`); a row without one still refuses asks as `ADMISSION_ASK_UNWIRED`, and no live approval/consume has been observed  **ROUND 88 measured the ASK CONSUMER boundary and did NOT wire it** (`bl-30-ask-consumer/README.md`): `resolveAskClassCall` (the designed consumer) consumes a durable allow only through the last-mile guard `guardOperation`, which by design never authorizes or consumes an INLINE allow (`control/service.ts:4155-4165`, `:4289`) — and the ONLY production ask producer writes exactly that coupling (`admission-port.mjs:163`, measured live in the round-87 D4 row `executionCoupling: 'inline'`). Two new arms pin it over the REAL `ControlService`: same admission-shaped scope, guarded ⇒ adapter accepts and consumes 1; inline ⇒ `guardOperation` `no-request`, adapter `APPROVAL_DENIED`, 0 consumptions. The one-shot grant is also already SPENT by the host tool guard before the body reaches the refusing Provider plane (`admission-port.mjs:770-784`; `provider-capabilities.ts:315`). So a granted `ask` still cannot execute, and the wire-up is an owner decision (flip the coupling and lose the Stop-cancels-the-ask law `ADM-57`, or give the OS plane a read port onto the centre's enforced decision) — not a wiring change. No product code changed. **CONSEQUENCE, stated plainly: a Member can ASK, be GRANTED, and still not run the granted call in production** — measured both couplings over the REAL `ControlService` (guarded ⇒ guard allows + 1 consumption + `resolveAskClassCall` ok; inline = the production coupling ⇒ `no-request` + `APPROVAL_DENIED` + 0 consumption rows) and observed live in the round-87 row. This is **open gap G2** in §10 and needs an owner ruling, not a test change. **ROUND 95 — the owner ruled R3 and it is now WIRED IN PRODUCTION for `write`:** a booted rc.2 host produced a real Control request for a Member's `write` (lane `ask`), the Leader's `team_resolve_control` allowed it through the real control path, the one-shot grant was consumed once, the Provider verified the minted receipt for THAT execution and wrote the approved bytes, with `COMPLETED` settlement (`d4:ask-execute` PROVEN, two agreeing boots). Denial and Stop-while-pending both leave zero bytes and `REFUSED`/`not-started`. Every other tool/operation still refuses at R4, so G2 is **closed for `write`/`writeText` only**, never globally. |
| **C6** | Officer assignment + ReviewCapability routing | **preserve** (KEEP module) — *and* the contract's own rule: if Alpha.6 is not wired, "the corresponding approval and auto-wake paths must be **explicitly disabled**, never silently fall back" (`06-CAPABILITY-CONTRACT.md:95-98`) | **MECHANISM + the live REFUSAL shape.** (Round 86 audit: this cell opened with "REFUSED-BY-DESIGN … `centre-config.ts:73` rejects the opt-in on **every** row" — that was true through round 83 and is false since round 84: only an INCOHERENT row is refused.) `ADMISSION_ALPHA6_UNAVAILABLE` in two independent gates: `alpha6EnablementRefusal` (`centre-config.ts`) refuses each incoherent opt-in piece by piece and admits a coherent row (`root.ts:2508-2525` records either outcome through the same point) (`ADM-34`, `ADM-99`, `ADM-141`). **Live:** `d3:alpha6` **PROVEN** as the typed-refusal shape — no team root (`/__p6t6/state` 404), no decision, no wake intent. **ROUND 68:** the row's refusal is now RECORDED at the host entry through the product's own point (`host.ts` -> `createAlpha6RowRefusalHook` at the centre rule -> `createHostSurfaceRefusalPoint`): both live boots measured one `ADMISSION_ALPHA6_UNAVAILABLE` invocation-authority fact on `host.service` and a `REFUSED`/`not-started` settlement (`ADMITTED→REFUSED`) under the row's `centreStatePath`, while the same typed refusal and the same no-team-row boot outcome are unchanged. A row with no `centreStatePath` is still refused but unwritten (no durable directory). `ADM-116/117/118` carry the in-process shape. **ROUND 84 — THE FORMAL ROUTING IS IMPLEMENTED; the row is no longer unconditionally refused.** The pre-code determination (`ALPHA6-FORMAL-ROUTING.md`) found three missing pieces and **no `CORE_SEAM_BLOCKER`**: the routing AXIS (none is lawful and none is needed — a routing decision executes nothing, so no member I/O axis is invented for it); the WAKE (a bespoke `followup`/`steer` write is replaced by a governed DELIVERY: durable `team-review-wake-routed` intent → `SessionInputPort.submitAttributedInput` → `team-review-wake-delivered` confirmation, in the SAME TeamDomain ledger, with the SAME correlation token P6-T3 uses for `member.send`); the ENABLEMENT (`centre-config.ts#alpha6EnablementRefusal` admits a COHERENT row — authored v5 `reviewRouting.enabled`, non-empty `centreStatePath`, absolute `alpha6WakeIntentPath` — and refuses each incoherent one with its OWN typed piece code under the unchanged `ADMISSION_ALPHA6_UNAVAILABLE` prefix, so the recorded refusal still lands). The Officer's own `team_resolve_control` is admitted by the ONE centre on `team.control` under the OFFICER's binding, and the management plane never executes a tool during a wake. New arms: `ADM-141` (positive enablement + each piece refused AND recorded), `ADM-142` (officer route, nothing executed), `ADM-143` (intent + confirmation + machine attribution + zero executions), `ADM-144` (Officer's own call admitted under its binding), `ADM-146` (duplicate ⇒ ONE confirmation; unknown recipient ⇒ typed refusal, zero facts), plus `a6-pr4-review-wake-glue`, `a6-pr7-merged-wake-host` and `a6-root-wiring` (a PRODUCTION root boots a coherent Alpha.6 row). The refusal arms stay green (`ADM-34/85/99/116/117/118`; the D3 live `d3:alpha6` refusal). **Still NOT proven: a live host run of the ROUTED wake** — the D3 world's blueprint is v4 with a single worker member and no Officer/approval case, so it can express only the refusal side. **ROUND 87 measured the live answer (D4 probe, two agreeing DEV-LIVE boots):** a coherent v5 world with an Officer boots a real Team (`d4:enablement` PROVEN), the Officer comes up and ITS OWN call is admitted under ITS binding (`d4:officer-up` / `d4:officer-binding` PROVEN), and the refusal side is still PROVEN (`d4:refusal`) — but the routed wake is **REFUTED by the product itself**: the worker's authored `ask` lane mints a real durable `leader-approval` row with **no `approvalCaseId`/`legOrdinal`/`reviewAuthority`**, the product's own router answers `null` for it (`memberListCalls: 0`), zero `team-review-wake-*` facts and zero wake-intent files exist, the Officer is never woken, and the **Leader** receives the plain C1 ask. Two Team-side seams are missing and **neither is a `CORE_SEAM_BLOCKER`**: no live producer of a case-bearing ordinary ask (the only live leg producer is the envelope-mutation lane; the PA ask lane was deleted in `1617d5839`; `team_request_control`/the admission ask cannot carry a case), and no consumer for an `ask`-disposition call even after an allow (`IO_ASK_REQUIRES_APPROVAL`, "`resolveAskClassCall` has no production caller", BL-30). Claim stays MECHANISM | `D-BOOT-FEASIBILITY.md:629-643`; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md`; **`dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md`**; `dev/agent-workflow/evidence/ute-a1/ALPHA6-FORMAL-ROUTING.md`; `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/src/plugin/vnext/review-wake-delivery.mjs` | a **live** routed review (an Officer approval case resolved through the mock model and the wake delivered at a boot); the live level remains the refusal shape (`CAPABILITY-MATRIX-C.md` C-alpha6), and round 87 shows the blocker is our own missing ask-case producer + BL-30, not an upstream seam |
| **C7** | durable Wake intents + cold wake | **preserve** | MECHANISM, in-process only. `ADM-98` composes `createAlpha6RootWiring` directly, the ONE shared `createAlpha6RootRouter` takes a real `recipient` decision off a durable control row (Officer, `routeRole='officer'`), and the real `dispatchLatch` + `createFileWakeIntentDirectory` persist a row that a **fresh** reader sees naming exactly the routed reviewer. **ROUND 87:** that in-process arm is still the ONLY place the intent is written from a routed case — on a real host the durable row the product actually mints carries no case, so `route()` returns `null` before any intent exists (`d4:routed-wake` REFUTED; `d4/runs/boot0{1,2}/route-probe.json`) | `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/src/plugin/vnext/review-wake-delivery.mjs`; `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md` | the same, reached at a **product entry**: ROUND 84 makes the wake a governed delivery and a coherent row BOOTS (`a6-root-wiring`, `a6-pr7-merged-wake-host`, `ADM-143`), so the machinery is now built at a real production root — what is still missing is (i) a live producer of a CASE-bearing ordinary ask and (ii) a live boot that carries an Officer approval case (§6.5, §10 G1/G2) |
| **C8** | Stop (sticky, durable, non-replaying) | **preserve** | MECHANISM + **DEV-LIVE PROVEN** (`d2:stop`, two boots). Stop is the host's own `exec.signal` — no second stop mechanism. `ADM-56…ADM-62` cover Stop before the body, while an ask is pending, after the approval and before the body, lifecycle close with a call in flight, and the product composition's own close. Live: `POST /api/session/cancel` → tool result `ADMISSION_STOPPED`, centre fact `refusalCode=ADMISSION_STOPPED`, settlement `REFUSED`/`dispatch=not-started` with **no** execution fact, never `UNKNOWN`; a second Member completed with zero stops. **ROUND 79 — the rc.5 PRE-DISPATCH case (B6):** rc.5 cancels a call before dispatch without entering the pipeline, so `tools/result` never fires and event-only observation recorded nothing. The centre now reads the host's own `ABORTED_BEFORE_DISPATCH` result at the executor completion boundary (`pre-dispatch-abort.mjs`; `batch.ts:271-280` → `index.ts:375-377`), writes the SAME canonical execution fact (`aborted`, `abortPhase:'pre-dispatch'`, product ExecutionId) through ONE ExecutionId-keyed dedupe map, records `Stop(pre-dispatch)` + `CANCELLED` when an admission record exists, and when none exists writes **no** settlement and REPORTS `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` (no fabrication: no fake allow, no fabricated `tools/result`). `SLICE-21`/`SLICE-30` GREEN on rc.5 AND rc.2 with unchanged assertions; `SLICE-37` pins the dedupe (both paths firing ⇒ one fact, zero settlement) | `packages/runtime/test/vnext-fs-slice.test.mjs` (SLICE-21/30/37); `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493`; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md`; `RC5-MIGRATION.md` §7 | Stop **under load** and a real Stop keypress; and the settlement-recheck cell, which is no longer open: the owner approved **Option A** in round 73 (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md:51`; `ADM-119`: allow `gen-1` → durable deny `gen-2` → `REFUSED`/`not-started`). **Round 79 adds one:** the production `tools.execute` call site belongs to the host agent loop, so the pre-dispatch observer is exported and driven end to end in the slice composition but is NOT yet wired into a booted rc.5 member turn (`RC5-MIGRATION.md` §7.5) |
| **C9** | remote entry (`s6-remote`, remote control surface) | **preserve** | **RESTORED as a GOVERNED MANAGEMENT CONTROL PLANE (round 74)** under owner ruling `docs/reviews/20261122-1536.txt` §3. The S6 plane is BUILT and INSTALLED on a centre-configured row; `POST /team-remote/team.create` mints a Team at runtime through `createAndStartTeam()` with the existing S6 Principal + TeamDomain/Control + creation/start gates. Commands are classified by ACTUAL EFFECT in ONE closed table (`s6-command-classification.ts`): control-plane reads/creation/management are served, and since round 83 `member.create` / `member.send` / `member.followup` are also served as the **`work-delivery`** class (`s6-command-classification.ts:125-130`) — a handover into the Member's own governed path that never executes a tool. Only the two ROOT commands whose effect is agent execution (`team.admitInitialWork`, `team.ensureRootLive`, `:111-112`) stay REFUSED with `ADMISSION_REMOTE_UNAVAILABLE` on `team.control` + durable fact + `REFUSED`/`not-started` settlement. `ADM-86` (rewritten) pins the closed table both ways, the no-default-allow rule, a served control read, a refused execution (zero ports), the durable shapes, and the unauthenticated principal refusal; E3 pins the real production root (`installed===true`, served read, five type-refused executions with facts). Live `d:remote-creation` (round 74, two boots): unauthenticated refused/mints no Team, `TEAM_REMOTE_FOREIGN_TEAM`, runtime create success, duplicate no second Team/no provider request. Live `d2:remote-delivery` (round 83, two boots, rc.2): `member.send` acknowledged with 0 admissions/0 executions at the acknowledgement, the delivered prompt then ran in the Member's own turn and its `allow` landed in the MEMBER's ledger ~113 ms later; unknown member, archived member, duplicate send (at-least-once, no operator-side execution), restore, and Stop during a delivered turn (`ADMISSION_STOPPED`) all measured on that row. LIMIT: **no live `member.create` / `member.followup`** (production-port + router-detach arms only, §9.5); per-DSH_HOME authenticated operator, NOT multi-user RBAC | `CAPABILITY-MATRIX-C.md` C-remote; `ESCALATION-centre-row-creation-entrance.md` RESOLUTION; `packages/runtime/test/vnext-admission.test.mjs` (`ADM-86`); `a3p4-pr4-production-entry-regression.test.ts` (E3); `D-BOOT-FEASIBILITY.md` §17 | a real-model drive through the remote entrance, and a user-level identity isolation claim (out of scope/not claimed) |
| **C10** | MCP catalog + initial grant + live loss | **preserve** — "may land in C, but must never be enabled by default while unmanaged" (`06-CAPABILITY-CONTRACT.md:99`) | MECHANISM. `ADM-96` mounts the product's own real HTTP mini-MCP server through the **exact production call**, reads the tool off the model-visible surface, admits it on `net.mcp` with the **server** as locator, and the real body answers `pong:mounted`; `ADM-97` proves mounting ≠ permission, that a tool-level restriction narrows, and that a bare `mcp__` prefix is refused by name. `f15-mcp-live-loss` is green inside the 238-suite vitest population. Not enabled by default: the remote mount is `SKIPPED` on the centre row | `packages/runtime/test/vnext-admission.test.mjs`; `tests/checks/eb3-ute-migrated-suites.txt`; `D-BOOT-FEASIBILITY.md:171-222` | a **live mount at a host boot** (unknown at D: the row's remote mount is skipped) and a live server-loss observation. Also: the centre is **not mount-aware**, so a well-formed name for a never-mounted server is decided on the network axis alone (`ADM-97` step 5) |
| **C11** | state projections (`sessionProjections`) | **preserve** | **MECHANISM, measured (round 66).** The row names two owners. (a) The Team-owned projection (`projection/**`) is **PRESERVED in the new assembly** and proven to derive from the TeamDomain's own facts: `ADM-107` wires it exactly as the entry does — `createProjectionService(createTeamDomainReadPort(domain, readPortDeps), <live overlay>, { clock, schemaVersion: 2 })` (`root.ts:4302`) — over the REAL durable `TeamDomain`, and asserts the identity core, every member row and the ledger summary field-by-field against the durable rows; a real `team_create_member` is then what the **next** reader sees (fresh port + service), and every durable value survives a **cold domain reopen**. `ADM-108` (negative) proves a mutation **REFUSED at the ONE centre** (`ADMISSION_NO_BINDING`, `LANE_DENY`) moves **nothing** — projection byte-identical, no new member row, no ledger entry, no generation move — with a same-world positive control. `ADM-109` (negative) proves the live overlay is **not a second authority** (a live handle invents no member; dropping one moves only residency, never lifecycle/creation/generation), that an absent TeamSession **fails closed** (`TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT`, never an invented empty team), and that a projection pass **writes nothing**. Falsified not assumed: stamping v1 and emptying the catalog template rows each turn the arms red. (b) The other named owner — the host's native `sessionProjections` service behind the `todo`/`goal` faces — is preserved **by construction, not by this cut**: neither the retired entry (`live/agent-bindings.mjs`, `root.ts` at `1617d5839^`) nor the new one references it (`grep -c sessionProjections` → **0** in all four files), so the entry replacement cannot have un-wired it; those faces stay bound on `host.service` (`ADM-32`). The Team-side uses are pass-through **reads** of the HOST's service, never a registration of its own: the PTY facade hands `ctx.get('sessionProjections')` to the pinned backend (`team-services/src/terminal-pty.ts:400`) and the P5-T5 real-instance harness restores the durable model selection with `stateOf(session, 'modelSelection')` (`root-binding/harness/plugin.mjs:969-982`) | `packages/runtime/test/vnext-admission.test.mjs` (`ADM-107`…`ADM-109`); `MIGRATED-SUITE-STATUS.md` "Round 66 (C11)" | (i) a **live boot** reading the Member's todo/goal projection state through the host's own `sessionProjections.stateOf` — that service is the HOST's, so no in-process arm can read it; (ii) a projection read at a **product entry** (`team.getProjection`), which a centre-configured row CAN now reach since round 74 (`team.getProjection` is a served `control-plane-read` command, `s6-command-classification.ts:99`) — what is missing is an arm that measures it, not reachability. **The `sessionProjections.stateOf` half is NOT claimed here**, and no cell above is PRODUCT-PROVEN |
| **C12** | tool admission (guard, builtin deny, selector) | **preserve** (KEEP module) | MECHANISM + DEV-LIVE. `ADM-1…ADM-45` (lanes, deny precedence, unbound refusal, `ADMISSION_TOOL_UNBOUND`), `ADM-29/30` (tool restriction answers before the ceiling and only narrows), `ADM-31` (closed list matches `createTeamTools` both ways), `ADM-35` (a governed member refuses to run unrecorded), `ADM-44` (`MEMBER_CENTRE_UNWIRED`). Live: `d:centre-facts` PROVEN — 2 `fs.read` admissions (`allow` + `DENY/LANE_DENY`) and 2 execution facts, read back from disk | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:369-395` | a real model choosing tools adversarially (the mock is scripted), and a policy compiled at runtime rather than passed as an input (`CAPABILITY-MATRIX-C.md:66-67`) |
| **C13** | confined I/O faces (fs/web/subprocess/terminals/userQuestions) | **replace** with provider lanes | MECHANISM + **DEV-LIVE for fs and subprocess**; **web is in-process only** (round 86 audit corrected this cell: it said "DEV-LIVE for fs, web and subprocess" while its own gap cell says a live `web_fetch` is still missing); **process family ADMITTED ON A DECLARATION, live persistent shell PROVEN (round 76)**. fs: `d:guard-facts` **PROVEN** (2 `allow` facts, methods `stat`/`readText`, `memberIdentity=inst-0pe2z220bhfb`), `SLICE-1…SLICE-36`, and `d2:multi-member-concurrency` live. web: `SLICE-31/32` (transport reached / never reached), `ADM-67/74`. subprocess: keys on `toolBindings[].authorization` + `execution.executionBoundary` (`admission.ts:424-466`, `ADM-125`…`ADM-131`); round 76 additionally mounts the HOST's `dsh-tool-bash-persistent` (`backendType: a5sf-governed-shell`) beside the one-shot baseline and declares the binding, so the live D3 judge is **PROVEN** in two agreeing boots — the second turn reuses the same shell, and the out-of-lane write is refused by the OS profile (§6.3). PTC: **NOT SUPPORTED BY PRODUCT RULING (round 92)** — owner ruling `docs/reviews/20261124-0151.txt` §PTC, amendment `ADR-ptc-unsupported.md`. `run_code` is refused typed with `ADMISSION_PTC_UNAVAILABLE` before the body, is absent from the governed Member's model-visible set, and a call through the host-retained entry gets the same typed refusal with status `unsupported-by-product-ruling` on fact + settlement, ZERO worker and zero effect (`ADM-76`, `ADM-79`, `ADM-87`). The two PTC POSITIVE arms are `NOT APPLICABLE — PRODUCT UNSUPPORTED` with machine-visible markers (`ADM-69`, `ADM-147`, asserted by `ADM-80`/`ADM-148`), not deleted and not "skipped pending a fix"; the refusal controls are kept. This is a RULED SCOPE REDUCTION, not test deletion. **ROUND 77's closed rc.5 FS gap stands** (`SLICE-35` GREEN on rc.5 and rc.2, `ADM-135`…`ADM-140`; still in-process, §6.15), and round 85's measurement stands as the BASIS (nested calls, Control escalation and Stop HOLD; the worker's OS profile is the HOST session policy — rc.5 does not close it: `sandboxPolicy.resolve({session})` + `additionalWritableRoots` only adds writable roots). The old `CORE_SEAM_BLOCKER` is CLOSED as a ruled scope reduction. | `D-BOOT-FEASIBILITY.md:349-414`; `packages/runtime/test/vnext-fs-slice.test.mjs`; `packages/runtime/test/vnext-b-probe-ladder.test.mjs` | a live `web_fetch` at a boot, and `userQuestions`/terminals beyond the PTY-owner refusal (`SLICE-33`) — the persistent (`a5sf-governed-shell`) live shell at a boot is no longer on this list (round 76 PROVEN); what remains unproven for it is a GATED (non-DEV-LIVE) status and a real-model interleaving |
| **C14** | **old governed-family execution implementations**: each family's own tool body, its duplicated policy computation, and the historical per-family semantic-equivalence requirement … | **dropped** — the host rows own execution now, and the equivalence criterion is retired with the bodies; the differences that mattered were defects of the deleted body (`SD-SEARCH-1`) | **DROPPED-AS-RULED**, and closure holds: `deleted=148 prodRefs=0 distResiduals=0 dupNames=0` (fresh run, §1.1); no legacy Plane/Family Body/Kernel/PA Bridge is wrapped as an internal component and there is no legacy fallback (`PR-BODY-draft.md` §"What this branch is") | `ute-cut-closure` line in §1.1; `CUT-BOUNDARY-ADDITIONS.md`; `docs/plans/memo/ute-p0-20261121/03-RETIRE-KEEP.md` | nothing — a drop is complete when the closure gate is green and the ruling is named, which it is (`06-CAPABILITY-CONTRACT.md:90`) |
| **C14b** *(the contract's split row, not a 19th criterion)* | **the safety invariants those families enforced**: path read/write upper bounds, network allow/deny, Control authority, Stop | **preserved** — never implied by C14's drop | **MECHANISM, with a per-invariant positive+negative pair; DEV-LIVE only for the fs/subprocess/Stop carriers** (round 86 audit narrowed this cell: the network-deny OS control is a node-leg probe, `ENV-LIMITED` on an incapable runner, so "MECHANISM + DEV-LIVE" overstated it). §2.3 maps every dropped implementation to a surviving owner with `file:line`; `ADM-110` (path bounds: centre authored lane + provider resolved path, `..` and symlink), `ADM-111` (network: allow/unset/deny + tool-level narrowing), `ADM-112` (Control authority: the REAL durable `ControlService` asks, denies and one-shot spends), `ADM-113` (Stop: REFUSED/not-started, never UNKNOWN, durable across a fresh reader), `ADM-114` (process: fail-closed `ADMISSION_EXECUTION_UNAUTHORIZED`, never an unconfined shell), `ADM-115` (dropped names are unbound; preserved host faces keep `host.service`). The P1–P5 proofs (§3) and the OS controls still stand: `OS-1` Landlock ABI 7, `OS-2` **negative**, `OS-3` **positive** on a host that proves the network-deny profile (this one), and `SLICE-4` (without the realm mount the outside read **succeeds**, so the confinement arms are falsifiable). On a runner that cannot prove that profile, `OS-2`/`OS-3` are ENV-LIMITED fail-closed controls and the kernel claims are NOT made — see §3.1 and `ENV-LIMITED-CAPABILITY-20261123.md`. **No invariant is enforced only by a deleted component** — checked, not assumed: the five `confined-*` shadows were mounted by the realm row itself (`a5sf-realm-row.mjs` at A0), so a realm-less member was never confined by them; the residual is the *ungoverned* (never-asked) row, which this row does not claim to govern (§2.3) | §2.3; §3; `packages/runtime/test/vnext-admission.test.mjs` (`ADM-110`…`ADM-115`); `packages/runtime/test/vnext-os-probe.test.mjs`; `packages/runtime/test/vnext-fs-slice.test.mjs` | a live OS-boundary measurement at a boot (today the OS probe runs in the node leg on the CI host); network containment under a real model; and a product entry that drives each invariant (not only the in-process centre) |
| **C15** | `team_skill` | **preserve, re-homed** — Team skill provider into a host-shaped row | MECHANISM + **recorded LIMIT**. Bound on `host.service` (`ADM-32`); `skill` is in `HOST_CAPABILITY_TOOL_NAMES` (`admission.ts:143-153`); the governed preset mounts `a5sf-skill-provider` (`scripts/dist-placements/190-a5sf-pd29-service-seam.json:5-6` places the module; the governed realm row mounts it at `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:989`). **Limit, not a confinement claim:** a skill file read by the host skill service is OUTSIDE the member's fs ceiling (`CAPABILITY-MATRIX-C.md:76-87`) | `packages/runtime/test/vnext-admission.test.mjs`; `CAPABILITY-MATRIX-C.md:29,76-87` | a D judge that has a governed Member invoke `team_skill` on a booted host and asserts the row is reachable — with the limit stated in the same evidence, not only here |
| **C16** | `subagent_fork` | **preserve, re-homed** — row over `subagent-fork-in-process` | MECHANISM. Bound as host capabilities (`subagent`, `send_message`, `interrupt_agent`, `admission.ts:143-153`, `ADM-32`); the **child's own** binding governs the child's tools (so the parent's ceiling is not a claim about the child) | `packages/runtime/test/vnext-admission.test.mjs`; `CAPABILITY-MATRIX-C.md:30` | a live fork at a boot, and an assertion that the child's own centre judges the child's calls — neither is measured in the D legs |
| **C17** | **Team's own `exit_plan_mode` tool** — not DSH plan mode, and not the goal tools | **dropped by owner ruling** — the host has only a `claude-code-mods` name mapping, and re-creating a plan-mode state machine is out of scope. `get_goal`/`create_goal`/`update_goal` are untouched | **DROPPED-AS-RULED**, provable by **absence**: zero `exit_plan_mode` references under `packages/runtime/src` and `packages/tools/src`, and it is in neither closed table (`admission.ts:61-74`, `:57-73`, `:114-122`). The goal tools **are** present on `host.service` | `grep -rn exit_plan_mode packages/runtime/src packages/tools/src` → no matches; `admission.ts:143-153` | nothing — the ruling is named and the absence is checkable |
| **C18** | `a5p5-tools` lane helpers (arg parsing, effects, render, spill) | **dropped** — dormant, nothing dispatched | **DROPPED-AS-RULED.** `packages/tools/a5p5-tools` no longer exists under `packages/tools/src` (only `builtin-deny.ts`, `guard.ts`, `index.ts`, `native-fs-binding.ts`, `tokens.ts`, `tool-selector.ts`, `tools.ts`, `types.ts`), it is absent from the migrated population, and the cut-closure run reports 148 sources gone with **zero production references** (`references=3`, `prodRefs=0`: three non-production references remain, and `retiredSurfaces=12`) | `ls packages/tools/src`; `grep a5p5 tests/checks/eb3-ute-migrated-suites.txt` → none; `ute-cut-closure` line in §1.1 | nothing — dormant-and-deleted with an empty dispatch path is the ruling's own completion criterion |

**Rows that are not proven, at a glance** (this is the honest subset a reviewer should carry forward):
**C1/C4/C5/C6/C7/C10/C11/C15/C16** are MECHANISM at best (C6/C7's formal routing is implemented; their
remaining gap is a LIVE routed wake, not a missing mechanism — §6.5 — and **round 87 measured that gap as
two in-repo seams**, not a missing abstract piece: no case-bearing ordinary-ask producer and no BL-30 ask
consumer; C5's grant/consume half is narrower still — a granted `ask` does not execute in production;
C11's host `sessionProjections.stateOf` half needs a live boot); **C2/C3/C8/C9/C12/C13/C14b** carry
DEV-LIVE evidence (C2 create only, C9 the delivery boundary, C13 fs/subprocess only — **not** web) but are
still not PRODUCT-PROVEN; **C13's PTC arm is UNSUPPORTED BY RULING (round 92)** — typed refusal + status + zero worker proven, no positive claimed, the `CORE_SEAM_BLOCKER` closed as a ruled scope reduction (`ADR-ptc-unsupported.md`). **C14/C17/C18
are DROPPED-AS-RULED** and are not coverage.
**No cell above says PRODUCT-PROVEN, and none may be upgraded by narration.** The complete open-gap list,
with the owner decision each needs, is **§10**.

### 2.3 C14's dropped implementations, and where their safety invariants live now

C14 drops **implementations**, never safety (`06-CAPABILITY-CONTRACT.md:54-63`). The frozen text
(`:40`) and the retirement inventory (`03-RETIRE-KEEP.md:21-22`, `01-ASSET-INVENTORY.md:14-21`; per-file
lists at `:54-218`) name **eight governed-family bodies** — fs, search, web, process, ui, inspect,
agent-control, agent-state — plus the retired pre-execution/dispatch components. The table is the
drop→owner enumeration the C14b row relies on; every "now enforced at" cell is a `file:line` a reviewer
can open, and the arm column names the round-67 positive+negative pair that proves the invariant after
the drop.

| dropped implementation (C14) | files | safety invariant it enforced | now enforced at (file:line) | arm (round 67) |
| --- | --- | --- | --- | --- |
| `family-fs` — read/write/edit/read_image executors over ONE controlled root | 17 | path READ/WRITE upper bounds, including the **resolved** path (symlink / `..`) | centre: authored locator decided in `admission.ts:387`; provider: `team-services/src/fs.ts:134,179` → `member-io-policy/src/provider-capabilities.ts:299-405` (`PATH_SYMLINK_ESCAPE`, resolved containment) | `ADM-110` (+ `SLICE-3/6/27`, `ADM-2`) |
| `family-search` — grep/glob executor + presentation | 9 | search-root bound; an omitted path means the workspace root, never "unbounded" | `admission.ts:61-62` (`TOOL_AXES`), `:196-199` (`DEFAULTED_LOCATORS`); the durable overlay ABSTAINS instead of faulting (`overlay-decision.mjs:226-228`) | `ADM-110` (provider half), `ADM-16`, `ADM-105/106` |
| `family-web` — fetch/search + redirect ownership | 10 | network allow/deny; an fs grant never stands in for it | centre `admission.ts:468-476` (`net.fetch`, tool-level narrowing included); provider face `team-services/src/web.ts` (compiled `network` axis) | `ADM-111` (+ `SLICE-31/32`, `ADM-17`) |
| `family-process` — bash + an unrouted pwsh + confined-shell executor | 11 | **no unconfined shell execution**; the OS boundary belongs to the provider, not a body | centre refuses a process with no compiled execution authorization `admission.ts:424-466` (`ADMISSION_EXECUTION_UNAUTHORIZED`/`_DENIED`/`ADMISSION_EXECUTOR_UNAVAILABLE`); PTC keeps its own code + the round-92 status `unsupported-by-product-ruling` (`ADR-ptc-unsupported.md`); OS profile `team-services/src/subprocess.ts:1372` (`compileExecutionProfile`) | `ADM-114`, `ADM-125`…`ADM-131` (+ `OS-1/2/3`; `d3:persistent-subprocess` **PROVEN** round 76, two agreeing boots) |
| `family-ui` — ask_user_question + present | 9 | no second declarant / no undeclared I/O surface | the names have no preserved home ⇒ `ADMISSION_TOOL_UNBOUND` (`admission.ts:396-398`); terminals stay the PTY-owner refusal (`SLICE-33`) | `ADM-115` |
| `family-inspect` — team_skill + two `team_cordis_*` rows | 10 | host-service I/O is RECORDED on its own axis, never judged by the fs lane | `HOST_CAPABILITY_TOOL_NAMES` (`admission.ts:143-153`, axis `host.service`); the limit is stated at `:100-108` | `ADM-115` (+ `ADM-32`) |
| `family-agent-control` — seven subagent/orchestration rows | 14 | the CHILD's own binding governs the child's tools | `host.service` table (`admission.ts:143-153`); the child's centre is installed at its own bind (`ADM-92`) | `ADM-115` (+ `ADM-32`) |
| `family-agent-state` — todo_write + goal rows + `exit_plan_mode` | 7 | preserved state faces recorded; `exit_plan_mode` dropped by ruling | `host.service` table (`admission.ts:143-153`); `exit_plan_mode` is in no closed table (`ADM-115`) | `ADM-115` |
| `pa-mount-registry`, `pa-control-bridge`, `pre-execute-adapter`, `native-tool-admission`, the five `confined-*` shadows, `family-assembly` | 10 | **Control authority**: one approval authority, current mount facts, no second dispatch authority | centre ask path `admission-port.mjs:94` (`createControlApprovalPort`), `:336-344`, `:477`; authority `packages/runtime/control/service.ts`; closed tables `admission.ts:61-74/57-73/114-122` | `ADM-112` (+ `ADM-46…55`) |
| `governance-center` + `tool-dispatch` (one group) | 11 | one decision, one durable closure; a Stop never becomes a completion | centre `refuseStop` `admission-port.mjs:336-344,477,801-802`; settlement `settlement/execution-settlement.ts` | `ADM-113` (+ `ADM-56…62`) |

**What the enumeration establishes.** Each of C14b's four named invariants has a surviving enforcer on
both layers the old bodies used: the centre's compiled lane (authored locator, network axis, approval
path, Stop) and the provider face (resolved path, web transport, OS profile, settlement). The old
per-family equivalence demands (`pwsh` parity, web redirect ownership) are retired **with** the bodies
because they were criteria of the deleted implementation, not safety properties (`06-…:40`).

**The one residual, measured rather than assumed (not a preserved enforcement).** The five `confined-*`
shadows existed because the preset scope otherwise resolved the inherited unconfined service (PD-17),
and they were mounted by the **realm row** itself (`a5sf-realm-row.mjs` at A0, `A5SF_CONFINED_FS_TOOL`).
They are gone, so the question is whether any member that used to be confined by them now is not. Two
cases, and the answer is the same in both: a member whose row **asked for the centre** but mounted no
realm is **refused** `MEMBER_CENTRE_UNWIRED` (`centre-config.ts:36-49`, called at
`agent-bindings.mjs:1972`, `ADM-44`); a member whose row **never asked** also never mounted the
realm row, so the deleted shadows were never its enforcement either. **No invariant in C14b is left
enforced only by a component that is gone.** The ungoverned row remains ungoverned by design — a
capability limit, not a regression this cut introduced — and the open design question (admit against
the same compiled ceiling with an explicitly unconfined provider, or refuse) is
`ESCALATION-realmless-admission.md`, whose "What the code says" snippet predates the round-35 refusal.

---

## 3. The P1–P5 ladder and the OS negative controls

The P1–P5 obligation set is frozen in `docs/plans/memo/ute-p0-20261121/04-SEAMS.md:57-67`: "Each proof is
a *pair*: an assertion that must be green, and a mutation that must turn it red. A proof without its
mutation is a claim, not a test." The C14b row names them as the evidence that the safety invariants
survived the C14 drop (`06-CAPABILITY-CONTRACT.md:48`). Round 67 adds the invariant-shaped arms
`ADM-110`…`ADM-115` (§2.3): same proof shape (a green positive, a must-refuse negative), applied to the
four preserved invariants and to the process family's fail-closed rule. They supplement, never replace,
the P-rungs below.

| proof | what the rung proves (verbatim obligation) | arms that carry it | live judge that carries it | negative control / must-red mutation | committed evidence |
| --- | --- | --- | --- | --- | --- |
| **P1** | **Binding monotonicity** (UTE-06): `EffectiveIO ⊆ AgentCeiling ∩ ToolRestriction` on every admitted call | `ADM-2` (out of lane is `LANE_DENY`; a write grant is never read as a read grant), `ADM-7` (deny wins), `ADM-29/30` (a TOOL restriction answers before the ceiling and **can only narrow**), `ADM-39` (an omitted axis does not inherit the ceiling), `ADM-45` (the durable overlay can only REMOVE authority), `ADM-52` (post-approval generation drift refuses) | `d:centre-facts` — one ledger holding `allow` **and** `deny/LANE_DENY` for the same member; `d2:multi-member-concurrency` — A's read of B's in-lane file is `LANE_DENY`, **zero** B bytes reach A, and **zero** guard facts exist for B's locator under A's identity | must-red mutation: widen one axis after approval ⇒ the same call refuses (`ADM-52`, `ADM-37`); live widening is refused by the durable lane itself (`d2:revocation` direction (d): `changed:false`, reason `mutation-proposal-pending`, widened locator still `LANE_DENY`) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:452-461`; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` |
| **P2** | **Face completeness** (UTE-07): a tool with all required faces bound executes; a tool missing one face is refused **whole** | `ADM-4` (a tool with no declared axis is refused, never admitted by default), `ADM-18` (no compiled tool-level execution authorization ⇒ the subprocess family is EXPLICITLY refused), `ADM-33` (an MCP tool needs a **server** locator, no prefix matching), `ADM-78` (the binding IS the compiled answer; absent axes stay absent) | `d3:persistent-subprocess` — **PROVEN (round 76) and correct as a face-completeness witness**: `bash` now executes ONLY after the world declares `authorization` + `executionBoundary`, and a declaration the composition cannot place is refused whole (`ADMISSION_EXECUTOR_UNAVAILABLE`); before the declaration existed the same call was refused whole with `ADMISSION_EXECUTION_UNAUTHORIZED` rather than run without an execution declaration | must-red mutation: bind `faces.web = null` and assert the whole tool refuses, not "runs without web" (`04-SEAMS.md:63`); B's ladder rung 6 (`ADM-76`) is the live-shaped negative | `packages/runtime/test/vnext-b-probe-ladder.test.mjs` (`ADM-78`); `D-BOOT-FEASIBILITY.md:572-598` |
| **P3** | **Fail-closed** (UTE-09): provider absent ⇒ refuse | `ADM-3` (UNWIRED refuses; it does **not** fall through to the composition provider), `ADM-42` (a native module specifier is judged before it is imported), `ADM-83` (an unwritable ledger is a refusal), `ADM-102` (`GOVERNED_NATIVE_MODULE_*` typed refusal, **never** a base-provider fallback), `SLICE-9` (with no binding the in-ceiling call never reaches the provider) | `d:guard-facts` — `out-lane-never-reached-provider 0` guard facts; the refused call never enters the provider at all. Residual 1 of `FINDING-native-tool-provider.md` is exactly this law: the centre's `LANE_DENY` precedes the body | **negative control that makes it falsifiable:** `SLICE-4` — **without** the realm mount, the same outside read **SUCCEEDS**. Also `SLICE-17/18/19` (observation policy OFF accepts an unobserved overwrite; ON refuses it; a moved version is refused) | `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/test/vnext-fs-slice.test.mjs`; `FINDING-native-tool-provider.md:91-115` |
| **P4** | **One fact** (UTE-15/17): one `ExecutionId`, one canonical outcome per physical attempt; a crash between emit and return leaves a recoverable fact | `ADM-21` (`ADMITTED → RUNNING → COMPLETED`), `ADM-79` (crash between the admission fact and the execution fact ⇒ a **new process** recovers `ADMITTED→UNKNOWN`, never `COMPLETED`), `ADM-80` (a callId with a durable fact is refused on a second attempt in a **fresh process**, before the body), `ADM-81` (a duplicate execution fact on disk is a refusal), `ADM-84` (an open settlement is classified `UNKNOWN` from disk with what is missing) | **`d3:crash-cold-recovery` — PROVEN.** A real `SIGKILL` (`signal=SIGKILL`, pid gone) and a restart on the **same** `DSH_HOME`: the in-flight `RUNNING` becomes `UNKNOWN` with **no execution fact** and one admission fact (never replayed); the completed call's fact/settlement are **byte-identical**; a new call is admitted with a **new** fact and completes | must-red mutation: kill the process after emit and assert recovery yields `unknown`/fact, never `succeeded` from memory (`04-SEAMS.md:65`); `ADM-79`'s control also completes a **different** call before dying, which stays `COMPLETED` (no blanket rewrite) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:599-617`; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` |
| **P5** | **Stop is durable and non-replaying** (UTE-18): after stop + cold start, facts are restored and nothing re-executes | `ADM-56` (Stop before the body ⇒ `REFUSED`/not-started, never `UNKNOWN`, never an execution), `ADM-57` (Stop while the ask is pending closes the durable request; a later approval cannot revive it), `ADM-58` (Stop **after** the approval and **before** the body spends nothing), `ADM-59` (lifecycle close refuses a new call with its own code), `ADM-60` (close with a call in flight: it still settles; a second dispose neither throws nor double-settles), `ADM-61` (close while an ask is pending abandons it), `ADM-62` (the product composition closes the member) | **`d2:stop` — PROVEN.** Through the product's own public `POST /api/session/cancel` on the child session, while parked at a durable `admission-ask`: tool result `Error: ADMISSION_STOPPED: …`, centre fact `refusalCode=ADMISSION_STOPPED`, settlement `REFUSED`/`dispatch=not-started`/`bodyOutcome=not-started` with **no execution fact**; never a completion and never `UNKNOWN`. Member B completed with zero stops | must-red mutation: restart and assert the previous call is **not** resumed; a resume attempt must red (`04-SEAMS.md:66`). The live negative is the **second Member**: it completes, so Stop is not a blanket. Re-reported in **both** boots — no single-boot concession | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493`; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` |

**The honest gap in the P-ladder:** the "must-red mutation" half is recorded for P1/P2/P4/P5 as mutations
performed and reverted during those rounds (`PR-BODY-draft.md` §"B stage, second slice" and §"The durable half of B" — seven and six mutation edits
respectively, each reddening exactly its own arm). P3's mutation is the **missing-mount world**
(`SLICE-4`) rather than an edited source line. Nothing in this section is a substitute for a product
acceptance: P1–P5 are properties of the **binding and settlement**, which is what the contract says they
are (`04-SEAMS.md:69-73`).

### 3.1 OS negative controls (fresh, this HEAD) — PROVEN where the capability exists, ENV-LIMITED where it does not

Measured inside `ute-vnext-a1` (file `packages/runtime/test/vnext-os-probe.test.mjs`; leg definition
`dev/ci/eb3-ci-manifest.json` → `layers[4].legs[11]`, which sets `A5SF_REQUIRE_PINNED_HOST=1`).

**The precondition is measured, not assumed.** `OS-2`/`OS-3` request `networkProfile: 'deny'`, and the
product admits that request only when its own `runNetworkLeg` (the launcher's real `--net-leg`: a control
child reaching a loopback listener, a deny child landing in a DISTINCT network namespace and failing
tcp/udp with a kernel errno while the listener counters do not move) confirms it. The same proof gates
the confined subprocess face that `grep` runs through, so OS-2/3, `ADM-66`, `SLICE-28` and the `ADM-70`
grep rung all ride ONE capability. The leg asks that probe first (`tests/world-factory/lib/a5sf-env-capability.mjs`)
and prints its answer:

```
A5SF-CAPABILITY network-deny=present level=enforced code=NET_DENY_ENFORCED ... forced=false
  detail="runNetworkLeg verdict=NET-DENY-CONFIRMED mechanism=netns netns=…/(host …)"
```

**This host (capability present ⇒ real enforcement):**

```
OS-1 measured landlock abiVersion=7
✔ OS-1 — the host answers the Landlock ABI the provider requires
✔ OS-2 — NEGATIVE CONTROL: a confined payload CANNOT read outside its allow set (3214.834264ms)
✔ OS-3 — POSITIVE CONTROL: the same payload CAN read inside its allow set (3194.526655ms)
ℹ tests 211  ℹ pass 209  ℹ fail 0  ℹ skipped 2
```

The pair is load-bearing: a positive-only run would prove nothing about the boundary, and a
negative-only run would not distinguish "denied" from "broken". Both controls ran in this session's
`dispatch-tests --run --leg ute-vnext-a1`.

**The hosted `ci-census` runner (capability ABSENT).** The runner's `--net-leg` does not confirm a
network namespace (see `ENV-LIMITED-CAPABILITY-20261123.md` for the hosted probe line), so
`network-destination` is `unsupported` and the provider refuses every `network: deny` spawn BEFORE any
process exists (`IO_POLICY_UNSUPPORTED` / `NETWORK_UNCONFINED_REALM`). The five affected arms take the
truthful branch, assert the product's FAIL-CLOSED behaviour, and are reported ENV-LIMITED — never
counted as proven, never silently skipped:

| arm | disposition on an incapable runner | what IS asserted there | what is NOT proven there |
| --- | --- | --- | --- |
| `OS-2` | FAIL-CLOSED-CONTROL | `prepare()` refuses with `IO_POLICY_UNSUPPORTED`, names the unoffered `deny` profile and why an ABI number is not a network guarantee; no plan and no output dir exist | the kernel denial of the out-of-allow-set read |
| `OS-3` | FAIL-CLOSED-CONTROL | the positive payload is refused the same way before any plan exists | the in-allow-set read |
| `ADM-66` | ENV-BLOCK | admission fact `allow`/`fs.read` at the judged locator; execution `failed`; settlement `FAILED`; ZERO provider spawns; no fabricated match | the confined `grep` body/`Found 1 match` |
| `SLICE-28` | ENV-BLOCK | the same refused-spawn facts, PLUS the lane negative control (`LANE_DENY` before the body, `admission-refusal`) | the in-ceiling search |
| `ADM-70` | ENV-BLOCK | the runnable-rung order and the DURABLE admission order (grep included, as admitted) | the complete 4-rung positive ladder |

The arm count is small, named and stable: **five** env-limited arms, one code
(`NETWORK_DENY_UNPROVEN`), printed per arm as `UTE-VNEXT-A1-ENV-LIMITED …` and aggregated by the
dispatcher as `DSH-TEST-DISPATCH-ENV-LIMITED count=5 proven=0 env_blocks=3 fail_closed_controls=2`.
Each such arm calls `t.skip` only AFTER its assertions, so a regression in the fail-closed behaviour
turns the arm RED (a skip is not a shield). **An environment absence is not a PASS**: on the hosted
runner the five guarantees above are explicitly UNPROVEN, they increment no proven counter, and
`CAPABILITY-MATRIX-C.md` shows those cells as ENV-LIMITED rather than PROVEN. The OS probe needs
`python3` and a Landlock-capable kernel; on a host lacking THOSE, `OS-1`/the provider probe fail
loudly (a red leg), not as a skip.

**Product gap or runner limit?** Runner limit. The product's launcher already creates the namespace it
needs (`CLONE_NEWUSER|CLONE_NEWNET`, unprivileged) and the provider offers `deny` exactly when the
probe measures it; there is no realm-provisioning switch that could be flipped in product code to make
an incapable kernel capable. The failure mode is disclosed, not patched around. A future runner that
permits unprivileged user+net namespaces gets the real controls automatically: the same leg, with no
code change, reports `network-deny=present` and the five arms run as on this host.

### 3.2 All live judges, actual verdicts (do not read the list as all-green)

| judge | rc.2 verdict (both boots) | rc.5 verdict (both boots) | recorded at |
| --- | --- | --- | --- |
| `d:member-read-admitted` | **PROVEN** | **PROVEN** | `D-BOOT-FEASIBILITY.md:369-395`; `dev/agent-workflow/evidence/d-boot-feasibility/runs/`; `dev/agent-workflow/evidence/ute-a1/rc5/run-boot.log` |
| `d:guard-facts` | **PROVEN** (2 allow facts: `stat`, `readText`; `memberIdentity=inst-0pe2z220bhfb`) | **PROVEN** (2 allow facts) | same |
| `d:centre-facts` | **PROVEN** (2 `fs.read` admissions `allow` + `DENY/LANE_DENY`, 2 execution facts) | **PROVEN** (same counters) | same |
| `d:native-read-surface` | **PROVEN** after the round-62 re-anchor (all six clauses; the `native-description` clause now reads the top-level field and `native-file-path-description` reads the parameter field) | **PROVEN** (same clauses) | `D-BOOT-FEASIBILITY.md:494-511` |
| `d:member-read-denied` | **PROVEN** after the round-71 rewrite (the clause measures the DECIDING CHANNEL: `LANE_DENY` with ZERO provider guard facts for that call, or `IO_READ_DENIED` with its own guard deny fact; zero secret bytes and not-ENOENT in both; plus a separate in-process `ADM-100` clause for the provider channel) | **PROVEN** after the rc.5 porting fix to the in-process world (batch `tools.execute` shape + `workingDirectory`/executor; assertions unchanged) | `FINDING-native-tool-provider.md` §"Round 71"; `dev/agent-workflow/evidence/d-boot-feasibility/runs/boot01/in-process-provider-channel.json` |
| `d2:multi-member-concurrency` | **PROVEN** | **PROVEN** | `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` |
| `d2:revocation` | **PROVEN** after the round-71 rewrite — (a) durable deny ⇒ `ADMISSION_OVERLAY_DENY`, zero body, settlement `REFUSED`, overlay named + policy generation; (b) deny removal ⇒ admitted + `COMPLETED`, a NEW fact; (c) in-lane control admitted at every phase; (d) widening beyond the compiled ceiling is a no-op proposal and the widened locator stays `LANE_DENY` | **PROVEN** (identical clauses; a/b admissions 9/9, guard facts 14/14) | `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md`; `FINDING-native-tool-provider.md` §"Round 71" |
| `d2:stop` | **PROVEN** | **PROVEN** (`stopSettlementState=REFUSED`) | `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` |
| `d3:persistent-subprocess` | **PROVEN (round 76)** — both boots, all clauses: `bash` on the Member surface, preset shell rows `["tool-bash","tool-bash-persistent"]`, first call admitted (`process.exec`, `allow`) writing durable state, second turn reusing the SAME shell and reading it back (`DBOOT_D3_PERSISTENT_SHELL_STATE`/`DBOOT_D3_STATE_READ`), both settlements `ADMITTED→RUNNING→COMPLETED`; the out-of-lane write is refused by the OS profile (`Read-only file system` in the shell, 0 bytes on disk from outside) while the in-lane 32-byte file is written. Round-75 history: the same judge was REFUTED with `ADMISSION_EXECUTION_UNAUTHORIZED` before the preset mounted the persistent row and the world declared the binding | **PROVEN** (identical clauses; both bash states `COMPLETED`) | `dev/agent-workflow/evidence/d-boot-feasibility/d3/runs/boot01/verdicts.json` + `confinement-probe.json`; `D-BOOT-FEASIBILITY.md` round-76 section |
| `d3:crash-cold-recovery` | **PROVEN** | **PROVEN** | `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` |
| `d3:work-delivery` | **PROVEN** | **PROVEN** (`collectStatus=succeeded`, `inflightAfter=UNKNOWN` by contract) | `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` |
| `d3:alpha6` | **PROVEN** (as the typed-refusal shape, now with its durable fact + settlement — round 68) | **PROVEN** (same typed refusal) | `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` |
| **`d:remote-creation`** | **PROVEN (round 74; judge-shape repaired round 91 — §12)** — unauthenticated refused (401) and mints NO Team; cross-team `TEAM_REMOTE_FOREIGN_TEAM`; legitimate runtime `team.create` 200 / `path:"fresh-root"`; duplicate mints no second Team (after round 74's fix) and adds 0 provider requests. The round-74 `member.send` refusal is **history**: round 83 re-classified it as work-delivery (next row) | **PROVEN** (round 78 observations; not re-run in round 91) | `D-BOOT-FEASIBILITY.md` §17; `dev/agent-workflow/evidence/d-boot-feasibility/runs/boot01|boot02/remote-creation.json`; `round74-console.log`; round-91 repair `dev/agent-workflow/evidence/ute-a1/round91/diagnosis.md` |
| **`d2:remote-delivery`** (round 83, **new**) | **PROVEN** (round 83, two boots, host `legacy` = rc.2) — `member.send` → HTTP 200 with the coordinator's `delivered` acknowledgement (intent 39 / confirmation 40) while the Member's delivered call had **0 admissions / 0 executions at the ack**; the delivered prompt then ran in the Member's own turn and the centre's `allow` for that `read` appeared in the MEMBER's ledger under the MEMBER's binding ~113 ms later, execution `completed`; unknown member, archived member, duplicate send (at-least-once, no operator-side execution), restore, and Stop during a delivered turn (`ADMISSION_STOPPED`) all measured on the same row | **NOT RECORDED on rc.5** — the rc.5 acceptance log (`ute-a1/rc5/run-boot-d2.log`) predates this judge and carries 3 d2 judges, not 4 | `dev/agent-workflow/evidence/d-boot-feasibility/d2/driver.log:1214-1313` (`"host":"legacy"`); `d2/README.md`; §9.3 |

**rc.5 host column (round 78).** **Thirteen of the fourteen** judges are `PROVEN` on 0.2.2-rc.5
with the same counted facts as rc.2 (two agreeing boots each). `d2:remote-delivery` was added in round 83,
after the rc.5 acceptance run, and has **rc.2 evidence only** — its rc.5 status is not recorded. Three rc.5
drifts had to be ported to get there: (a) model selection must exist at Agent
creation (`AgentOptions` from the host's `agentDefaultModel`; rc.5's
`installModelSelection` no longer takes the rc.2 ref) — product fix in
`packages/runtime/src/plugin/host.ts` + `vnext/agent-bindings.mjs`; (b)
`{{cwd}}` is no longer a registered prompt variable, so the governed preset's
persona suffix now names "the session workspace" (`cordis.patch.yml`); (c) the
in-process ADM-100 world needs rc.5's `workingDirectory` service, executor and
batch `tools.execute` shape (`vnext-admission.test.mjs`; assertions unchanged).
Full side-by-side tables, the exact errors, and the deployment requirements are
in `RC5-ACCEPTANCE.md`; the rc.5 logs are kept under
`dev/agent-workflow/evidence/ute-a1/rc5/`.

**rc.5 limitations (not proven).** Only these three scripted drivers ran on
rc.5: the other 238-suite vitest population and the other node:test slices were
not executed on rc.5 (ADM-100 was re-run individually). The model is the
scripted mock; no real model, MCP server, PTY backend, Windows host or hosted
deployment was exercised. `d3` records `inflightAfter=UNKNOWN` by contract and
Alpha.6 routing is unavailable by design. The `{{cwd}}` removal changes the
persona text on both hosts (verdicts unchanged); that the runtime context still
states the same directory on rc.5 is assumed, not judged.

After round 76, `run-boot.mjs` (6/6 judges, incl. `d:remote-creation`), `run-boot-d2.mjs` (3/3) and
`run-boot-d3.mjs` (4/4, `evidence-complete=true allProven=true`) are `overall=PASS` on two agreeing
boots each, on rc.2 AND on rc.5 (round 78). A driver that exited 0 without a PROVEN judge would be the
finding; every PASS above is a measured clause set, not an exit code (`evidence-complete=true,
allProven` is per driver).

**Round-91 instrumentation correction (append, §8.5.5).** The rc.2 `run-boot` half of that sentence was
**not true between round 83 and round 91**: after `5c09cbd82` changed the driver's refusal sample from
`{ok, code}` to `{rootWork, rootLive, delivery}` and left `judgeRemoteCreation`'s last clause reading the
old fields, `d:remote-creation` reported REFUTED unconditionally on a product-passing sample (the
round-90 red). Round 91 reproduced it on two agreeing boots, proved the cause is the stale clause and not
the port/home/product, and repaired the clause to the round-83 shape. The rc.5 driver runs were **not**
repeated in round 91. Full mechanism and evidence: §12 and
`dev/agent-workflow/evidence/ute-a1/round91/diagnosis.md`.

---

## 4. Required CI — gates and last measured output

All eight commands were run fresh at this HEAD in this worktree. Pasted verbatim.

> **Round 89 note.** The pastes in §4 are the round-74/76 measurement and are kept as the historical
> record. Every required gate was re-run at `97d7d7c8d`; the fresh outputs are in **§9.4** and are the ones
> that apply to this candidate now (dispatch 211/209/0/2, catalog 785 collected / 38 uncollected / 14
> excluded, closure/assets/docs unchanged, 30 placements, ci-required 10/0, bound vitest 216, migrated
> population 238, UTE G1 89/89, `ci-pr-gate --full` 10/10).

### 4.1 `dispatch-tests --run --leg ute-vnext-a1`

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 211
ℹ pass 209
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
```

Round 68 adds three in-process arms (`ADM-116/117/118`), round 73 adds six settlement-Option-A arms
(`ADM-119`…`ADM-124`), and round 75 adds six process-execution-authority arms
(`ADM-125`…`ADM-130`). Rung 5's positive control exists in `ADM-125`; **rung 6 is no longer "blocked"**:
under the round-92 owner ruling PTC is NOT SUPPORTED this generation, so its positive is
`NOT APPLICABLE — PRODUCT UNSUPPORTED` and its refusal is the control (see §4.1b).

The **3 skips are disclosed and labelled**, never passes — one pre-existing bash disclosure plus the
TWO ruled PTC not-applicable markers (each asserted by a companion arm, `ADM-80`/`ADM-148`):

```
﹣ ADM-68 — BASH positive: NOT RUN in this world (no compiled execution authorization) — disclosed, never a pass
﹣ ADM-69 — RUN_CODE positive: NOT APPLICABLE — PRODUCT UNSUPPORTED (owner ruling 20261124-0151 §PTC)
﹣ ADM-147 — the declared-world PTC positive: NOT APPLICABLE — PRODUCT UNSUPPORTED
VNEXT-PTC-PRODUCT-UNSUPPORTED arm=ADM-69 marker="NOT APPLICABLE — PRODUCT UNSUPPORTED" status=unsupported-by-product-ruling verdict=NOT_APPLICABLE ...
VNEXT-B-LADDER rungs=read,write,grep,web_fetch,bash,run_code negatives=6/6 positives=4/5 bash-positive=ADM-68-blocked-in-this-world-ADM-125-proves-it ptc=ADM-69-NOT-APPLICABLE-product-unsupported amendment=ADR-ptc-unsupported.md
```

**4.1b — the PTC amendment (ruled scope reduction, not test deletion).** The owner ruling formally
closes PTC / `run_code` for this generation. The supported B-ladder positive scope is
`read → write → grep → web_fetch → bash`; PTC is verified ONLY as
`run_code → typed refusal → zero worker execution → REFUSED/not-started`. Both PTC positives emit the
marker and are asserted to have emitted it (`ADM-79`, `ADM-80` in the ladder; `ADM-147`, `ADM-148` in
the admission suite), the refusal negative controls are kept and strengthened, and the frozen A0
contract is CITED by `ADR-ptc-unsupported.md` (never edited). Counts moved because four arms were
ADDED (+1 skip, the second ruled marker), not because coverage was removed.

### 4.2 `test-catalog --max-uncollected 41 --max-excluded 7`

```
$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
test-catalog (test-catalog/1) — discovery + the node:test predicate the dispatcher resolves legs against
  tests=785 instruments=3 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32
  DISCOVERED_AND_COLLECTED 733
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              38
  by runner: node=146 none=7 vitest=632
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
```

Note for the reviewer: `41` is the **ceiling**; the measured `UNCOLLECTED` is `38`, so the gate is green
with three units of headroom. New arms are added to an already-collected suite, so the catalog population
(785 files) is unchanged by round 73.

### 4.3 `ute-cut-closure --check`

```
$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
```

### 4.4 `ute-p0-assets --check`

```
$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
```

### 4.5 `docs-sync --check`

```
$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
AUTHORITY_SOURCE_BINDING {"kind":"authority-pointer","pointer_file":"dev/engineering/current-authority.json","snapshot_file":"dev/engineering/authority-snapshots/as20261109r1.json","snapshot_version":"as20261109r1","content_digest":"sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3","pointer_digest_verified":true,"view_may_not_reverse_decide_authority":true}
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof
```

### 4.6 `place-dist-glue`

```
$ node scripts/place-dist-glue.mjs
place-dist-glue: done (30 placement(s))
```

### 4.7 `eb3-ci-required`

```
$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0
```

### 4.8 `eb3-security-run --layer ci-integration --list-file …`

**The command as specified in the brief does not pass a real file**, and that is reported here rather than
silently swapped:

```
$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=REFUSED reason=suite list absent: tests/checks/ute-migrated-suites.txt
```

There is no `tests/checks/ute-migrated-suites.txt` in this tree; the population is declared in
`tests/checks/eb3-ute-migrated-suites.txt` (the `eb3-` prefix is in the committed filename, bound in
`20d5ee9b3`). With the file that exists, the leg is green:

```
$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

**The gate's refusal is itself a feature, not a wording problem:** the token runner refuses a list
shorter than its report, a listed-but-absent file, and an empty run
(`tests/checks/eb3-ute-migrated-suites.txt`, header comment). A typo in `--list-file` therefore cannot
grade green.

---

## 5. Host-modification authority

### 5.1 What was and was not done to the pinned host

The pinned host is `tests/deepseek-harness-test-use` (gitignored, its own git repo, detached). Check run
in this session:

```
$ git -C tests/deepseek-harness-test-use rev-parse HEAD
639ed015397290b3745d163aafe02ffee4aa3f84
$ git -C tests/deepseek-harness-test-use status --porcelain | wc -l
0
$ node -e "import('./tests/paths.mjs').then(m=>console.log(m.TEST_USE_BASELINE_SHA, m.DSH_BASELINE_VERSION))"
639ed015397290b3745d163aafe02ffee4aa3f84 0.2.0-rc.2
```

So: **pristine at the pinned SHA**, and the SHA equals `TEST_USE_BASELINE_SHA` from `tests/paths.mjs`
(version `0.2.0-rc.2`) — the single source of the pin, not a hard-coded copy.

What was **not** done, stated as facts rather than intentions:

- **No patch, no `git apply`, no `patch-package` / `pnpm patch` / postinstall rewrite, no vendored modified
  copy.** The host tree has **zero** porcelain entries before and after every boot; each D2/D3 evidence
  directory carries its own `host-tree-porcelain.txt`
  (`dev/agent-workflow/evidence/d-boot-feasibility/d2/`, `dev/agent-workflow/evidence/d-boot-feasibility/d3/`),
  and both READMEs record "porcelain empty before and after both boots".
- **No import of an upstream private/internal API.** The native-mount fix reaches upstream only through
  public seams: `compositionInventory()` and `readDocument()` on the `agentPresets` accessor
  (`FINDING-native-tool-provider.md:65-67`), and the host's own `mountHostModules` path.
- **No modification of the shared read-only baseline.** All code in this candidate lives under this
  repo's `packages/` and `scripts/`.

### 5.2 CORE PATCH BUDGET = 0 was honoured

`AGENTS.md` fixes the budget at zero and classes any path needing an upstream source patch as
`CORE_SEAM_BLOCKER`, not a TODO. Every gap found in D was therefore handled **without** a patch, in one
of three lawful shapes:

| gap | how it is carried | not a patch because |
| --- | --- | --- |
| subprocess / PTY | execution-authority decision + typed refusals; `CONTRACT-CHANGE-REQUEST-process-lane.md` is RESOLVED | the declaration source was ALWAYS there (`toolBindings[].authorization` + `execution`); round 75 fixed the carriage. What remains for subprocess/PTY is a COMPOSITION swap (persistent confined shell), not a contract question |
| PTC | **CLOSED BY OWNER RULING (round 92): NOT SUPPORTED this generation** — typed refusal + status `unsupported-by-product-ruling` + zero worker; `ADR-ptc-unsupported.md` amends the A0 contract by citation | no upstream patch is needed OR wanted: the ruling accepts the refusal instead of a fork, and DSH host PTC stays untouched. The revisit path is an upstream per-execution policy seam (ADR §7) |
| search face and the durable overlay | shape B implemented in this repo (`overlay-decision.mjs`, `admission-port.mjs`), shape A left open in `CONTRACT-CHANGE-REQUEST-search-face.md` | the change is to this repo's plugin and its fact shape, not to the host |
| Alpha.6 review routing | typed refusal + two lawful shapes (`CAPABILITY-MATRIX-C.md:119-123`) | needs a compiled axis or an owner ruling; nothing upstream |
| runtime team creation on a centre row | **RESOLVED in round 74 by owner ruling** (`docs/reviews/20261122-1536.txt` §3) — S6 Remote restored as a governed management control plane, per-command refusal for agent execution; `ESCALATION-centre-row-creation-entrance.md` now RESOLVED | the change is inside this repo's plugin; the original was an owner decision and the owner ruled |
| admitted-then-refused settlement | **RESOLVED in round 73 by owner-approved Option A** — the settled contract now appends a durable recheck deny beside the allow and reaches `REFUSED`/`not-started` (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`; `ADM-119`…`ADM-124`) | the change is inside this repo's settlement store and plugin, not a host patch; the original escalation was an owner decision and the owner ruled |

### 5.3 No DSH upstream patch exists

To be explicit, because "we did not need one" and "we did not write one" are different claims: **there is
no upstream patch in this candidate to apply, and none was stashed.** The cut's closure gate proves the
positive side — `prodRefs=0` means no surviving production import of a retired entry, and
`distResiduals=0` means no dist mirror of a deleted source survives (§1.1/§4.3). The host tree's empty
porcelain (§5.1) proves the negative side at measurement time.

---

## 6. Limits and unproven claims (the honest list)

Assembled from `CAPABILITY-MATRIX-C.md`, `FINDING-native-tool-provider.md`, the three CCRs,
`ESCALATION-centre-row-creation-entrance.md`, and the D-BOOT-FEASIBILITY sections. Each item names what
would prove it.

### 6.1 No PRODUCT-PROVEN row

No row is PRODUCT-PROVEN (`CAPABILITY-MATRIX-C.md:71-74`). (The round-70 sentence "every row is `MECHANISM` or `UNPROVEN`" was not accurate: rows are also `DROPPED-AS-RULED` — C14, C17, C18 —, `UNSUPPORTED BY RULING` — C13/PTC (round 92) —, and `ENV-LIMITED` — five arms; the accurate claim is the one that matters: none is PRODUCT-PROVEN.) A row
moves only with a real host boot line at a named commit — and even the `DEV-LIVE` boots that exist are not
gates (`CAPABILITY-MATRIX-C.md:7`). *Would prove a row:* a gate-grade run (not a driver record) that boots
the product at a named commit and drives that row end to end.

### 6.2 Runtime team creation on a centre row — **RESOLVED (round 74)**

The round-59 measurement was `[boot1] team.create status=405 ok=false null`: the S6 plane was not built on
a centre-configured row, so the driver's only runtime creation entrance 404/405'd and D fell back to a
boot-created Team (shape 3). **Owner ruling** `docs/reviews/20261122-1536.txt` §3 rejected shapes 1/2/3 as
the product answer and restored S6 Remote as a **governed management control plane**:

- the plane is BUILT and INSTALLED on a centre row (`root.ts`; `host.ts` mounts the `installed` seam);
- `POST /team-remote/team.create` mints the Team at runtime through the existing
  `root.ts#createAndStartTeam()` (Principal + TeamDomain/Control + creation/start gates);
- every S6 command is classified by ACTUAL EFFECT in ONE closed table
  (`packages/runtime/src/plugin/s6-command-classification.ts`); control-plane
  read/creation/management commands and the round-83 `work-delivery` class (`member.create`,
  `member.send`, `member.followup`) are served, while `agent-execution` commands (the two root
  commands) are REFUSED before params/handlers with the existing `ADMISSION_REMOTE_UNAVAILABLE` on `team.control`, a durable
  invocation-authority fact and a `REFUSED`/`not-started` settlement;
- **no new admission axis**, no change to `admission.ts`, and no member admission on the management route.

Measured live (round 74, two agreeing boots): unauthenticated `team.create` → **401, no Team minted**;
foreign TeamSession → **`TEAM_REMOTE_FOREIGN_TEAM`**; legitimate create → **200, `path:"fresh-root"`**
with the durable TeamSession + leader row; duplicate create → **no second root, 0 provider requests**;
`member.send` → **served as work-delivery, acknowledged with 0 admissions / 0 executions at the ack**
(round 83's `d2:remote-delivery` measures the rest: the delivered prompt ran in the Member's own turn
and its `allow` landed in the Member's ledger; see §3.2 and §9.3). The round-74 measurement that
`member.send` was refused belongs to the pre-round-83 classification and is kept as history, not as
the current state.

**Limit, stated rather than hidden:** the principal is a **per-DSH_HOME authenticated operator**
(Connection Gate), **not** multi-user RBAC, and no user-level identity isolation is claimed. The created
Team's Member runs with its OWN compiled Binding and its OWN centre ledger — the management request never
carries a member Binding.

### 6.3 Process execution: authority is declarable, and the live persistent shell is PROVEN (round 76)
Round 75 replaced the path-lane question with an EXECUTION-authority question (owner ruling
`docs/reviews/20261122-1536.txt` §1; full fitness check in
`CONTRACT-CHANGE-REQUEST-process-lane.md`, now RESOLVED).

- `bash` / `pwsh` → decided by `toolBindings[].authorization` + `execution.executionBoundary` and the
  composition's executor readiness (`admission.ts:424-466`). Absent declaration →
  `ADMISSION_EXECUTION_UNAUTHORIZED`; `deny` → `ADMISSION_EXECUTION_DENIED`; a declared boundary with
  no ready executor → `ADMISSION_EXECUTOR_UNAVAILABLE`; `ask` → the existing Control approval.
  `Binding.process` and `io.process` do not exist. Arms `ADM-125`…`ADM-130`; the B ladder's rung-5
  negative is `ADMISSION_EXECUTION_UNAUTHORIZED` (`ADM-75`).
- `run_code` (PTC) → its **own** `ADMISSION_PTC_UNAVAILABLE` (the PTC branch in `admission.ts`,
  `ADM-87/88`) **and, since round 92, the product-ruling status `unsupported-by-product-ruling`** on
  the fact + settlement (`ADM-79` reaches it through the host-retained entry: zero worker, zero effect,
  REFUSED/not-started). The owner ruling `docs/reviews/20261124-0151.txt` §PTC closes PTC as NOT
  SUPPORTED this generation (`ADR-ptc-unsupported.md`), so this is a RULED SCOPE DECISION rather than
  a blocker: **ROUND 85's measurement is the basis** — nested calls re-enter the registry scheduler on
  the member agent's scope (**HOLDS**), escalation goes through `approval/request` → ControlService
  durable ask + one-shot grant (**HOLDS**), Stop aborts the run controller and terminates the Node
  child (**HOLDS**), and the WORKER's OS profile is the HOST session policy rather than the member's
  compiled read/write lanes (**FAILS**; rc.5's `sandboxPolicy.resolve({session})` +
  `additionalWritableRoots` does not close it).
- The v4 member ceiling is still a **closed** io shape `{read, write, network}`
  (`packages/domain/blueprint/src/blueprint-v4.ts:187-197`); feeding `io.process` live still yields
  `unknown-field`. That is correct: process authority is a TOOL-level execution declaration, not a
  fourth lane.
- **ROUND 76 — THE SWAP WAS MADE AND THE LIVE ARM IS PROVEN.** The shipped governed preset now carries
  the HOST's `@deepseek-ai/dsh-tool-bash-persistent` as a TOP-LEVEL row
  (`cordis.patch.yml:363-368`, `config.backendType: a5sf-governed-shell`) BESIDE the one-shot
  `tool-bash`, which stays as the surface baseline the lane replaces. The D3 main blueprint declares
  `toolBindings[]` for `bash` (`run-boot-d3.mjs:309-321`: `authorization: allow`,
  `executionBoundary: confined-subprocess`, `implementationOrigin: dsh-native`, io lanes `all` + empty
  deny). `run-boot-d3.mjs --boots 2` (DEV-LIVE, two agreeing boots, 2026-11-22T12:17-12:23Z) answers
  `allProven=true` (2/2) with all four judges PROVEN: the first `bash` call is admitted
  (`process.exec`, `allow`), writes durable shell state, is `ADMITTED→RUNNING→COMPLETED`, and a SECOND
  turn reuses the SAME shell and reads that state back (`DBOOT_D3_PERSISTENT_SHELL_STATE` →
  `DBOOT_D3_STATE_READ`). Confinement is real at the kernel level with both controls: the in-lane state
  file is written (32 bytes) while the out-of-lane write is refused by the OS profile — the shell
  itself reports `Read-only file system`, and the driver, reading from OUTSIDE the sandbox, finds no
  file (0 bytes) at the out-of-lane path. The PTY spawn is wrapped by the HOST `sandbox` provider
  (`terminal-bash` → `sandbox.confine`), whose Linux chain prefers bubblewrap (verified usable:
  0.11.1) and falls back to the Landlock launcher.
- **DEPLOYMENT REQUIREMENT (measured).** The persistent row injects `terminals`, and a preset with a
  pending row refuses to bind (`agent-preset/invalid … waiting for terminals`, then
  `TEAM_RUNTIME_DURABLE_WRITE_FAILED` at member creation — measured in D3 and reproduced in D1/D2
  before their worlds composed the service). Every governed deployment must compose
  `@deepseek-ai/dsh-terminal` on an ancestor scope. The test worlds add the HOST's module with NO
  backend: inert and fail-closed (`NO_BACKEND`, zero processes); the Member's live `bash` is the realm
  mount of the same module on the governed face.
- **SURFACE CHANGE (deliberate, disclosed).** The model-visible `bash` is now the persistent definition:
  `{command}` ONLY — `description`/`workdir`/`timeoutMs` are gone (`ADM-132`). Every assertion that
  spoke the old surface was moved: the D3 scripted model, the preset persona, and the new arms. A
  second-turn `cd`/`export` is durable; the surface no longer accepts a per-call `workdir`.
- **THREE RUNTIME DEFECTS FIXED BY MAKING THE PATH REAL** (no core patch): the projection refused a
  `confined-subprocess` restriction although the answer had a confined process face
  (`product-assembly.ts`); the compiled answer stored for admission DROPPED the mounted faces, so
  readiness said `unavailable` for a realm that had mounted the face (`a5sf-realm-row.mjs`); and a
  process-class binding claimed `bash` for an `fs`-only IO realm, breaking shape A's untargeted mount
  (`mount.ts`). Arms `ADM-131`…`ADM-134` + the B-ladder face arm pin all three.
- B's rung-5 positive control is NOT RUN in the ladder world (`ADM-68`, a disclosed bash-only skip;
  its positive control EXISTS at `ADM-125` + the round-76 live D3 judge). Rung 6 is NOT a skip in that
  sense any more: under the round-92 owner ruling PTC is NOT SUPPORTED (`NOT APPLICABLE — PRODUCT
  UNSUPPORTED`, `ADM-69`/`ADM-147`), and what the ladder proves for it is the REFUSAL chain
  (`ADM-76`/`ADM-79`/`ADM-87`: typed refusal, status, zero worker, zero effect, REFUSED/not-started).

*What is still NOT proven:* DEV-LIVE is not a gate; no real-model interleaving; the `ask`/`deny` arms
are in-process only; no Windows deployment (the persistent row is disabled on win32); the durable shell
state is shell-local across two turns, not a tmux/Processo env proof.

### 6.4 The search face — **Shape B is the DECLARED SUPPORT LEVEL, and it is NOT full dynamic permission governance**

**Owner ruling `docs/reviews/20261124-0151.txt` §Search (2026-11-24): Shape B is the support level for
this generation**, with the limitation stated plainly: **a durable Overlay deny aimed at ordinary file
reads does NOT automatically deny `grep`/`glob`.** The Overlay returns `no-opinion` for tools outside its
closed vocabulary, so the compiled FS Read Lane alone judges the search call. That is accepted as a
staged implementation only because the safety claim is explicit, not because it is equivalent to Shape A.
Full cross-tool dynamic revocation (an Overlay deny that reaches a search) is **Shape A's scope, not
something Shape B delivers**.

Measured live (round 64): an in-lane `grep` is admitted and runs (`decision=allow`,
`overlayOutcome=no-opinion`, execution fact `completed`, a real match at `team-b/corpus/huge-7.txt`),
while an out-of-lane `grep` is `LANE_DENY`.

**The required negative control is now GREEN over the REAL search tool paths (round 98, `SLICE-39`).**
The ruling requires "allow a parent directory but DENY a child, and prove a recursive search does not
read or return the protected child's contents"; checking only the root passed to `grep` is explicitly
not enough. The arm builds the parent-allow/child-deny lane, and the real `grep` module runs through the
real confined `subprocess` face. That face compiles the effective lane once with
`compileExecutionProfile`; Landlock has no negative rules, so the nested deny is INEXPRESSIBLE
(`PATH_NESTED_DENY_UNEXPRESSIBLE`) and every spawn from that realm is refused before a process exists.
Result: the recursive search returns an error, **no match and no byte of the protected child** (not even
its path), while the POSITIVE CONTROL world without the child deny DOES return the child's token. The
dangerous scope is therefore **FORBIDDEN**, not filtered — and it is forbidden because the traversal
cannot be carved, not because the root looked safe. Shape A remains the only shape that can express a
nested deny precisely.

**Limits (not softened):** (1) a durable Overlay rule cannot deny `grep`/`glob` — the lane is the whole
governance; (2) the centre judges the ROOT, and the provider's answer to a nested deny is a wholesale
refusal of the confined process face for that realm (a shell on the same realm is refused too), not a
per-file filter; (3) tests are MECHANISM (in-process, pinned host), not a booted product gate.

### 6.5 Alpha.6: the refusal is recorded (round 68), the routed path is implemented (round 84), and the LIVE routed wake is REFUTED (round 87)

**Round 68** closed the recorded-fact gap at the host entry: `host.ts` runs
`createAlpha6RowRefusalHook` (`vnext/row-refusal-entry.ts`) at the config rule, before the unchanged typed
throw, and that hook builds the product's own `createHostSurfaceRefusalPoint` through
`createCentreHostSurfacePoint` (shared with `root.ts`) and writes the invocation-authority fact +
`REFUSED`/`not-started` settlement under the row's `centreStatePath`. Measured live in both D3 boots
(`refusalFactCount=1`, `refusalSettlement.state=REFUSED`), with the row still refused and no team row
live. `d3:alpha6` is PROVEN **as the typed-refusal shape WITH its record**.
**Round 84 changed the ENABLEMENT law:** the opt-in is no longer refused on every row. `centre-config.ts`
now admits a COHERENT configuration (authored v5 `reviewRouting.enabled === true`, a non-empty
`centreStatePath`, an ABSOLUTE `alpha6WakeIntentPath`) and refuses each incoherent one with its own typed
piece code (`ADMISSION_ALPHA6_ROUTING_REQUIRED` / `_CENTRE_REQUIRED` / `_WAKE_INTENT_PATH_REQUIRED`) under
the unchanged `ADMISSION_ALPHA6_UNAVAILABLE` prefix, so the recorded refusal still lands. The routed path
itself is implemented through the ONE centre interface: the decision is the shared policy's projection of
the durable control row (`ADM-142`), the wake is a governed DELIVERY (durable intent + confirmation facts
over the P6-T3 session-input port, machine-attributed, zero tool executions — `ADM-143`/`ADM-146`), and the
Officer's own `team_resolve_control` is admitted by the centre on `team.control` under the OFFICER's
binding (`ADM-144`). A PRODUCTION root boots a coherent row and merges three real asks into one wake
(`a6-root-wiring`, `a6-pr7-merged-wake-host`).
*Still NOT proven:* a **live host** run of the routed wake. The D3 world's blueprint is v4 with a single
worker member and no Officer/approval case, so that world can express only the refusal side, and no
mock-model path resolves a control. The live level therefore stays the refusal shape; the positive path
is MECHANISM-proven over the real ports. Remaining limit: a row with no `centreStatePath` is refused but
unwritten (there is no durable directory to write to).

**Round 87 — the live answer, measured (D4 probe; `dev/agent-workflow/evidence/d-boot-feasibility/d4/`).**
The v4 limitation above is gone: the probe authors the coherent **v5** world with an `officer` member and
boots it twice (rc.2 `639ed015…`, HEAD `775be06d7`, `agreeing=true differing=[]`). Four of the five judges
are **PROVEN live**: `d4:enablement` (the coherent row is admitted by `alpha6EnablementRefusal`, the host
boots, the TeamSession is served, zero refusal facts), `d4:officer-up` (the Officer is a RUNNING instance
with its own running child session), `d4:officer-binding` (the Officer's OWN `read` is admitted by the ONE
centre under ITS binding: one allow `invocation-authority` fact for its callId, settlement
`ADMITTED→RUNNING→COMPLETED`), and `d4:refusal` (the same v5 document without `reviewRouting` is refused
by name, recorded, settled `REFUSED`, zero wakes). The fifth, `d4:routed-wake`, is **REFUTED by the product
itself**: the worker's authored `ask` lane creates a REAL durable `leader-approval` row
(`control-request-recorded`, `actionName: admission-ask`, `toolName: write`) that carries **no
`approvalCaseId`, no `legOrdinal`, no `reviewAuthority`**; the product's own
`createAlpha6RootRouter.route()` answers **`null`** for that row with `memberListCalls: 0`; the durable fact
census of the world holds **zero** `team-review-wake-routed` / `team-review-wake-delivered` facts, **zero**
files in the wake-intent directory, and a disk-wide scan for `[team-review-wake` finds nothing; the
Officer's session never receives a review wake and the **Leader** receives the plain C1 ask
(`[team-control … waiting for Leader approval`). The ask WAS resolvable through the plain C1 path (the
Leader's `allow` is durably recorded), so the world is coherent — what is missing is the route.
**TWO Team-side seams, neither a `CORE_SEAM_BLOCKER`:** (1) no live producer of a case-bearing ordinary
ask — `route()` requires the case identity (`alpha6/root-router.ts:209`), the case-less notifier branch
wakes the Leader by design (`alpha6/notifier.ts:159-169`), the only live leg producer `requestApprovalLeg`
(`control/service.ts:5607`) is called solely by the envelope-mutation lane (`governance/service.ts:1016`,
excluded by `isDelegableOrdinaryToolAsk`, `review-router/policy.ts:68`), both ordinary-ask producers are
case-less by construction (`src/plugin/vnext/admission-port.mjs:155-165`; `packages/tools/src/tools.ts:973-1000`),
and the Alpha.4 PA ask lane was deleted by the A1 cut (`1617d5839`); (2) no consumer for an
`ask`-disposition call even after an allow — the centre refused the granted call verbatim
(`member-io-policy/src/provider-capabilities.ts:315`, `IO_ASK_REQUIRES_APPROVAL`, "`resolveAskClassCall`
has no production caller", BL-30; `ALPHA5-SANDBOX-BACKLOG.md:559/:562`). No leg was fabricated, no control
route was added to the harness, and no wake file was written by the driver.

**ROUND 88 — seam (2) is now measured to be a CONTRACT conflict, not an unwired call (and it is still open).**
The task was to wire `resolveAskClassCall` so a granted `ask` executes. The measurement
(`dev/agent-workflow/evidence/bl-30-ask-consumer/README.md`, two new arms in
`packages/runtime/test/a5sf-approval-takeover.test.ts`, real `ControlService`) shows the seam's contract
cannot be satisfied by the product's own ask: the adapter's authority is the last-mile guard
`guardOperation`, which by DESIGN never consumes or authorizes an INLINE allow (B2/§D.4,
`control/service.ts:4155-4165`, `:4289-4291`), while the admission ask — the only production producer — is
`executionCoupling: 'inline'` (`admission-port.mjs:76-79`, `:163`; measured on the round-87 live row). Same
scope, guarded ⇒ adapter accepts and one durable consumption; inline ⇒ `no-request`, `APPROVAL_DENIED`,
zero consumptions. And the one-shot grant that DOES authorize the call is spent by the host tool guard
before the body reaches the refusing Provider plane (`admission-port.mjs:770-784`), so the Provider cannot
be a second consumer without a second authority. **No product code changed, no grant ledger added, no
coupling flipped**: the lawful fixes are owner decisions (name them, don't pick one silently) — flip the
ask to `guarded` (loses the Stop-cancels-the-pending-ask law, `ADM-57`/round-62 live stop) or give the OS
plane a read port onto the centre's already-enforced per-call decision. `d4:routed-wake` therefore stays
**REFUTED**; gap (2)'s live status is unchanged and now precisely explained.

### 6.6 The overlay cannot widen authority — by design, and now measured in both directions

`overlay-decision.mjs:9` (deny-only), `admission-port.mjs:498-521` (consulted only when the compiled lane
allows; the only verdict is `ADMISSION_OVERLAY_DENY`), `permission-mutation.ts:435-436` (a revoke removes
restrictions and "never needs expansion authority"). Measured live through the ONE durable
`permissionOverlay` lane: pre-read admitted → `team_grant_permission` exact `read` deny (`changed:true`) →
same read `ADMISSION_OVERLAY_DENY`, zero body, settlement `REFUSED`, the fact naming the overlay
(`overlayOutcome=deny`, `laneDecision=allow`) and carrying the compiled `policyGeneration` →
`team_revoke_permission` (`changed:true`) → same read **admitted again** and `COMPLETED` as a NEW fact;
the untouched in-lane read is admitted at every phase.

Round 71 replaced the old REQUIRED clause — which had demanded that the overlay WIDEN (revoke the deny ⇒
the previously succeeded call must be refused with a new compiled generation) — with the contract's own
terms, strictly. It also MEASURED the widening direction: the same lane was asked for an `allow` on a
locator outside the member's compiled lane and answered
`{"status":"permission-mutated", …, "changed":false, "reason":"mutation-proposal-pending"}` (a durable
proposal, not a minted authority), and the widened locator stayed `LANE_DENY` with zero foreign bytes.
`centre-install.mjs:94` fixes the fact's `policyGeneration` to the COMPILED revision at bind, which is
what (a) and (b) now assert it carries.
**D's "permission revocation" acceptance is stated in the contract's own terms:** revocation of access =
a durable deny (refused with zero body), restoration = removing that deny, widening beyond the compiled
ceiling = refused. `d2:revocation` is **PROVEN** on both boots
(`dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md`;
`FINDING-native-tool-provider.md` §"Round 71").

### 6.7 The model is a scripted mock, not a real model

Every D record uses the product's **scripted mock model** over `dsh web` (D-BOOT-FEASIBILITY:59 `dsh web,
mock model, p6t6 directive`). Each round's "what this does NOT prove" names "a real-model interleaving
(scripted mock)" (`D-BOOT-FEASIBILITY.md:529`, `:678`, `:776`). So no claim here covers model-driven
choice, retries, or adversarial tool selection. *Would prove it:* the same judges with a real model, and
the interleaving recorded rather than scripted.

### 6.8 In-process vs live — the distinction, everywhere it matters

- `MECHANISM` arms run **in-process**. The named stand-ins decide nothing: the agent-context double, the
  member's live-agent handle (`dispose()` running the registered disposers), the child-session factory,
  and the work-delivery port (`CAPABILITY-MATRIX-C.md:54-59`, `:105-106`). The compiled member answer is an
  **input** (a ceiling), not a decision — so **policy COMPILATION is not exercised** anywhere
  (`CAPABILITY-MATRIX-C.md:67`, `:128`).
- `DEV-LIVE` boots are real host processes but **not gates**. Since round 76 all three drivers end `overall=PASS` (the round-70 sentence "`overall=FAIL` for both drivers" was stale and contradicted §3.2); `DEV-LIVE` is still not a gate and no row moves on it.
- Consequences that only exist in one class are stated per item: the archived member's **product route**
  refuses earlier at the durable lifecycle gate, so `ADM-93` proves the centre's own tombstone, not the
  product's refusal order (`CAPABILITY-MATRIX-C.md:61-64`); `IO_READ_DENIED` is unreachable on the live
  path by design and is proven **in-process** (`ADM-100`).

### 6.9 A governed member with no confined provider is REFUSED (Option B); an ungoverned member is ALLOWED but REPORTED ungoverned

**Owner ruling `docs/reviews/20261124-0151.txt` §Realmless (2026-11-24): OPTION B.** A governed Team
Member with NO enforceable confined provider is **REFUSED**, because an admission ALLOW taken against the
compiled ceiling cannot claim the access bound when the provider that executes the call is not itself
bound by that ceiling. The typed refusal is **`MEMBER_CENTRE_UNWIRED`** — kept deliberately: the ruling
permitted the more accurate `ADMISSION_PROVIDER_UNCONFINED`, but the existing string is the identifier
ADM-44 and every reader already carries, it is NOT part of the closed
`AdmissionRefusalCode`/`HOST_SURFACE_REFUSALS` tables, and renaming would buy wording rather than
enforcement. The refusal prose states the accurate semantics ("asked for governance ... no
confined-provider realm").

**Round 98 closes a placement hole.** The round-35 rule ran BEFORE the mount attempt and only asked
whether the row DECLARED a realm source. A row that declared one but whose provider compiled no realm
for this template (`compiledFor → undefined`; a v4 template outside `memberIoCeilings`) slipped past it
and ran with no centre. `memberAdmissionGate` (`centre-config.ts`) now runs on the **mount result** after
`mountMemberA5sfRealm` and before `installMemberExecution`, the preset mount, the deny lane and every
tool body. The gate also produces the REPORT.

**The ungoverned path is labelled, not implied.** A row that never configured `centreStatePath` keeps
DSH's own permission model, but the live bindings report `{ mode: 'ungoverned', uteProtected: false }`
(`admissionModeOf(sessionId)`) and one `UTE-GOVERNANCE ungoverned` observation. It is **never reported
as UTE-protected**; it produces no UTE admission fact or settlement, and that absence is now explicit.

**Arms:** `ADM-44` (the pure rule) and `ADM-44b` (governed+unconfined ⇒ typed refusal, zero files
written; governed+realm ⇒ `uteProtected: true`; ungoverned ⇒ allowed + reported ungoverned; source pin
that the gate reads the MOUNT RESULT and runs before any preset/tool surface). **What is NOT proven:** a
full booted AgentSetup refusal arm; the gate is in-process and its placement is pinned by source order.
Per §2.3, the deleted `confined-*` shadows were mounted by the realm row itself, so a never-asked row
was never confined by them either.

### 6.10 "Admitted, then refused before the body" is now settled by an appended deny decision — but only in process

The old limit — `REFUSED` was `SETTLEMENT_ADMISSION_MISMATCH` against a cited `allow`, `CANCELLED` needed
a Stop, and `UNKNOWN` asserted an unobserved effect for a body that provably never ran — was **closed in
round 73** by owner-approved Option A (`docs/reviews/20261122-1536.txt` §2;
`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`, RESOLVED). The recheck now appends a durable deny
decision for the same executionId (its own `policyGeneration`, the product's existing
`ADMISSION_RECHECK_*` code) beside the untouched allow, and the settlement reaches
`REFUSED`/`dispatch=not-started` citing it as `terminalDecision`. Without that durable deny the old
`SETTLEMENT_ADMISSION_MISMATCH` / `SETTLEMENT_CONTRACT_GAP` path is unchanged (negative 1); a call that
reached `RUNNING` cannot be back-filled (negative 2); a Stop remains `CANCELLED` (negative 3); the crash
window recovers `REFUSED` without replay; and a failed deny write keeps the refusal and surfaces the gap.
Arms `ADM-119`…`ADM-124` over the real store + real port + real ledger.

*Still not proven:* the arms are **in-process mechanism** evidence. No live `D` judge boots a host
through the recheck path in this round, so no row moves to PRODUCT-PROVEN (§6.1); the rule against
inventing a Stop for a refusal is unchanged.

### 6.11 `host.service` capabilities' I/O is outside the member's fs ceiling

Goal/Todo, Team Skill and Subagent are bound and recorded on `host.service`, but a skill file read by the
host skill service is **outside** the member's fs ceiling (`CAPABILITY-MATRIX-C.md:76-87`;
`admission.ts:132-137`). This is a **limit, not a confinement claim**, and it is repeated in C15 of §2.

### 6.12 The centre is not mount-aware

Its binding is installed at the member bind (`agent-bindings.mjs:2036` installs the member centre) while
`mcpMountTarget` is computed later per boundary (`agent-bindings.mjs:2287`), and `admission.ts:364-368` has no
mount input. A
**well-formed** name for a never-mounted server is therefore decided on the network axis alone; the
product excludes such a call at the **tool registry**, not at admission (`ADM-97` step 5). *Would prove
it:* an admission-time mount input, i.e. a contract change.

### 6.13 `d:member-read-denied` — the two channels, each measured at its own layer (round 71)

The live path's contract is: the centre decides **before** execution, so an out-of-lane call is refused
on the LANE channel (`LANE_DENY`) and never reaches the provider. The old clause required the provider's
`IO_READ_DENIED` on that path, which asked the product to run the provider before the centre — the wrong
order for a governance system — so it was an instrument defect about the judge, not a product gap.

The rewritten judge measures the deciding channel, strictly:

- the durable fact's `refusalCode` is `LANE_DENY` or `IO_READ_DENIED`, and the tool result names it;
- **lane channel**: the result carries `LANE_DENY` AND **zero provider guard facts exist for that exact
  call id** — the refusal genuinely preceded the provider;
- **provider channel** (the alternative): the result carries `IO_READ_DENIED` AND the provider guard
  recorded its own `deny` fact (`decidedBy=IO_READ_DENIED`) for that call;
- zero secret bytes and not-ENOENT are required on BOTH channels.

The provider channel is additionally evidenced in its own in-process population: a separate clause runs
`node --test --test-name-pattern ADM-100 packages/runtime/test/vnext-admission.test.mjs` in the boot and
requires the pass **and** the presence of that test's provider-deny assertion (a deleted assertion fails
the clause). Raw result: `runs/boot01/in-process-provider-channel.json`.

Measured live (two agreeing boots): `refusalCode=LANE_DENY`, `channel=lane`, `provider guard facts for
this call=0`, zero secret bytes, not-ENOENT, and ADM-100 green in process. The judge is **PROVEN**
(`D-BOOT-FEASIBILITY.md` §14; `FINDING-native-tool-provider.md` §"Round 71"). The two channels are both
evidenced; neither is conflated with the other.

### 6.14 Other measured-or-missing coverage

**Still-open register (round 89: re-issued as §10, which is the authoritative list; this paragraph keeps the
round-86 numbering so older citations still resolve).** The **fourteen** items are: (1) the root-work async
seam (`team.admitInitialWork` /
`team.ensureRootLive` refused; no enqueue-and-acknowledge seam exists); (2) no live `member.create` /
`member.followup` (only `member.send` was driven); (3) **PTC — CLOSED, no longer a gap**: the owner
ruled it NOT SUPPORTED this generation (round 92, `ADR-ptc-unsupported.md`), so it is a ruled scope
reduction with a proven refusal chain, not an open blocker; (4) Alpha.6's **live routed wake** (the formal routing is implemented and the
refusal shape is live); (5) the rc.5 `{{cwd}}` persona change (rc.5 no longer registers the variable, so
the preset suffix names "the session workspace" — a substitution, not a governed feature); (6) the
operator is a **per-DSH_HOME authenticated human, not RBAC**, with no user-level isolation claimed;
(7) the census runner's **five ENV-LIMITED arms** (`ENV-LIMITED-CAPABILITY-20261123.md`); (8) the
**pre-dispatch Stop observer is not production-wired** (`RC5-MIGRATION.md:492-504`); (9) the realm-less
admission ruling (code refuses today; the ruling decides the final answer); (10) search-face shape A (the
durable overlay cannot deny a search); (11) the scripted mock model stands in for a real model;
(12) the census population counts differ from the published baseline (identity set identical);
**(13, round 87) no live producer of a case-bearing ordinary ask** — the only live leg producer
`requestApprovalLeg` serves the envelope-mutation lane, so every durable ordinary ask is case-less and
`alpha6/root-router.ts:209` returns `null` (`d4:routed-wake` REFUTED); **(14, round 88) no consumer for an
`ask`-disposition call (BL-30)** — `resolveAskClassCall` has no production caller and cannot be wired
without an invariant/owner decision, so a granted `ask` still does not execute.
`CANDIDATE-AUDIT.md` §6 carries the round-86 register with what closes each one; **§10 below supersedes it
for the current HEAD.**

- **No Stop under load, no revocation under load, no multi-agent load beyond two Members.** `d2:stop` is a
  timing race by nature; it reproduced in both boots, but two agreeing boots is not load.
- **No real Stop keypress** (the public RPC was used).
- **`userQuestions` and terminals** are covered only by the PTY-owner refusal (`SLICE-33`), not by a
  positive.
- **C11 (state projections)** now has its Team-owned half measured (`ADM-107`…`ADM-109`, round 66): the
  projection is preserved in the new assembly and derives only from durable TeamDomain facts. What it still
  lacks is a **live boot** reading the HOST's `sessionProjections.stateOf` for a Member's todo/goal state —
  the host service, not the Team's (`§2` C11 row).
- **`test-catalog` is close to its ceiling** (`UNCOLLECTED=38` against a 41 ceiling), so the collected
  population has three units of headroom.
- **The measured Team is runtime-created** (round 74), removing the boot-bound concession (§6.2). The
  model is still the product's scripted mock.

### 6.15 The rc.5 FS additions were unconfined — **CLOSED (round 77)**, and what it does not prove

**The limitation, stated as it stood.** This report's C13 row is measured on DSH **0.2.0-rc.2**
(`vnext-fs-slice.test.mjs`, `ADM-100`…`ADM-102`) while A0 targets **0.2.2-rc.5**. rc.5's `FileSystem`
adds three methods — `patchText`, `deleteFile`, `moveFile` — and the Team confined provider overrode
ten methods ending at `editText`, so on rc.5 `apply_patch`, delete and move reached the base provider
**without the Member's lane**. The invariant that keeps this visible (SLICE-35) was RED on rc.5 and
named seven un-overridden names (`RC5-MIGRATION.md` §6). Until round 77 no "FS confinement holds on
rc.5" claim could be made for those three operations.

**What is now closed (round 77).**
- The three overrides exist in the SAME shape as the ten (`packages/runtime/team-services/src/fs.ts`):
  `patchText` like `editText`, `deleteFile` like a write, and `moveFile` judging BOTH paths (source as
  a removal of an existing file, destination as a write + read-if-existing) before either effect. An
  out-of-lane destination refuses with `IO_WRITE_DENIED` and the source is not removed.
- rc.2 compatibility is preserved by construction: the three are extra methods on a separate surface,
  reached through ONE local, commented cast; a base that implements none of them refuses TYPED with
  `IO_POLICY_UNSUPPORTED` (never a `TypeError`, never a fallthrough). `MANAGED_FS_METHODS` was not
  grown, so an rc.2 install is still accepted and the capability decision is per call.
- SLICE-35 is GREEN on **both** lanes, and the green is falsifiable (renaming the `patchText`
  override turns it red naming that method). SLICE-36 keeps its exact assertion with a fixture that
  adds three names the product does not cover.
- Six new arms `ADM-135`…`ADM-140` ride the `ute-vnext-a1` leg: in-lane reaches the provider exactly
  once with the same path(s); out-of-lane is a typed refusal with zero provider calls (for a move,
  the source survives); the cross-root case follows the product's per-path rule; an old backend is a
  typed refusal; and the REAL pinned provider performs the three on rc.5 while refusing them typed on
  rc.2.
- Leg population grew 182 → **204** (202 pass, 2 disclosed skips, exit 0); vitest stays **238**.

**What it does NOT prove (so this is not read as more than it is).**
- **In-process, not a boot.** The provider is mounted through Cordis in the test process; `ADM-140`
  uses the real pinned `LocalFileSystem` and the real lane guard, but there is no host boot, no model
  turn and no live `apply_patch`/delete/move through a Member.
- **No kernel boundary.** The lane is a guard in trusted code over a model-controlled path; the base
  provider's own TOCTOU between canonicalization and the syscall is inherited, not closed.
- **rc.5 semantics only partly exercised.** `moveFile`'s publish-then-remove shape, its
  `sourceDeleted:false` outcome and its version guards were read from the host source; the arms
  exercise the unconditional case (no hunks, no version guards).
- **The rc.5 lane still has pre-existing reds** unrelated to this round, measured against the
  reverted tree: `vnext-b-probe-ladder.test.mjs` hangs on rc.5 (so the leg cannot run as one
  invocation there), and `ADM-96/97` (`signals[0] is not of type AbortSignal`) and
  `ADM-100/101/102` (preset native-module default mount) fail. They are recorded, not bent.
- **No matrix upgrade.** C-fs stays MECHANISM: rc.5 greens are lane evidence, and a PRODUCT-PROVEN
  row would require a booted measurement.

### 6.16 The two entry files are still large — round 90 is a REVIEWABILITY change, and this is exactly what it does not prove

**The limitation.** The A1 cut replaced the two entry files wholesale and they carry the whole centre
assembly: `agent-bindings.mjs` was **4,967** lines and `root.ts` **5,239**. Nothing in the acceptance
argument depended on their size, but a reviewer cannot hold a 5,000-line closure in view, so the size
was itself the review risk. Round 90 (branch `vnext/a1-cut`, evidence
`round90/`) moves four cohesive spans of `agent-bindings.mjs` into sibling modules under
`packages/runtime/src/plugin/vnext/`, **verbatim**, and imports them back.

| span (what it owns) | new module | moved lines | module lines |
| --- | --- | --- | --- |
| the governed preset's enabled row module specifiers + each row's declared `config` (SHAPE A) | `governed-preset-modules.mjs` | 127 | 156 |
| the MCP CAPABILITY WITNESS: capability telemetry, the F15 public tool-surface readers, fiber retirement | `mcp-witness-lane.mjs` | 158 | 205 |
| the Root (Leader) input delivery ports: the ONE shared real-input path + the B6 context, TCM-M3 initial work, C1 control notification | `root-delivery.mjs` | 208 | 248 |
| the Member stop lane: interrupt + PD-29 goal disarm, the recursive descendant drain, the live-residency port | `stop-drain-lane.mjs` | 205 (3 chunks: 95 + 12 + 98) | 249 |

`agent-bindings.mjs` went **4,967 → 4,301** lines; `root.ts` is untouched (5,239). (The last
single line came off in the follow-up that removed the two bindings the move left unused — an
unused import name and an unused destructure entry; see the round-90 settlement comment.) Every module is a
factory over one row instance — no module-level mutable state, exactly like the closure it came from.

**How "verbatim" was proved, not asserted.** Each moved range was copied by line range from
`git show HEAD:…/agent-bindings.mjs` and the receipt
(`round90/byte-identity.txt`) is a substring test in both directions: the exact original text is present
in the new module AND ABSENT from the rewritten glue. Six ranges, 698 lines, all
`verbatim_in_module=True absent_from_glue=True`. The only new lines at the move sites are the
import/destructure lines and a comment; the only deleted lines are the moved ones. The exported surface
of `agent-bindings.mjs` is unchanged (`createAgentBindings`, `a5PlaneSubtreeContains` and the existing
`createPtcEscalationRouter` re-export).

**Same counts, same digest, before and after.**

| gate | before | after |
| --- | --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | `suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975` | identical |
| `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` | identical |
| `run-boot.mjs --boots 1` | `RESULT FAIL` (5 PASS / 1 FAIL: `d:remote-creation`), exit 1 | identical |
| `run-boot-d2.mjs --boots 1` | `RESULT PASS`, 4/4 PASS, exit 0 | identical |
| `run-boot-d3.mjs --boots 1` | `evidence-complete=true allProven=true`, 4/4 PROVEN, exit 0 | identical |

The `run-boot` FAIL is the pre-existing `d:remote-creation` arm at this HEAD (it is FAIL before and
after the decomposition; this round neither fixes nor hides it — the point of the pair is that the
verdict is *unchanged*).

`place-dist-glue` mirrors all four new files (30 → 34 placements, every line `(byte-identical)`), and
the round-90 p4t6 booking (`packages/testkit/test/p4t6-bookings/round90decomposition.json`) records the
**measured** scannable-surface delta `1313 → 1317` — the scanner printed
`scanner counts 1317, ledger derives 0 + 1313 = 1313` with the four files unbooked, and the ledger is
green with exactly those four paths booked. No arm was relaxed.

**Three things deliberately did NOT move, each with its reason.**
- `observeMcpOperationalWitness` (the F15 confirmed-loss classifier) reads the row's `closing`
  primitive (`let closing`, set once by `close()`). A primitive cannot be passed by reference, so a move
  would have forced an edit to the moved condition — a logic edit this round refuses. It stays in the
  glue and consumes the moved readers through the factory return.
- `deliverRootWorkCompletionNotification` and `deliverReviewWake` read the same `closing` primitive; they
  stay for the same reason.
- `reconcileMcpSet` (the mount/dispose transaction) and the plugin-owned cooldown/reconnect constants
  stay: `f15-mcp-live-loss.test.ts` §9.2 is a STATIC call-site witness that reads `agent-bindings.mjs`
  and pins exactly one `state.mcpMountCtx.plugin(mcpClient,` site plus the literal policy constants.
  Moving the transaction would have required editing that test, which the round's rules forbid; the
  alternative — leaving the assertion pointing at a file that no longer holds the call site — would have
  been a silent weakening. This is the one span the round wanted and could not take without a test edit,
  and it is reported as such.

**What this does NOT prove.** No behaviour was changed, so nothing new is proven — and that is the whole
claim. Specifically: (a) the moved modules are exercised through the SAME suite population as before
(the leg populations did not grow; there is no new unit test for a factory boundary, because inventing
one would be new surface, not preservation); (b) `root.ts` was **not** decomposed, so the reviewer's
size concern is only partly addressed (5,239 lines remain); (c) the decomposition does not make the
centre assembly easier to *test* — it makes it easier to *review*, and that is a line-count and
diff-shape claim, not an acceptance level; (d) the `d:remote-creation` red at `run-boot` is unchanged and
still open (§10 register). CORE PATCH BUDGET = 0: no upstream file was touched, no port was opened, no
second server was started.

---

## 7. Verdict

**What a reviewer may conclude.**

1. **The candidate implements A1 + B + C.** The A1 cut is closed by measurement, not by prose: 148 sources
   gone, `prodRefs=0`, `distResiduals=0`, `dupNames=0`, 34 byte-identical dist placements (30 at the
   round-89 head; round 90 added the four decomposition modules), and the 37/180/
   69,512-line frozen census unchanged (§1.1–§1.2). B and C are carried by the arms through `ADM-146` and
   `SLICE-21…SLICE-38` in the `ute-vnext-a1` node leg (**211 tests / 209 pass, 0 fail, 2 disclosed skips**)
   and by the 15 migrated capability
   suites (**238/238**, `verdict=PASS`) (§4). C14b's six invariant arms are part of that count, as are
   round 68's three entry-ordering arms and round 73's six settlement-Option-A arms (`ADM-119`…`ADM-124`).
2. **There is live D evidence for the listed items.** **Every live judge is PROVEN** at two agreeing
   boots each — **fourteen** judges: the twelve measured through round 74, round 76's
   `d3:persistent-subprocess`, and round 83's `d2:remote-delivery` (rc.2 only; see §3.2) — `d:remote-creation`,
   `d:member-read-admitted`, `d:guard-facts`, `d:centre-facts`, `d:native-read-surface`
   (repaired, not deleted), `d:member-read-denied` (round 71: channel-typed, provider guard facts
   required to be ABSENT on the lane channel), `d2:multi-member-concurrency`, `d2:revocation` (round 71:
   the four contract directions, widening measured and refused), `d2:stop`,
   `d3:persistent-subprocess` (round 76: a persistent, OS-confined shell across two turns),
   `d3:crash-cold-recovery`, `d3:work-delivery`, `d3:alpha6` (as the typed-refusal shape). The P1–P5 obligations each have a green
   assertion, a negative control, and a live carrier (§3). **Round 87 adds four more PROVEN live probe
   judges** — `d4:enablement`, `d4:officer-up`, `d4:officer-binding`, `d4:refusal` — over a coherent v5
   world, and **one REFUTED** (`d4:routed-wake`). The D4 probe is a blocker measurement, not a driver
   acceptance; it upgrades no row and its REFUTED judge is carried in §6.5/§10, not hidden.
3. **It is NOT a completed product acceptance**, and the refuted items are named rather than rounded up:
   - **`d3:persistent-subprocess` is no longer refuted (round 76).** The governed preset mounts the
     persistent shell beside the one-shot baseline, the world declares the execution authorization, and
     two agreeing DEV-LIVE boots PROVE the first call admitted + durable state + a second turn reusing
     the same shell, with the out-of-lane write refused by the OS profile (§6.3). It is DEV-LIVE, not a
     gate; the `ask`/`deny` arms remain in-process. B's `bash` positive is still **NOT
     RUN** in the ladder world (a disclosed bash-only skip); `run_code` is no longer a "not run" positive
     — it is `NOT APPLICABLE — PRODUCT UNSUPPORTED` (round-92 ruling), and the ladder proves its refusal
     chain instead (§6.3, §4.1b).
   - **Runtime team creation is RESOLVED, not a gap** (round 74): the governed management plane is live
     and `d:remote-creation` is PROVEN on two boots (§6.2). The remaining limit is scope, not existence:
     per-DSH_HOME operator, not RBAC. This moves no C row to PRODUCT-PROVEN (the model is still a mock).
   - **Alpha.6's ENABLEMENT is no longer the gap; the ROUTED WAKE is REFUTED live (round 87).** A
     coherent v5 row boots, the Officer is up and its own calls are admitted under its own binding — but
     the product's own durable ordinary ask carries no case, `alpha6/root-router.ts:209` returns `null`,
     and the Leader receives the plain C1 ask (`d4:routed-wake` REFUTED). The blocker is two Team-side
     seams, **not** an upstream seam (§6.5, §10 G1/G2) — and the second one means **a granted `ask`
     still does not execute in production** (BL-30).
   - **The search face is lane-only governance, by RULING** — Shape B is the declared support level for this generation; a durable overlay rule cannot deny `grep`/`glob`, and that is explicitly NOT full dynamic permission governance (§6.4). The required recursive parent-allow/child-deny control is GREEN (`SLICE-39`).
   - **No row is PRODUCT-PROVEN**, and the model is a **scripted mock** (§6.1, §6.7).
   - **C11 (state projections)** has mechanism arms for its Team-owned projection (`ADM-107`…`ADM-109`,
     round 66), but its host `sessionProjections.stateOf` half is unproven and needs a live boot (§2.2).
   - **C14b** is preserved with its own positive+negative arms (`ADM-110`…`ADM-115`, round 67), but it is
     still **not PRODUCT-PROVEN**: the arms are in-process, the OS probe is a node-leg measurement, and
     the ungoverned (never-asked) row remains outside the centre by design (§2.3, §6.9).
   - **The two round-71 judges are PROVEN as instruments, not as new product capability.** The provider
     channel remains unreachable on the LIVE path by design (its proof is in-process, `ADM-100`), and
     widening beyond the compiled ceiling remains impossible by design (§6.6, §6.13). A reviewer must
     not read "PROVEN" there as "the overlay can widen" or "the live path reaches the provider".
   - **The round-73 settlement Option A is a MECHANISM result.** `ADM-119`…`ADM-124` prove the appended
     deny, the two negatives, the crash window and the fail-closed write in process; no live `D` judge
     boots a host through the recheck path, so no row moves to PRODUCT-PROVEN (§6.10).
4. **Therefore:** the honest description is *"A1+B+C implemented and measured, with D live evidence for
   the named, listed items — **not** a completed product acceptance."* The centre behaves as an A1 cut
   should: an unwired controlled call is **refused with a typed code**, not forwarded. That is a
   governance result, not a product-acceptance result, and the two must not be merged in any report,
   release note, or review summary.

**What would change this verdict** (in order): the composition swap to a persistent confined shell
(plus its `toolBindings[]` declaration) and a re-run of the live D3 driver, a ruling/wiring for
Alpha.6's review-routing axis, a real-model interleaving, and then a
gate-grade product acceptance run that boots at a named commit and drives each C row end to end. (The settlement-recheck ruling was given and implemented
in round 73; it removed a red cell, not the product-acceptance gap.)

**Nothing in this report authorises a merge, a release, or a deployment.** `master` is untouched by this
branch; the candidate must not auto-merge (`PR-BODY-draft.md` §"What this candidate is" and §"Not done
here").

---

## 8. Readiness checklist (for the reviewer)

A box a reviewer can tick against this HEAD. Every line names the check and where its measurement is.

| # | check | state | where to verify |
| --- | --- | --- | --- |
| 1 | **Branch and base** | `vnext/a1-cut`, measurement commit `97d7d7c8d1bb0410dac9dedac77dee97143851bf` (round 89), base `a19d1df01` (frozen A0, PR #821, `master`) | `git rev-parse HEAD`; §1 |
| 2 | **No auto-merge** | PR #822 is **draft**, base **`master`**, state **OPEN**; the engine may sync the body but must never mark it ready or merge it. **Merging is the OWNER's act** — not the engine's, not this branch's | `gh pr view 822 --json isDraft,baseRefName,state` → `{"baseRefName":"master","isDraft":true,"state":"OPEN"}` |
| 3 | **Gates green (local)** | every required command passes at this HEAD (dispatch 215/212/0/3 — the third skip is the second ruled PTC marker, round 92; catalog 785 collected / 38 uncollected / 14 excluded; closure four zeros with `references=3`; assets 37/180/69,512; docs-sync 0 findings; 34 placements; CI-required 10/0; CI-security bound vitest 216; migrated layer 238/238; `ci-pr-gate --full --census-captures 2` 10/10; UTE G1 89/89). **Hosted is NOT all-green at this HEAD: `ci-integration` FAILED and `ci-census` was skipped; `ci-required` is red for both reasons** (§9.4, §10 G9) | §4.1–§4.8, §9.4; `round86-ci-pr-gate.log` (round-86 block) and the §9.4 block (round 89) |
| 4 | **Refuted / unreachable items listed** | `d3:persistent-subprocess` (round 76: PROVEN in two agreeing DEV-LIVE boots — a persistent OS-confined shell across two turns; its `ask`/`deny` arms and a gated status remain unproven), **`d4:routed-wake` REFUTED (round 87)** with the two in-repo seams named, search face lane-only, provider channel unreachable on the LIVE path (in-process only), widening beyond the ceiling impossible by design. **Runtime creation is no longer on this list** (round 74 RESOLVED, `d:remote-creation` PROVEN) | §3.2, §6.2–§6.5, §6.6, §6.13, §7, §10 |
| 4b | **The two older owner rulings are DECIDED and implemented (round 98)** | Realmless = **Option B** (governed+unconfined ⇒ typed `MEMBER_CENTRE_UNWIRED`; ungoverned ⇒ allowed but reported `ungoverned`/`uteProtected:false`; `ADM-44b`). Search = **Shape B is the declared support level, NOT full dynamic permission governance** — an Overlay deny on ordinary file reads does not deny `grep`/`glob`; the parent-allow/child-deny recursive negative control is GREEN (`SLICE-39`) because the confined provider forbids the inexpressible scope. Shape A remains future work | §6.4, §6.9; `OWNER-DECISIONS.md` round-98 block; `CAPABILITY-MATRIX-C.md` |
| 5 | **Owner decisions listed** | **the two older rulings are now DECIDED (round 98: realmless = Option B, search = Shape B declared), leaving Shape A as future work, plus four rulings the two round-87/88 seams need** (one Alpha.6 ask-producer decision; three BL-30 routes: guarded coupling, an OS-plane decision read port, or accepting the refusal). **PTC is NO LONGER an open decision**: the owner RULED it unsupported this generation (round 92, `ADR-ptc-unsupported.md`), so the old "PTC upstream seam" ask is closed — PTC is a ruled scope reduction, not a blocker and not a pending feature. The other older items are resolved or implemented (process lane: `bash`/PTY live; runtime creation; settlement recheck; Alpha.6 formal routing — live routed wake REFUTED) | `OWNER-DECISIONS.md` (round-86 correction block + round-92 addendum), §9.5, §10, `ADR-ptc-unsupported.md` |
| 6 | **Host untouched** | pinned host `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain empty; CORE PATCH BUDGET = 0 with no upstream patch | §5.1–§5.3 |
| 7 | **No PRODUCT-PROVEN row** | by design at this stage: `DEV-LIVE` boots are not gates | §2.1, §6.1 |

**Plain statement.** This candidate is reviewable now and mergeable **only by the owner**. Nothing here
is a release, a deployment, a version bump, or a claim that the product is accepted.

---

## 9. Round 83 — work DELIVERY on the management plane, and the gates at this HEAD

### 9.1 What changed

Round 74 restored S6 Remote as a governed management plane and refused five commands as
`agent-execution`. Three of those were real product operations. Round 83 keeps the exact boundary and
delivers them the only lawful way:

> **The management plane may DELIVER work. It may never EXECUTE a tool.**

- **Classification** (`packages/runtime/src/plugin/s6-command-classification.ts`): a third SERVED class
  `work-delivery` = `member.create`, `member.send`, `member.followup`. The refused set shrinks to
  `team.admitInitialWork`, `team.ensureRootLive` (both `agent-execution`). Still ONE closed table, no
  default-allow, unknown commands still refused.
- **`member.create`** → the S6 admission port → `TeamRuntime.performAction({action:'create-member'})` →
  the ONE ActivationProvider; the effect is `member-activated`. Creation only: no work chain, no turn.
- **`member.send`** → the S6 messaging port → P6-T3 coordinator: durable intent fact → input ACCEPTANCE
  into the recipient's own session inbox → confirmation fact. The answer IS the acknowledgement.
- **`member.followup`** → the S6 admission port → `performAction({action:'follow-up',
  execution:'async'})`: Phase A commits the durable `team-work-admitted` receipt and returns it; Phase
  B/C run DETACHED inside the Team runtime. The request never awaits, and never observes, the turn.
- **`team.admitInitialWork` / `team.ensureRootLive` stay REFUSED**, stated as a ruling: the first's only
  seam awaits the root's turn to idle (and is root-scoped, not a Member delivery); the second starts an
  executor and returns no delivery acknowledgement at all. Neither can be expressed as a delivery.
- **Fail closed**: a delivery command on a row with no delivery port answers the EXISTING wire code
  `ADMISSION_REMOTE_UNAVAILABLE` with a message naming the unwired seam, typed, before any claim/param/
  durable write — never a fallback to executing. The refusal reason was shortened to fit the 512-char
  settlement reason cap (ADM-86 now asserts the cap; E3 runs with zero settlement faults).

### 9.2 Boundary arms (host-free)

- `packages/runtime/test/vnext-admission.test.mjs` **ADM-86** (rewritten): literal delivery set and
  refusal set; served `catalog.list`; `member.send` reaches the coordinator exactly once and returns the
  `delivered` outcome (no `toolResult|result|assistant|executionId`); `member.followup` reaches the
  action facade once; `member.create` reaches the creation action once with no execution mode; the
  refusal hook is NEVER consulted for a delivery command; the plane has no `tool|provider|execute|
  bridge` port; the two root commands keep the durable `team.control` refusal + `REFUSED`/`not-started`
  settlement; an unwired seam fails closed typed; unauthenticated is refused first.
- `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` **E3**: the production root
  installs the plane, serves a read, refuses ONLY the two root commands (facts on the row's own ledger),
  leaves NO deny fact for a member command, and at the exact production port
  (`createS6RemotePorts`) `member.followup` asks the facade for `execution:'async'`, `member.create`
  carries no execution mode, `member.send` reaches the coordinator.

### 9.3 Live proof (D2, DEV-LIVE, `--boots 2`, two agreeing boots)

`d2:remote-delivery` **PROVEN on both boots**; the driver runs its FULL declared set
(`selected=4 / totalCases=4`, `subset=false`) and `agreeing=true differing=[]`.

```
[ boot1] member.send ack: status=200 ok=true code=null deliveredSeq=40 facts=18 admissions=0 executions=0
[ boot1] member.send unknown member: ok=false code=TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED requestsAdded=0
[ boot1] member.send duplicate: ok=true distinct=true requestsAdded=0
[ boot1] member.send archived: lifecycle=ARCHIVED ok=false code=TEAM_RUNTIME_WORK_STATE_REJECTED requestsAdded=0
[ boot1] member.send restored: lifecycle=SETTLED ok=true code=null
[ boot1] delivered-stop: ackOk=true pending=true landed=true state=REFUSED refusal=ADMISSION_STOPPED
[ boot1] case d2:remote-delivery: PASS
```

Measured facts (boot1; boot2 identical): ack intent seq **39** / confirmation **40**; at the ack
**0 admissions / 0 executions** for the delivered call; after the member's own turn, B's ledger 18 → 20
facts with the centre's `allow` on `fs.read` (`instanceId = agentId = B`, B's in-lane locator) at
`…40.623Z` vs the ack at `…40.510Z` (**~113 ms later**), one `completed` execution, and B's in-lane bytes
in B's transcript. Duplicate send is a SECOND durable coordination (at-least-once, not a token replay)
with 0 provider requests at the ACK and still exactly one completed execution. Stop during a DELIVERED
turn is `ADMISSION_STOPPED` with a `REFUSED`/`not-started` settlement. Host porcelain empty after both
boots; DEV-LIVE slots released.

### 9.4 Required gates re-run at this HEAD

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 211
ℹ pass 209
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 0
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=785 instruments=3 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32
  DISCOVERED_AND_COLLECTED 733
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              38
  by runner: node=146 none=7 vitest=632
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (30 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-security      # the bound vitest leg
EB3-LAYER layer=ci-security verdict=PASS suites=14 files=14 describes=61 passed=216 failed=0 clock_ms=20000

$ npx vitest run <the 15 migrated files in evidence/ute-a1/migrated-entry-imports.json>
 Test Files  15 passed (15)
      Tests  238 passed (238)

$ node --test --test-force-exit --test-timeout=480000 --test-reporter=spec \
    tests/ute1-fs/native-fs-binding.test.mjs tests/ute-g1-fs/lane-suite.test.mjs \
    tests/ute-g1-fs/lib/refusal-categories.test.mjs tests/ute-g1-fs/product-route-image.test.mjs \
    tests/ute-g1-search/lane-suite.test.mjs tests/ute-g1-web/lane-suite.test.mjs \
    tests/ute-g1-process/lane-suite.test.mjs tests/ute-g1-agentctl/lane-suite.test.mjs \
    tests/ute-g1-uistate/lane-suite.test.mjs
ℹ tests 89
ℹ pass 89
ℹ fail 0
```

`ci-pr-gate --full --census-captures 2` (**PASS 10/10**, 275.7 s at `97d7d7c8d` (an earlier same-HEAD run measured 285.5 s; the verdict was identical); 2 captures, identical
identity sets, captured **599 files / 7,416 lines** vs the baseline-declared 626 / 7,936 — the counts moved
by the round-88 arms, the identity set did not). The PR settlement gate and the hosted verdicts are
recorded in the **round-89** settlement comment on PR #822 (the comment is the living record).

**Hosted at `97d7d7c8d` (queried this round; this supersedes the `c29da52d3` set pasted in round 86):**
`pr-gate`, `ci-fast`, `ci-security`, `ci-product`, `synthesize-merge-tree`, `candidate-protection`
**success**; `ci-census` **skipped (draft)**; **`ci-integration` FAILURE** — leg `tinf-instruments`,
`EB3-REQUIRED` grading `fail layers=6 green=4 nongreen=ci-integration:failure,ci-census:skipped` — and
`ci-required` / `ci-required-deferred` failure for exactly those two non-green layers;
`pr-settlement-gate` failure until the round-89 comment. **The `ci-integration` red is not claimed as
"solely the census skip" any more.** Its job log (run `45136105108`, job `137562782742`) names **no
failing assertion**: the leg's output ends mid-line at `D17` with no `DSH-TEST-DISPATCH` token, i.e. the
node process aborted. The same leg is **GREEN locally** (51 suites, `exit=0`, 334.3 s,
`sha256:6954daa63c627bfe8968b1221dadf58b2e6fcfdd8a562c39d3a7a51f6c49d556`), so the hosted red is **not
reproduced** here; it is carried as open item **G9** in §10, not explained away.
Hosted evidence: check-run API for `97d7d7c8d` (2026-11-23T08:07–08:10Z).

### 9.5 NOT proven in round 83

- `member.create` and `member.followup` have NO live S6 proof (production-port + router-detach arms
  only); only `member.send` was driven over the real API in the D2 world.
- `team.admitInitialWork` / `team.ensureRootLive` remain unavailable through this plane; no async
  root-work delivery seam exists and none was invented.
- The operator is the per-DSH_HOME authenticated human whose claim must be an owned root — not
  multi-user RBAC, and no user-level isolation is claimed.
- The model is the product's scripted mock; the delivery's timing is measured from durable fact
  timestamps, not from a real provider's scheduling.
- No PRODUCT-PROVEN row moves: every live claim here is DEV-LIVE.

### 9.6 What rounds 87–88 added to this section (and what they did not)

- **Round 87 (D4 probe, two agreeing boots):** a coherent v5 Alpha.6 world **boosts**, the Officer is up
  and its own binding admits its calls, and incoherent rows are refused by name — but the product's own
  durable ordinary ask is **case-less**, so `alpha6/root-router.ts:209` returns `null` and
  `d4:routed-wake` is **REFUTED**. Four judges PROVEN, one REFUTED; this adds no PRODUCT-PROVEN row.
- **Round 88 (BL-30 boundary):** the ask-consumer wire-up was attempted and **STOPPED** with the
  invariant measured over the real `ControlService`: the only production ask producer hard-codes
  `executionCoupling:'inline'` (`admission-port.mjs:163`), an inline durable allow is never a guard token
  (`control/service.ts:4155-4165`, `:4289`), and the one-shot grant is already spent at the host tool
  guard (`admission-port.mjs:770-784`). Two new arms in the seam's own suite (25/25 pass); **no product
  source was changed**. Consequence: a Member can ASK, be GRANTED, and still not run the granted call.
- **Neither round re-ran a boot for `member.create`/`followup` or the rc.5 pre-dispatch observer**, so
  those two gaps are unchanged (§10 G4/G5).


---

## 10. OPEN GAPS — the round-89 register (every still-open item, with the owner decision it needs)

This section is the authoritative open-gap list at `97d7d7c8d`. It **adds** the two round-87/88 seams to
the round-86 register (§6.14) and restates the older items so that no gap is discoverable only by reading
a cell. Nothing here is a TODO the engine may close by itself; each row that says **owner decision** is a
ruling, and the two seam rows are explicitly **not** upstream patches (`CORE PATCH BUDGET = 0`).

| id | open gap (measured, not inferred) | evidence (`file:line` / artefact) | what closes it |
| --- | --- | --- | --- |
| **G1** | **Alpha.6 has no case-bearing ordinary-ask producer (Team-side seam, NOT upstream).** `requestApprovalLeg` is only called for `envelope-mutation`; the ordinary `ask` lane does not call it and is explicitly excluded by `isDelegableOrdinaryToolAsk`, which needs `kind:'leader-approval'`, `reviewAuthority:'leader'`, an `operationFingerprint`, an `authorityScope` and a non-null `operationTool`. So the only live ordinary ask is **case-less**, `root-router.ts:209` returns `null`, and no wake intent is ever written. `d4:routed-wake` is **REFUTED** on two agreeing boots. | `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md` §4.2; `d4/runs/boot0{1,2}/control-row-durable.json` (no `approvalCaseId`/`legOrdinal`), `route-probe.json` (`null`, 0 member reads); `packages/runtime/alpha6/root-router.ts:209`; `packages/runtime/review-router/policy.ts:68-75`; `packages/runtime/src/plugin/vnext/admission-port.mjs:158-165` | **Owner decision R1** (below) — commission the Alpha.6-aware case-forming ask lane, or accept that the routed wake stays unproven this generation. **ROUND 93: R1 was ruled APPROVED and its PRODUCER IS LANDED** (`vnext/alpha6-ask-case.mjs`, five arms `ADM-149`…`ADM-153`, case through the EXISTING `requestApprovalLeg`). G1's *producer* half is therefore CLOSED; the LIVE routed wake is still REFUTED, now for a different and newly measured reason — see `G11` and §10.2  **ROUND 97 (2026-11-24) — G1 IS CLOSED IN FULL, LIVE.** The missing producer was wired in round 93 and the two blockers that kept the live routed wake REFUTED were removed in rounds 94 (G11 lane algebra) and 95/96 (R3 receipt). Round 97 booted the coherent v5 world twice (agreeing) and measured the WHOLE case path: `d4:case-created` (real durable case id + leg + frozen identity), `d4:router-officer` (the product router selects the unique lawful Officer; the self-ask control routes to the Leader), `d4:wake-delivered` (intent + correlated confirmation + machine attribution + ZERO management-plane executions), `d4:officer-decides` (the Officer is woken in its own session and its own `team_resolve_control` is admitted under its own binding), `d4:ask-executes-after-review` (the decision precedes the settlement and real bytes land), `d4:duplicate-route` (one wake for a duplicate route) and `d4:sticky-stop` (a machine wake does NOT clear a human Sticky Stop; only a human claim resumes). `d4:routed-wake` is PROVEN as their conjunction on two agreeing DEV-LIVE boots; the level is DEV-LIVE, not PRODUCT-PROVEN, because no executable gate binds it. Evidence: `d4/runs/boot0{1,2}/routed-judges.json` + `sticky-stop.json` + `duplicate-route.json`. |
| **G2** | **BL-30: no production consumer for an `ask`-disposition call, and it cannot be wired without an invariant change.** The only production ask producer hard-codes `executionCoupling:'inline'`; an inline durable allow is never a guard token (`guardOperation` `no-request`); the one-shot grant is already spent at the host tool guard before the Provider plane runs; and `resolveAskClassCall` has no production caller, so the confined provider refuses `IO_ASK_REQUIRES_APPROVAL`. **Consequence: a Member can ASK, be GRANTED, and still not run the granted call in production.** | `dev/agent-workflow/evidence/bl-30-ask-consumer/README.md` §1–§3; `packages/runtime/src/plugin/vnext/admission-port.mjs:76-79`, `:163`, `:770-784`; `packages/runtime/control/service.ts:4155-4165`, `:4289-4291`; `packages/runtime/member-io-policy/src/provider-capabilities.ts:196-210`, `:315`; `d4/runs/boot01/wake-measurement.json#workerWrite.result`; measured arms `packages/runtime/test/a5sf-approval-takeover.test.ts` (25/25) | **ROUND 94: R3 WAS PO C'd AND IS PROVEN FOR `write` ONLY** — see the round-94 addendum below and `ADR-approved-ask-receipt.md`. **ROUND 95: CLOSED FOR `write` IN A BOOTED PRODUCT** — the real mount now passes the real binder as the Provider's authority (`agent-bindings.mjs:1771-1790` → `a5sf-realm-row.mjs` → `mount.ts` → `install.ts`), and the D4 live driver proves ask → real Control allow → one-shot consume → receipt verified → real bytes on disk → `COMPLETED`, plus deny and Stop negatives. Every other tool/operation still refuses exactly as this row states, so the gap is narrowed to `write`/`writeText`. **ROUND 96: EXTENDED TO EVERY FS MUTATION** — the same receipt now covers `editText`/`patchText`/`deleteFile`/`moveFile` with per-method scope binding (see the round-96 addendum), proven by `ADM-162`…`ADM-173` and a second live mutation (`d4:ask-execute-2`). The **subprocess/PTY face is explicitly NOT covered** (its authority is an OS `SandboxExecutionPolicy`, not a file lane) and stays R4; `apply_patch` stays unbound. |
| **G3** | **PTC (`run_code`) is refused with `CORE_SEAM_BLOCKER` on the worker's OS profile.** Three of its four parts hold (nested calls, Control escalation, Stop); part (a) — the worker's OS confinement is not the member's compiled profile — needs a per-execution policy seam upstream, which this repo may not patch. | `PTC-FOUR-PART-FINDING.md`; `packages/runtime/src/plugin/vnext/admission.ts:421-423`; report §6.3 | upstream/owner acceptance of the `CORE_SEAM_BLOCKER` shape — not product work here |
| **G4** | **Two S6 root-work commands stay refused** on the management plane: `team.admitInitialWork`, `team.ensureRootLive`. No async enqueue-and-acknowledge root-work seam exists, and none was invented. | `packages/runtime/src/plugin/s6-command-classification.ts:111-112`; report §9.5; `d3:work-delivery` (landed=0 for root) | a new governed root-work delivery seam (product work) or an explicit owner ruling to keep them out of scope |
| **G5** | **The rc.5 pre-dispatch-abort observer is not wired into a booted production turn.** The rc.5 additions have mechanism arms and no production pre-dispatch wiring, so a Stop between admission and dispatch is not live-evidenced on rc.5. | `RC5-MIGRATION.md:492-504`; `packages/runtime/src/plugin/vnext/pre-dispatch-abort.mjs` (present, mechanism-only) | production wiring plus a live boot; owner ruling not needed, product work needed |
| **G6** | **No live evidence for `member.create` / `member.followup`.** Only `member.send` was driven through the real S6 API on two deterministic boots (plus production-port/router-detach arms for the other two). | report §9.3, §9.5; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` | extend the D2 driver's case set and re-boot (product instrumentation, no product semantic change) |
| **G7** | **Five ENV-LIMITED census arms are never counted as PASS.** Their guarantee is implemented and proven on a host that offers the physical capability; this runner does not (`unshare`/`CLONE_NEWUSER`), so the only admissible evidence here is the product's fail-closed refusal. | `ENV-LIMITED-CAPABILITY-20261123.md`; `CAPABILITY-MATRIX-C.md` round-82 section (`DSH-TEST-DISPATCH-ENV-LIMITED count=5 proven=0 env_blocks=3 fail_closed_controls=2`) | a runner/host that provisions the namespaces; not a product change |
| **G8** | **The operator is a per-DSH_HOME authenticated human, not RBAC.** Every management-plane claim is scoped to that operator; no multi-user isolation, no per-user authority, no tenant boundary is claimed. | `CAPABILITY-MATRIX-C.md` C-work row; report §6.2, §9.5 | owner decision on whether RBAC is in scope for a later stage |
| **G9** | **The model is the shipped scripted mock** (`packages/tools/harness/mock-deepseek.mjs`) in every live boot. Timing claims are measured from durable fact timestamps, not from a real provider's scheduling; no real-model interleaving is proven. | report §6.7; `CAPABILITY-MATRIX-C.md` round-63 section | a real-model live round; no owner ruling needed, a measurement is needed |
| **G10** | **Hosted CI is NOT all-green at `97d7d7c8d`.** `ci-integration` FAILED on leg `tinf-instruments`; its job log names no failing assertion and ends mid-line at `D17` with no `DSH-TEST-DISPATCH` token (abort), and the same leg is GREEN locally (51 suites, `exit=0`, 334.3 s). `ci-census` skipped (draft) and `ci-required` red for exactly `ci-integration:failure,ci-census:skipped`. | §9.4; run `45136105108`, jobs `137562782742` (integration) / `137563665337` (required); local `tinf-instruments` log in the round-89 session | a hosted re-run that reproduces or clears the abort; the cause is **unidentified**, and this report does not claim it is the census skip. **Round-89 update: at the next (docs-only) head `d1506acd1` the same hosted job set re-ran and `ci-integration` came back SUCCESS (2026-11-23T08:5xZ), so the `97d7d7c8d` failure was transient rather than a standing product red; `ci-required` still fails there for the draft `ci-census:skipped` layer only.** |
| **G11** | **A live v5 world cannot carry BOTH an ordinary `ask` and a trusted `ToolBinding` (Team-side seam, NOT upstream).** R1's case identity must freeze the ToolDefinition identity, which only a declared `toolBindings[]` entry provides; but the Alpha.5 binding-lane compiler's hard intersection (`compileEffectiveIo(ceiling, restriction, {approvedOnce:false})`) collapses ANY `ask` path to an EMPTY (deny) lane, so declaring the binding makes the tool deny-all and writes no control row at all. Measured over three declarations (ask+ask, allow+ask, allow+allow ⇒ only the last is non-empty) and live (`workerWrite.result` = `LANE_DENY … outside the tool's compiled fs.write lane`, `control-request-recorded` count 0). `authorization:'ask'` does not help: the `fs.read`/`fs.write` axes are judged on `perTool[tool].write`. **Consequence: `d4:routed-wake` stays REFUTED even with R1 landed.** | `dev/agent-workflow/evidence/ute-a1/ALPHA6-FORMAL-ROUTING.md` §R1-D; `dev/agent-workflow/evidence/d-boot-feasibility/d4/` (`--boots 1` and `--boots 2`, agreeing; failing clauses `row-carries-approval-case`, `product-router-selects-the-officer`, `wake-*`, `no-plain-c1-ask-to-the-leader`); `packages/runtime/team-services/src/product-assembly.ts:1302` (`compileEffectiveIo` with `approvedOnce:false`); `packages/runtime/src/plugin/vnext/admission.ts:481-520` (per-tool lane is the judge) | an owner ruling on WHICH representation is real: either the binding-lane compiler carries an unresolved `ask` (an Alpha.5 semantic change), or the centre projects a trusted ToolDefinition coordinate for an undeclared tool (the second authoring source R1's Q1 exists to prevent). **ROUND 94: G11 IS A LANE-ALGEBRA DEFECT AND IS FIXED.** `intersectPathRuleSets` required ask coverage by the intersection of the allow sets, collapsing a legal pure-ask lane; an ask now survives iff neither side is `deny` (it stays `ask`, never promoted), pinned by two arms in `a5sf-member-policy.test.ts`. The live boot was not re-run that round. **ROUND 95 re-ran it:** a booted v5 world now takes a pure-ask lane to a real durable Control request and, after the allow, executes the `write` through the R3 receipt; `d4:routed-wake` nevertheless stays REFUTED for its own reason (the ordinary ask row still carries no approval CASE, so the router selects no Officer — §10 G1). So G11's lane algebra is live-validated; G1's case identity is not. |

### 10.1 The four owner rulings the two new seams need

Neither seam is a `CORE_SEAM_BLOCKER`, and neither can be closed by re-enabling an ungoverned plane. The
four decisions are:

1. **R1 — Alpha.6 ask producer (G1).** Commission the Alpha.6-aware ordinary-ask lane: the admission `ask`
   path must open the durable request through `requestApprovalLeg` with `authorityScope`,
   `operationFingerprint` and `requestedEffect`, i.e. make an ordinary tool ask a first-class Alpha.6 case.
   *Cost:* a new admission ask shape; the current case-less `admission-ask` rows remain compatible.
   *Alternative:* rule that the live routed wake is out of scope for this generation and keep
   `d4:routed-wake` REFUTED as the disclosed state. Either way the report's level does not move.
2. **R2 — BL-30 route (a): flip the production ask coupling to `guarded`.** One approval would then have
   TWO one-shot paths (the binder grant and `guardOperation`'s `control-allow-consumed`) and a Stop would
   stop abandoning the pending ask (`ADM-57`, the round-62 live Stop arm), because `inlineAbortCascade`
   gates on `inline`. *Cost:* two authorities over one decision; a governance level change, stated openly.
3. **R3 — BL-30 route (d): let the OS/Provider plane read the ONE decision the centre already enforced.**
   The admission point publishes the resolved disposition it already writes into its `invocation-authority`
   fact (`decision: allow`, `laneDecision: ask`), and the confined provider narrows its ask on that
   decision only. *Cost:* a new cross-plane read port; the OS plane stops being an independent refusal and
   becomes a reader of the centre's decision (an admission-duty shape change).
4. **R4 — BL-30 status quo: keep the refusal.** Rule that an `ask`-disposition call does not execute in
   this generation, and carry `IO_ASK_REQUIRES_APPROVAL` as the intended level. *Cost:* none to safety;
   the capability stays at its honest "refused, no consumer" level, and BL-33's consumption half stays
   blocked.

Routes (b) (substitute a different `AskApprovalAuthority`) and (c) (mint a second guarded row) are **not**
offered as decisions: the product's own contract refuses both (`approval-takeover.ts:63-68`; "one call
site" / single consumer).

---

## 11. Corrections made in the round-89 pass

**19 claims were corrected or re-measured** (the instruction was to fix the claim, never the evidence; no
evidence file, test, skip or A0 artefact was edited). The worst five:

1. **`d4:routed-wake` was carried as "unproven" while the round-87 evidence says REFUTED.** Corrected in
   §2.2 C7, §6.14 (item 13), §7, §9.6 and §10 G1 — with the two named seams and the `root-router.ts:209`
   reason.
2. **The report implied a live grant could execute.** Round 88 measured that **a granted `ask` still cannot
   execute in production** (inline coupling; grant spent at the host guard; no consumer). Corrected in §2.2
   C5, §7 and §10 G2.
3. **The scope block was 5 commits stale**: 205→**210** commits, 3,377→**3,476** files,
   +241,087→**+249,967**, `2,548 A · 210 M`→**`2,646 A · 211 M`** (§1).
4. **Hosted CI was described as "six layer jobs green; red solely because the census is skipped."** At this
   HEAD `ci-integration` FAILED independently (`EB3-REQUIRED fail layers=6 green=4
   nongreen=ci-integration:failure,ci-census:skipped`), and the failure is not reproduced locally.
   Corrected in §9.4, §8 row 3 and §10 G10.
5. **`ci-pr-gate` and the census numbers were stale** (274.7 s→**275.7 s**; two same-HEAD runs: 275.7 / 285.5; census 599f/**7,414**l→
   **7,416**l from the round-88 arms; 10/10 unchanged, identity set unchanged) — §9.4.

The other corrections (documentation-only; not every one is a claim-level change): §1.1 closure line gains
`retiredSurfaces=12 placements=self`; §4's round-83 note no longer cites 206/204 and 29 placements; §4.2
gains the `by runner` line and §4/§9.4 gain the docs-sync block; §2.2 C5/C7 consequence text; §6.14
register renumbered 12→14 and pointed at §10; §7 adds the four round-87 PROVEN judges and one REFUTED;
§8 rows 1/3/4/5 re-stated for this HEAD; §9.5/§9.6 split; PR body HEAD/gate/limits blocks (the PR body's
own count is in its round-89 block); and the four
owner-decision items in `OWNER-DECISIONS.md` now carry the round-89 addendum.

---

## 12. Round 91 — the `d:remote-creation` red was a STALE JUDGE, not the product

**2026-11-23 · branch `vnext/a1-cut` · PR #822 (DRAFT) · head `b67a3eb38` + this round's repair ·
evidence `dev/agent-workflow/evidence/ute-a1/round91/`.**

The round-90 red (`run-boot.mjs --boots 1` → `5 PASS / 1 FAIL`, `d:remote-creation`) was reproduced with
the real driver on the unmodified tree, diagnosed to its clause, and repaired at the instrument layer.
No product byte changed; no timeout, retry, skip or assertion was widened.

### 12.1 Reproduction and failing assertion

`node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2` → `RESULT FAIL (2/2 boots;
agreeing pair=true)`, both boots on **port 3194**, with exactly one failing clause in the case's own
record:

```
no-execution-without-admission: member.send ok=undefined code=undefined provider requests added=0
```

while the same boot measured `team.create` 200 / `path:"fresh-root"`, the runtime root
`session-dboot-read-team`, duplicate no-second-Team, and this refusal sample:

```json
{"rootWork":{"status":200,"code":"ADMISSION_REMOTE_UNAVAILABLE","ok":false},
 "rootLive":{"status":200,"code":"ADMISSION_REMOTE_UNAVAILABLE","ok":false},
 "delivery":{"status":200,"code":"TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED","ok":false,"servedNotRefused":true},
 "mockRequestsAdded":0}
```

### 12.2 Mechanism (proved, not inferred)

Round 83 (`5c09cbd82`) reclassified `member.send` as `work-delivery` and changed the driver's sample
from `{status, code, ok, mockRequestsAdded}` to `{rootWork, rootLive, delivery, mockRequestsAdded}`. The
`no-execution-without-admission` clause kept reading `execution.ok` / `execution.code`; both are
`undefined` on the new shape, so `ok === false` is false and the clause **cannot pass regardless of the
product**. Same clause id, three runs:

| evidence | sample | clause | verdict |
| --- | --- | --- | --- |
| `d-boot-feasibility/archive/2026-11-22T14-50-21-474Z` (pre-`5c09cbd82`) | flat `{ok:false, code:"ADMISSION_REMOTE_UNAVAILABLE"}` | true | **PASS** |
| `archive/2026-11-23T09-54-52-433Z` (this head, pre-fix) | nested `{rootWork, rootLive, delivery}` | false (`undefined`) | **FAIL** |
| `d-boot-feasibility/runs/boot0{1,2}` (this head, post-fix) | identical nested sample | true (see §12.3) | **PASS** |

`bde902939` (round 90) touched no driver source; the round-90 before/after pair recorded the same FAIL
both times. The defect predates round 90 and was exposed by it.

### 12.3 The four suspects, settled

- **(a) D4 port/home collision — REFUTED.** `HOST_PORT_BANDS` is one global legacy band (`3181-3199`);
  the probe declares no band (its README's "port 3194/3195" is an observation of leased ports). The
  decisive fact: **the same port 3194** produced FAIL before the repair and PASS after it, 2/2 boots
  each, with the same product answer; the created Team's `defaultWorkspace` is this boot's own
  `tests/homes/u5u5a5sfdev1-…` home, so the request reached this world's host. Homes are guarded
  against same-second collisions by `world-factory.mjs`'s bounded stamp bump.
- **(b) Round-90 decomposition — REFUTED.** No driver source in `bde902939`; verdicts identical
  before/after by that round's own pair.
- **(c) Product regression 83–89 — REFUTED.** The product answer in the FAIL and PASS runs is identical
  and is exactly round 83's contract (two ROOT commands refused, delivery served typed with zero
  provider requests, `team.create` 200 + runtime root).
- **(d) Driver sequencing flake — REFUTED.** Deterministic 2/2 identical before and after; the failing
  value is a shape lookup, not a timing measurement.

### 12.4 The repair

`judgeRemoteCreation()` now judges the measured shape, keeping the clause id and **adding** conditions:
both ROOT commands `ok:false` + `ADMISSION_REMOTE_UNAVAILABLE`; the delivery command HTTP 200, served
(`servedNotRefused`), `ok:false` with a typed non-empty code that is not the execution refusal; and
`mockRequestsAdded === 0`. This is strictly stronger than the old single-command clause. Proposition text
now states the round-83 delivery law. Driver: `tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs`.

### 12.5 Four live drivers, rc.2, this head (after the repair)

| driver | command | boots | judges | overall |
| --- | --- | --- | --- | --- |
| `run-boot.mjs` | `--boots 2` | 2, agreeing (`differing=[]`) | `d:member-read-admitted`, `d:member-read-denied`, `d:native-read-surface`, `d:guard-facts`, `d:centre-facts`, **`d:remote-creation`** = **PASS (6/6)** | **PASS**, exit 0 |
| `run-boot-d2.mjs` | `--boots 2` | 2, agreeing | `d2:multi-member-concurrency`, `d2:revocation`, `d2:stop`, `d2:remote-delivery` = **PASS (4/4)** | **PASS**, exit 0 |
| `run-boot-d3.mjs` | `--boots 2` | 2, agreeing | `d3:persistent-subprocess`, `d3:crash-cold-recovery`, `d3:work-delivery`, `d3:alpha6` = **PASS (4/4)** | `evidence-complete=true allProven=true`, exit 0 |
| `probe-d4-routed-wake.mjs` | `--boots 1` | 1 | `d4:enablement`, `d4:officer-up`, `d4:officer-binding`, `d4:refusal` = **PASS**; `d4:routed-wake` = **FAIL (REFUTED)** | **BLOCKED** (known open gap, §10 G1), exit 3 |

All four boots of the three acceptance drivers leased port 3194 and used distinct homes. Logs:
`round91/after-run-boot.log`, `after-run-boot-d2.log`, `after-run-boot-d3.log`, `after-probe-d4.log`;
the `d:remote-creation` clause in both boots reads
`rootWork ok=false code=ADMISSION_REMOTE_UNAVAILABLE; rootLive ok=false code=ADMISSION_REMOTE_UNAVAILABLE;
delivery status=200 ok=false code=TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED servedNotRefused=true; provider
requests added=0`.

### 12.6 Gates at this head

```
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
  (DISCOVERED_AND_COLLECTED 733 / EXCLUDED_WITH_REASON 14 / UNCOLLECTED 38; bounds --max-uncollected 41 --max-excluded 7)
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (34 placement(s))   — every line (byte-identical)
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
node --test (UTE G1 nine-file argv): tests 89 / pass 89 / fail 0 / skipped 0, exit 0
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
  tests 211 / pass 209 / fail 0 / skipped 2

ci-pr-gate --full --census-captures 2:
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=282.9
  census: captured 599f/7416l, 599f/7416l vs baseline-declared 626 / 7936 — 2 captures, identical identity sets — COUNTS MOVED, SET DID NOT
```

### 12.7 What this does NOT prove

The row is still a scripted-mock, per-DSH_HOME-operator measurement (round 74/83 scope); the judge's
`delivery.ok:false` is specific to this probe addressing a member that does not exist; `d4:routed-wake`
stays REFUTED (§10 G1/G2) and was not "fixed"; no capability row moves, no C row becomes PRODUCT-PROVEN.
The claim is about the acceptance instrument and the measured product answer, not about new product
behaviour.

### 10.2 ROUND 93 — R1 landed: what it closed, what it opened, and the exact live state

The owner ruled **R1 = APPROVED** (review `20261124-0151` §1) with three prohibitions that shaped the
implementation: use the EXISTING `requestApprovalLeg`, add NO new ask producer and NO new UTE I/O axis;
convert only asks that qualify, so a non-qualifying ask keeps the lawful Leader/Human path; and never
fabricate a missing Operation Tool or Authority Scope to make the router answer.

**Closed — G1's producer half.** `packages/runtime/src/plugin/vnext/alpha6-ask-case.mjs` implements the
CLOSED rule `ALPHA6-ORDINARY-CASE-Q` (enabled · Q1 declared ToolBinding · Q2 canonical operation identity ·
Q3 Leader rung · Q4 the shared delegable predicate) and `admission-port.mjs` opens the durable leg through
`ControlService.requestApprovalLeg` **only** for a qualifying ask. A qualification failure is not an error:
it returns to the byte-identical plain `requestControl` path. An ask that qualified but whose required
identity member cannot be sourced is a TYPED refusal naming the field
(`ADMISSION_ALPHA6_CASE_IDENTITY_INCOMPLETE`) and writes nothing. No identity member has a default.
Five arms pin it over the real ports (`ADM-149` case · `ADM-150` router selects the Officer + round-84
governed wake · `ADM-151` non-qualifying ask keeps the plain path · `ADM-152` typed refusal, zero rows ·
`ADM-153` no self-review).

**Opened — G11, measured.** The live `d4:routed-wake` judge is still **REFUTED**, and the judge was
AMENDED (disclosed in the clauses) from asserting the defect to asserting the requirement. The measured
cause is not R1: a live v5 world can carry the ordinary `ask` (a Member ceiling lane, no ToolBinding) OR a
trusted `ToolBinding` (a declared `toolBindings[]` entry), but not both, because the Alpha.5 binding-lane
compiler collapses an `ask` path to an empty deny lane. R1's Q1 therefore refuses the production-shaped
ask (correctly), and the declared-binding world produces no ask at all (`LANE_DENY`). The two agreeing
boots report the case-less row, `route() === null`, zero wake facts / intent files, an unwoken Officer and
the plain C1 ask at the Leader.

**Still out of scope, unchanged.** `R3`/`G2` (BL-30): after an allow the provider still refuses an
`ask`-disposition call (`IO_ASK_REQUIRES_APPROVAL`), so the granted call cannot execute. The in-process
arms prove the CASE and the ROUTE, never an executed body, and the capability matrix says exactly that
(C-alpha6 stays **MECHANISM**).

---

## ROUND 94 ADDENDUM (2026-11-24) — R3 PoC: the `ask → grant → execute` chain is PROVEN for `write` at mechanism level

**The ADR.** `dev/agent-workflow/evidence/ute-a1/ADR-approved-ask-receipt.md` records the ONE new
record (the ApprovedAskReceipt), its binding fields, its lifetime, who mints and who reads, why the
model cannot forge it, why it cannot leak across Members/calls/async tasks, the rejected alternatives
(`guarded` coupling, global callId map, attribution-ALS reuse) and its failure modes.

**The PoC.** Eight arms, `ADM-154`…`ADM-161`, in `packages/runtime/test/vnext-admission.test.mjs`, over
the REAL confined `fs` Provider (`createMemberFsGuard` + `createConfinedFileSystemClass` over the host's
`LocalFileSystem`), the REAL invocation binder, the REAL durable `ControlService`, the REAL admission
port and the REAL settlement store. Only the host loop is a double (it supplies the pinned order
`pre-execute → guard → execute → result`; same precedent as `ADM-19/20`). Results:

| arm | claim | result |
| --- | --- | --- |
| ADM-154 | `ask` disposition → inline durable `allow` → grant consumed → receipt minted → the REAL Provider writes the file; scope is the body's own; settlement `COMPLETED` | **PASS** |
| ADM-155 | a second Provider effect in the same body is `RECEIPT_REUSED`; a new execution with the same callId is refused `ADMISSION_REPLAY` before the body | **PASS** |
| ADM-156 | a receipt for path A cannot authorize path B (both in the ask class) — `RECEIPT_OPERATION_MISMATCH` | **PASS** |
| ADM-157 | revocation after the grant is consumed but before the Provider call — `RECEIPT_REVOKED`, zero bytes | **PASS** |
| ADM-158 | after the body the scope is gone; a captured receipt cannot reopen (`RECEIPT_CLOSED`) | **PASS** |
| ADM-159 | `deny` wins over a live unused receipt (`IO_WRITE_DENIED`, before any receipt consult) | **PASS** |
| ADM-160 | Provider refusal after body entry settles `FAILED` / `quiesced` / `failed` — never `REFUSED` / `not-started` | **PASS** |
| ADM-161 | another Member's Provider in the same async body cannot read A's receipt — `RECEIPT_MEMBER_MISMATCH` | **PASS** |

**G11 fixed as a defect.** The collapse was in `intersectPathRuleSets`' ask-survival algebra, not in
`approvedOnce` (which the compiler never reads). The rule is now: an `ask` survives iff neither the
Member lane nor the tool restriction answers `deny` for that locator; the result stays `ask` and is
never promoted to `allow`. A pure-ask lane + a non-disjoint tool allow now compiles to
`{allow:[], ask:[p]}` and reaches the Control plane; a disjoint tool allow still yields no ask coverage.
Pinned by two new arms in `packages/runtime/test/a5sf-member-policy.test.ts` (19/19).

**What this does NOT prove.** (a) No live v5 boot was re-run, so `d4:routed-wake` remains REFUTED and
C-alpha6 remains MECHANISM. (b) Production wiring of the Provider authority was absent at that HEAD (the real mount
called `createMemberFsGuard(policy)` with no third argument, so a product turn still failed closed) —
**SUPERSEDED by the round-95 addendum below.** (c) Only `write` (`writeText`) is covered; `editText`/`patchText`/`deleteFile`/
`moveFile`, subprocess and the other faces still refuse `IO_ASK_REQUIRES_APPROVAL`. (d) The receipt
carries `caseId:null` for an inline admission request — it binds the durable request/decision
identity it actually has, not an Alpha.6 case it never had. G2/BL-30 is therefore **narrowed, not
closed**: proven for one operation at mechanism level; every other consumer remains at R4.

---

## ROUND 95 ADDENDUM (2026-11-24) — R3 IS WIRED INTO THE PRODUCTION MOUNT AND PROVEN LIVE FOR `write`

**What changed in the product (no invariant moved).**

| location | change |
| --- | --- |
| `packages/runtime/src/plugin/vnext/agent-bindings.mjs:1771-1790` | the member-realm mount receives `approvedAskAuthority: { binder: grantBinder }` **only when** the row's Control service is wired (`grants !== undefined`). Same binder the one-shot grant is spent through; it mints nothing and adds no allow source. |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:835,968` | forwards the authority into the mount input when supplied. |
| `packages/runtime/team-services/src/mount.ts:796,896,965` | `MountA5sfRealmInput.approvedAskAuthority`; forwarded to both provider installers, omitted when absent. |
| `packages/runtime/team-services/src/install.ts:104,513,880` | `createMemberFsGuard(policy, undefined, authority)` on the MEMBER face and the BINDING-REALM face; terminal faces unchanged. A row without Control keeps the byte-identical fail-closed mount. |
| `packages/runtime/team-services/src/guard-observability.ts:280-305` | the observer wrapper forwards the optional `FsGuardOperation` verbatim (it had dropped `writeText`'s content, so a governed realm refused a valid receipt with `RECEIPT_CONTENT_UNAVAILABLE`). No decision changes. |

**Frozen invariants that were checked and did NOT move:** `deny` is still decided before any receipt
consult; the ask lane is still `ask` (never promoted); the bounds snapshot is the compiler's own
`perEffective` read/write; there is no `guarded` coupling, no global callId map, no reuse of the
attribution ALS, no second authority, no admission-duty expansion, no upstream patch, no widened
timeout/retry, and the scripted model is still the only double.

**New regression arms** in `packages/runtime/test/a5sf-service-install.test.ts` (`R3 production
wiring: the mount passes the invocation binder`): with authority ⇒ the real confined provider writes
the bytes; without authority ⇒ `IO_ASK_RECEIPT_REFUSED` / `RECEIPT_AUTHORITY_UNAVAILABLE`, ENOENT;
outside the execution scope ⇒ `RECEIPT_NOT_IN_SCOPE`, ENOENT. Plus `observeGuard` operation
forwarding. File `20/20`.

**LIVE PROOF — `probe-d4-routed-wake.mjs --boots 2` (DEV-LIVE, booted rc.2 host, scripted model
only; every judge below is the probe's own, none weakened).** Target lives INSIDE the Member's own
workspace (the host sandbox root), so the measured effect is the lane/receipt, never a sandbox
accident.

| judge | rounds | result |
| --- | --- | --- |
| `d4:ask-execute` | 2/2 | **PROVEN** — real durable Control request for the Member's `write` (lane `ask`), Leader allow through the real control path, one-shot grant consumed once, receipt verified for THAT execution, **27 real bytes** written at the approved path (`sha256` recorded), execution fact `allow/ask`, settlement `COMPLETED` |
| `d4:ask-denied` | 2/2 | **PROVEN** — approval denied ⇒ Provider never entered, file absent (0 bytes), settlement `REFUSED` / `not-started`, no receipt |
| `d4:ask-stopped` | 2/2 | **PROVEN** — Stop through the public `session/cancel` while the ask is pending ⇒ file absent (0 bytes), settlement `REFUSED` / `not-started` |
| `d4:enablement`, `d4:officer-up`, `d4:officer-binding`, `d4:refusal` | 2/2 | PROVEN (unchanged) |
| `d4:routed-wake` | 2/2 | **REFUTED, deliberately unchanged** — the ordinary ask still carries no approval CASE, so the product router selects no Officer wake. R3 did not touch this and must not be read as routing evidence. |

**Not proven / not claimed.** (1) `editText`/`patchText`/`deleteFile`/`moveFile`, subprocess
and every other face still refuse `IO_ASK_REQUIRES_APPROVAL`; R3 covers `write`/`writeText` only.
(2) No capability row is PRODUCT-PROVEN: the D4 evidence is a `DEV-LIVE` record, not a gate.
(3) Alpha.6 routing (`d4:routed-wake`, G1) stays REFUTED. (4) The receipt binds `caseId:null` for an
inline admission request. (5) The live run uses the scripted model; no real-model interleaving was
measured.

---

## ROUND 96 ADDENDUM (2026-11-24) — the SAME receipt extended to `editText` / `patchText` / `deleteFile` / `moveFile`

**Owner ruling and its limit.** Extend R3 method by method, each with its own proof; do NOT assume an
OS-sandbox approval path inherits the FS proof. Round 96 therefore covers every FS mutation the
Provider exposes and **deliberately does not touch subprocess/PTY**.

**What changed in the product (no invariant moved).**

| location | change |
| --- | --- |
| `packages/runtime/member-io-policy/src/approved-ask-receipt.ts` | schema `/2`: the operation is a discriminated union — `fs-write` (target + content `sha256`), `fs-edit` (target + the requested `(oldString,newString,replaceAll)` + `editSha256`), `fs-patch` (target + the exact `PatchHunk[]` payload `sha256`), `fs-delete` (target only, `bytesReadBack:false`), `fs-move` (**source AND destination**, authored + canonical). `prepareApprovedFsOperation` prepares the five declared tool shapes; the verifier requires an exact method↔kind match first, then per-path deny/resolve/bounds/canonical checks. |
| `packages/runtime/team-services/src/fs.ts` | `moveFile` is ONE guard over the path PAIR (deny on either path wins; ONE receipt verification; read-before-mutate for the source and an existing destination). `editText` forwards the literal triple, `patchText` the hunks; the ask branch now covers every write method rather than `writeText` only. |
| `packages/runtime/src/plugin/vnext/admission-port.mjs` | the centre prepares the five shapes; a name outside the table mints NO receipt (the Provider keeps R4), a recognised-but-malformed call is refused at admission. |
| `packages/runtime/src/plugin/vnext/admission.ts` | `delete_file` / `move_file` / `patch_text` are DECLARED names on the SAME `fs.write` axis as `write`/`edit` (one existing duty, no new one). Naming them creates no tool: no preset mounts them, and rc.5's multi-file `apply_patch` is deliberately NOT in the table (stays unbound / R4). |

**Frozen invariants checked and NOT moved:** `deny` is decided before any receipt consult on every
path (including both move paths); the lane stays `ask` and is never promoted; the bounds snapshot is
still the compiler's own; the receipt is still single-use and execution-scoped; no `guarded`
coupling, no global callId map, no attribution-ALS reuse, no second authority, no upstream patch, no
widened timeout/retry; the scripted model is still the only double.

**Regression arms** — `ADM-162`…`ADM-173` over the REAL confined Provider (rc.2 for `editText`,
rc.5 for the other three), real binder, real `ControlService`, real settlement store: four positives
with the bytes (or absence) verified and `COMPLETED` settlements, and eight negatives (content/payload
binding refused with zero bytes at the body phase, cross-operation, cross-path, revoked + reuse,
(a→b) vs (a→c), deny-wins on the move destination, and a non-mutation approval that mints no
receipt). File `156 tests / 155 pass / 1 skipped / 0 fail` (the admission suite's own count).

**LIVE PROOF — `probe-d4-routed-wake.mjs --boots 2` (DEV-LIVE, booted rc.2 host, scripted model
only; every existing judge unchanged).** The probe now performs a SECOND real mutation — a second
`write` on a different path with different bytes and its OWN durable Control request.

| judge | rounds | result |
| --- | --- | --- |
| `d4:ask-execute` | 2/2 | **PROVEN** — 27 real bytes, `sha256:ced10112…`, `COMPLETED` |
| `d4:ask-execute-2` | 2/2 | **PROVEN** — new durable request `ctrl-1u9ufbv1rss8va1kc1szx1d5`, real Leader allow, 29 real bytes at the second path, `sha256:2d71ffdd…`, the FIRST file byte-identical, the two digests different, `COMPLETED` |
| `d4:ask-denied`, `d4:ask-stopped` | 2/2 | **PROVEN** — 0 bytes, `REFUSED` / `not-started` |
| `d4:enablement`, `d4:officer-up`, `d4:officer-binding`, `d4:refusal` | 2/2 | PROVEN (unchanged) |
| `d4:routed-wake` | 2/2 | **REFUTED, deliberately unchanged** — same eight failing clauses; a receipt is never routing evidence |

Two-boot agreement `agreeing=true`, `differing=[]`.

**G2/BL-30 status after round 96.** The gap is now closed for **every FS mutation** at mechanism level
and for **two mutations live** (`write`, and a second distinct `write` proving content binding). It is
NOT closed globally: the **subprocess/PTY** face still refuses (R4) and is the next owner-ruled step,
and `apply_patch` remains unbound.

**Not proven / not claimed.** (1) Subprocess/PTY — no receipt, no proof, R4. (2) `apply_patch` — stays
unbound. (3) The four new methods' tool names are declared shapes, not shipped tools, so they are
proven at the production composition point, not through a live model. (4) No row is PRODUCT-PROVEN.
(5) Real-model interleaving remains unmeasured.

## ROUND 97 ADDENDUM (2026-11-24) — the routed review wake is PROVEN LIVE end to end

Round 95 wired the R3 receipt into the production mount; round 96 extended it to every FS mutation.
Neither touched the Alpha.6 CASE path, which stayed REFUTED at its last live measurement. Round 97
re-ran the D4 driver on a booted rc.2 host with a world that satisfies the closed qualification rule
`ALPHA6-ORDINARY-CASE-Q` in ONE coherent row (declared `toolBindings[]` entry with `authorization:'ask'`,
the pure-ask lane surviving the round-94 algebra, `reviewRouting.enabled` + `default:'officer'` + `hold`).

**Two agreeing DEV-LIVE boots; `d4:routed-wake` = PROVEN as seven independent judges (40 clauses).**

1. **`d4:case-created` (9 clauses).** The worker's `write` produced a durable `control-request-recorded`
   carrying `approvalCaseId case-0dotsl405xthlb0lqsqo21tg`, `legOrdinal 1`, rung `leader`, a frozen
   `operationFingerprint`, the exact `authorityScope` for the target path, coordinate `dsh.fs/write`,
   blueprint hash/revision and `authorityGeneration 0` — read back from `storages/team_domain.json`.
2. **`d4:router-officer` (4 clauses).** The product's own `createAlpha6RootRouter.route()` on that row
   selects `inst-1crltnl0089j` `routeRole:'officer'`; exactly one active officer candidate exists; the
   requester is not the reviewer; and the SELF-ASK control (same durable row, operation owner set to the
   Officer) routes to the **Leader** with the product's own reason string. Self-review is refused.
3. **`d4:wake-delivered` (6 clauses).** Exactly one `team-review-wake-routed` intent for the leg, one
   `team-review-wake-delivered` confirmation correlated by `factSequence`, the input that landed in the
   Officer's session is machine-attributed (`source.kind = plugin:dsh-agent-team`, never `user`), and no
   settlement names the wake token — the management plane executed **zero** tools.
4. **`d4:officer-decides` (5 clauses).** The Officer is woken in ITS OWN child session; its
   `team_resolve_control` for the exact `requestId` is admitted under ITS binding (a durable
   `invocation-authority` allow for its callId and instanceId in its centre ledger); its settlement is
   `COMPLETED`; the Leader never resolved the leg.
5. **`d4:ask-executes-after-review` (6 clauses).** The durable decision precedes the tool settlement; the
   worker's result is not an error; the approved bytes are on the host filesystem (`27 bytes`,
   `sha256:ced10112…`); the admission allow is on the `ask` lane; settlement `COMPLETED`/`completed`.
6. **`d4:duplicate-route` (5 clauses).** The second leg was routed by BOTH real route call sites (the
   request-creation notifier and the reviewer turn/end re-collection) while still pending; exactly ONE
   intent, ONE confirmation and ONE model-visible input exist. A duplicate route produces one wake.
7. **`d4:sticky-stop` (5 clauses).** A real human `session/cancel` of a running Officer turn wrote the
   Sticky Stop marker (`stopped-20765e07.json`). A third worker ask was then admitted and routed; the
   marker survived the machine attempt, **zero** wake inputs reached the stopped Officer, and the delivery
   was refused. An explicit HUMAN prompt cleared the marker; the held wake was delivered and the third
   `write` executed (`COMPLETED`, 29 bytes). Machine wake ≠ human resume.

**The eight pre-existing judges are unchanged and still PROVEN** (`d4:enablement`, `d4:officer-up`,
`d4:officer-binding`, `d4:refusal`, `d4:ask-execute`, `d4:ask-execute-2`, `d4:ask-denied`,
`d4:ask-stopped`), including the two negative live arms (deny → zero bytes, `REFUSED`/`not-started`;
Stop-while-pending → `ADMISSION_STOPPED`, zero bytes).

**Level.** `C-alpha6` moves to **DEV-LIVE**. It cannot be PRODUCT-PROVEN: this repository reserves
`V@B=yes` for a capability exercised by a bound executable gate, and the D4 probe is a driver with its
own evidence contract, not that gate. No gate was invented; the level is capped honestly.

**Not proven / still open.** Only `write`/`writeText` carry the live R3 receipt (the other FS mutations
are mechanism-level; subprocess/PTY and `apply_patch` refuse at R4). The model is scripted. The
duplicate-route attempt itself leaves no durable fact — the judge proves convergence (one wake), and
records the two product call sites that produced the attempt. No production code changed in round 97.

## ROUND 99 ADDENDUM (2026-11-24) — G2 reaches the PROCESS face: MECHANISM proven, LIVE leg blocked by a named assembly gap

Owner ruling: extend the SAME `ApprovedAskReceipt` to the process face (persistent `bash` / governed
shell with disposition `ask`), as a distinct operation kind `process-exec`, and do NOT assume an
OS-sandbox approval inherits the FS proof.

**Per-face status of G2/BL-30 after this round**

| face | ask→? | what is proven | level |
| --- | --- | --- | --- |
| FS (`write`/`writeText`) | executes | round 95 live chain (real ask → real allow → consume → receipt → real bytes → `COMPLETED`), unchanged this round | **DEV-LIVE** |
| FS (`edit`/`patch_text`/`delete_file`/`move_file`) | executes | round 96 mechanism arms over the real Provider/binder/Control/settlement | **MECHANISM** |
| **process — confined subprocess face** | spawns under the receipt, no new capability | `ADM-174`…`ADM-179`: real provider over the landlock launcher; receipt bound to tool + compiled `executionBoundary` + `implementationOrigin` + fixed shell class + `commandSha256`; verified BEFORE the provider call; cross-execution/cross-face/reuse refused; out-of-lane write refused by the OS with the request's `allowPaths` byte-identical to the lane-compiled profile; `danger-full-access` still clamps to at most `workspace-write`; deny wins; revocation; command mismatch refused pre-spawn; post-spawn kernel denial settles by its real phase | **MECHANISM** |
| **process — governed persistent PTY** | verification wired at the spawn point | the same `process-exec` verifier runs in `createGovernedPtyTerminalFace.spawn` before `raw.spawn`; it verifies everything except `commandSha256` (the shell precedes any command text — disclosed in the ADR) | **MECHANISM** |
| **process — LIVE (booted rc.2)** | **BLOCKED** | `d4:ask-execute-process`: the REAL ask, the REAL Alpha.6 case routing, the REAL Officer allow and the REAL grant consumption all happen; the persistent `bash` tool then reports `no PTY backend registered for "a5sf-governed-shell"` from its OWN backend lookup, BEFORE the governed PTY `spawn` — so the receipt verifier is never reached on a boot. Zero bytes, no process, settlement `FAILED`: fail-closed. | **REFUTED (named gap)** |

**Why the live gap is not a receipt defect, and not papered over.** The same governed PTY face mounts
and serves in the v4 D3 world (`d3:persistent-subprocess`, PROVEN live in round 76); the difference on
this boot is the composition/activation path of a v5 per-tool `bash` binding, not any receipt rule.
Two world-shape hypotheses were MEASURED and are recorded as failures rather than worked around:
`a5sfNativeToolModules: []` breaks Member activation (the Officer never comes up), and a ceiling that
asks for a subtree while allowing an enclosing root is not expressible (the Member never activates).
No assertion was weakened and no timeout widened to make the live cell look green.

**The final pair (`--boots 2`).** `allBooted=true`, `evidence-complete=true`, `agreeing=true
differing=[]`; thirteen named judges PROVEN on both boots and ONE REFUTED (`d4:ask-execute-process`).
Its counters are identical on both boots and are the whole claim: in-lane bytes `null`, out-of-lane
existence `false`, settlement `FAILED` — no process, no bytes, nothing widened.

**G2 statement, exact:** closed live for `write`/`writeText`; proven at mechanism level for the other
four FS mutations and for BOTH process faces (spawn-point verification, all negatives); the live
process leg is BLOCKED by the named assembly gap and is the next owner-ruled step. `apply_patch`
remains unbound (R4). No row is PRODUCT-PROVEN.
