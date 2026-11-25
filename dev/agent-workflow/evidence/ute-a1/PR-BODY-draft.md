# feat(ute-vnext): A1 cut + centre (draft; not for merge)

Draft candidate for the UTE vNext floor on top of the frozen A0 contract
(`master @ a19d1df01`, PR #821). **Not merged, not for merge, not a release, not a deployment.** Citation
convention: a path containing `/` is repo-root-relative; a bare filename is shorthand for the full path
named in the same row or section.

| field | value |
| --- | --- |
| **Head measured for every number below** | **round 116 sits on `5cb5c6062` (the dispatch-parity evidence regeneration), and its settlement comment names the round-116 documentation commit on top. The hosted Required set was executed at `5cb5c6062` (run `45517751283`: every layer + `ci-required` success, `ci-census` 2 captures / 599f / 7424l each, identical identity sets), and the PR was restored to DRAFT immediately after.** The round-115 row that follows keeps its own head (`5f79acb73` + postcommit commit) and its numbers (the candidate report + the measured `devex-diag` bound fix + this round's gate logs) plus the postcommit-logs commit named in the settlement comment; its gate block is the round-115 section immediately below.** Round 114 sat on `b5da23b4b` + the round-114 commit set (`194a5c3ce` fixes + `974c643de` post-commit gate logs); it closes SEC-01/SEC-02, declares SEC-03, and leaves every driver verdict and capability level untouched.** Round 110 leaves the driver verdicts of `acc72e58e` untouched; its own head is `fc170f929060133b3897cb1f0b769c20a928c893` + the round-110 commit (the documentation/observation commit carrying this body is its child, named in the settlement comment)**; the round-106/102/98/95/89 sections that name `563feac13` / `10d8a67ae` / `a95be5f11` / `d322b17aa` / `97d7d7c8d` / `c29da52d3` keep their own round's numbers and are labelled as such |
| **Base** | `master @ a19d1df01` (frozen A0, PR #821) |
| **PR state** | **DRAFT**, `state=OPEN`, never merged (`gh pr view 822 --json isDraft,state,headRefOid`) |
| **Record class** | every live claim is `DEV-LIVE` (a real host boot, **not a gate**); no capability row is PRODUCT-PROVEN |
| **Read first** | **[`dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md`](https://github.com/ArmourPiercer1/dsh-agent-team/blob/vnext/a1-cut/dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md) — the ONE reviewable candidate report (round 116): identity/HEAD/base/PR state, static closure and exactly what its numbers do and do not prove, the single-authority verdict, the P1–P5 ladder with the OS negative controls and the declared exceptions, Required CI (the final hosted Required set is green at `5cb5c6062` WITH census — 2 captures, 599f/7424l, identical identity sets — and why census skips on a draft), the C1–C18 summary with every UNSUPPORTED/ENV-LIMITED row named, host-modification authority, the candid limits list, the reviewer's exact reproduction commands, and the boundaries in force.** Then [`D-ACCEPTANCE-REPORT.md`](https://github.com/ArmourPiercer1/dsh-agent-team/blob/vnext/a1-cut/dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md) — now explicitly the append-only chronological record (its header points at the candidate report) — plus `C1-C18-SIGNOFF.md` (the per-row sign-off), `SECURITY-REVIEW-20261125.md` (the adversarial audit) and `ARCHITECTURE-AUTHORITY-AUDIT.md` (the single-authority audit) |
| **How to review** | (1) read the audit's corrections table first — it lists every number the report used to get wrong; (2) re-run the gate block in §"Verification on this HEAD" (single commands, ~8 min with the census) and diff the verdict lines; (3) for any capability row, follow its `file:line`/evidence path and check it says what the row claims; (4) treat every `DEV-LIVE` row as unproven for acceptance purposes; (5) read `D-ACCEPTANCE-REPORT.md` §10 before forming a view — the two round-87/88 seams and the four rulings they need are there; (6) do **not** mark this PR ready or merge it — that is the owner's act. |
| **Gate status at this head** | **Round 116 / `5cb5c6062` is the CURRENT block — see the round-116 section immediately below and `CANDIDATE-REPORT.md` §5: the fresh dual-host candidate gate at `92be91dfb` is `CANDIDATE-GATE pass hosts=legacy,next judges=62 proven=60 known-refuted=2` (with `packages/*/src` proven unchanged to `5cb5c6062`); the 18 B-ladder arms are 18/18 on rc.2 and rc.5; the 40 host-importing vitest suites are measured `ENV-LIMITED` at the Vite layer (0 of 40 counted); local `ci-pr-gate --full --census-captures 2` PASS 10/10; the hosted Required set at `5cb5c6062` is fully green WITH census, and the PR is DRAFT again.** The rows below keep the numbers of the head they were measured at. **Round 115 / `974c643de` — one reviewable candidate report and the hosted devex `BOUND HIT` fixed with a measured budget raise: `ute-vnext-a1` leg 255/252/0/3; `test-catalog` tests=786 collected=734; local `ci-pr-gate` PASS 10/10.** **Round 112 / `ba3b3b436` + the round-112 commit — the B ladder is GREEN on BOTH hosts: 18/18 rc.2 and 18/18 rc.5, leg 251/248/0/3 on both, no product change, no assertion weakened.** Full tables: `dev/agent-workflow/evidence/ute-a1/RC5-TEST-MATRIX.md` and `round116/VITEST-HOST-PROBE.md`. |

## ROUND 116 — the newest measurements folded in: hosted green with census, two reds fixed, the rc.5 vitest probe

Head `5cb5c6062` (the dispatch-parity evidence regeneration) plus the round-116 documentation commit named in
the settlement comment. Branch `vnext/a1-cut`, base `master @ a19d1df01`, PR **#822 stays DRAFT** — no merge,
no ready flip beyond the single hosted evaluation below, no history rewrite, no upstream patch, no assertion,
timeout, retry or skip widened. **No capability level moves and no row becomes PRODUCT-PROVEN.**

### 1. The final hosted Required set at `5cb5c6062` — every layer green, census executed

Run `45517751283` (event `pull_request`, 2026-11-25T00:23:49Z) at head `5cb5c6062`: `synthesize-merge-tree`,
`pr-gate`, `candidate-protection`, `pr-settlement-gate`, `ci-fast`, `ci-product`, `ci-integration`,
`ci-security`, **`ci-census`** and the synthetic **`ci-required`** are all **success** (`ci-required-deferred`
skipped, as its ready-state complement). Check-run table saved verbatim at
`round116/hosted-check-runs-5cb5c6062.tsv`.

The census was **executed, not skipped** (job `138881626487`, 621.6 s):

```
DSH-CENSUS-POPULATION baseline=ok roots=11 files=599 baseline_files=599 growth=none added=0
DSH-CENSUS-CAPTURE capture=1 … tasks=11 passed=11 failed=0 assertions_executed=7424 assertions_total=7424
DSH-CENSUS-CAPTURE capture=2 … tasks=11 passed=11 failed=0 assertions_executed=7424 assertions_total=7424
DSH-CI-LEG leg=census verdict=pass seconds=621.6 … aggregate=PASS expected=22 observed=22 codes=none
```

**2 captures, 599 files / 7,424 assertions each, identical identity sets** (the gate grades failing identities;
both captures report `failed=0`, so both sets are empty and identical; per-root shapes are equal too —
`round116/hosted-census-identity-compare.json`). **The PR was restored to DRAFT immediately after**
(`isDraft=true`, `autoMergeRequest=null`). The conversion triggers a fresh `pull_request` evaluation whose
`ci-required` is failure **solely** because `ci-census` skips on a draft (`.github/workflows/ci-required.yml:150`)
— the draft mechanism, not a candidate red. No hosted green is claimed for that draft-state re-evaluation.

### 2. The two reds found and fixed in this stretch — neither is a weakened assertion

- **devex `maxRecords` (600 → 900), with its measurement.** `ci-integration` failed at `974c643de` in
  `tests/u7-3-devex/devex-integration.test.mjs` E4/E5 with `BOUND HIT: more than maxRecords 600 … REFUSED`
  (run `45508260944`, job `138849199239`). Cause: **602** committed `u5-run-record/1` records.
  `scripts/integration-order.mjs` `BOUNDS.maxRecords` raised **600 → 900** with the measurement in its header
  (10,440 tracked evidence `.json`; 623 mention the schema; 602 parse; `maxCandidates` unchanged at 12,000).
  Controls untouched and green: E7 still builds `maxRecords + 1` and requires `BOUND HIT`, E8 still requires a
  late record graded without it, E4 still requires `--strict` to fail on an unbound head. No evidence deleted,
  no assertion/timeout/retry/skip widened. Hosted proof: `ci-integration` success at `5cb5c6062`.
- **dispatch-parity evidence regenerated (`92be91dfb`).** `scripts/test-catalog.test.mjs` refused:
  `the dispatched set moved away from the committed parity evidence — regenerate it deliberately`
  (`b5b99294…` vs `f8488aa9…`). Round 114 added `tests/checks/d4-evidence-consistency.test.mjs` to a dispatch
  leg, so the union grew by exactly one suite (77 → 78). Regenerated with the repo's own generator and its
  declared base: `dispatch-tests --parity --old-ref e5bf05670` → `union old=25 new=78 set=sha256:b5b99294…`,
  `problems=0`, nothing missing, only the one declared suite added. The control refused correctly and now
  agrees with the resolved set; no assertion relaxed. Full note: `round115/dispatch-parity-regeneration.md`.

### 3. The fresh dual-host candidate gate at `92be91dfb` — and why it still describes `5cb5c6062`

`CANDIDATE-GATE pass hosts=legacy,next judges=62 proven=60 known-refuted=2 env-limited=0` (2 agreeing boots per
driver; verdict
`dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T23-43-47-693Z/verdict.json`; summary at
`round116/candidate-gate-92be91dfb-summary.txt`). The 2 known-refuted are the single enumerated
`d4:ask-execute-process`, once per host, preserved as REFUTED.

**It was run at `92be91dfb`, NOT at `5cb5c6062`.** The product code is unchanged across those heads:
`git diff --stat 92be91dfb..5cb5c6062 -- 'packages/*/src'` prints **nothing** (exit 0, zero lines; saved as
`round116/product-diff-92be91dfb-5cb5c6062.txt`). Every intervening commit is evidence or evidence
regeneration, so the verdict is representative of this head's product code — stated as a transfer over identical
code, never as a run at this head. The layer stays **NON-REQUIRED**; a green there is `DEV-LIVE`, never
PRODUCT-PROVEN.

### 4. The rc.5 matrix outcome — ladder closed, the vitest population measured

- **18/18 B-ladder arms green on BOTH hosts** (16 pass + the same 2 declared non-runs each), through the one
  selector; no arm, assertion, skip or timeout moved.
- **The 40 host-importing vitest suites remain not gradable on rc.5 through the one selector — `ENV-LIMITED`,
  layer = Vite, 0 of 40 counted.** Bounded probe (1 throwaway probe + 5 representative suites): the selector and
  Node loader are correct (plain-Node control resolves `0.2.2-rc.5`), but **Vite resolves bare `@deepseek-ai/*`
  before Node's loader is asked** — `TEAM_TEST_HOST=next NODE_OPTIONS=--import=…/host-loader.mjs` still yields
  `0.2.0-rc.2`, and `server.deps.inline` is inert. The representative suites stayed green **while importing
  rc.2 modules** (a false green, not coverage). A Vite-side redirect derived from the selector's mapping *would*
  work (measured `0.2.2-rc.5`) but is a **second selection mechanism**, refused. The host would need a
  Vite/Vitest seam that lets the registered loader own bare-specifier resolution, or a host-published Vite
  plugin parameterised by the selected tree. Evidence: `round116/VITEST-HOST-PROBE.md`,
  `RC5-TEST-MATRIX.md` §10.

### 5. Security findings' dispositions (no open item)

SEC-01 admission-fact durability **FIXED** (fsync-before-return, fail-closed refusals, arms `SEC-01a…d`; a
physical power cut is still not injectable). SEC-02 d4 evidence contradiction **FIXED, history retained**
(dated banner + `d4-evidence-consistency.test.mjs`). SEC-03 host-capability tools with no managed lane
**DECLARED** (matrix row C-host-capability, acceptance row 35). SEC-04 ungoverned rows **DECLARED** (labelled
mode). Details: `SECURITY-REVIEW-20261125.md` § "Disposition".

### 6. Gate block at this head (`dev/agent-workflow/evidence/ute-a1/round116/`)

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

### 7. Required CI at this head — the honest position

The final hosted Required set **is** the green run at `5cb5c6062` above. It exists because the PR was briefly
marked ready for that one evaluation (census only runs on a non-draft PR) and restored to DRAFT immediately
after. Further hosted green requires the owner's ready flip; this body claims no hosted green for any later
commit.

## ROUND 115 — one reviewable candidate report, and the one hosted Required-CI red fixed

Head `974c643de` + this round's commits (named in the settlement comment), branch `vnext/a1-cut`, PR **#822
stays DRAFT**. This round writes **one document a reviewer reads first** and fixes the single standing red in
the hosted `ci-integration` layer. **No capability level moves; no row becomes PRODUCT-PROVEN; no history
rewrite; no upstream patch; no assertion, timeout, retry or skip widened.**

**The entry point is now
[`dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md`](https://github.com/ArmourPiercer1/dsh-agent-team/blob/vnext/a1-cut/dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md).**
It states: identity (branch / `974c643de` / base `master @ a19d1df01` / PR #822 DRAFT / the A0 contract it
implements / the one-paragraph claim), static closure with what the numbers do **not** prove, the
single-authority verdict (`SINGLE-AUTHORITY`, 53 surfaces, 0 findings), the P1–P5 ladder with the six rungs and
the OS negative controls plus the three declared exceptions (PTC unsupported by ruling; per-call process ask
unsupported by ruling with the `d4:ask-execute-process` REFUTED preserved; env-limited arms), Required CI, the
C1–C18 summary with every UNSUPPORTED/ENV-LIMITED row named, host-modification authority, the candid limits
list, the reviewer's exact commands, and the boundaries in force. `D-ACCEPTANCE-REPORT.md` keeps every round
section unchanged and its header now points at the candidate report as the entry point.

### The hosted red, named and fixed with a measurement

`ci-integration` failed at `974c643de` in one step: `EB4-B/D/E tooling suites` →
`tests/u7-3-devex/devex-integration.test.mjs` **E4/E5**, `BOUND HIT: more than maxRecords 600 committed run
records … REFUSED, no partial report is produced` (run `45508260944`, job `138849199239`, step 19; reproduces
locally, so it is not a runner defect). Cause: the branch now carries **602** committed `u5-run-record/1`
records, exceeding `scripts/integration-order.mjs`'s *capacity budget* — a bound the script's own header says
must be **raised with a measurement**, never trimmed by deleting evidence (done twice before, 2026-11-13 and
2026-11-22/24). `BOUNDS.maxRecords` **600 → 900**, with the measurement in the header and at the declaration:
10,440 tracked `.json` under the evidence root (12 over the 512 KiB cap, unread), 623 mention the schema,
**602 parse**. The controls are untouched and re-run green: `E7` still builds `maxRecords + 1` fixture records
and requires `BOUND HIT`, `E8` still requires a late record to be graded, `E4` still requires `--strict` to
fail while any record does not bind the candidate head. Local `devex-diag` after the fix: **44 tests / 44 pass
/ 0 fail**.

### Gate block at this head (`dev/agent-workflow/evidence/ute-a1/round115/`)

| gate | measured verdict |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` (`A5SF_REQUIRE_PINNED_HOST=1`) | **255 tests / 252 pass / 0 fail / 3 disclosed skips**, `exit=0`, set `sha256:edd4f1c4…` |
| `dispatch-tests --run --leg devex-diag` | **44 / 44 pass / 0 fail**, `exit=0` |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=786 collected=734 excluded=14 uncollected=38`, digest `sha256:8982e6e9…`, `findings=0` (**no new scannable file**) |
| `ute-cut-closure --check` | `pass deleted=148 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 findings=0` |
| `ute-p0-assets --check` | `pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148) findings=0` |
| `docs-sync --check` | `docs=193 findings=0 blocking=0 contracts=20 pairs compared` |
| `place-dist-glue` | `done (35 placement(s))`, every line byte-identical |
| `eb3-ci-required` | `pass workflows=11 findings=0` |
| bound vitest (`ci-integration`, 15 suites) | `PASS 238 passed / 0 failed` (`clock_ms=20000`, unchanged) |
| UTE G1 nine-file argv (exact CI argv) | **89 tests / 89 pass / 0 fail / 0 skip** |
| `EB3-RUN-MANIFEST` | `pass records=602 strict=0 incomplete=11 findings=0` |
| `ci-pr-gate --full --census-captures 2` | **PASS 10/10**, 294.9 s, census `599f/7424l` twice with **identical identity sets**, `refused=0` |

### Required CI at this head — the honest position

The last **fully green hosted set with census** is run `45429461306` @ `a4a00fc816` (2026-11-24T15:46:52Z; also
`45424962377` @ `fc4bac62e2`). At `974c643de` the hosted set is **red** for two named reasons: `ci-census`
**skipped** because the PR is a draft (`.github/workflows/ci-required.yml:150` — so `ci-required` cannot be green
until the owner flips ready), and the `ci-integration` bound described above (now fixed locally). **The final
head must re-earn the whole set in the coordinator's hosted run; this body claims no hosted green at this head.**

## ROUND 114 — the three security findings are closed (no capability row moves, PR stays DRAFT)

Head `b5da23b4b` + the round-114 commit (named in the settlement comment), branch `vnext/a1-cut`. This
round changes **one product file** (`fact-ledger.mjs` + its dist mirror), **one test file** (four new
arms), **one new `tests/checks` arm**, evidence docs, and the D4 README correction. **PR #822 stays
DRAFT; no history rewrite, no merge, no upstream patch, no PRODUCT-PROVEN claim.**

| finding | disposition | what proves it |
| --- | --- | --- |
| **SEC-01** ledger append not `fsync`'d | **FIXED** | `fact-ledger.mjs`: `open(O_APPEND) → write → fsync(file) → close`, plus one directory fsync on create; admission registered in memory only after the durable append. **Policy = fsync-before-return, not a batched window** (bounded: one fsync/record + one dir fsync for the file's first record). Refused fsync is named and fail-closed (`LEDGER_NOT_DURABLE` / `LEDGER_DIRECTORY_NOT_DURABLE` / `LEDGER_CLOSE_FAILED` / `LEDGER_UNRECOVERABLE`), bytes rolled back, settlement never opened. Format/ordering/digest/replay unchanged. Arms `SEC-01a…d`. |
| **SEC-02** d4 README inverts the routed-wake verdict | **FIXED (history retained)** | `d4/README.md` corrected 2026-11-25 with a dated banner; round-87/88 text kept as `[HISTORICAL]`; §2 now transcribes `results.json` at head `41d579119` (all seven routed sub-judges PROVEN; `overall` BLOCKED only for the declared `d4:ask-execute-process`). Machine check `tests/checks/d4-evidence-consistency.test.mjs` (head/judge-set/verdict/`overall` equality + no current-tense REFUTED about a PROVEN judge outside a historical block). Mutation control: RED on the pre-correction README. |
| **SEC-03** host-capability tools have no managed lane | **DECLARED — no behaviour change** | `CAPABILITY-MATRIX-C.md` row **C-host-capability** + DECLARED UNCOVERED BOUNDARY status, and the single acceptance table **row 35** in `D-ACCEPTANCE-REPORT.md`. |
| **SEC-04** ungoverned rows outside every invariant | **DECLARED (unchanged)** | still a labelled product mode; no fix proposed. |

**No finding remains open.** `SECURITY-REVIEW-20261125.md` carries the per-finding disposition table and
its §3/§7 are updated; `D-ACCEPTANCE-REPORT.md` has the round-114 block; `CAPABILITY-MATRIX-C.md` has the
round-114 section. **No capability level moves and no row is PRODUCT-PROVEN.**

**Gates at this head (all exit 0; logs in `round114/`):** `dispatch-tests --run --leg ute-vnext-a1`
**255 tests / 252 pass / 0 fail / 3 skip** (the 4 SEC-01 arms added); `test-catalog --max-uncollected 41
--max-excluded 7` **tests=786, collected=734, uncollected=38, excluded=14, findings=0** (**new
scannable-surface delta = +1 test**, the `d4-evidence-consistency` arm; booked in `round114/README.md`);
`ute-cut-closure --check` **pass** `cut(0/148)`; `ute-p0-assets --check` **pass** `cut(148/148)`; `docs-sync
--check` **docs=193 findings=0 blocking=0**; `place-dist-glue` **35 placements** byte-identical;
`eb3-ci-required` **pass workflows=11 findings=0**; bound vitest (`ci-integration`, 15 suites) **PASS 238
passed / 0 failed**; UTE G1 nine-file argv **89/89**; `EB3-RUN-MANIFEST` **pass records=602 strict=0
incomplete=11 findings=0**; `ci-pr-gate --full --census-captures 2` **PASS 10/10**.

## ROUND 113 — the C1–C18 sign-off and the adversarial security review (evidence only; no row moves)

Review `20261125-0058` Stage C. Two documents, both evidence-bound and both independent of the older
prose in the D report:

- [`C1-C18-SIGNOFF.md`](C1-C18-SIGNOFF.md) — one row per item of
  `docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md` (19 contract rows + C13's two ruled-out arms
  = **21 sign-off rows**), each with the contract requirement, the evidence (test ids / run records / live
  judges + paths), the level, the limitation and required-vs-candidate gate status.
- [`SECURITY-REVIEW-20261125.md`](SECURITY-REVIEW-20261125.md) — an adversarial audit of Admission,
  Provider/OS boundary, Settlement, Control and Stop: claimed invariants, an attempted break for each
  (code + throwaway probes + existing arms), verdicts, and findings with `file:line` and severity. **No fix
  included**, by instruction.

**Counts (21 sign-off rows): MECHANISM 7 · DEV-LIVE 8 · ENV-LIMITED 1 · UNSUPPORTED BY PRODUCT RULING 5 ·
NOT PROVEN 0 · PRODUCT-PROVEN 0.** Folded back to the contract's granularity (18 + C14b = 19 rows):
7 MECHANISM, 8 DEV-LIVE, 1 ENV-LIMITED, 3 UNSUPPORTED, 0 NOT PROVEN. The two ruled-out arms are the
already-recorded owner decisions (PTC = `ADR-ptc-unsupported.md`; per-call process `ask` =
`SCOPE-subprocess-ask.md`), not gaps. **No row is upgraded by the non-required candidate gate.**

**Security findings (round-113 state — all four DISPOSITIONED in round 114, see the section above):**
SEC-01 the admission ledger append is not `fsync`'d
(`fact-ledger.mjs:126`; process-crash durable, machine-crash not); SEC-02 `d4/README.md` still inverts the
routed-wake verdict against `results.json`; SEC-03 host-capability tools have no managed I/O lane; SEC-04
ungoverned rows are outside every invariant. **[ROUND 114: SEC-01 FIXED, SEC-02 FIXED with history
retained, SEC-03/SEC-04 DECLARED.]** **No managed Admission / Provider-OS / Settlement / Control /
Stop invariant was found BROKEN at that head.** The hostile-code threat model is not met (six-item list in
the review; its fsync item is now closed).

**Gates at this head (all exit 0; logs in `round113/`):** `dispatch-tests --run --leg ute-vnext-a1`
**251 tests / 248 pass / 0 fail / 3 skip** (set `sha256:edd4f1c4…`); `test-catalog --max-uncollected 41
--max-excluded 7` **tests=785, collected=733, uncollected=38, excluded=14, findings=0** (digest
`sha256:da8a452d…` unchanged; **new scannable-surface delta = 0**); `ute-cut-closure --check` **pass**
`cut(0/148)`; `ute-p0-assets --check` **pass** `cut(148/148) modules=37 files=180 lines=69512`;
`docs-sync --check` **docs=193 findings=0 blocking=0**; `place-dist-glue` **35 placements** byte-identical;
`eb3-ci-required` **pass workflows=11 findings=0**; bound vitest (`ci-integration`, 15 suites) **PASS 238
passed / 0 failed**; UTE G1 nine-file argv **89/89**; `EB3-RUN-MANIFEST` **pass records=602 strict=0
incomplete=11 findings=0**; `ci-pr-gate --full --census-captures 2` **PASS 10/10** (295.4 s, census
`599f/7424l` twice, identical identity sets).

**Earlier rounds (unchanged numbers, kept for the record).** **Round 108 / `acc72e58e`:** `candidate-acceptance-gate --hosts next` **PASS** (31 judges / 30 proven / 1 enumerated refuted / 0 env-limited, 4 drivers, 8 records, agreement); `dispatch-tests --run --leg ute-vnext-a1` **251 tests / 248 pass / 0 fail / 3 skipped** (leg digest unchanged `sha256:edd4f1c4…`); `test-catalog --max-uncollected 41 --max-excluded 7` **tests=785, uncollected=38, excluded=14, findings=0** (no new scannable file); `ute-cut-closure --check` **pass** `cut(0/148)`; `ute-p0-assets --check` **pass** `cut(148/148)`; `docs-sync --check` **docs=193 findings=0 blocking=0**; `place-dist-glue` **35 placements** byte-identical; `eb3-ci-required` **pass workflows=11 findings=0**; bound vitest (`ci-integration`, 15 suites) **PASS 238 passed / 0 failed**; UTE G1 nine-file argv **89/89**; `EB3-RUN-MANIFEST` **pass records=552 strict=0 incomplete=11 findings=0**; `ute-a1-window --check` **pass red=0/0**; `ci-pr-gate --full --census-captures 2` **PASS 10/10** (321.3 s, census `599f/7424l`, two captures with identical identity sets; the first attempt hit one unrelated loopback-timeout flake in `u6-mcp-017-regression`, disclosed in `round108` §6). Earlier, **Round 106 / `563feac13`:** `dispatch-tests --run --leg ute-vnext-a1` **251 tests / 248 pass / 0 fail / 3 skipped** (digest `sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975`); `test-catalog --max-uncollected 41 --max-excluded 7` **tests=785, uncollected=38, excluded=14, findings=0** (digest unchanged); `ute-cut-closure --check` **pass** `cut(0/148)`; `ute-p0-assets --check` **pass** `cut(148/148)`; `docs-sync --check` **docs=193 findings=0 blocking=0**; `place-dist-glue` **35 placements** byte-identical; `eb3-ci-required` **pass workflows=11 findings=0**; bound vitest (`ci-integration`, 15 suites) **PASS 238 passed / 0 failed**; UTE G1 nine-file argv **89/89**; `EB3-RUN-MANIFEST` **pass records=546 strict=0 incomplete=11 findings=0**; `ute-a1-window --check` **pass red=0/0**; `ci-pr-gate --full --census-captures 2` **PASS 10/10** (348.2 s, census 599f/7422l, two captures with identical identity sets). Earlier, **Round 98 / `a95be5f11`:** local `ci-pr-gate --full --census-captures 2` = **PASS 10/10** (277.6 s); bound `ci-security` 222 and `ci-integration` 238; UTE G1 argv 89/89; `ute-vnext-a1` leg 242 tests (239 pass, 3 skipped); docs/matrix/D-report updated for the two decided rulings. Earlier (round 95 / `d322b17aa`): local `ci-pr-gate --full --census-captures 2` = **PASS 10/10** (275.4 s); bound vitest `ci-security` 222 / `ci-integration` 238; UTE G1 argv 89/89; the hosted verdicts below belong to the round-89 head and are re-queried after this push. Earlier round-89 local status: all required gates green, including `ci-pr-gate --full --census-captures 2` = **PASS 10/10** (275.7 s). Hosted: `pr-gate`, `ci-fast`, `ci-security`, `ci-product`, `synthesize-merge-tree`, `candidate-protection` green; **`ci-integration` FAILURE** on leg `tinf-instruments` (no named failing assertion; not reproduced locally — see "Open gaps" G10); `ci-census` **SKIPPED (draft)**; `ci-required` **RED for `ci-integration:failure,ci-census:skipped`**; `pr-settlement-gate` red until the round-89 settlement comment. On the docs-only follow-up head `d1506acd1` the same hosted job set re-ran with **`ci-integration` SUCCESS**, so the `97d7d7c8d` abort was transient; `ci-required` remains red there only for the draft census skip.

## ROUND 112 — the B ladder's rc.5 cell closes (observation only; no capability row moves)

The one rc.5 test-population red that round 110 left open — **all 18 `vnext-b-probe-ladder` arms**, which
died in the `before` hook because rc.5 removed `ToolRuntime`'s `mode` config — is closed. The ladder is
now **host-selectable, not host-doubled**: one arm set, one expectation set, two host shapes, selected
through the existing `tests/next-host/host-select.mjs`.

1. **The rc.5 replacement API, read from the pin.** `mode` is `z.never()` ("Removed. Mount a native or
   PTC tool executor instead." — `tests/deepseek-harness-next/packages/core/tools/lib/index.js:406-409`).
   Dispatch now delegates to a per-scope EXECUTOR (`tools.execute` → `selectExecutor(input.agent)`,
   `:641-643`; `setExecutor` is one-per-scope, `:577-620`), the reserved `run_code` transport moved into
   `PtcExecutor.requirePtcTransport()` (`…/core/tool-executor-ptc/lib/index.js:1867-1870`), and a call is a
   BATCH (`{calls:[{type:'tool-call', id, name, arguments:<JSON string>}], signal, agent}` →
   `batch.results[].result`, `…/core/tools/lib/pipeline.js:28-52`). Each executor is a plugin object
   `{name, inject, apply}` (`…/core/tool-executor-native/lib/index.js:20-31`).
2. **How the world mounts on each host.** rc.2 keeps its byte-for-byte mount (`mode:'both'` / `mode:'native'`,
   the repo install, single-call dispatch). rc.5 mounts `ToolRuntime` with NO config, mounts the exported
   executor PLUGIN at the deployment scope (PTC for the PTC-presenting world, native for the shipped one),
   nests a `NativeToolExecutor` under the member scope so native calls and the retained `run_code` entry
   coexist where the host allows (one executor per scope), resolves every `@deepseek-ai/*` entry through
   `resolveSelectedHostModule`, dispatches through the existing `executeToolDispatch` batch shape, resolves
   `run_code` through `requirePtcTransport()`, and supplies the `workingDirectory` service rc.5's tool
   packages statically inject.
3. **Measured.** The same 18 arms, same assertions, on both hosts: **rc.2 18/18** (16 pass + 2 declared
   non-runs) and **rc.5 18/18** (16 pass + 2 declared non-runs, 0 fail). The leg is **251 / 248 pass / 0
   fail / 3 skip on BOTH hosts** (`sha256:edd4f1c4…` unchanged). The two non-runs are the arms' own
   declared states, unchanged from rc.2: `ADM-68` (bash positive — no compiled execution authorization in
   this world) and `ADM-69` (PTC positive — NOT APPLICABLE, product ruling). Full per-arm table and the
   replacement-API reading: `dev/agent-workflow/evidence/ute-a1/RC5-TEST-MATRIX.md` §9.
4. **No product change, no shim.** Only `packages/runtime/test/vnext-b-probe-ladder.test.mjs` changed (the
   world's mounting code); no file under `packages/*/src`. No `mode` polyfill, no widened timeout, no
   retry, no skipped arm, no weakened assertion. The two host pins are unmodified
   (`git -C tests/deepseek-harness-next status --porcelain` and the same on `-test-use` are empty).

## SCOPE — the Subprocess/PTY promise (`allow`/`deny`; per-call `ask` is NOT supported)

**APPROVED BY OWNER (2026-11-24, review `20261124-2120` ruling 1).** This is a **product scope** ruling:
behaviour does not change, only the declared promise does. Process Ask is **`UNSUPPORTED BY PRODUCT
RULING`**, the same class as PTC. Full statement: [`SCOPE-subprocess-ask.md`](SCOPE-subprocess-ask.md).

> **This generation promises `allow`/`deny` for Subprocess/PTY. Per-call `ask` for process execution is
> NOT supported and remains fail-closed.**

- **What stands:** live persistent `bash` under the OS sandbox (two turns on one shell, `d3:persistent-subprocess`,
  both hosts), out-of-lane refusal by the OS profile (`Read-only file system`, 0 bytes), PTY confinement
  (`OWNER_NOT_LIVE`, `PTY_PROCESS_DENIED`, `PTY_PROCESS_RECEIPT_REFUSED`), and Stop (`d2:stop`; `d4:ask-stopped`).
- **What does not:** `d4:ask-execute-process` is **REFUTED on BOTH hosts** — the real ask→approval→grant
  consumption DID occur, then the v5 per-tool `bash` binding landed on a realm with no governed PTY
  backend (`no PTY backend registered for "a5sf-governed-shell"`), so the PTY spawn failed with
  `NO_BACKEND` **before any process existed**: **zero process, zero bytes, settlement `FAILED`** (never
  `REFUSED`/`not-started`), receipt verifier never reached. The R3 receipt is **not** extended to the
  process face: a file-operation receipt must never be read as permission to bypass the OS sandbox.
  Preserved verbatim: 16/17 PROVEN, 1 REFUTED.
- **A future generation would need:** a governed PTY backend on the binding realm **and** a process-scoped
  receipt that cannot widen the kernel profile (`SCOPE-subprocess-ask.md` §5). Neither is scheduled.
- **P0-2 is CLOSED BY OWNER RULING (round 106)** — the lawful "no settlement" boundary, no upstream seam
  and no second authority (`D-ACCEPTANCE-REPORT.md` row 31; `OWNER-DECISIONS.md` round 106). The law:
  `No Admission + No Body Start => No UTE Settlement (lawful)`; `Admission Exists => Terminal Settlement
  Required`; `Body started + unconfirmable => UNKNOWN`. Tested on both hosts by `SLICE-40`/`SLICE-41`/
  `SLICE-42`; `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` remains a report, never a settlement. The observer
  still not being wired into a booted host's own agent loop is a **coverage limit**, not a blocker.

## ROUND 108 — the two rc.5 gaps re-run; the `d2` rc.5 refutation was a PRODUCT defect, fixed

Review `20261124-2120` §3 (first P0) named the two rows the round-106 table still carried as rc.5 gaps:
`d:remote-creation` (never re-run on rc.5 since the round-91 judge repair) and `d2:remote-delivery` (no
rc.5 verdict, plus the round-105 candidate-gate MEASURED refutation of one clause). Both were re-run on
rc.5 (`TEAM_TEST_HOST=next`, `--boots 2`) and both are **PROVEN**. **No row moves; no rc.2 verdict was
touched; PR #822 stays DRAFT.**

**The refutation was the product's fault, not the judge's.** On rc.5 `member.archive` returned its own
typed failure (`archiveOk=false`) and the durable member row stayed `SETTLED`; the round-105 observation
discarded that reply's error code, so only the consequence was visible — `member.send` →
`ok=true code=null requestsAdded=0`. The send was CORRECT (`SETTLED` is work-accepting, so an un-archived
member lawfully accepts a delivery): the archive had never happened. Root cause: **rc.5 renamed the
PUBLIC `subagents.drainContinuableDescendants` to `subagents.drainDescendants`** — same signature
(`parents: readonly Agent[]`), same aggregate-after-settle contract, the very same
`manager.drainDescendants` underneath. The drain seam required only the rc.2 name
(`packages/runtime/src/plugin/vnext/stop-drain-lane.mjs`, pre-fix lines 194/201), so on rc.5
`recursive-drain-unavailable` → `LIFECYCLE_LIVE_EFFECT_FAILED` at step `drain-descendants` → **zero
durable writes** → the member stayed `SETTLED`.

**The fix (CORE PATCH BUDGET = 0, no upstream patch).** `resolveDrainSeam` (`stop-drain-lane.mjs:177`)
resolves the drain seam by PUBLIC NAME capability — `drainDescendants` (rc.5) first, then
`drainContinuableDescendants` (rc.2) — and passes the parents verbatim (`:238`, `:248`); a host exposing
neither still fails closed through the same typed `recursive-drain-unavailable` path (`:241`). Arms
**M3-6** (a double exposing ONLY the rc.5 name drives the same drain + honest count) and **M3-7**
(`listDescendants` but neither public drain name still refuses) are in the already-collected
`packages/runtime/test/t12a-m3-recursive-drain.test.ts` (7/7 pass). The d2 driver also records the
archive reply's own typed channel (`archiveCode`/`archiveMessage`) — **observation only; no clause
predicate relaxed, no judge skipped, no timeout widened, no retry loop.**

**Positive control (the clause was NOT relaxed into "nothing happened").** On the same rc.5 boots the
same `member.send` channel is accepted for a LIVE member (`ok=true`, `deliveredSeq=40`) and again after
`member.restore`; it refuses exactly the ARCHIVED target with the typed code
`TEAM_RUNTIME_WORK_STATE_REJECTED` and `requestsAdded=0`.

**Measured (both drivers 2/2 boots, `agreeing=true differing=[]`):**

```
d    RESULT PASS — 6/6 judges; d:remote-creation 8/8 clauses each boot
     allowFacts=2 denyFacts=0 centreAdmissions=2 centreExecutions=2 governedSurface=true
d2   RESULT PASS — 4/4 judges; d2:remote-delivery 20/20 clauses each boot
     archived-member-refused-typed: archiveOk=true lifecycle=ARCHIVED
     code=TEAM_RUNTIME_WORK_STATE_REJECTED requestsAdded=0
```

**Candidate gate (rc.5) now reads:** `CANDIDATE-GATE pass host=next judges=31 proven=30
known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true` at head `acc72e58e` — the only
non-PROVEN id is the enumerated `d4:ask-execute-process`; `KNOWN_REFUTED` was not extended. All
round-108 gates (dispatch leg 251/248/0/3 with the leg digest unchanged; catalog 785/38; closure four
zeros; assets 37/180/69,512; docs-sync 0 findings; place-dist-glue 35; ci-required 11/0; bound
`ci-integration` 238/238; UTE G1 argv 89/89; run-manifest 552; window red=0/0; `ci-pr-gate --full
--census-captures 2` **PASS 10/10**, 321.3 s, census `599f/7424l` with identical identity sets) and the
one disclosed `u6-mcp-017-regression` loopback-timeout flake on the first `ci-pr-gate` attempt are in
`dev/agent-workflow/evidence/ute-a1/round108/README.md` §6. **Population delta: zero new scannable
files** (the two arms live inside an already-collected file), so the catalog population and the leg
digest are unchanged by construction.

## ROUND 106 — the two owner rulings implemented (scope APPROVED; P0-2 CLOSED by the lawful no-settlement boundary)

Owner review `20261124-2120`, rulings 1 and 2 (ruling 3 approved, not implemented this round). **No product
behaviour change beyond ruling 2**, which is a tested-law implementation: no second authority, no upstream
patch, no weakened assertion, no widened timeout, no retry loop, no rewritten historical evidence.
Measured at `563feac139e87e7cc3269d3d4d799afc0b676568`. Evidence: `dev/agent-workflow/evidence/ute-a1/round106/`.

- **Ruling 1 — the Subprocess/PTY scope is APPROVED (product scope only).** `SCOPE-subprocess-ask.md` is
  APPROVED BY OWNER (2026-11-24); Process Ask is `UNSUPPORTED BY PRODUCT RULING` (same class as PTC). All
  documents that named it changed PENDING → APPROVED (`CAPABILITY-MATRIX-C.md` C-subprocess/C-pty/`ask`,
  the single status table in `D-ACCEPTANCE-REPORT.md`, `ADR-approved-ask-receipt.md`, `OWNER-DECISIONS.md`,
  this body); the candidate gate's `knownRefuted` citation now names the APPROVED ruling (literal id, never
  a pattern). The historical `d4:ask-execute-process` REFUTED evidence is preserved verbatim: **16/17
  PROVEN, 1 REFUTED, zero process, zero bytes, settlement `FAILED`**; the real ask→approval→grant
  consumption DID occur, then the PTY spawn failed with `NO_BACKEND` before any process existed — not a
  positive test, not `REFUSED`/`not-started`. Future per-call process `ask` support requires a **new
  product contract + process boundary design** (`OWNER-DECISIONS.md` round 106).
- **Ruling 2 — P0-2 CLOSED.** The law is recorded verbatim in `OWNER-DECISIONS.md` and implemented as
  tested behaviour by three arms, green on **both** pinned hosts:
  `SLICE-40` (pre-admission cancel: no body, no provider call, no approval, no minted/spent grant, no
  written byte, no centre state row; durable ledger still refuses `LEDGER_EXECUTION_UNBOUND`;
  `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` is a report), `SLICE-41` (admitted-then-stopped records its Stop
  and must reach terminal `CANCELLED`, impossible to classify as "no settlement"), `SLICE-42` (source pin:
  no code path can write an execution fact without an admission). No refusal code removed or renamed; the
  host's `ABORTED_BEFORE_DISPATCH` return is untouched and no `tools/result` is fabricated.
- **Not done this round (the owner's next list):** rc.5 re-runs of `d:remote-creation` and
  `d2:remote-delivery` including the round-105 rc.5 refutation, the full rc.5 test population, a real-model
  smoke test, and C1–C18 sign-off.

## ROUND 102 — the D4 acceptance runs on the TARGET host (0.2.2-rc.5), judge by judge

**This section supersedes the D-stage sentences above and the round-87/93/97 D4 wording.** The single
current verdict table is the first section of `dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md`;
everything older in that file is historical where it disagrees.

Measured at `10d8a67aeb7e189011faf2c131a73aa33b76fac3`, branch `vnext/a1-cut`, PR **#822 DRAFT**.
Evidence: `dev/agent-workflow/evidence/ute-a1/round102/` (`d4-rc2/`, `d4-rc5/`, the two transcripts).

* **The probe is host-selectable now, like the other three D drivers.** One genuine porting bug was
  found and fixed: `probe-d4-routed-wake.mjs` mounted the governed realm's native `tool-fs` from a
  literal rc.2 path, so under `TEAM_TEST_HOST=next` an **rc.2 module** ran inside an **rc.5 Host**.
  Measurable, not stylistic: rc.5's `tool-fs` injects `workingDirectory` and rc.2's does not
  (rc.5 `…/tool-fs/lib/index.js:2003-2008`, rc.2 `…:1176-1180`). It now comes from the selected tree;
  ports/home suffix/child loader/pin already followed `tests/next-host/host-select.mjs`.
* **rc.5 result, `--boots 2`**: 16 of the 17 judges **PROVEN**, with counters and bytes **identical** to
  rc.2 — 8 wake facts, 4 routed / 4 delivered, **0** management executions, **0** wake-intent files,
  `write` under an approval 27 B `sha256:ced10112…` and 29 B `sha256:2d71ffdd…`, both `COMPLETED`;
  deny and Stop-while-pending leave **0 bytes** and settle `REFUSED`; `runRecordsValid=true`; world
  ids `…-next`, port `13000`, rc.5 tree porcelain `[]` before/after. The two per-host `agreement.txt`
  files are **byte-identical**.
* **One REFUTED on BOTH hosts, for a product reason**: `d4:ask-execute-process` —
  `Error: no PTY backend registered for "a5sf-governed-shell"` (host
  `packages/terminal/terminal/src/index.ts:140`; product: the governed PTY face is created only when
  a PTY terminal spec is passed, `packages/runtime/team-services/src/install.ts:609-619`, and a v5
  per-tool `bash` binding lands on a realm that carries none). Zero bytes, settlement `FAILED`,
  fail-closed. Owner decision; **not** an rc.5 drift.
* **One measurement oracle made deterministic (disclosed, no capability relaxed)**: `d4:case-created`'s
  `case-has-no-decision-yet` read the ledger AFTER the capture, so it measured how fast the Officer
  decides — boot 2 at `5952c84` had the decision 176 ms after creation, faster than the probe's
  300 ms poll, refuting a correct product. It is now `captured-case-precedes-any-decision`: the
  captured row is the `control-request-recorded` fact and every decision has a strictly later
  sequence in the append-only ledger.
* **P0-2, classified OPEN in round 102 — CLOSED by owner ruling in round 106.** The ruling chose (b), the
  lawful "no settlement" boundary, so no public batch-completion seam is needed and no upstream patch is
  proposed. `pre-dispatch-abort.mjs` is still not wired into a real host's agent loop — now a **coverage
  limit**, not an acceptance blocker (see the round-106 section at the top of
  `D-ACCEPTANCE-REPORT.md`). The product's `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` remains a report and
  never a settlement.
* **Levels:** no row moves; no row is PRODUCT-PROVEN. `C-alpha6` and the R3 `write` receipt are
  **DEV-LIVE on both hosts**; the governed process face is **NOT-PRODUCT-PROVEN**.

## What this candidate is (one paragraph)

This is the UTE vNext floor, cut and measured in four stages. **A1** retires the old governed-family
plane: 148 frozen sources gone (146 deleted + 2 replaced), **151 additional stale dist mirrors** on top
of the 52 A0-accounted ones, closure at four zeros (`prodRefs`, `distResiduals`, `dupNames`, `findings`)
with `references=3` non-production references remaining, census unchanged at 37/180/69,512. **B** makes
the centre real: one admission authority on three unmerged axes, durable facts, an ask path, Stop and
crash recovery that never replays, and a probe ladder over unmodified host tools. **C** disposes of all
19 contract rows — 15 team tools, member lifecycle, work delivery, a real MCP mount — and refuses PTC
with its own code and the ruled status `unsupported-by-product-ruling` (round 92: PTC is NOT SUPPORTED
this generation by owner ruling, a scope reduction recorded in `ADR-ptc-unsupported.md`, not a blocker); the S6 management plane is
restored (round 74) and serves work delivery (round 83); Alpha.6's formal routing is implemented
(round 84) while its **live routed wake is REFUTED (round 87)** on two named Team-side seams, and the
`ask`-disposition execution path had **no production consumer through round 94 (BL-30, round 88)**; since round 95 it **executes** (the R3 ApprovedAskReceipt authority is wired into the production mount and proven on two agreeing live boots), and round 96 extends the SAME receipt to **every FS mutation** — `writeText`, `editText`, `patchText`, `deleteFile`, `moveFile`, each with its own scope binding and its own proof — while the **subprocess/PTY face and every other tool keep the fail-closed R4 refusal** (an OS-sandbox approval is explicitly NOT assumed to inherit the FS proof). **D** adds live
`dsh web` evidence: **fourteen** judges PROVEN, the previously refuted three (`d3:persistent-subprocess`,
`d2:revocation`, `d:member-read-denied`) now PROVEN, four further round-87 probe judges PROVEN
(enablement / Officer up / Officer binding / incoherent-row refusal) and one REFUTED (`d4:routed-wake`),
and the 405 creation entrance gone (runtime creation since round 74).

## Latest round (98) — the two older owner rulings implemented (realmless Option B, Shape B + the search negative control)

Owner ruling `docs/reviews/20261124-0151.txt` §4, recorded as DECIDED in `OWNER-DECISIONS.md`.

- **Realmless admission = OPTION B.** A governed Member with no enforceable confined provider is
  **REFUSED** with the typed, stable `MEMBER_CENTRE_UNWIRED` (the ruling allowed
  `ADMISSION_PROVIDER_UNCONFINED`; kept because the existing string is the identifier ADM-44/readers
  already use and is not in a closed refusal table — the reason prose states the accurate semantics).
  The round-98 fix moves the gate onto the **mount result**, closing the case where a row declared a
  realm source but the provider compiled none. An ungoverned row (no `centreStatePath`) keeps DSH's own
  permission model but is **reported** `{ mode: 'ungoverned', uteProtected: false }`
  (`admissionModeOf`, plus a `UTE-GOVERNANCE ungoverned` observation) and is never reported as
  UTE-protected. Arms: `ADM-44`, `ADM-44b` (typed refusal + zero files; governed+mounted ⇒ protected;
  ungoverned ⇒ allowed + reported; placement pinned to the mount result).
- **Search = Shape B is the declared support level, and it is NOT full dynamic permission governance.**
  A durable Overlay deny aimed at ordinary file reads does **not** deny `grep`/`glob`; the Overlay
  returns `no-opinion` outside its vocabulary and the compiled lane alone judges the search. The
  ruling's required negative control is GREEN over the REAL search tool paths (`SLICE-39`): parent
  ALLOWED + child DENIED ⇒ the recursive `grep` returns an error with **no match and no byte of the
  protected child** (not even its path), because the confined subprocess face compiles the effective
  lane once and Landlock cannot express a nested deny (`PATH_NESTED_DENY_UNEXPRESSIBLE`) — the spawn is
  refused before any process. Positive control (no child deny) DOES return the child's token, so the
  pair is falsifiable; the centre's fact is `decision=allow` for the ROOT, proving the arm is not a
  root-only check. The dangerous scope is **forbidden wholesale**, not filtered; Shape A remains the
  only shape that can express a nested deny precisely.
- **Levels unchanged / not proven:** both arms are MECHANISM (in-process, pinned host); there is no
  booted AgentSetup arm for the realmless refusal, no PRODUCT-PROVEN row, and no claim that Shape B is
  dynamic permission governance.

## Latest round (95) — the R3 receipt is WIRED and PROVEN LIVE for `write`

The owner ruling `20261124-0151` approved R3 (the ApprovedAskReceipt) and kept R4 as the fail-closed
interim. Round 95 closes R3's last gap: the production mount now passes the **real invocation binder**
as the Provider's receipt authority, for `write`/`writeText` only.

- **Wiring, no invariant moved.** `agent-bindings.mjs:1771-1790` supplies
  `approvedAskAuthority: { binder: grantBinder }` only when the row's Control service is wired
  (`grants !== undefined`); `a5sf-realm-row.mjs` → `mount.ts` → `install.ts:513,880` forward it to
  `createMemberFsGuard(policy, undefined, authority)` on the member and binding-realm faces. Terminal
  faces are untouched; a row without Control keeps the byte-identical fail-closed mount. The observer
  wrapper (`guard-observability.ts:280-305`) now forwards the optional operation context verbatim — it
  had dropped `writeText`'s content, refusing valid receipts with `RECEIPT_CONTENT_UNAVAILABLE`.
- **Live proof, `probe-d4-routed-wake.mjs --boots 2` (DEV-LIVE, real rc.2 host, scripted model
  only).** `d4:ask-execute` is **PROVEN on both boots**: a Member `write` with lane `ask` raises a real
  durable Control request, the Leader allows it through the real control path, the one-shot grant is
  consumed once, the Provider verifies the receipt for THAT execution and writes **27 real bytes**
  (identical `sha256` both boots), settlement `COMPLETED`. Negatives: approval **denied** ⇒ zero bytes,
  `REFUSED`/`not-started`; **Stop** through the public `session/cancel` while pending ⇒ zero bytes,
  `REFUSED`/`not-started`. Two-boot agreement `agreeing=true, differing=[]`.
- **`d4:routed-wake` stays REFUTED, deliberately.** The ordinary ask still carries no approval CASE,
  so the product router selects no Officer; R3 is not routing evidence and `C-alpha6` stays MECHANISM.
- **Counts.** `ute-vnext-a1` unchanged (`228 tests / 225 pass / 3 skipped`, same leg digest); catalog
  unchanged (`785 / 38 uncollected / 14 excluded`); bound vitest `ci-security 218 → 222` (four new
  arms), `ci-integration 238`; UTE G1 argv `89/89`. No new scannable file ⇒ no p4t6 delta.
- **Not proven.** Only `write`/`writeText`; `editText`/`patchText`/`deleteFile`/`moveFile`, subprocess
  and every other tool keep R4. No row is PRODUCT-PROVEN (DEV-LIVE is a record, not a gate). Real-model
  interleaving is not measured.

## Latest round (96) — the R3 receipt extended to EVERY FS mutation (subprocess deliberately untouched)

Owner ruling: extend R3 method by method, each with its own proof; do NOT assume an OS-sandbox
approval path inherits the FS proof. Round 96 does exactly that for the FS face and states the
subprocess face as the next step.

- **One receipt, five operation kinds** (schema bumped to `a5sf-approved-ask-receipt/2`). The
  operation is a discriminated union and the verifier requires an EXACT method↔kind match first, so a
  receipt minted for one method can never satisfy another. Per-method scope binding:

  | tool → Provider method | kind | corridor | fingerprint is a `sha256` of | cannot say |
  | --- | --- | --- | --- | --- |
  | `write` → `writeText` | `fs-write` | target | the exact content string | nothing about prior content |
  | `edit` → `editText` | `fs-edit` | target | the requested `(oldString,newString,replaceAll)` transformation | not prior/resulting bytes (the Provider's match guard decides those) |
  | `patch_text` → `patchText` | `fs-patch` | target | the exact `PatchHunk[]` payload | not prior/resulting bytes, not that the hunks apply |
  | `delete_file` → `deleteFile` | `fs-delete` | target | nothing but the path (`bytesReadBack:false`) | nothing about what was deleted — no bytes are read back by design |
  | `move_file` → `moveFile` | `fs-move` | **both** paths | source + destination, authored and canonical | (a→b) can never authorize (a→c) |

- **Provider.** `moveFile` is now ONE guard over the path PAIR: deny on either path wins before any
  receipt consult, then one receipt verification covers both, then the read-before-mutate rule runs
  for the source and for an existing destination. `editText` forwards the edit triple, `patchText`
  the hunk payload; `deleteFile` forwards the path only. `write`/`edit` are shipped native tools;
  `patch_text`/`delete_file`/`move_file` are DECLARED argument shapes for rc.5 Provider methods with
  no shipped tool this round (no preset mounts them, so no model can reach them; rc.5's real
  multi-file `apply_patch` prepares nothing and stays R4).
- **Arms** (`ADM-162`…`ADM-173`, over the REAL confined Provider on the pinned hosts — rc.2 for
  `editText`, rc.5 for the other three — real binder, real `ControlService`, real settlement store):
  positives for edit/delete/move/patch with the bytes (or absence) verified and `COMPLETED`
  settlements; negatives: content/payload binding (zero bytes, `FAILED` at the body phase),
  cross-operation and cross-path, revoked + reuse, (a→b) vs (a→c), deny-wins on the move destination,
  and a non-mutation approval that mints no receipt.
- **Live** (`probe-d4-routed-wake.mjs --boots 2`, DEV-LIVE, real rc.2 host, scripted model only): the
  D4 probe now performs a SECOND real mutation — a second `write` on a different path with different
  bytes and its OWN durable Control request — judged by `d4:ask-execute-2` (content binding across
  two approvals: both files hold the bytes of their own approval, the first file is unchanged, the
  digests differ). Every existing judge is unchanged, `d4:routed-wake` stays REFUTED.
- **Not proven.** No subprocess/PTY receipt exists (next owner-ruled step); no capability row is
  PRODUCT-PROVEN (DEV-LIVE is a record, not a gate); the four new methods are proven at the
  production composition point and two of them live, but their tool shapes are declared, not shipped.

## What this branch is

- **A1 cut** — 146 frozen files deleted and 2 entries replaced wholesale (`agent-bindings.mjs`,
  `root.ts`) = 148 sources gone, plus **151 additional** stale dist mirrors (52 were already A0-accounted;
  `CUT-BOUNDARY-ADDITIONS.md:27-32`) — `place-dist-glue` maintains the **30** live placements.
  `ute-p0-assets` still reads `modules=37 files=180 lines=69512`; no legacy
  Plane/Family Body/Kernel/PA Bridge wrapped as an internal component and no legacy fallback.
  Closure gate: `deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0
  retiredSurfaces=12 placements=self findings=0` (three non-production references remain; no production
  import of a retired entry).
- **The centre** — one admission authority: identity/IPC binding, `EffectiveIO ⊆ AgentCeiling ∩
  ToolRestriction` on three axes that are never merged, `InvocationAuthorityFacts` /
  `DurableAdmission` / `ExecutionFact`, Control allow/ask/deny with a post-approval recheck, one-shot
  grants, Stop priority, real FS enforcement through the confined provider, durable facts, UNKNOWN, and
  crash recovery that never replays.
- **The wiring** — native DSH `ToolsService` definitions and dispatch only. An unwired controlled call
  is **explicitly refused** (`ADMISSION_AXIS_UNSUPPORTED`, `NETWORK_DENY`, `ADMISSION_TOOL_UNBOUND`),
  never forwarded.

## Why it is a draft

No capability row in `dev/agent-workflow/evidence/ute-a1/CAPABILITY-MATRIX-C.md` is PRODUCT-PROVEN
(the matrix's own rule, `CAPABILITY-MATRIX-C.md:71-74`): the D boots below are `DEV-LIVE` records, not
gates. Closing that is step D, not this PR. The three contract requests it once raised are **two
resolved (the search one is now DECIDED by the round-98 owner ruling, not open)** (round 86 audit corrected this section, which still described all three as open):

- `CONTRACT-CHANGE-REQUEST-process-lane.md` — **RESOLVED / SUPERSEDED** (round 75 + owner ruling §1). The
  v4 grammar already carried the declaration; the projection dropped it. `bash`/PTY are live-proven
  (round 76). **PTC is not a remaining contract question**: the round-92 owner ruling formally closes it
  as NOT SUPPORTED this generation (`ADR-ptc-unsupported.md`), so the refusal is the product boundary and
  no upstream seam is being requested for it.
- `CONTRACT-CHANGE-REQUEST-settlement-recheck.md` — **RESOLVED, owner Option A (round 73)**: a durable
  deny is the legal state for "admitted as allow, then refused before the body"; `ADM-119` is the
  positive. The store's own Stop shape is `Stop + CANCELLED`, never a fabricated allow/UNKNOWN.
- `CONTRACT-CHANGE-REQUEST-search-face.md` — **DECIDED (round 98, owner ruling `docs/reviews/20261124-0151.txt`
  §Search): Shape B is the declared support level for this generation, and it is NOT full dynamic
  permission governance.** The durable Overlay abstains (`no-opinion`) on a face outside its vocabulary,
  so an Overlay deny aimed at ordinary file reads does not deny `grep`/`glob`; the compiled lane alone
  judges the search. The required parent-allow/child-deny recursive negative control is GREEN
  (`SLICE-39`): the confined provider refuses the inexpressible scope before any process, so no child byte
  is read or returned. Shape A (a subtree search face the overlay can deny) remains future work, not a
  delivered capability.

## Owner decisions (the two older rulings are now DECIDED at round 98; four rulings the new seams need remain; PTC is RULED)

`dev/agent-workflow/evidence/ute-a1/OWNER-DECISIONS.md` carries a round-86 correction block and a
**round-89 addendum**; its historical text still describes states from rounds 59–68. Current state:

1. **PTC (`run_code`) — ANSWERED BY THE OWNER (round 92): NOT SUPPORTED this generation.** The ruling
   (`docs/reviews/20261124-0151.txt` §PTC) closes the upstream-seam ask; the amendment is
   `ADR-ptc-unsupported.md`. The governed Member is never offered `run_code`, and the host-retained entry
   is a typed refusal with status `unsupported-by-product-ruling` and zero worker. This is a RULED SCOPE
   REDUCTION: the two PTC POSITIVE arms are `NOT APPLICABLE — PRODUCT UNSUPPORTED` with machine-visible
   markers (asserted), and the refusal negative controls are kept — not deleted tests.
2. **runtime team creation** — **answered and implemented** (round 74); `team.create` is served.
3. **settlement recheck** — **answered** (Option A, round 73); no action.
4. **realm-less admission — DECIDED (round 98): OPTION B.** A governed Member with no enforceable
   confined provider is REFUSED (`MEMBER_CENTRE_UNWIRED`, kept; see `OWNER-DECISIONS.md` for the naming
   justification). An ungoverned row (no `centreStatePath`) keeps DSH's own permission model but is
   REPORTED `ungoverned`/`uteProtected:false` and is never reported as UTE-protected. Arms `ADM-44`/`ADM-44b`.
5. **search face — DECIDED (round 98): SHAPE B is the declared support level, NOT full dynamic permission
   governance.** An Overlay deny on ordinary file reads does not deny `grep`/`glob`; the recursive
   parent-allow/child-deny control is GREEN (`SLICE-39`); shape A stays future work.
6. **Alpha.6** — formal routing **implemented** (round 84); round 87 measured the remaining gap as a
   **live routed wake that the product's own router REFUTES** on a case-less ordinary ask. Two Team-side
   seams, not an upstream seam: no case-bearing ask producer (G1) and BL-30's missing ask consumer (G2).
7. **R1** — commission the Alpha.6-aware case-forming ask lane (G1), or accept the routed wake stays
   unproven this generation.
8. **R2 / R3 / R4** — BL-30: flip the production ask to `guarded` (R2, loses Stop-cancels-the-ask),
   give the OS plane a read port onto the centre's enforced decision (R3), or keep the refusal (R4).
   **Until one is ruled, a Member can ASK, be GRANTED, and still not run the granted call.**

## Open gaps at this HEAD (round 89) — the honest list, with owner decisions

The authoritative version is `D-ACCEPTANCE-REPORT.md` **§10** (G1–G10 with `file:line` evidence). In
short, none of these is closed, and none may be narrated closed:

| gap | measured state | needs |
| --- | --- | --- |
| **G1 Alpha.6 case-bearing ask producer** (Team-side, NOT upstream) | `requestApprovalLeg` only serves `envelope-mutation`; the ordinary ask is case-less, so `alpha6/root-router.ts:209` returns `null` and `d4:routed-wake` is REFUTED on 2/2 agreeing boots | **R1** (owner) |
| **G2 BL-30 ask consumer** (Team-side, NOT upstream) | production ask is `inline`; inline allow is never a guard token (`control/service.ts:4155-4165`, `:4289`); the grant is spent at the host guard (`admission-port.mjs:770-784`); `resolveAskClassCall` has no production caller, so `IO_ASK_REQUIRES_APPROVAL` (`provider-capabilities.ts:315`). **A Member can ASK, be GRANTED, and still not run the granted call.** Product source unchanged; test arms only (25/25) | **R2/R3/R4** (owner) |
| **G3 PTC upstream seam** | **CLOSED BY OWNER RULING (round 92)** — NOT SUPPORTED this generation; `run_code` is refused typed with status `unsupported-by-product-ruling` and zero worker; 3 of 4 parts hold and the worker OS profile does not (that is the measured BASIS, no longer an ask) | nothing — answered; future support is a new feature with the ADR's revisit criteria |
| **G4 root-work commands** | `team.admitInitialWork` / `team.ensureRootLive` refused (`s6-command-classification.ts:111-112`); no async root-work seam | product work / scope ruling |
| **G5 rc.5 pre-dispatch-abort wiring** | observer module present, not wired into a booted rc.5 production turn (`RC5-MIGRATION.md:492-504`) | product wiring + live boot |
| **G6 `member.create` / `member.followup` live evidence** | only `member.send` was driven through the real S6 API over two boots | extend D2 cases and re-boot |
| **G7 ENV-LIMITED census arms** | five arms, `count=5 proven=0 env_blocks=3 fail_closed_controls=2`; never PASS | a runner that provisions namespaces |
| **G8 operator model** | per-DSH_HOME authenticated human, **not RBAC**; no user isolation claimed (C-work) | scope ruling |
| **G9 scripted model** | every live boot used `packages/tools/harness/mock-deepseek.mjs`; timing from durable facts, not a real scheduler | a real-model live round |
| **G10 hosted `ci-integration` red** | FAILURE at `97d7d7c8d` on leg `tinf-instruments`; log names no failing assertion, ends mid-line at D17 with no dispatch token; **same leg GREEN locally** (51 suites, exit 0, 334.3 s). **Cleared on the next docs-only head `d1506acd1`, where `ci-integration` re-ran SUCCESS**; `ci-required` remains red there only for the draft `ci-census:skipped` layer | a cause identification if it recurs — **not** claimed as the census skip |

## D acceptance report

The single reviewable document for this candidate is
`dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md`. It carries the C1–C18 checklist (wording
verbatim from `docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md`), the HEAD/scope facts, the
P1–P5 ladder with its live judges, all eight required-CI lines, the host-authority statement, and the
limits. Its verdict: **A1+B+C implemented with live D evidence for the listed items, not a completed
product acceptance** — no PRODUCT-PROVEN row, PTC **UNSUPPORTED BY RULING** (round 92, a scope reduction
with a proven refusal chain — no longer an upstream-seam ask), two older open owner rulings plus the four
the round-87/88 seams need, and the complete open-gap register in **§10** (G1–G10).
(Round 86: the three judges this paragraph used to call REFUTED are PROVEN, and the 405 creation entrance
was removed in round 74. Round 89: `d4:routed-wake` is REFUTED and the ask/execution gap is measured.)

## The 15 migrated capability suites were first RUN, not assumed (rounds 30-32)

`migrated-entry-imports.json` said `missing: []` — every file imports the new entry — and that was read as
"migration done". Nothing had ever executed them. They run from the main worktree's vitest install (this
worktree's `.bin` points at a deleted sibling), and the first execution found **8 failures**, one a live
`ReferenceError` (`resolvePaMount`) on the authority-generation publish path.

That first run was **237/238** (the last red was fixed in rounds 48-50; today 238/238). The
population is declared in `tests/checks/eb3-ute-migrated-suites.txt`:

```
EB3-LAYER layer=ci-integration verdict=FAIL suites=15 files=15 describes=76 passed=237 failed=1
```

(The 16th bookkeeping entry is `t12a-live-bridge.mjs`, a helper with no tests — the token runner refuses a
list longer than its report, which is how the census found that out about itself.) At that round the leg
was **not bound to a Required layer** because its population was red: binding a red leg would need the
exemption this project forbids. The one red was fixed in rounds 48-50 and the leg is now in
`dev/ci/eb3-ci-manifest.json` (layer `ci-integration`, the migrated-suite leg).

## Two capability gaps found by running them (both escalated, neither papered over)

1. **The durable Alpha.4 permission overlay has no decision-side effect** (E3). The retired entry
   consulted it per call through a pre-execute adapter; the cut retired the adapter with the execution
   route, so the centre judges only the COMPILED binding lanes and a `grantInstance` deny persisted after
   bind changes nothing at execution time.
2. **Admission was conditional on the realm — CLOSED BY THE ROUND-98 RULING (Option B).** A governed
   member with no confined provider is REFUSED with `MEMBER_CENTRE_UNWIRED`; the round-98 placement fix
   now runs the gate on the MOUNT RESULT, so a row that declared a realm source but compiled none is
   covered too. A row that never asked is not silently "governed": it keeps DSH's own permission model and
   is REPORTED `ungoverned`/`uteProtected:false` (`admissionModeOf`), never as UTE-protected.

## E3 is GREEN, and the migrated suites are a Required leg (rounds 48-50)

The last red was not a wiring gap: **E3's world was pre-cut** (v3 document, no v4 `memberIoCeilings`, no
realm, no `centreStatePath`), so no centre installed and no ALLOW lane existed for its control — measured
with instrumentation, four facts with file:line. The assertion was right; the fixture was stale. It was
rebuilt on the v4 contract, and the centre got a real durable-overlay provider
(`overlay-decision.mjs`: async prepare keyed on the overlay generation, sync `decide` over the frozen
`resolveOperationPermission` — the async/sync split was one of the four measured facts).

```
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
EB3-CI-REQUIRED pass workflows=10 findings=0
```

G8's "flake" was also mislabelled: `bothFulfilled === false` was the retired `resolvePaMount`
`ReferenceError` **on the delivery path**, the same defect fixed for the f15 legs; the re-runs that cleared
it all came after that fix. It is now reproduced deterministically, and the arm awaits the world's own
`resumeGate` promise instead of polling a 3 s wall clock.

**Still not PRODUCT-PROVEN**: no host boot line. Overlay `ask`/`allow` are outside the port; subtree
matching is implemented but unexercised by the E3 probe. The realm-less admission ruling is open.

## B stage, first slice: the ask path is REAL (round 51)

Before this, every `ask` was a hard refusal: no approval binder was wired at all (`ADMISSION_ASK_UNWIRED`).
Now an `ask` becomes a durable Control request, its decision is recorded, the **post-approval recheck** runs
(lane AND policy generation), and a **one-shot** grant is minted and consumed exactly once — over the
EXISTING `ControlService.awaitControlDecision` bridge, not a second one. Host-native asks are preserved
(the host's own prompt is a legitimate approval authority).

Controls, all node:test in the `ute-vnext-a1` leg (119 pass at that round; **209 pass today**, 211 tests): ADM-46 three wirings; ADM-47 deny ⇒ no
execution + durable fact + REFUSED settlement; ADM-48 expired distinct from denied; ADM-49 fault; ADM-50
over the REAL durable ControlService (one request, one durable allow, spend counted once across the host's
double guard consultation, replay refused); ADM-51 real service deny; ADM-52 generation drift after
approval; ADM-53 incomplete identity refuses before asking a reviewer; ADM-54 supply-chain pin; ADM-55
aborted vs abandoned.

**Not proven:** no host boot (a member ask surfacing in a real leader's `team_list_pending_control` is not
exercised); the durable allow is `inline` and therefore not a guard token (`control/service.ts:4278-4290`),
so exactly-once rests on the binder grant + ledger replay refusal; `stale-denied` and the abort/abandon
distinction are proven at mapping level only; the grant binds member+call+tool+revision but not the locator.

## B stage, second slice: Stop priority and lifecycle close (round 52)

Stop is the host's own `exec.signal` — no second stop mechanism. A Stop decides BEFORE the lane and before
any reviewer (`ADMISSION_STOPPED`, distinct from deny/expired/fault), is recorded as the enforced deny with
settlement `REFUSED`/`not-started`, aborts a pending ask through the ControlService's existing inline-abort
cascade, and is re-checked after the durable decision returns so a late approval can never downgrade it.

Lifecycle close is a STATE, not a removal: `close()` keeps the pre-execute and guard installed in closed
mode, aborts a pending ask, refuses new calls with `ADMISSION_MEMBER_CLOSED` without ever consulting the
live binding, still settles in-flight calls, and is idempotent. ADM-56..62 (7 arms, 126 pass at that
round) each carry a positive and negative control; seven mutation edits (reverted) turned their own arm
red.

**Not proven, stated:** (round 86: this paragraph called the post-`allow` Stop cell "open"; it was
**closed by owner Option A in round 73** — `CONTRACT-CHANGE-REQUEST-settlement-recheck.md:51`,
`ADM-119`.) The rc.5 **pre-dispatch** Stop is measured in-process only: the observer is exported and driven
end to end in the slice composition but is **not wired into a booted rc.5 production turn**
(`RC5-MIGRATION.md:492-504`). The store's own Stop shape (Stop + `CANCELLED`, `not-started`) is recorded
and asserted. An
`allow`-admitted call that has not reached the guard is allowed to finish so it settles — refusing it would
hit the same wall and leave UNKNOWN. No host boot, no real Stop keypress.

## B probe ladder over UNMODIFIED native tools (round 53)

`packages/runtime/test/vnext-b-probe-ladder.test.mjs` (ADM-63..78) drives the host's real
`dsh-tool-fs` / `-fs-search` / `-web` / `-bash-persistent` through the product's ONE composition point, with
durable facts read back FROM DISK and the product settlement store:

| tool | positive | negative |
| --- | --- | --- |
| `read` | admitted, bytes arrive, provider counters move, `COMPLETED` | `LANE_DENY` before the body, counters byte-identical, settlement `REFUSED`/`not-started` |
| `write` | bytes on disk, `writeText ≥ 1` | `LANE_DENY`, file never created, zero provider calls |
| `grep` | match found, confined subprocess actually spawned | `LANE_DENY`, ZERO subprocess spawns |
| `web_fetch` | loopback fixture body, exactly one transport call | denied network axis ⇒ `NETWORK_DENY`, ZERO transport calls |
| persistent `bash` | **BLOCKED — NOT RUN** | `ADMISSION_AXIS_UNSUPPORTED`, zero spawns, zero `confine` calls |
| `run_code` | **NOT APPLICABLE — PRODUCT UNSUPPORTED** (round 92; ADM-69 marker + status, asserted by ADM-80) | typed `ADMISSION_PTC_UNAVAILABLE` + `unsupported-by-product-ruling`, zero worker spawns, zero confines (ADM-76, ADM-79) |

**The two "blocked" positives of this round-53 record are not environmental** (no ENV_BLOCK): `bash`/`run_code` are `process.exec`, and
the v4 member ceiling's frozen `io` set is `{read, write, network}`, so no compiled answer can carry
`binding.process`. I did not mint a lane in the test or derive one from the write lane — that would be
the second authority this cut forbids. ADM-78 pins the block in code so a future process-lane change flips
the two disclosures loudly instead of leaving a stale waiver.

**Round 86 correction (this table is a round-53 record, not the current state).** The process lane was
**resolved** in round 75 and the `CONTRACT-CHANGE-REQUEST-process-lane.md` is **RESOLVED / SUPERSEDED**:
`bash` is ADMITTED on a compiled execution declaration and the live persistent shell is **PROVEN** in two
agreeing boots (round 76, `d3:persistent-subprocess`). `run_code` (PTC) is refused, and round 92 makes that
a RULED SCOPE DECISION: the owner ruled PTC NOT SUPPORTED this generation (`ADR-ptc-unsupported.md`), so
the measured worker-OS-profile gap is the basis rather than an open upstream ask, and the refusal carries
`unsupported-by-product-ruling` on fact + settlement with zero worker. The row above is kept as the
round-53 history.

ORDER and IDENTITY are asserted: facts read back in ladder order, and every rung must resolve the host
module's own body (compared against the preset definition object, not just "registered").

## The durable half of B: crash recovery, UNKNOWN, no replay (round 54)

The crash is simulated honestly — a CHILD PROCESS that admits a call, prints its state, and `process.exit()`s
without a disposer; the parent then opens fresh ledger/store/centre over the same directory and asserts on
disk read-backs. Dead writer lock asserted on disk and reclaimed.

| claim | positive | negative |
| --- | --- | --- |
| crash recovery (ADM-79) | disk has the admission fact + `ADMITTED`, **0** execution facts ⇒ fresh store recovers `ADMITTED→UNKNOWN`, `PROCESS_TERMINATED_WITHOUT_OUTCOME`, missing evidence names `dispatch-confirmation`, `bodyOutcome: unknown` | child also COMPLETES a different call before dying ⇒ it stays `COMPLETED` (no blanket rewrite); a new callId still works |
| no replay, cross-process (ADM-80) | 2nd child (different pid) refuses `replay-1` before the body, appends exactly one replay-refusal; a fresh ledger throws `LEDGER_REPLAY` and appends NOTHING (bytes unchanged) | new callId in the same child is admitted and completes |
| duplicate execution fact (ADM-81) | on-disk duplicate ⇒ `UNKNOWN/LEDGER_DUPLICATE_EXECUTION`; centre refuses `ADMISSION_LEDGER_UNREADABLE` with 0 settlement records | same file with ONE execution fact is `KNOWN` and completes |
| truncated / garbage line (ADM-82) | three corruptions ⇒ `UNKNOWN`, writes refused with the same code, centre denies (never `ask`) | complete ledger is `KNOWN` and the same call shape completes |
| unwritable ledger (ADM-83) | `ADMISSION_LEDGER_UNWRITABLE`, both stages agree, nothing created | precondition ASSERTED (a root runner is RED, not silently green); writable twin records |
| cold recovery of an open settlement (ADM-84) | only the two OPEN records reconcile to `UNKNOWN`, preserving the reached phase and deriving DIFFERENT missing evidence | already-decided `REFUSED` stays; promoting `UNKNOWN` to `COMPLETED` is `SETTLEMENT_CONFLICT` with the file byte-identical |

Six mutation edits each red exactly their own arm (all reverted, verified). At that round the leg was 146
pass / 2 disclosed skips (round 70: 182 tests / 180 pass; **today 211 tests / 209 pass**); vitest still 238. **No `CONTRACT-CHANGE-REQUEST`
was needed**: a replayed callId is refused BEFORE any
settlement decision, so the open `allow` record is left to recovery as UNKNOWN (option D of the open CCR).

## C stage, first slice: Remote, Alpha.6 and PTC are EXPLICITLY UNAVAILABLE (round 55)

Three C rows were neither wired nor visibly refused. Each is now refused with its OWN code, on the
subject's existing axis, through the product's own ledger and settlement — no new axis, no second authority:

| row | code | axis | refused at |
| --- | --- | --- | --- |
| C-remote (round 74: per command) | `ADMISSION_REMOTE_UNAVAILABLE` | `team.control` | `root.ts` per-command hook — the S6 plane IS built/installed; only `agent-execution` commands are refused before params/handlers (control-plane commands are served) |
| C-alpha6 | `ADMISSION_ALPHA6_UNAVAILABLE` | `host.service` | `centre-config.ts#alpha6EnablementRefusal` (config) + `root.ts:2508` (records the refusal or admits a coherent row, before any wake). Round 84 removed the "every row is refused" rule |
| C-ptc | `ADMISSION_PTC_UNAVAILABLE` | `process.exec` | the PTC branch in `admission.ts` — the ONE centre, before the body; round 92: status `unsupported-by-product-ruling`, not offered to the Member, retained-entry refusal with zero worker (`ADM-79`) |

ADM-85..88 carry positives and negatives: an ungoverned remote row still dispatches (calls=1) while a
governed row records the deny and settles `REFUSED`/`not-started`; round 74 rewrote ADM-86 to the
per-command closed table (served control read, refused execution with zero ports, immutable fact +
settlement, unauthenticated refusal) and restored the S6 management plane on centre rows; a wake runs without the point and does
not with it; the same centre world admits an in-lane `read` (`COMPLETED`) while `run_code` never reaches the
body; and `bash` keeps its own execution code, so the two absences are distinguishable from the durable
record alone. ADM-88 pins the closed table: exactly three capabilities, pairwise distinct codes, each
naming its own missing axis. **Round 92 adds the ruling status and two marker arms** (`ADM-79`/`ADM-80`
in the ladder, `ADM-147`/`ADM-148` here): the PTC positives are `NOT APPLICABLE — PRODUCT UNSUPPORTED`,
reported and asserted, never silently skipped and never deleted.

**Disclosed cost (round 55 record):** a centre-configured row loses its remote API (`root.remoteDispatcher`
is absent) — that was the price of refusing rather than half-wiring. **Round 74 removed that cost**: the S6
plane is built and installed as a governed management control plane, and only `agent-execution` commands
are refused per command. The PTC tool refusal is what makes the escalation unreachable for a governed
Member; the escalation row itself STAYS because it is a SHARED `approval/request` control for every
sandbox-escalation prefix (round 92 wiring audit, `ADR-ptc-unsupported.md` §6).

## C stage, second slice: the 15 team tools, member lifecycle and work delivery (round 56)

Over the PRODUCT tool surface (`createTeamTools` on a real `createTeamRuntime`/`TeamDomain`/`ControlService`),
facts read back from disk with fresh ledgers:

- **C-tools** (ADM-89): all 15 `CENTRE_TOOL_NAMES` dispatched in declared order — allow before the body, every
  body reached, one authority fact each on `team.control`, one execution fact, every settlement `COMPLETED`.
- **unbound refusal** (ADM-90): binding removed ⇒ all 15 `ADMISSION_NO_BINDING`, zero bodies/deliveries/
  creations, settlements `REFUSED`/`not-started`; and a tool NOT in the closed list is `ADMISSION_TOOL_UNBOUND`
  (ADM-91) while `read` is still admitted — the refusal is not a blanket.
- **C-member** (ADM-92/93): `team_create_member` installs the MEMBER's own centre at its bind (its ledger,
  its generation, its lane — the Leader allows what the member denies); `team_archive_member` runs the
  centre's `close()`, after which the member's call is `ADMISSION_MEMBER_CLOSED` with transitions
  `['ADMITTED','REFUSED']` — never UNKNOWN.
- **C-work** (ADM-94/95): `team_delegate` delivers one unit (prompt verbatim at the seam), `team_collect`
  returns the terminal entry with a durable `settledSequence`; the collected work's calls are judged by THAT
  member's centre and never appear in the Leader's ledger. A refused delegation delivers nothing.

No row is PRODUCT-PROVEN (no host boot). Named host stand-ins decide nothing; policy compilation is an arm
input, not exercised.

## C stage, third slice: MCP's real mount and Alpha.6's reachable path (round 57)

**C-mcp (ADM-96/97).** A real HTTP MCP endpoint from the product's own harness is mounted through the exact
production call (`mcpClient.apply(ctx, <the seven-field literal reconcileMcpSet passes>)`); WHICH server
exists stays the product's mount gate. The centre admits `mcp__p5t5mini__ping` on `net.mcp` with the SERVER
as locator, the durable fact reads back from disk, and the REAL server answers `pong:mounted`. Negatives: a
mounted tool denied by the compiled per-tool answer or by the ceiling is refused with zero body while the
sibling tool of the SAME server still runs (mounting is not permission); `mcp__` and `mcp__<server>` are
`ADMISSION_TOOL_UNBOUND` (no prefix matching).

**New LIMIT, pinned rather than hidden:** the centre is not mount-aware (binding installed at the member
bind; the mount target is computed later), so a well-formed name for a never-mounted server is decided on the
network axis alone — the product excludes it at the tool registry, not at admission.

**C-alpha6 (ADM-98/99).** *(Round 55 record; **round 84 superseded it** — see the C-alpha6 correction at the
end of this section.)* The config rule then refused the opt-in on EVERY row, so no product-config path
reached the capability. The machinery itself is fine: composed directly, the real Alpha.6 router takes a
recipient decision off a durable control row and the real dispatch latch + wake-intent directory persist a
row that a FRESH reader sees naming exactly the routed reviewer. What was missing is a review-routing AXIS
in the centre (`admission.ts:61-74/86-102/143-153`); driving one only fabricates a fallback-axis record.
Two lawful shapes were recorded (compiled axis = contract change, or a ruling that a record-only approval
fact is adjudication).

**C-alpha6 — round 84 correction.** No new axis was invented and none is needed: the formal routing is
implemented as a **join on existing centre surfaces** (the routing decision is a projection of the durable
control row through the ONE policy; the wake is a governed **delivery** — `team-review-wake-routed` intent
→ `SessionInputPort.submitAttributedInput` → `team-review-wake-delivered` confirmation; the Officer's
approval is `team_resolve_control` under the Officer's own binding). A coherent row is admitted; each
incoherent piece is refused *and recorded* by its own typed piece code. Arms `ADM-141`…`ADM-146`. The
**live routed wake** was **REFUTED in round 87** on two agreeing D4 boots — the product's durable ordinary
ask carries no `approvalCaseId`/`legOrdinal`, so `alpha6/root-router.ts:209` returns `null`; see the
round-87/89 blocks above and `D-ACCEPTANCE-REPORT.md` §6.5/§10 G1.

## D stage, first live acceptance: the Provider-OS boundary now holds on a real host (round 61)

Round 60's live run REFUTED the owner's named risk: a governed Member's native `read` was served by the BASE
provider (ZERO guard consults). Round 61 implements the fix (shape A: mount by default) and re-measures with
the SAME unmodified driver, two agreeing boots:

**`d:guard-facts` moved from REFUTED to PROVEN** — 2 allow facts (`stat`, `readText`) naming the member
identity, `decidedBy=[ALLOW]`, zero out-of-lane provider facts. `d:member-read-admitted` still PASS, and
`d:centre-facts` still PASS (allow + `LANE_DENY` + executions).

How: a governed member's native tool modules are now mounted INTO ITS ISOLATED SCOPE by default. The candidate
set is derived from the preset's OWN rows (never a second hand-maintained list); each module is kept only if it
declares a realm face and registers a name the centre adjudicates; the HOST module is mounted through the
existing host-module path, so there is exactly ONE definition per name and no shadow. Unresolvable/invalid/
empty/ambiguous/conflicting cases are typed refusals (`GOVERNED_NATIVE_MODULE_*`,
`GOVERNED_NATIVE_SURFACE_CONFLICT/_CHANGED`) — never a base-provider fallback. Ungoverned rows are untouched.

Two residuals recorded, not relaxed:

1. `d:member-read-denied` still reports the centre's `LANE_DENY` rather than the provider's `IO_READ_DENIED`,
   because the centre decides BEFORE execution — by design. The provider-side refusal is proven in-process
   (ADM-100: provider deny with zero secret bytes).
2. `d:native-read-surface` reads the top-level description while the marker it looks for lives in the
   `file_path` PARAMETER description — an instrument defect, re-anchored rather than deleted.

ADM-100/101/102 pin the new behaviour: governed default mount through the confined face (identity changed,
same host `execute`, allow guard facts, provider deny), ungoverned unchanged, and unresolvable ⇒ typed refusal
with no fallback.

## D stage, live: the search face is restored without silencing faults (round 64)

Round 63 measured an IN-LANE `grep` being refused as `ADMISSION_OVERLAY_FAULT` (`tool-unsupported`) — the closed
permission vocabulary cannot canonicalize a search tool. Shape B of the search-face CCR is now implemented:

- the overlay classifies by **vocabulary membership** BEFORE canonicalizing; an out-of-vocabulary tool is
  `no-opinion` and never enters the canonicalizer, so it can never fault;
- the compiled LANE alone judges it;
- a fault on a COVERED tool still denies `ADMISSION_OVERLAY_FAULT` (faults are not silenced), and a stored deny
  still denies;
- the durable fact carries `overlayOutcome: 'deny' | 'no-opinion' | 'fault'`, so a reader can tell WHY the
  overlay abstained.

Live, two agreeing boots: the same `grep` is now `decision=allow`, `overlayOutcome=no-opinion`, execution
`completed`, real match returned; the fact is byte-identical after a SIGKILL cold restart. ADM-103..106 pin the
four directions (covered+deny, covered fault, out-of-vocabulary in lane, out-of-vocabulary out of lane).

Residual stated plainly (round 98 restatement): **Shape B is the declared support level for this
generation, NOT full dynamic permission governance.** A durable overlay rule still cannot DENY
`grep`/`glob` (the lane ceiling is their whole governance); the Overlay returns `no-opinion` for faces
outside its vocabulary. The recursive parent-allow/child-deny control over the real search paths is GREEN
(`SLICE-39`): the confined face cannot express a nested deny, so it refuses the spawn before any process
(no match, no child byte) — the dangerous scope is forbidden, not root-checked. Shape A (a subtree search
face in the vocabulary) remains future work.

## The adversarial centre review (round 28)

No P0, seven P1. Six are fixed on this branch; the seventh is the settlement gap above. They were all
in the product composition, not the mechanism — which is the useful part of the finding:

| finding | state |
| --- | --- |
| settlement recorded the lane's raw answer, then overruled it | fixed — settles the enforced decision, fact keeps `decision` + `laneDecision` |
| shared settlement dir turned another member's live execution UNKNOWN | fixed — per member |
| post-approval recheck consulted a frozen binding | fixed — live resolver (ADM-37) |
| realm disposer registered twice → close started it before the tombstone | fixed — ordering |
| throwing ledger/settlement escaped instead of refusing | fixed — three deny codes (ADM-38) |
| per-call memo served any dispatch with the same callId | fixed — memo serves one execution (ADM-38) |
| admitted-then-refused has no settlement state | **resolved** — owner Option A, round 73 (`ADM-119`); this row was still "escalated" in round 28's table |

## Verification on this HEAD

Measured at `97d7d7c8d1bb0410dac9dedac77dee97143851bf` (round 89; every command re-run fresh in this
worktree, full transcript in the round-89 session log; the round-86 audit's block is in
`CANDIDATE-AUDIT.md` §8). Local gates are green; **hosted is not all-green** (see G10):

| gate | result |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | `suites=7 files=7` · `tests=215 pass=212 fail=0 skipped=3` · `exit=0` · `set=sha256:edd4f1c4…` (the 3 skips: ADM-68 bash disclosure + the TWO ruled PTC markers ADM-69/ADM-147) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=785` · collected 733 · excluded 14 · **uncollected 38** (3 under the 41 ceiling) · `refused=0 findings=0` · by runner `node=146 none=7 vitest=632` |
| `ute-p0-assets --check` | `pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148)` |
| `ute-cut-closure --check` | `pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0` |
| `ute-a1-window --check` | `pass branch=vnext/a1-cut red=0/0 cut=(148/52)` findings=0 |
| `eb3-ci-required` | `pass workflows=10 findings=0` |
| `docs-sync --check` | `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20` |
| `place-dist-glue` | `done (34 placement(s))`, every line byte-identical |
| `eb3-security-run --layer ci-security` (bound vitest leg) | `verdict=PASS suites=14 files=14 describes=61 passed=216 failed=0` |
| `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` |
| `node --test` (the UTE G1 nine-file argv) | `tests 89 pass 89 fail 0 skipped 0` |
| `ci-pr-gate --full --census-captures 2` | **`DSH-CI-VERDICT pass pass=10 fail=0 skip=0 legs=10 refused=0`** (275.7 s; census 2 captures, identical identity sets, **599 files / 7,416 lines** vs the published 626 / 7,936 — counts are context, the identity set is the verdict) |
| `eb3-ci-negative-controls` | `35/35 control(s) behaved as required` |

`git rev-list --count a19d1df01..HEAD` = **210**; `git diff --shortstat a19d1df01..HEAD` = **3,476 files
changed, +249,967 / −160,719** (2,646 A · 616 D · 211 M · 2 R094 · 1 R095; rename counts are a lower bound
because git skipped exhaustive rename detection). Entry files: `agent-bindings.mjs` **4,967** lines,
`root.ts` **5,239** lines (unchanged by rounds 87/88).

**Hosted verdicts at `97d7d7c8d` (queried this round):** `pr-gate`, `ci-fast`, `ci-security`, `ci-product`,
`synthesize-merge-tree`, `candidate-protection` **success**; `ci-census` **skipped** (draft);
**`ci-integration` FAILURE** (`EB3-REQUIRED fail layers=6 green=4
nongreen=ci-integration:failure,ci-census:skipped`); `ci-required` / `ci-required-deferred` **failure** for
those two layers; `pr-settlement-gate` failure until the round-89 settlement comment. The `ci-integration`
red is **not** explained by the census skip: its job log (run `45136105108`, job `137562782742`) names no
failing assertion and ends mid-line at `D17` with no `DSH-TEST-DISPATCH` token, while the same leg is
**GREEN locally** (51 suites, `exit=0`, 334.3 s). It is open item **G10**, not a green claim.

## Limits stated plainly (not claims)

- **No gate-grade product acceptance.** The D boots are `DEV-LIVE` records with two agreeing boots each;
  they are not gates and no row is PRODUCT-PROVEN. No capability under load: no multi-agent load beyond
  two Members, no revocation-under-load, no Stop-under-load, no real Stop keypress.
- **The model is a scripted mock** in every D record, so model-driven choice, retries and adversarial
  tool selection are not measured.
- `host.service` capabilities (Goal/Todo, Team Skill, Subagent) are bound and recorded, but their I/O
  is the **host's** — a skill file read by the host skill service is outside the member's fs ceiling.
  This is a limit, not a confinement claim.
- **Ask is wired — and a granted ask still does not execute in production (BL-30, round 88).** The
  product installs the grant binder and the durable Control approval port when the row has a
  `controlServiceRef` (`agent-bindings.mjs:692-710`); a row without one refuses asks as
  `ADMISSION_ASK_UNWIRED`. Round 88 measured the consumer boundary over the real `ControlService`: the
  only production producer writes `executionCoupling:'inline'` (`admission-port.mjs:163`), an inline
  allow is never a guard token (`control/service.ts:4155-4165`, `:4289-4291`), the one-shot grant is
  already spent at the host tool guard (`admission-port.mjs:770-784`), and the confined provider then
  refuses `IO_ASK_REQUIRES_APPROVAL` (`provider-capabilities.ts:315`). The live ask is still only
  `d2:stop` (parks at the pending request, then stops it). **A Member can ASK, be GRANTED, and still not
  run the granted call.**
- **Alpha.6's routed wake is REFUTED live (round 87), not merely unproven.** A coherent v5 row boots and
  the Officer is up, but the product's own durable ordinary ask carries no `approvalCaseId`/`legOrdinal`,
  so `alpha6/root-router.ts:209` returns `null`, the Officer is never woken, and the Leader gets the plain
  C1 ask. Two Team-side seams (G1/G2), never an upstream one.
- **Hosted CI is not all-green at this HEAD** (G10): `ci-integration` failed on a leg that is green
  locally, and `ci-required` is red for that failure plus the draft census skip. Nothing here claims
  otherwise.
- Local environment at round 89: `tsc` and vitest **are** available and ran (`ci-pr-gate`'s typecheck
  and the bound vitest legs are green); no product boot was run for this documentation round — all live
  claims are the earlier rounds' DEV-LIVE records (rounds 87/88 changed test/evidence only). The pinned
  rc.2 host is built; the rc.5 host is present but not installed (see `NEXT-HOST-RC5-FEASIBILITY.md`).
  (The round-70 sentence "no `tsc`, no vitest" is no longer true of this worktree.)
- The two giant files are being decomposed by ownership, not by line count; `agent-bindings.mjs` is
  **4,967** lines and `root.ts` is **5,239** lines today (the round-70 body said 4,780 for
  `agent-bindings.mjs`), and the progress table is append-only in `DECOMPOSITION-PLAN.md`.

## Not done here — status statement

**This PR is not merged and must not be auto-merged. No release, no deploy, no version bump, no tag.
`master` and `stable` are untouched.** PR #822 is `DRAFT`; only the owner marks it ready and merges.
No capability row is PRODUCT-PROVEN, PTC is UNSUPPORTED BY RULING (round 92 — a ruled scope reduction,
not a blocker), `d4:routed-wake` is REFUTED and
BL-30 leaves a granted `ask` unable to execute, and the owner still has two older rulings + four for the
new seams open (PTC is no longer among them) — so even after review this candidate is **not** a completed
product acceptance.

## Round 83 — work DELIVERY on the management plane (the round-74 refusal narrowed)

Round 74 restored S6 Remote as a governed management plane and refused five commands as
`agent-execution`. Round 83 keeps the boundary and makes the three real product operations reachable:

**The management plane may DELIVER work; it may never EXECUTE a tool.** A third served effect class
`work-delivery` (`s6-command-classification.ts`) hands each command into the target agent's own governed
path — `member.create` (the ONE activation authority), `member.send` (the messaging coordinator's durable
inbox acceptance), `member.followup` (the action facade's `execution: 'async'` delivery receipt, whose
Phase B/C run detached inside the Team runtime). `team.admitInitialWork` and `team.ensureRootLive` stay
REFUSED because their only seams await a root turn / start an executor with nothing to acknowledge.

Boundary arms: **ADM-86** (rewritten: literal delivery/refusal sets, the dispatcher's three handovers,
no tool port, an ack with no tool result, the durable refusal for the two root commands, typed
seam-unwired fail-closed, unauthenticated refusal, 512-char settlement reason cap) and **E3** (production
root: only the two root refusals leave deny facts; at `createS6RemotePorts` the follow-up requests
`execution: 'async'`, creation carries no execution mode, `member.send` reaches the coordinator).

Live proof (`d2:remote-delivery`, DEV-LIVE, `--boots 2`, two agreeing boots): `member.send` answered
HTTP 200 with the coordinator's `delivered` acknowledgement (intent 39 / confirmation 40) while the
Member's delivered call had **0 admissions and 0 executions at the acknowledgement**; the delivered
prompt then ran in the Member's own turn, and the centre's `allow` for that `read` appeared in the
MEMBER's own ledger under the MEMBER's binding ~113 ms after the ack, with a `completed` execution.
Error paths measured on the same row: unknown member, archived member, duplicate send (at-least-once,
no operator-side execution), restore, and Stop during a delivered turn (`ADMISSION_STOPPED`).

Not claimed: no live `member.create`/`member.followup`; the two root commands stay unavailable; the model
is the scripted mock; the operator is a per-DSH_HOME authenticated human, not RBAC.

**Round 86 audit note.** `d2:remote-delivery` is PROVEN on **two rc.2 boots** (`"host":"legacy"` in
`d-boot-feasibility/d2/driver.log`); it was added after the rc.5 acceptance run, so the rc.5 column for
that judge is **not recorded** — 13 of the 14 judges ran on rc.5. The report's §3.2 now says so.


## Round 89 — documentation integrity: what the report now carries (and what it refuses to round up)

This body and `D-ACCEPTANCE-REPORT.md` were re-measured at `97d7d7c8d` after rounds 87/88. Three things
changed in substance, and none of them is an upgrade:

1. **`d4:routed-wake` is REFUTED, with the blocker located in this repo, not upstream.** The round-87 D4
   probe booted a coherent v5 Alpha.6 world twice (enablement, Officer up, Officer's own binding and the
   incoherent-row refusal all PROVEN) and measured the product's own router answering `null` because the
   durable ordinary ask carries no case identity (`alpha6/root-router.ts:209`). Two Team-side seams:
   no case-bearing ask producer (G1), no BL-30 ask consumer (G2).
2. **A Member can ASK, be GRANTED, and still not run the granted call.** Round 88 measured both couplings
   over the real `ControlService` (guarded ⇒ guard allows + 1 consumption + `resolveAskClassCall` ok;
   inline = production ⇒ `no-request` + `APPROVAL_DENIED` + 0 consumption rows) and changed **no product
   source** (two new arms, 25/25). The wire-up is one of owner rulings R2/R3/R4.
3. **Hosted CI is not all-green at this HEAD.** `ci-integration` failed on `tinf-instruments` while the
   same leg is green locally; `ci-required` is red for that plus the draft census skip. Carried as G10
   with the job ids, not as a green claim.

**Corrections in this round: 19** (full list in `D-ACCEPTANCE-REPORT.md` §11; worst five: the refuted
routed wake, the implied executable grant, the 5-commit-stale scope block, the false "green except the
census skip" hosted claim, and the stale `ci-pr-gate`/census numbers). **Evidence unchanged**: no product
source, test assertion, skip, negative control, A0 artefact or evidence file was edited to fit a claim;
documentation-only commits.

## Round 93 — R1: the Alpha.6 case producer (the G1 seam is closed; the live wake is still REFUTED, for a NEW measured reason)

Owner ruling: review `20261124-0151` §1, **R1 = APPROVED**. Scope discipline was part of the ruling and is
part of the diff: **the EXISTING `ControlService.requestApprovalLeg` is the only leg writer, no new ask
producer and no new UTE I/O axis were added, and no identity member is ever defaulted.**

**What now exists (product code).**

- `packages/runtime/src/plugin/vnext/alpha6-ask-case.mjs` — the CLOSED qualification rule
  `ALPHA6-ORDINARY-CASE-Q` (`enabled` · **Q1** declared ToolBinding · **Q2** canonical operation identity ·
  **Q3** Leader rung · **Q4** the shared delegable predicate) and the case builder that freezes
  `operationFingerprint`, `authorityScope`, `requestedEffect`, `operationToolOwner/Name` + the trusted
  ToolDefinition identity, the Blueprint content hash, the policy generation, the requesting Member
  identity and the call correlation id — every member read from a trusted source.
- `admission-port.mjs` — a qualifying ask is opened as a real case through `requestApprovalLeg`; a
  non-qualifying ask keeps the **byte-identical plain path**; an ask whose required identity cannot be
  sourced is a typed refusal (`ADMISSION_ALPHA6_CASE_IDENTITY_INCOMPLETE`, field named) with zero rows
  written. The wait still goes through the ONE bridge (`awaitControlDecision`) on the same requestId.
- `centre-install.mjs` / `agent-bindings.mjs` / `host.ts` — the trusted ToolBinding coordinate is passed
  through from the compiled binding (never re-derived), and the SAME single authority-ceiling reader the
  root uses is forwarded to the producer. The producer is wired ONLY when the row opted in **and** the
  reader exists: an unwired producer is the pre-round product, and defaulting the frozen legacy rung on a
  v3 Team would widen Officer authority.

**Arms (ute-vnext-a1, all over the real `ControlService` / router / latch):** `ADM-149` qualifying ask ⇒
durable case (`case-…`, `legOrdinal:1`, `reviewPayload.authorityScope`,
`operationToolDefinitionIdentity:'dsh.fs/write'`, `perEffectRequiredAuthorities:['leader']`, one pending
request, zero decisions); `ADM-150` the product's own router selects the **Officer** and the round-84
governed delivery writes intent + confirmation and wakes the Officer session; `ADM-151` non-qualifying ask
⇒ no case, plain `leader-approval`, `ordinaryAsk:null`; `ADM-152` unsourceable identity ⇒ typed refusal,
zero rows; `ADM-153` the Officer's own operation is never self-reviewed. `ADM-54`'s static witness was
updated (one construction, unchanged `controlOf` first key), not loosened.

**The live D4 judge: still REFUTED — and the judge was amended in the open, in the strict direction.**
The two clauses that ASSERTED the defect (`route() === null`, "the Leader received the plain ask") now
assert the REQUIREMENT (the router must select the existing Officer instance; the plain case-less ask must
be ABSENT); the router probe now serves the boot's real durable member view instead of a hard-coded `[]`.
Nothing else was relaxed. Two agreeing boots report `enablement` / `officer-up` / `officer-binding` /
`refusal` **PROVEN** and `routed-wake` **REFUTED** at `row-carries-approval-case`,
`product-router-selects-the-officer`, the four wake clauses and `no-plain-c1-ask-to-the-leader`.

**Why — the new finding (`G11`), measured in both directions.** R1's case identity needs a **trusted
ToolBinding**; only a declared `toolBindings[]` entry provides one. But the Alpha.5 binding-lane compiler
(`compileEffectiveIo(…, {approvedOnce:false})`) collapses ANY `ask` path to an **empty deny lane**: the
production-shaped world (ask on the Member ceiling) has no ToolBinding at all, and the declared-binding
world (`D4_BINDING_WORLD=1`) denies the call with `LANE_DENY … outside the tool's compiled fs.write lane`
and writes **no control row**. So the ask and the ToolBinding are **mutually exclusive in a live v5 world
today** — a Team-side gap, not upstream, and explicitly NOT papered over with a fabricated ToolBinding or a
defaulted authority scope. `G11` is carried in `D-ACCEPTANCE-REPORT.md` §10 with the ruling it needs.

**Not proven (stated, not implied).** `R3`/`G2` (BL-30) is untouched: after an allow the provider still
refuses an `ask`-disposition call (`IO_ASK_REQUIRES_APPROVAL`), so the granted call still cannot execute.
The live routed wake is not reached (`G11`). C-alpha6 stays **MECHANISM**; no capability row moves up.

---

## ROUND 97 — `d4:routed-wake` is PROVEN LIVE (C-alpha6 → DEV-LIVE)

Round 97 closes the live half of the Alpha.6 chain that rounds 93–96 left REFUTED. **No production code
changed**: the D4 driver authored a world that satisfies the closed qualification rule in one coherent
row, and the routed wake was measured as seven independent judges over durable bytes.

**The live chain (two agreeing DEV-LIVE boots, rc.2 `639ed015…`, HEAD `a7a7f08ca…`).** A worker `write`
whose lane is `ask` on the declared `dsh.fs/write` binding opens a real durable approval CASE
(`case-…`, `legOrdinal 1`, frozen operation fingerprint, authority scope, tool coordinate, blueprint
hash/revision). The product's `createAlpha6RootRouter` selects the unique lawful **Officer** (the
self-ask control routes to the Leader, never the Officer). The governed delivery writes one
`team-review-wake-routed` intent and one correlated `team-review-wake-delivered` confirmation; the
Officer's own session receives a **machine-attributed** input (`source.kind = plugin:dsh-agent-team`),
and the management plane executes **zero** tools. The Officer is woken in its own session and its own
`team_resolve_control` is admitted under **its own binding** (durable `invocation-authority` allow,
`COMPLETED` settlement). The worker's granted call then executes AFTER the decision — real bytes on the
host filesystem (`27 bytes`, `sha256:ced10112…`), settlement `COMPLETED`/`completed`.

**The two laws are now live, not just in-process.**
- **Duplicate route ⇒ one wake.** Leg 2 was routed by both real call sites (request-creation notifier and
  reviewer `turn/end` re-collection) while still pending: exactly one intent, one confirmation and one
  model-visible input exist.
- **Machine wake ≠ human resume.** A real human `session/cancel` wrote the Sticky Stop marker; a third
  worker ask was routed while the Officer was stopped and **zero** wake inputs reached it; the marker
  survived the machine attempt and was cleared only by an explicit human prompt, after which the held
  wake was delivered and the third `write` executed.

**Level: DEV-LIVE, not PRODUCT-PROVEN.** `V@B=yes` requires a bound executable gate; the D4 driver is
not one, and no gate was invented. The cell moves from MECHANISM to **DEV-LIVE**.

**Eight pre-existing judges unchanged and PROVEN**; deny and Stop-while-pending still write zero bytes
and settle `REFUSED`/`not-started`. The only driver change beyond the new judges/mock is a measurement
fix: the second ask is now waited for on the durable ledger instead of the pending projection (the
Officer can settle a leg inside one poll).

**Not proven.** Only `write`/`writeText` carry the live R3 receipt; subprocess/PTY and `apply_patch`
remain R4; the scripted model is the only double; the duplicate-route attempt itself leaves no durable
fact (the judge proves convergence and records the two call sites).

## ROUND 99 — the R3 receipt reaches the PROCESS face: MECHANISM proven, the LIVE process leg REFUTED by a named assembly gap

Owner ruling this round: the same `ApprovedAskReceipt` must cover the **process face** (persistent `bash`
/ governed shell whose compiled disposition is `ask`), as a distinct operation kind `process-exec`, with
the verifier at the governed spawn point **before any process exists**. Nothing was relaxed: no new
authority, no lane promotion, no second authority, no widened assertion, no widened timeout, no retry.

**What the receipt binds on this face.** `toolName`, the COMPILED `executionBoundary` and
`implementationOrigin`, the composition's fixed shell class (`program`/`programs`), the exact
`commandSha256` (or `null` when the call carried no command), and the authored `cwd` as CONTEXT only.
The fingerprint is a `sha256` over exactly those fields. The operation is staged on the EXECUTION OBJECT
(`WeakMap`) and the authorization is an `AsyncLocalStorage` scope on the Provider call — never a global
`callId` map, never a second authority.

**Where it is verified (file:line, before any process).**
- confined subprocess: [subprocess.ts](packages/runtime/team-services/src/subprocess.ts#L1487-L1536) —
  `deny` throws `SUBPROCESS_PROCESS_DENIED` first, `ask` runs
  `authorizeProcessAskWithReceipt(...)` (L1515) and refuses with `SUBPROCESS_PROCESS_RECEIPT_REFUSED`
  (L1532); both BEFORE the provider call and before the program-identity check.
- governed persistent PTY: [terminal-pty.ts](packages/runtime/team-services/src/terminal-pty.ts#L470-L505)
  — the same verifier before `raw.spawn`; it cannot compare `commandSha256` (the shell precedes any
  command text — disclosed in the ADR).

**Arms (real governed provider + real binder + real Control + real settlement).** `ADM-174`…`ADM-179`:
positive chain (ask → inline allow → consumed grant → receipt → spawn → real command → `COMPLETED`, ONE
provider call); cross-execution/cross-face/reuse refused; no widening (out-of-lane write refused by the
OS, zero bytes; the request's `allowPaths` deep-equal the lane-compiled profile); no escalation
(`danger-full-access` still clamps to at most `workspace-write`; a pure-ask lane stays `read-only`);
`deny` wins before any receipt and revocation refuses, both with ZERO provider calls; phase honesty
(approved command ≠ spawned command refuses pre-spawn with `RECEIPT_COMMAND_MISMATCH`; a post-spawn
kernel denial settles by its real phase). `vnext-admission.test.mjs`: **162 pass, 0 fail**.

**One real defect found and fixed by running it.** `completeAsk` classified a call as a process call by
"its compiled binding carries an `execution` block" — but EVERY tool binding carries one (`trusted-host`
for the FS tools too). Measured live: the granted worker `write` then refused with
`RECEIPT_NOT_IN_SCOPE`, i.e. the fix for the process face would have BROKEN the live FS face. The
classification is now the CLOSED TOOL TABLE `APPROVED_ASK_PROCESS_TOOL_SHAPES = ['bash']`
([admission-port.mjs](packages/runtime/src/plugin/vnext/admission-port.mjs#L814-L826)), exactly like the
FS table. After the fix the two FS live arms and all seven routed-wake judges are PROVEN again.

**LIVE (D4, two boots): the process ask chain is real and the SHELL never appears.** The worker `bash`
(`authorization: 'ask'`) raises a real durable Control request, the router qualifies it as an Alpha.6
case, the Officer allows it through the real control path, the grant is consumed — and the persistent
`bash` tool then fails with `no PTY backend registered for "a5sf-governed-shell"` from ITS OWN backend
lookup, before the governed PTY `spawn`, i.e. before the verifier. Zero bytes, no process, settlement
`FAILED`. `d4:ask-execute-process` is therefore **REFUTED**, and the other twelve named judges (including
all eight pre-existing ones, the deny arm and Stop-while-pending) are **PROVEN** on both boots with
identical rows.

**Two driver MEASUREMENT fixes were required for a deterministic pair, and both are disclosed, not
hidden:** leg 1's ask is now discovered on the DURABLE ledger as well as the pending projection (a boot
was measured where the ask was already decided before the projection was read: the judge said "no
request raised" while the write really executed — the fix round 97 applied to the second ask), and the
routed CASE row is snapshotted the moment its id is known, before any reviewer can decide it (reading it
after the ask-appearance HTTP roundtrip let the Officer settle first and tripped the round-97 clause "the
case has no decision yet" on a correct product). The agreement table also stopped comparing the
freshly-minted `ctrl-…` id. No assertion changed.

**Two world-shape hypotheses measured and REFUSED rather than worked around:** `a5sfNativeToolModules: []`
breaks Member activation (the Officer never comes up); a ceiling that asks for a subtree while allowing
an enclosing root is not expressible to Landlock and the Member never activates. Neither was adopted; the
world keeps its round-98 shape plus the bash declaration and a pure-allow workspace ceiling.

**Not proven.** The live POSITIVE process execution (blocked by the assembly gap above — a product
decision, not a receipt defect: the same face mounts in the v4 D3 world). `apply_patch` remains R4. The
scripted model is the only double. No row is PRODUCT-PROVEN.

