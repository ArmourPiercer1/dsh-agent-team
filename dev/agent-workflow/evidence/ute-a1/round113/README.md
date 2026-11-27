# Round 113 — C1–C18 sign-off + adversarial security review (evidence only)

Scope: `.worktrees/vnext-a1-cut`; branch `vnext/a1-cut`; PR #822 stays **DRAFT**. This round changes
**no product file** and no assertion: it adds two evidence documents, the gate logs below, and the
matching sections in `D-ACCEPTANCE-REPORT.md` / `PR-BODY-draft.md`. No row is upgraded, no gate is
weakened, no timeout widened, no retry added, no upstream source touched.

## Deliverables

| file | what it is |
| --- | --- |
| `../C1-C18-SIGNOFF.md` | one row per `06-CAPABILITY-CONTRACT.md` item — 21 sign-off rows (C1–C18 + C14b + C13's two ruled-out arms), with evidence, level, limitation, gate status |
| `../SECURITY-REVIEW-20261125.md` | adversarial audit of Admission / Provider-OS / Settlement / Control / Stop: claimed invariant, attempted break, existing arm, verdict; four findings (SEC-01…04), none fixed |
| `../D-ACCEPTANCE-REPORT.md` | new ROUND 113 block: the counts, the two corrections, the gate block pointer |
| `../PR-BODY-draft.md` | round-113 row: counts + pasted gates |

## Counts (21 sign-off rows)

| level | count |
| --- | --- |
| MECHANISM | 7 |
| DEV-LIVE | 8 |
| ENV-LIMITED | 1 |
| UNSUPPORTED BY PRODUCT RULING | 5 |
| NOT PROVEN | 0 |
| PRODUCT-PROVEN | 0 |

## Gates at this head (every exit 0; logs in this directory)

| gate | measured |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | **251 tests / 248 pass / 0 fail / 3 skip**, set `sha256:edd4f1c4…` (`gate-dispatch-tests.log`) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | **tests=785 collected=733 uncollected=38 excluded=14 findings=0**, digest `sha256:da8a452d…` unchanged (`gate-test-catalog.log`) |
| `ute-cut-closure --check` | **pass** `cut(0/148)` `prodRefs=0 distResiduals=0 dupNames=0` (`gate-ute-cut-closure.log`) |
| `ute-p0-assets --check` | **pass** `cut(148/148) modules=37 files=180 lines=69512` (`gate-ute-p0-assets.log`) |
| `docs-sync --check` | **docs=193 findings=0 blocking=0** (`gate-docs-sync.log`) |
| `place-dist-glue` | **35 placements**, all byte-identical (`gate-place-dist-glue.log`) |
| `eb3-ci-required` | **pass workflows=11 findings=0** (`gate-eb3-ci-required.log`) |
| bound vitest (`ci-integration`, 15 suites) | **PASS 238 passed / 0 failed** (`gate-bound-vitest.log`) |
| `EB3-RUN-MANIFEST` | **pass records=602 strict=0 incomplete=11 findings=0** (`gate-eb3-run-manifest.log`) |
| UTE G1 nine-file argv | **89 tests / 89 pass / 0 fail** (`gate-ute-g1-argv.log`) |
| `ci-pr-gate --full --census-captures 2` | **PASS 10/10** in 295.4 s; census `599f/7424l` twice with identical identity sets (`gate-ci-pr-gate.log`) |

`ci-pr-gate` wrote its comparison JSON to `dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/`
(untracked, as in every prior round; the scratch directory has been untracked since round 98).

## New scannable-surface delta — measured, not assumed

Booked as **0**: `docs-sync` still reports `docs=193` and `test-catalog` still reports
`tests=785 … digest=sha256:da8a452d…` — the same values as round 112. The two new `.md` files live under
`dev/agent-workflow/evidence/`, which neither scanner counts, and no test/instrument file was added or
removed. `ute-cut-closure`/`ute-p0-assets` are unchanged (`cut(0/148)` / `cut(148/148)`), and
`place-dist-glue` still reports 35 byte-identical placements (no new dist file).

## Evidence binding (disclosed, not smoothed)

The candidate-acceptance verdict this sign-off cites is bound to head **`41d579119`**, not to this
round's head. `git diff --stat 41d579119..HEAD -- packages/*/src` is **empty**: only test files and docs
changed since. The sign-off therefore uses the machine verdict for the product code that is still at this
head, and says so in `C1-C18-SIGNOFF.md` §3.

## Corrections recorded this round

- **F-1 / SEC-02** — `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md:104-133` still prints
  `d4:routed-wake` **REFUTED** while the same tree's `results.json` and the candidate verdict record all
  seven routed sub-judges **PROVEN**. The sign-off uses the machine artifacts. Not fixed (evidence-only
  round).
- **F-2** — `D-ACCEPTANCE-REPORT.md` §2.2's C6/C7 rows say the live routed wake is unproven; the new
  ROUND 113 block supersedes them (C6 DEV-LIVE, C7 MECHANISM for the cold-wake half only).

## Security findings (none fixed)

- **SEC-01** admission ledger append is not `fsync`'d (`packages/runtime/src/plugin/vnext/fact-ledger.mjs:126`);
- **SEC-02** stale d4 README inverting the routed-wake verdict;
- **SEC-03** host-capability tools are admitted with no managed I/O lane;
- **SEC-04** ungoverned rows are outside every invariant (labelled `uteProtected=false`).

No managed Admission / Provider-OS / Settlement / Control / Stop invariant was found **BROKEN** at this
head. Details and the hostile-code gap list: `SECURITY-REVIEW-20261125.md`.
