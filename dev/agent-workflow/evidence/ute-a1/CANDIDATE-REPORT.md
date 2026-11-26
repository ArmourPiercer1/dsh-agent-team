# CANDIDATE REPORT — UTE vNext A1 cut + ONE centre (PR #822, DRAFT)

**This is the one document a reviewer reads first.** It states the current truth of the candidate: what it
claims, what is measured, what is NOT measured, and what the owner must decide. It supersedes the *prose* of
`D-ACCEPTANCE-REPORT.md` (which stays as the append-only chronological record; its round sections are
historical where they disagree with this file) and it does not replace `C1-C18-SIGNOFF.md`, which is the
itemised per-contract-row sign-off this file summarises.

**Round 117, 2026-11-25.** Every number below was measured in `.worktrees/vnext-a1-cut` at the HEAD named in
§1 and is traceable to a named log or artifact. Where a claim is not measured, it says so. **Round 117's
change is a CONTRACT change, not a measurement**: the owner ruled that the Candidate Acceptance Gate is a
**VERSION gate** (required at a frozen candidate SHA, never a per-PR required context), so the definition of
`PRODUCT-PROVEN` changed — §1.1 states it, `VERSION-GATE.md` is the operational procedure, and every document
that defines or consumes the term now points at that one definition.

---

## 1. Identity

