**[dated settlement, 2026-11-23T10:40Z — round 91: `d:remote-creation` red = a STALE DRIVER JUDGE, repaired; all four live drivers re-measured; head `@@HEAD@@`]**

Covered head: `@@HEAD@@` (parent `b67a3eb38`; one code commit — the judge repair — plus the round-91
evidence/gate transcripts and the report/status/log updates). PR #822 stays **DRAFT**, unmerged
(`state=OPEN`, `isDraft=true`, `headRefName=vnext/a1-cut`, checked with `gh pr view 822` immediately
before posting). :3080 and its DSH_HOME were never touched; no second server was started; no non-topic
push; no history rewrite.

## Verdict

**The red was an acceptance-instrument defect, not a product defect.** `d:remote-creation` is **PASS on
two agreeing boots** after the repair, at the same port 3194 and under the same conditions that produced
the red. No product byte changed. No timeout, retry, skip, weakened assertion, compatibility layer or
upstream patch. No capability row moved: no row is PRODUCT-PROVEN, `d4:routed-wake` stays **REFUTED**,
BL-30 stays open.

## Reproduction, mechanism, proof

`node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2` on the unmodified tree:
`RESULT FAIL (2/2 boots; agreeing pair=true)`, both boots on port 3194, with exactly one failing clause
in the case record:

```
no-execution-without-admission: member.send ok=undefined code=undefined provider requests added=0
```

while the same boot measured `team.create` 200 / `path:"fresh-root"`, the runtime root, duplicate
no-second-Team, and `rootWork/rootLive` refused + `delivery` served typed with **0** provider requests.

Round 83 (`5c09cbd82`) reclassified `member.send` as work-delivery and changed the driver's sample from
`{ok, code}` to `{rootWork, rootLive, delivery}`; `judgeRemoteCreation` kept reading `execution.ok` /
`execution.code`, which are `undefined`, so the clause was REFUTED unconditionally. Same clause, three
runs: pre-`5c09cbd82` archive **PASS** (flat sample); this head pre-fix **FAIL** (`undefined`); this head
post-fix **PASS** (nested sample). Round 90's decomposition touched no driver source; its before/after
pair recorded the same FAIL both times.

The four suspects are settled in `round91/diagnosis.md`: (a) port/home collision **REFUTED** — one
global `3181-3199` lease band, the probe declares none, and the **same port 3194** failed pre-fix and
passed post-fix with the created Team's `defaultWorkspace` in this boot's own home; (b) round-90
decomposition **REFUTED** — no driver source in `bde902939`; (c) product regression **REFUTED** — the
product answer in the FAIL and PASS runs is identical and is round 83's contract; (d) sequencing flake
**REFUTED** — 2/2 identical boots before and after.

## The repair (instrument layer)

`judgeRemoteCreation()` now judges the measured shape, keeping the clause id and **adding** conditions:
both ROOT commands `ok:false` + `ADMISSION_REMOTE_UNAVAILABLE`; delivery HTTP 200, served, `ok:false`
with a typed non-empty code that is not the execution refusal; `mockRequestsAdded === 0`. Strictly
stronger than the old single-command clause.

## Four live drivers, rc.2, this head

| driver | command | judges | result |
| --- | --- | --- | --- |
| `run-boot.mjs` | `--boots 2` | 6/6 PASS incl. **`d:remote-creation`** | `RESULT PASS (2/2 boots; agreeing pair=true)`, exit 0 |
| `run-boot-d2.mjs` | `--boots 2` | 4/4 PASS | `RESULT PASS (2/2 boots; agreeing pair=true)`, exit 0 |
| `run-boot-d3.mjs` | `--boots 2` | 4/4 PASS (PROVEN) | `evidence-complete=true allProven=true (2/2 boots; agreeing pair=true)`, exit 0 |
| `probe-d4-routed-wake.mjs` | `--boots 1` | enablement/officer-up/officer-binding/refusal PASS; routed-wake **REFUTED** | `blocked=true (1/1 boots)`, exit 3 (known open gap) |

All driver hosts leased port 3194; every acceptance driver booted in a distinct home. Logs:
`dev/agent-workflow/evidence/ute-a1/round91/drivers.log`.

## Gates at this head

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

## Seat and model disclosure

Implementation, reproduction and the gate runs were performed in one delegated DeepSeek-Harness coding
session (model `deepseek-v4.1-flash-1017`, seat: SOLE WRITER in `.worktrees/vnext-a1-cut`). No second-party
reviewer seat was commissioned in that session; the review verdict is the reproduced driver evidence and
the gate set above, cross-checked against the pre-round-83 archived PASS, not a second reviewer's opinion.
The coordinating agent holds the independent review/merge decision.

## Report / evidence

`dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md` §12 and §3.2 (judge table);
`MIGRATED-SUITE-STATUS.md` round-91 section; `round91/diagnosis.md` (mechanism + four-suspect
disposition); `round91/{repro-run-boot,after-run-boot,after-run-boot-d2,after-run-boot-d3,after-probe-d4}.log`;
pre-fix artefacts `d-boot-feasibility/archive/2026-11-23T09-54-52-433Z/`.

## Limits / NOT proven

No product byte changed, so nothing new is proven and no row moves. The measurement is still a
scripted-mock, per-DSH_HOME-operator row; the judge's `delivery.ok:false` is specific to this member-less
probe; `d4:routed-wake` stays REFUTED; the rc.5 driver runs were not repeated. No upstream file touched;
CORE PATCH BUDGET = 0.