| field | value | how to check |
| --- | --- | --- |
| branch | `vnext/a1-cut` | `git rev-parse --abbrev-ref HEAD` |
| **HEAD measured** | **`818eae405e13d02786398e336dc605039a148e72`** (base of the round-117 commit set; the round-117 documentation head is its child and is named in the settlement comment) | `git log -1` → `818eae405 docs(evidence): round-116 — fold the newest numbers into the acceptance status table` |
| base | `master @ a19d1df01` (frozen A0, PR #821) | `git merge-base --is-ancestor HEAD origin/master` → false; `origin/master` = `a19d1df01` |
| PR | **#822 — DRAFT (unmerged)** | `gh pr view 822 --json isDraft,state,baseRefName,headRefOid,autoMergeRequest` → `{"autoMergeRequest":null,"baseRefName":"master","isDraft":true,"state":"OPEN","headRefOid":"5cb5c606203eaf07dd78a2a5c67b442899db2377"}` |
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
PRODUCT-PROVEN, no version has been frozen and no version gate has been run as a version gate, and the model
in every boot is a scripted mock (§8).

---

## 1.1 The Candidate Acceptance Gate is a VERSION gate — and the `PRODUCT-PROVEN` definition in force

**Owner ruling, 2026-11-25** (recorded as DECIDED in `OWNER-DECISIONS.md` §"ROUND 117"). The Candidate
Acceptance Gate is a **version gate**, not a per-PR gate:

- it is **NOT required on ordinary PRs** — an every-PR dual-host run is a measured **~84 minutes / 16 real
  host boots** (round 109: `83 m 48 s`), a 10x slowdown of the daily loop for no added value on docs/script
  PRs;
- it **IS the formal gate for a candidate/release version**: it must run, be green, and be **Required** at
  the **frozen candidate SHA** before a version is declared deliverable;
- the rejected alternative is **"required on every PR"** (rejected for that cost/relevance trade-off; it is
  recorded as the rejected option, not as an oversight).

**`PRODUCT-PROVEN` — the single definition now in force, and the only one any document in this tree may use:**

> A capability row is **PRODUCT-PROVEN** only when a candidate/release **version** has been frozen: the
> version gate ran at the **frozen candidate SHA**, is **green** there, its `version-gate-receipt.json`
> verifies (head == frozen SHA, verdict `pass`, `envLimited` 0, known-refuted set exactly the enumerated
> one), **and** the `version-gate` context is **Required** by the release branch/tag protection rule.
> It is **NOT** "covered by every PR's Required CI".

**No row is PRODUCT-PROVEN today**, and no row becomes so until such a version gate is frozen, Required and
green at that SHA.

**ROUND 118 vocabulary (owner ruling 2026-11-25, `OWNER-DECISIONS.md` §"ROUND 118").** Two words, two
facts, never interchangeable: **`CANDIDATE-ACCEPTED`** = the row's deterministic acceptance evidence ran on
**both** pinned hosts in one candidate round, with the selected generation proven per run
(`HOST-VERSION-GUARD host=<mode> resolved=<version> pin=<version>`) and a classified result on each;
**`PRODUCT-PROVEN`** = the frozen-version fact above. `CANDIDATE-ACCEPTED` is a precondition for the freeze,
not a substitute. Model-behaviour rows need a real-model run at the pin to reach `CANDIDATE-ACCEPTED`; that
run is a later round and is not started. **No row is PRODUCT-PROVEN.**

The mechanism (`version-gate-receipt.json` schema, the typed verifier, the exact
branch/tag ruleset the owner must apply, and the freeze procedure) is **`VERSION-GATE.md`**; the workflow is
`.github/workflows/candidate-acceptance.yml`, and `scripts/eb3-ci-required.mjs` **asserts** the manifest's
version-gate classification so it cannot be promoted into a required layer or stripped of its meaning.

**Coverage, so nobody infers blanket coverage.** The gate grades **31 judges per host** (62 per dual-host
run). Those judges can speak to **C2, C3, C5, C6, C8, C9, C12 and C13's fs/subprocess base faces**. They
**never** cover **C1, C4, C7** (the cold-wake half), **C10, C11**, **C13's PTC arm and its
web/terminals/userQuestions faces**, **C14**, **C14b** (the network-deny invariant is never judged live),
**C15, C16, C17 or C18**. A green version gate is therefore not a claim about those rows at all. The full
judge list and per-row mapping is `VERSION-GATE.md` §2.

**What is NOT exercised (stated plainly, not rounded up).** The version gate has **not** run end-to-end as a
version gate: no `v*` tag, no `release/**`/`candidate/**` push, and no `workflow_dispatch` with a `head`
input has been fired; the hosted artifact→verifier path is unmeasured; and **no branch/tag protection rule
has been applied** — those are owner actions (`VERSION-GATE.md` §5–§6). What IS exercised: the receipt writer
and the verifier against this repository's own latest gate verdict, the verifier's negative controls, and the
manifest-classification controls (§9 rows 19–21).

---

## 2. Static closure — the four zeros, the vehicle counts, and what they do NOT prove

Fresh at this HEAD (logs: `round116/gate-ute-cut-closure.log`, `round116/gate-ute-p0-assets.log`,
`round116/gate-place-dist-glue.log`):

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

**rc.5 test-matrix outcome, in one place** (`RC5-TEST-MATRIX.md`; numbers from round 112/116 measurements):

- **The 18 B-ladder arms are green on BOTH hosts** — `18/18` on rc.2 and `18/18` on rc.5 (16 pass + the same
  2 declared non-runs each), through the one selector. The rc.5 world mounts the host's exported executor
  services and the batch dispatch shape; no arm, assertion, skip or timeout moved.
- **The 40 host-importing vitest suites are still not gradable on rc.5 through the one selector** — and round
  116 now *measured* why instead of assuming it: the one selector and the Node loader are correct (plain-Node
  control resolves `0.2.2-rc.5`), but **Vite resolves bare `@deepseek-ai/*` before Node's loader is asked**, so
  `NODE_OPTIONS=--import` and `server.deps.inline` both leave the suites on `0.2.0-rc.2`. A Vite-side redirect
  derived from the selector's mapping *would* work but is a **second selection mechanism**, so it is refused.
  The finding is **`ENV-LIMITED`, layer = Vite**, 0 of 40 counted as rc.5 coverage; the 5 representative suites
  that ran green under `TEAM_TEST_HOST=next` are a **false green** (they graded rc.2 modules) and are not
  coverage. Evidence: `round116/VITEST-HOST-PROBE.md`, `round116/probe-*.log`, `RC5-TEST-MATRIX.md` §10.

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
   real-model layer — the key was supplied on 2026-11-26 and the route answers, but the real-model driver
   aborts before the first judge (a DRIVER gap, §8.1).

---

## 5. Required CI

### 5.1 The final hosted Required set at this head — every layer green, census executed

**Run `45517751283` (event `pull_request`, 2026-11-25T00:23:49Z) @ head `5cb5c606203eaf07dd78a2a5c67b442899db2377`
— every layer and the synthetic `ci-required` context SUCCESS, with the census actually RUN.** The hosted
check-run table for this head is saved verbatim at `round116/hosted-check-runs-5cb5c6062.tsv`.

| job (id) | conclusion | what that layer covers |
| --- | --- | --- |
| `synthesize-merge-tree` (138881480001) | success | the candidate tree the layer jobs grade |
| `pr-gate` (138881479726) | success | the PR-shape gate |
| `candidate-protection` (138881479801) | success | the draft/protected-branch guard |
| `pr-settlement-gate` (138881480131) | success | the settlement marker check |
| `ci-fast / ci-fast` (138881626146) | success | the fast change-set legs |
| `ci-product / ci-product` (138881626116) | success | the product's own suites |
| `ci-integration / ci-integration` (138881626234) | success | the migrated UTE capability suites plus the EB tooling legs — **including the `devex-diag` leg that was red (§5.3a)** |
| `ci-security / ci-security` (138881626166) | success | the token-runner / security layer |
| `ci-census / census-runtime` (138881626487) | success | the nine-root census with the pristine pinned host (621.6 s) |
| `ci-required` (138891893317) | **success** | the synthetic context that grades **every** layer: absence, skip, cancel, ENV_BLOCK, refused and failure are all **NOT green** |
| `ci-required-deferred` (138882850386) | skipped | the complement job; skipped because the PR was **ready** for this run (see §5.2) |

**The census was not a skip.** Hosted job log (`round116/hosted-ci-census-45517751283.log`, extracted machine
lines from `gh api …/jobs/138881626487/logs`; capture evidence copied to
`round116/census-evidence-1.json` / `-2.json`):

```
DSH-CENSUS-POPULATION baseline=ok roots=11 files=599 baseline_files=599 growth=none added=0
DSH-CENSUS-CAPTURE capture=1 mode=live order=capture-major tasks=11 passed=11 failed=0 incomplete=0 assertions_executed=7424 assertions_total=7424 skipped_total=0
DSH-CENSUS-CAPTURE capture=2 mode=live order=capture-major tasks=11 passed=11 failed=0 incomplete=0 assertions_executed=7424 assertions_total=7424 skipped_total=0
DSH-CENSUS-PLAN execution=plan tasks=22 roots=11 captures=2 plan=sha256:bb56587f… host=639ed015397290b3745d163aafe02ffee4aa3f84
DSH-CI-LEG leg=census verdict=pass seconds=621.6 … shards=1 aggregate=PASS expected=22 observed=22 codes=none
```

**2 captures, `599f` / `7424l` each, identical identity sets.** The identity set this gate grades is the set of
**failing** test identities (`scripts/ci-pr-gate.mjs:2148-2156`); both captures report `failed=0`, so both
graded sets are empty and therefore identical, and the per-root counts/shapes are identical too
(`round116/hosted-census-identity-compare.json`: 11 roots, 599 files, 7,424 assertions, all root shapes equal
between captures). The per-root digest differs only because the capture number is embedded in `task_id`; it is
not an identity-set signal.

**The PR was restored to DRAFT immediately after** — `gh pr view 822` now reports `isDraft=true`,
`autoMergeRequest=null`, `headRefOid=5cb5c6062…`. That conversion fires a fresh `pull_request` evaluation
(run `45520935697`, 00:48:23Z) whose `ci-required` is **failure** for exactly one reason: `ci-census` is
`skipped` on a draft (§5.2). **That is the draft mechanism, not a candidate red** — the final Required set that
was actually executed at this head is the green run above, and no hosted green is claimed for a draft-state
re-evaluation.

### 5.2 `ci-census` skips on a draft — by design, and it is load-bearing

`.github/workflows/ci-required.yml:150` runs census only when `!pull_request.draft && !label ci-defer-full`;
`:205` runs a complementary `ci-required-deferred` job on exactly the negated condition. So **while PR #822 is
a draft, census does not run and `ci-required` cannot be green** — the deferred job reports the skip, and
`ci-required` counts it as NOT green. That is the mechanism, not a malfunction: the owner's draft state is what
suppresses the census, and the round-116 green set exists precisely because the PR was briefly marked ready for
that one hosted evaluation.

### 5.3 The two reds found and fixed in this stretch — and why neither is a weakened assertion

**(a) The `devex-diag` capacity bound (`maxRecords` 600 → 900).** At `974c643de`, `ci-integration` failed in
`EB4-B/D/E tooling suites` → `tests/u7-3-devex/devex-integration.test.mjs` **E4/E5** with
`BOUND HIT: more than maxRecords 600 committed run records … REFUSED, no partial report is produced` (run
`45508260944`, job `138849199239`, step 19; reproduced locally). Measured cause: the branch carries **602**
committed `u5-run-record/1` records. `scripts/integration-order.mjs` `BOUNDS.maxRecords` was raised
**600 → 900** with the measurement recorded in the file's own BOUNDS header:

| measure at `974c643de` | value |
| --- | --- |
| tracked `.json` under `dev/agent-workflow/evidence/**` (`git ls-files`) | **10,440** (12 over the 512 KiB cap, never read) |
| files mentioning `u5-run-record/1` | **623** |
| files that **parse** as `u5-run-record/1` | **602** |
| `maxCandidates` (unchanged) | 12,000 vs 10,440 measured |

The bound is a **capacity budget**, never a safety assertion — the script's own header says "raise the bound
with a measurement" and records two earlier raises done exactly this way. **No assertion was weakened:** `E7`
still builds `BOUNDS.maxRecords + 1` fixture records and still requires `BOUND HIT`, `E8` still requires a late
record to be graded without `BOUND HIT`, `E4` still requires `--strict` to fail while any record does not bind
the candidate head. No committed evidence was deleted or trimmed. Hosted proof: `ci-integration` is **success**
in the green set (§5.1). Local proof: `round116/gate-devex-diag.log` (44/44). **Re-measured at this head:** `EB3-RUN-MANIFEST` now counts **634** tracked run records — 602 at round 115 plus
the 32 run records of the dual-host `92be91dfb` candidate-gate evidence (13 already committed at `5cb5c6062`,
19 staged with this round's evidence). Still well under the raised 900 bound; the delta is recorded, not hidden.

**(b) The dispatch-parity evidence was stale (`92be91dfb`).** Hosted `ci-integration` at `92be91dfb` failed on
`scripts/test-catalog.test.mjs` → `dispatch: the committed parity evidence still describes the resolved set`:
`+ sha256:b5b99294… / - sha256:f8488aa9…`. Cause: round 114 added `tests/checks/d4-evidence-consistency.test.mjs`
to a dispatch leg, so the resolved dispatch union grew by exactly one suite (77 → 78 files) while the committed
parity evidence (`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt`) still pinned the
previous union digest. **The control refused correctly** rather than let the dispatched set drift away from its
evidence. The evidence was regenerated deliberately with the repo's own generator and its declared base:

```
node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670
union old=25 new=78 set=sha256:b5b992944b59753bf4afb1f4ddff0e872bd1e5bf4c520b7bd25bd49caae92da2
DISPATCH-PARITY mode=inspect DIFFERS steps=19 old_files=25 new_files=78 problems=0
```

The only added file is `tests/checks/d4-evidence-consistency.test.mjs`; `problems=0`, nothing missing. **No
assertion was relaxed, no suite removed, no timeout touched** — the union digest and the file count moved
together, which is exactly what the control demands. Full note: `round115/dispatch-parity-regeneration.md`;
hosted proof: `pr-gate` and `ci-integration` are success at `5cb5c6062` (§5.1).

### 5.4 The local gate block at this HEAD, pasted verbatim

From `dev/agent-workflow/evidence/ute-a1/round116/` (each file also carries its own `EXIT=` line):

```
$ A5SF_REQUIRE_PINNED_HOST=1 node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
tests 255 / pass 252 / fail 0 / skipped 3

$ node scripts/dispatch-tests.mjs --run --leg devex-diag
tests 44 / pass 44 / fail 0 / skipped 0   (set=sha256:08ea42463381f08e6797e90afa6c9bc910a7dc6e4b1e3d7891f94bfce22bb3e1)

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
DSH-TEST-CATALOG tests=786 digest=sha256:8982e6e9d6c029234b185be68d97930db21d7171c0b41659e3d0a2b9c9b1fd4e refused=0 findings=0
(discovered/collected 734, excluded 14, uncollected 38; by runner node=147 none=7 vitest=632)

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (35 placement(s))          # every line (byte-identical)

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=11 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 20000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=20000

$ node --test --test-force-exit --test-timeout=480000 --test-reporter=spec <the nine UTE G1 files>
tests 89 / pass 89 / fail 0 / skipped 0

$ node scripts/eb3-run-manifest.mjs
EB3-RUN-MANIFEST pass records=634 strict=0 incomplete=11 findings=0

$ node scripts/ci-pr-gate.mjs --full --census-captures 2
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=286.4
DSH-CI-LEG leg=census verdict=pass seconds=242.1 detail=… captured 599f/7424l, 599f/7424l vs baseline-declared 626 / 7936; 2 captures, identical identity sets … identity set IDENTICAL to the published baseline
EXIT=0
```

`ci-pr-gate`'s own run line for that block: `DSH-CI-RUN head=5cb5c6062 mode=full … workers=4` → `DSH-CI-VERDICT pass pass=10 fail=0 skip=0 … seconds=286.4` (`round116/gate-ci-pr-gate.log`).

### 5.5 What a green block means — and does not

Only that the *static and in-process* obligations named in each row hold at this head. A green `ci-pr-gate`
means the local full gate produced its verdict; it is **not** Required CI, which only exists hosted (§5.1). A
green run of the candidate gate is **not** PRODUCT-PROVEN by itself — PRODUCT-PROVEN needs the version freeze
of §1.1 (frozen SHA + Required context + green + verified receipt), which has not happened and is an owner
action (`VERSION-GATE.md`).

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
| **PRODUCT-PROVEN** | **0** | — (no row claims it; the definition in force is §1.1 — a frozen, Required, green version gate at a candidate SHA, not "covered by every PR's Required CI") |

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

**Security findings — dispositions, so none is mistaken for an open item** (`SECURITY-REVIEW-20261125.md`
§ "Disposition"; `D-ACCEPTANCE-REPORT.md` ROUND 114):

| finding | severity | disposition | where it stands |
| --- | --- | --- | --- |
| **SEC-01** admission fact not `fsync`'d | Low (durability) | **FIXED** — `packages/runtime/src/plugin/vnext/fact-ledger.mjs` fsyncs the file (and the directory on create) before `record()` returns; a refused fsync is a named fail-closed refusal and the settlement record is never opened; arms `SEC-01a…d`. Remaining bound: a physical power cut is not injectable in-process, so the ordering is pinned and the cut is not observed. | §8.6 |
| **SEC-02** d4 README contradicted `results.json` | Low (evidence integrity) | **FIXED, history retained** — dated correction banner, round-87/88 text kept as `[HISTORICAL]`; machine check `tests/checks/d4-evidence-consistency.test.mjs` (RED on the pre-correction README). | `d-boot-feasibility/d4/README.md` |
| **SEC-03** host-capability tools have no managed lane | Low (declared boundary) | **DECLARED, no behaviour change** — `CAPABILITY-MATRIX-C.md` row **C-host-capability** and acceptance-table **row 35**; never counted as confinement. | §8.5 |
| **SEC-04** ungoverned rows outside every invariant | Informational | **DECLARED (unchanged)** — a labelled product mode, not a governed row. | §8.5 |

No finding remains **open**. SEC-01/SEC-02 were defects and are fixed with arms; SEC-03/SEC-04 are declared
boundaries of this generation and are owner decision 4 below.

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

1. **The model was a scripted mock in every live boot; ROUND 120 adds a REAL-MODEL DEV-LIVE run
   (`DEV-LIVE-real-model`) — not candidate acceptance.** Round 120 rebuilt the driver's real branch
   (request capture at the public `DEEPSEEK_BASE_URL` seam, non-vacuous turn gates, discovery by
   predicate over the observed transcript) and ran the two required commands at `1a3a79c4c`:
   `--model real --boots 2` exits **0** on both pinned hosts — legacy (`deepseek-v4-flash`) **892 s**,
   next (`deepseek-flash`) **180 s** — with **20/20 judges PROVEN on 2/2 boots per host**,
   `agreeing=true differing=[]`, and RUN records `recordClass: DEV-LIVE` / `overall: PASS`. The four
   negative controls are observed with the model's own replies (deny → `ADMISSION_APPROVAL_DENIED`,
   zero bytes, `REFUSED`/`not-started`; Stop → `session/cancel` 200 + `ADMISSION_STOPPED`, zero bytes;
   duplicate approval → `CONTROL_REQUEST_DECIDED`, one execution; restart-no-replay → `before === after`,
   1 decision, 1 execution). The scripted control is still 20/20 and an anti-vacuity self-test pins three
   `DISCOVERY-MISS` cases. Full trail (including six preserved red attempts and the dated prompt
   amendment): `dev/agent-workflow/evidence/ute-a1/round120/README.md`, `REAL-MODEL-ACCEPTANCE.md`
   §ROUND 120. **This is development evidence, not candidate acceptance:** the version gate has not run
   with a real model at a frozen version, the real model is non-deterministic (one flaky negative-arm
   boot preserved, not retried away), and agreement is over two boots per host rather than independent
   sessions across time. `d4:ask-execute-process` remains the single enumerated `knownRefuted`.
2. **No row is PRODUCT-PROVEN.** The candidate acceptance gate is a **VERSION gate** by owner ruling
   (2026-11-25): required at a frozen candidate SHA, never a per-PR required context (§1.1). No version has
   been frozen, so a green run is still `DEV-LIVE` evidence and upgrades nothing. **The current dual-host
   verdict was re-run fresh at `92be91dfb`** —
   `CANDIDATE-GATE pass hosts=legacy,next judges=62 proven=60 known-refuted=2 env-limited=0`, 2 agreeing boots
   per driver, one disclosed dual-host run (verdict
   `dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T23-43-47-693Z/verdict.json`, summary copied
   to `round116/candidate-gate-92be91dfb-summary.txt`). The 2 known-refuted are the single enumerated
   `d4:ask-execute-process`, once per host, preserved as REFUTED (§4.2). **This verdict was NOT run at
   `5cb5c6062`.** It is still representative of this head's product code because the product code is unchanged
   between the two heads: `git diff --stat 92be91dfb..5cb5c6062 -- 'packages/*/src'` prints **nothing** (exit 0,
   zero lines; saved as `round116/product-diff-92be91dfb-5cb5c6062.txt`). The commits in between are evidence
   and evidence-regeneration only. A verdict is a claim about product code; the product code is identical, so
   the claim transfers — it is **not** a claim that the gate ran at `5cb5c6062`.
3. **40 host-importing vitest suites cannot be graded on rc.5 through the single selector — now measured, not
   assumed: `ENV-LIMITED`, layer = Vite.** Round 116 ran a bounded probe (1 throwaway probe + 5 representative
   suites, 2 client / 3 runtime). The selector and the Node loader are correct (plain-Node control resolves
   `dsh-scope` `0.2.2-rc.5`), but **Vite resolves bare `@deepseek-ai/*` before Node's loader is asked**:
   `TEAM_TEST_HOST=next NODE_OPTIONS=--import=…/host-loader.mjs` still yielded `0.2.0-rc.2`, and
   `server.deps.inline` was inert. The 5 suites stayed green **while importing rc.2 modules** — a false green,
   not coverage. A Vite `resolveId`/alias derived from the selector's own mapping **would** work (measured
   `0.2.2-rc.5`) but is a **second host-selection mechanism**, so it is refused. **0 of 40 counted as rc.5
   coverage.** What the host would need: a Vite/Vitest seam that lets the registered Node loader own bare
   specifier resolution, or a host-published Vite plugin parameterised by the selected tree. Evidence:
   `round116/VITEST-HOST-PROBE.md`, `round116/probe-*.log`, `RC5-TEST-MATRIX.md` §10.
   **AMENDED round 121 (2026-11-26): the population is now MEASURED on rc.5, 42 of 44 files.**
   `RC5-TEST-MATRIX.md` §11 built the Vite/Node seam (round 118) and §11.6 closes the product gap that
   kept 3 runtime suites red on rc.5: the dispatch seam
   (`packages/runtime/src/plugin/vnext/tool-executor-mount.mjs`) detects the host's dispatch contract by
   PUBLIC CAPABILITY (`tools.setExecutor` = rc.5 executor mount; `modeFor`/`defaultMode` = rc.2 registry),
   mounts the host's own `@deepseek-ai/dsh-tool-executor-native` on the Member's agent scope, and refuses
   by name (`A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`) when neither exists. Measured: rc.2 42/44 files /
   532 of 535 tests; **rc.5 42/44 / 532 of 535** (was 39/44, 505/519). The remaining 3 reds are the same
   pre-existing, host-independent client failures on both hosts. Two disclosures belong to this number:
   (a) round 118's rc.5 counts were measured on a SPLIT module graph (`resolve.preserveSymlinks: true`
   gave two `@deepseek-ai/dsh-scope` instances); the Vite adapter now unifies that one case and
   `host-resolution-consistency.test.mjs` pins it (12/12), so §11.6's numbers are the first measured on a
   unified graph; (b) `agent-bindings.mjs#executeTool` still emits the rc.2 single-call shape (`:4058`) —
   not on any red path this round, unchanged, and named as open rather than counted as migrated. **This is
   coverage, not a freeze:** no row becomes PRODUCT-PROVEN and the candidate gate has still not run at a
   frozen version.
   **AMENDED round 122 (2026-11-26): disclosure (b) is CLOSED — the entry dispatch is capability-detected
   on BOTH hosts.** The product's one tool-dispatch entry (`createAgentBindings().executeTool`, the body
   behind the harness row's `POST /__p6t6/tool`) no longer hands `tools.execute` a hard-coded rc.2 object.
   It goes through the same round-121 seam (`dispatchGovernedToolCall`): `hostToolDispatchShape` picks the
   host's OWN shape by public capability (`setExecutor` ⇒ rc.5 batch
   `{calls:[{type:'tool-call',id,name,arguments}]}` + `results[0].result` unwrap; `modeFor`/`defaultMode`
   ⇒ rc.2 single call), with **no version sniff, no try/catch fallback and no removed-API emulation**. A
   caller that hands the one-call entry a BATCH is refused by name —
   `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED` — *before* `ensureLiveAgent`, so it is not silently coerced into
   either host's shape. Controls: `packages/runtime/test/vnext-tool-dispatch-shape.test.ts` (A/B positive
   on both shapes, C/D/E negative with zero dispatches; both mutation-checked — reverting the dispatch call
   re-reds B/D/E, removing the shape gate re-reds C) plus `a5sf-bl16-grep-realm.test.ts` C5 on each REAL
   host (typed refusal, zero spawns, zero facts). Measured rc.2 **42/44 files, 533 of 536 tests**; rc.5
   **42/44, 533 of 536** (round 121: 532/535). The 3 remaining reds are the same pre-existing client
   failures on both hosts — see §8 item 4 (the known-red disclosure). **This is coverage, not a freeze:** no row
   becomes PRODUCT-PROVEN.
   **AMENDED round 123 (2026-11-26): BOTH round-122 residues are CLOSED, and what replaced them is named
   here so no reader inherits an empty disclosure.** Round 122 left two gaps of its own (its §G): (a) the
   test world still picked its dispatch shape from a VERSION flag — `executeToolDispatch` took `{hostMode}`
   and emitted `hostMode === 'next' ? batch : single` — the same decision the product had just learned to
   make by public capability; (b) the new `A5SF_*` → HTTP mapping on `POST /__p6t6/tool` (400 only for
   `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED`, 500 for every other `A5SF_*`) had no ROUTE-LEVEL arm, so the
   mapping was asserted from the source, not observed. Round 123 closes both, and **neither is on the
   limits list any more**; the replacement entries are:
   (a′) *the World's dispatch shape is capability-detected, with a drift control* — `hostMode` is deleted
   from `executeToolDispatch` (and from all four call sites plus the World's own dispatch), the World reads
   `setExecutor` / `modeFor` / `defaultMode` from the LIVE service exactly as the product does, refuses
   typed (`A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`) when the service offers neither, and arms **F–I** in
   `vnext-tool-dispatch-shape.test.ts` (9/9) prove batch / single / typed refusal and the **drift control**:
   on ONE fake service both probes answer the same shape and, on the SAME input, both engines dispatch the
   SAME call and settle identically across six selector combinations. Mutation-checked (never emit the
   batch ⇒ F, I red; fall back to the single call instead of refusing ⇒ H, I red). This is a *stronger*
   disclosure than the gap: any future divergence between the World and the product now fails a test
   instead of being invisible.
   (b′) *the route mapping is held by a route-level suite* — `packages/tools/test/p6t6-tool-route-errors.test.ts`
   (host-free, 9/9) drives ONE real `plugin.apply()` over a scratch `DSH_HOME` with the hostile-seam doubles
   and observes the status codes: shape refusal ⇒ **400** + typed code; `A5SF_TOOL_EXECUTOR_UNAVAILABLE` /
   `…_RESULT_MISSING` ⇒ **500** + typed code; a governed call ⇒ **200** with the `{isError,value,error,content}`
   settlement carried through unchanged; an `isError` settlement ⇒ **200** (not an HTTP failure). The
   negatives are the point and are now the standing obligation: an UNTYPED error ⇒ 500 with NO `code`, a
   non-`A5SF_*` code ⇒ 500 echoing no `A5SF_*`, and an `A5SF_`-PREFIXED lookalike ⇒ 500 — so a widened
   prefix can no longer pass as "the shape refusal". Mutation-checked (all `A5SF_*` → 400 ⇒ R2a/R2b/R4c red;
   branch deleted ⇒ R1/R2a/R2b/R4c red).
   What this does NOT change: nothing becomes PRODUCT-PROVEN, no version is frozen, and the remaining
   limits of this item are unchanged — the 40 rc.2-only Vite suites (round 116 measurement) and the 3
   pre-existing client reds (§8 item 4) stay exactly as disclosed. Two measurements from the round, both
   in `round123/README.md`: population 42/44 files, **533/536** on rc.2 and on rc.5 (identical to round
   122; the round's new arms are host-free), and — published rather than skipped — the rc.5 `ute-vnext-a1`
   leg carries **4 pre-existing reds** (`ADM-63/69/79/80`, the ladder's PTC/`run_code`-transport identity
   arms on this pinned rc.5 tree), reproduced identically with the round-123 files checked out at the
   parent head `af2b03f20`, off the dispatch path, and not caused by this round.
4. **KNOWN-RED disclosure (round 122) — three client arms are red on `master` BEFORE this branch and are
   deliberately NOT skipped, NOT deleted and NOT retried.** Identity and attribution are measured, not
   asserted (full method and logs: `round122/POPULATION.md` §4):
   - `packages/client/test/team-governance.client.spec.tsx :: override reset … pulls once on success` —
     red since **`dcf661468`** (W1 fix-A F10): `TeamGovernance.tsx` reads
     `(response.value.data)['removed']` while the fixture's `okResponse(null, 'override.reset')` is `null`,
     so it throws before `pullProjection` runs (0 calls).
   - `packages/client/test/team-creation-panel.client.spec.tsx :: selecting a blueprint … persona-fact
     probe` and `:: switching the runtime preset …` — red since **`4f07e2da9`** (pre-alpha3 PR-E):
     `intentEnvironmentFacts` changed `available: true` → `observedKind === 'standard'` (roster
     `standard/ptc/cordis/minimal`), so `team`/`solo` become `available:false`.
   Both commits are **ancestors of the A0 base `a19d1df01`**, and the A0 measurement is identical
   (`Test Files 2 failed (2)`, `Tests 3 failed | 46 passed (49)`) to HEAD on rc.2 and on rc.5 (guard lines
   prove the loaded tree). The two spec files and every product file behind them are unchanged since A0
   (`git diff --name-status a19d1df01..HEAD -- <paths>` prints nothing). Disposition: **out of scope for
   the dispatch round** — the fix is a client panel/governance task; the reds are published here so no
   reader can mistake the 3-failure aggregate for a green population.
5. **The 18 B-ladder arms are green on BOTH hosts** (18/18 rc.2 and 18/18 rc.5; 16 pass + the same 2 declared
   non-runs each), but they are **in-process `MECHANISM`**, not boots; C-ptc stays unsupported.
6. **Two declared boundaries (not controls):** **SEC-03** — host-capability tools (`subagent`,
   `send_message`, `interrupt_agent`, `skill`, the 15 `team_*`) are admitted on host authority with **no managed
   fs/net lane**, so the lane algebra does not bound their effects; a hostile-code model must treat them as
   capabilities **outside** the sandbox. **SEC-04** — ungoverned rows (`centreStatePath` absent) remain a
   labelled product mode **outside every invariant**; Option B refuses a *governed* row with no confined
   provider (`MEMBER_CENTRE_UNWIRED`), it does not govern a row that never asked.
7. **Physical power-cut durability is unmeasured.** SEC-01 made the admission append `fsync`-before-return
   (file + one directory fsync on create) and the arms pin the ordering and the fail-closed refusals; a
   **physical power cut cannot be injected in-process** — a kernel/power cut is out of reach here, so the
   machine-crash claim is structural, not observed.
8. **`apply_patch` is unbound.** The R3 receipt covers `write`/`writeText`, `editText`, `patchText`,
   `deleteFile`, `moveFile` (with per-method scope binding); `apply_patch` stays unbound and the
   subprocess/PTY face is explicitly **not** covered (its authority is an OS `SandboxExecutionPolicy`).
9. **`caseId: null` for inline asks.** The receipt binds the durable request/decision identity, but an inline
   admission request mints `caseId: null` — so the receipt is not a claim that every ask is an Alpha.6 case.
10. **The operator model is per-`DSH_HOME`, not RBAC.** Every management-plane claim is scoped to one
   authenticated operator (Connection Gate); no multi-user isolation, no per-user authority, no tenant
   boundary is claimed.
11. **Sticky Stop is latch-scoped.** A machine wake does not clear a human Sticky Stop (measured,
    `d4:sticky-stop` PROVEN), but the guarantee is about the latch: an in-flight Stop whose body aborts without
    a terminal observation settles **`UNKNOWN`**, and is not a `CANCELLED` claim unless the Stop evidence
    exists.
12. **A duplicate-route attempt leaves no durable fact.** `d4:duplicate-route` PROVEN = one wake for a
    duplicate route (1 intent, 1 confirmation, 1 input); the *attempt* itself is not persisted as a fact, so
    "we can count duplicate attempts" is not a claim this candidate makes.
13. **Alpha.6 review routing is `DEV-LIVE`, not PRODUCT-PROVEN.** The routed wake is PROVEN on both hosts,
    2 agreeing boots (case created with frozen identity, router selects the unique lawful Officer, the wake is
    delivered with zero management-plane executions, the Officer decides in its own session and the decision
    precedes the settlement, duplicate route yields one wake, sticky Stop survives a machine wake) — but no
    version gate has been frozen, and the **cold-wake** half (an intent written before a restart and consumed
    after) is **not** a live judge at all.
14. **In-process vs live is a real distinction everywhere.** `MECHANISM` arms run in-process over real pinned
    components with named stand-ins that decide nothing; the compiled member answer is an **input**, so policy
    **compilation** is not exercised. `DEV-LIVE` boots are real host processes but not gates.
15. **No Windows deployment** (the persistent shell row is disabled on win32); no hosted third-party
    deployment; no MCP server booted live (the `ADM-96` mount is in-process over a real server object).

---

## 9. Reviewer's checklist — the exact commands and the expected verdict lines

Run in `.worktrees/vnext-a1-cut`. Every command is copy-pasteable; the expected line is what this round measured
(logs under `dev/agent-workflow/evidence/ute-a1/round116/`; round-115 logs remain for the devex-bound row).

| # | command | expected verdict line |
| --- | --- | --- |
| 1 | `git log -1 --format='%H %s'` | `5cb5c606203eaf07dd78a2a5c67b442899db2377 fix(ci): regenerate the dispatch-parity evidence for the round-114 control suite (round 115b)` (the settlement comment names the round-116 commit on top) |
| 2 | `gh pr view 822 --json isDraft,state,baseRefName` | `{"autoMergeRequest":null,"baseRefName":"master","isDraft":true,"state":"OPEN","headRefOid":"5cb5c6062…"}` |
| 3 | `node scripts/ute-cut-closure.mjs --check` | `UTE-CUT-CLOSURE pass deleted=148 … prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 … findings=0` |
| 4 | `node scripts/ute-p0-assets.mjs --check` | `UTE-P0-ASSETS pass modules=37 files=180 lines=69512 … cut=cut(148/148) findings=0` |
| 5 | `node scripts/place-dist-glue.mjs` | `place-dist-glue: done (35 placement(s))` (every line `(byte-identical)`) |
| 6 | `node scripts/docs-sync.mjs --check` | `docs:sync --check: docs=193 … findings=0 blocking=0 contracts=20 pairs compared` |
| 7 | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=11 findings=0` |
| 8 | `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` | `DSH-TEST-CATALOG tests=786 digest=sha256:8982e6e9… refused=0 findings=0` (collected 734 / uncollected 38 / excluded 14) |
| 9 | `A5SF_REQUIRE_PINNED_HOST=1 node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1` | `DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c4…` and `tests 255 / pass 252 / fail 0 / skipped 3` |
| 10 | `node scripts/dispatch-tests.mjs --run --leg devex-diag` | `… exit=0 set=sha256:08ea4246…` and `tests 44 / pass 44 / fail 0` (the round-115 bound fix, re-run here) |
| 11 | `node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 20000` | `EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` |
| 12 | `node scripts/eb3-run-manifest.mjs` | `EB3-RUN-MANIFEST pass records=634 strict=0 incomplete=11 findings=0` (32 more tracked run records than round 115: the dual-host `92be91dfb` candidate-gate evidence; still under the raised 900 bound) |
| 13 | `node --test --test-force-exit --test-timeout=480000 --test-reporter=spec tests/ute1-fs/native-fs-binding.test.mjs tests/ute-g1-fs/lane-suite.test.mjs tests/ute-g1-fs/lib/refusal-categories.test.mjs tests/ute-g1-fs/product-route-image.test.mjs tests/ute-g1-search/lane-suite.test.mjs tests/ute-g1-web/lane-suite.test.mjs tests/ute-g1-process/lane-suite.test.mjs tests/ute-g1-agentctl/lane-suite.test.mjs tests/ute-g1-uistate/lane-suite.test.mjs` (the exact CI argv) | `tests 89 / pass 89 / fail 0 / skipped 0` |
| 14 | `node scripts/ci-pr-gate.mjs --full --census-captures 2` | `DSH-CI-VERDICT pass pass=10 fail=0 skip=0 … refused=0 refusedlegs=none` |
| 15 | **live drivers** (two agreeing boots each; rc.2 default, rc.5 with `TEAM_TEST_HOST=next`) — `node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2`, `run-boot-d2.mjs --boots 2`, `run-boot-d3.mjs --boots 2`, `probe-d4-routed-wake.mjs --boots 2` | each driver's own `RESULT PASS (2/2 boots; agreeing pair=true)` (d3 prints `evidence-complete=true allProven=true`, d4 `blocked=true` for the one declared refusal); the judge-by-judge verdicts are the §4 tables above and `D-ACCEPTANCE-REPORT.md` §3.2 |
| 16 | **candidate gate, both hosts** (the VERSION gate; non-required on PRs, ~84 min) — `node scripts/candidate-acceptance-gate.mjs --hosts both` | `CANDIDATE-GATE pass hosts=legacy,next judges=62 proven=60 known-refuted=2 env-limited=0` (the 2 are the single enumerated `d4:ask-execute-process`, once per host). The recorded verdict is bound to **`92be91dfb`**, not to this head; it is representative because `git diff --stat 92be91dfb..5cb5c6062 -- 'packages/*/src'` is empty (§8.2) |
| 17 | `git -C tests/deepseek-harness-test-use status --porcelain \| wc -l` and the same for `tests/deepseek-harness-next` | `0` and `0`; `rev-parse HEAD` = `639ed01539…` and `9c2670d3bc…` |
| 18 | `GH_TOKEN=$(gh auth token) node scripts/pr-settlement-gate.mjs --repo ArmourPiercer1/dsh-agent-team --pr 822` | `DSH-SETTLEMENT-VERDICT PASS marker=none matches=<n> candidates=<n>` — i.e. a dated settlement comment whose body carries **this** 40-hex head sha (a pushed commit mechanically retires the previous one, §8.5.2) |
| 19 | **version-gate receipt + verifier dry run** (round 117, temp dir; no receipt committed for an unfrozen SHA) — `node scripts/version-gate-receipt.mjs --verdict dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T23-43-47-693Z/verdict.json --requested-head 92be91dfb… --out $TMP/version-gate-receipt.json && node scripts/version-gate-verify.mjs --receipt $TMP/version-gate-receipt.json --head 92be91dfb…` | `VERSION-GATE-RECEIPT written head=92be91dfb… verdict=pass proven=60 known-refuted=2 env-limited=0 hosts=legacy,next` then `VERSION-GATE-VERIFY pass head=92be91dfb… hosts=legacy,next proven=60 known-refuted=2 env-limited=0`, exit 0; the two negatives (wrong head → `REFUSED VERSION_GATE_HEAD_MISMATCH`, missing receipt → `REFUSED VERSION_GATE_RECEIPT_MISSING`) exit 1. Log `round117/version-gate-dryrun.log` |
| 20 | `node scripts/dispatch-tests.mjs --run --leg version-gate-verify-unit` | 22 tests / 22 pass / 0 fail — missing receipt, wrong head, verdict≠pass, unexpected known-refuted id, schema drift (extra/missing/wrong type), schemaVersion drift, digest mismatch, missing verdict file, `envLimited>0`, dropped known-refuted id, non-SHA head, judges partition — each its OWN named code |
| 21 | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=11 findings=0`, including the manifest classification assertion; its six controls in `scripts/eb3-ci-required.test.mjs` red on classification removal, `requiredPerPR:true`, deletion of the stable `version-gate` job entry, layer promotion (both directions), and removal of the PR label gate |

**What a reviewer should conclude from a green block.** Only that the *static and in-process* obligations named
in each row hold at this head. A green row 14 means the local full gate produced its verdict; it is **not**
Required CI, which only exists hosted (§5). A green row 16 is not PRODUCT-PROVEN by itself: rows 19–21 are the
version-gate controls, and PRODUCT-PROVEN needs the frozen-SHA freeze of §1.1 (`VERSION-GATE.md`). Row 18 is
the mechanical settlement check: the comment must carry **this** 40-hex head, so pushing the round-117 commit
retires the previous marker.

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

1. **DECIDED (2026-11-25) — the live layer's status.** The candidate acceptance gate is a **VERSION gate**:
   required at a frozen candidate SHA, never a per-PR required context (§1.1). The alternative "required on
   every PR" was **rejected** (its ~84 min dual-host cost would land on every PR for no value on docs/script
   changes). What remains is the owner ACTION, not a decision: apply the ruleset in `VERSION-GATE.md` §5 and run
   the freeze procedure in §6. Until then no row is PRODUCT-PROVEN.
2. **The draft → ready flip is yours, and it is what unlocks census.** While #822 is a draft, `ci-census` does
   not run and `ci-required` therefore cannot be green (§5.2). The final green hosted set already exists for
   `5cb5c6062` because the PR was briefly marked ready for that one evaluation and restored to DRAFT
   immediately after (§5.1); any *further* hosted green still requires the same brief ready flip.
3. **The real-model gap is now a DRIVER gap.** The credential has been supplied and the route answers
   (`REAL-ROUTE-AVAILABLE`, both hosts, `deepseek-v4-flash` 200), but the real-model driver's real branch
   aborts before the first judge (§8.1). Commission that driver work (request capture + call-id discovery +
   real prompts), or rule that this generation ships with `ENV-LIMITED` / `SCRIPTED-ONLY` real-model evidence
   named as such.
4. **The two declared uncovered boundaries** — host-capability tools with no managed I/O lane (SEC-03) and
   ungoverned rows outside every invariant (SEC-04). Accept them as declared limits of this generation, or
   commission the lane work in a later phase.
5. **The round-115 capacity-budget raise** (`integration-order.mjs` `maxRecords` 600 → 900, measured at 602).
   Approve it as the maintenance it is, or rule that the devex evidence-bound audit must not gate Required CI.
   Either way, no committed evidence was trimmed and no assertion was weakened.
6. **The rc.5 vitest population.** 40 suites (26 client + 14 runtime) stay rc.2-only because Vite, not the
   selector, decides their host (§8.3, measured round 116). Decide: commission a **host-published Vite-side
   selection seam** (then these 40 can be graded on rc.5 through one authority), rule these suites
   **host-version-agnostic by contract** (they stop being a coverage gap by definition), or accept the gap with
   its measured `ENV-LIMITED` label. A Team-authored Vite alias is refused and is not an option.
