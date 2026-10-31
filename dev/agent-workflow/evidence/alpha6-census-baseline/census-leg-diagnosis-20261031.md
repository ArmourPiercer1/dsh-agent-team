# Census-leg diagnosis — 2026-10-31 (真实 UTC): the `census` leg of `scripts/ci-pr-gate.mjs` refuses without `tests/deepseek-harness-test-use` and grades RED with it

**This is a diagnosis record. Nothing was changed by it.** No baseline document, no booking, no p4t6
file, no gate script, and nothing under `scripts/**`, `packages/**`, or `tests/**` was edited —
anywhere, in any tree. The baseline document
`dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md` and the
`--self-test` pin in `scripts/ci-pr-gate.mjs` are owned by the **Alpha.5 phase authority** and stay
byte-identical; the recorded decision below explicitly leaves them untouched.

- **Recording provenance.** The measurements were made 2026-10-31 in the lane workspace against the
  branch `alpha6/lane2-pri1a-writer-20261031` (stack base `7b906b4322b67437ec555e05c5469f2f82f4b508`).
  The agent that recorded them died mid-work leaving one machine-readable file in this directory
  uncommitted; this round re-verified that file value-by-value against the raw captures, the gate
  script, and `git ls-tree` (all values confirmed), and committed it **as found, unmodified**.
  A later recording round (this file's author) completed the record after independent re-derivation
  of the universe lists, which are committed here alongside it.
- **Measured commits.** lane head `9dd6ff48c26e91931c70bab7535e3adae56486af` (the lane's real-host
  test commit; parent `a2bc18d783046c62db3f9db41a8d22dc716e5fa0`), stack base `7b906b432`, and the
  declaring commit `27a81845665a3f065beff606b37097c4ba70c9df` (2026-10-26T12:13:33Z,
  "test(eb2-c): re-pin 9 stale old-red observers to sanctioned product behaviour" — an Alpha.5-phase
  commit on master).
- **Reproduction world.** The lane worktree (runtime materialized + tree built) plus scratch clones of
  both measured commits with the pinned pristine runtime (`tests/deepseek-harness-test-use`, detached
  at the 0.2.0-rc.2 release `639ed01539…`) moved in and back out (`mv`, scratch only).

## What this directory holds, and what stays uncommitted

Committed here: this diagnosis, `census-capture-matrix.json` (the path-scrubbed machine-readable
capture matrix: the 2×2 matrix, the 46-file × 531-leg registration table, the five graded captures
with their scrubbed red identities, the universe counts, the declared pair, the tolerance-set
machine line, and the verdict rule), and four re-derived universe file lists
(`universe-27a818456.txt`, `universe-7b906b432.txt`, `universe-a2bc18d78.txt`,
`universe-9dd6ff48c.txt` — each the `git ls-tree` enumeration below, re-derived from the commits
themselves, so a cold clone can reproduce the 626/660/661/661 counts).

**Left uncommitted on purpose, and summarized here instead of pathed:** the five raw vitest JSON
full-suite captures (~3.8–4.2 MB each), the three gate comparison sidecars, the gate/stdout logs,
the fifteen solo-rerun logs, and the lane worktree's own census captures. Two reasons: raw machine
captures are refused by the evidence-size guard (`scripts/eb3-evidence-guard.mjs`, 1 MiB bound), and
the instrument's red identities are path-keyed as `TEST <checkout-absolute-path>::<title>`, so the
raw captures carry machine-specific paths this repository must not commit. Every number and red
title they contain is restated in this file and in the matrix JSON (which normalizes each identity to
the repository-relative path and byte-preserves the title half), and each restated value was
re-derived in the recording rounds from the raw files or from the commits themselves.

## Root cause (one paragraph)

The census leg has a refusal switch keyed on the presence of an **optional, gitignored directory**:
if `tests/deepseek-harness-test-use` is absent the leg answers, before spawning vitest (exit 1,
`seconds=0`):

> `REFUSED before spawning vitest: tests/deepseek-harness-test-use (the pristine test host, gitignored, pinned by tests/paths.mjs) is absent from this checkout`

— and materializing that checkout flipped the leg from *refused* to *graded* **at the same commit**,
because **531 registered legs across 46 test files register only when the directory exists**
(module-load-time provisioning probes throw at import, so without the checkout those files collect
with zero registered cases). Once graded, the verdict is an **identity-set comparison against a
tolerance set retired to empty** — any red not tolerated fails the leg — and this head's red
population contains state-determined `a4p7-merge-gate` legs plus a load-race pool. Materialization
did not break the census; it made a leg that had always been refusing actually grade a population
that has never been green in any capture since the declaring commit.

## The same-commit pair: `661f/8416l` without the directory, `661f/8947l` with it

Direct `pnpm exec vitest run` over the root config in scratch clones, runtime moved out/in at the
same commit (recomputed from the raw capture JSONs: `files = testResults.length`,
`legs = Σ assertionResults.length`):

| commit | runtime absent | runtime present |
| --- | --- | --- |
| `9dd6ff48c` (lane head) | **661 files / 8416 legs**, 46 files with 0 registered legs | **661 files / 8947 legs**, 0 zero-leg files |
| `a2bc18d78` (its parent) | **661 files / 8416 legs**, 46 files with 0 registered legs | **661 files / 8947 legs**, 0 zero-leg files |

The file *set* is world-invariant (661 both ways); the leg *population* is not. Exactly 46 files go
0 → N legs when the directory exists (`a6a-production-wiring` +59, `multi-mcp-wiring` +49,
`mcp-blueprint-initial-grant` +32, …; full table in the matrix JSON; sum 531 = 8947 − 8416). Their
collection-death tokens include `no repo root with tests/deepseek-harness-test-use` and
`test-use provisioning probe refused the grade: …` — registration happens at import time, so without
the checkout they register zero cases. The same commit therefore measures two different populations
depending on a gitignored directory — and the declared pair `626 / 7936` was declared in the
**materialized** world, so a clean checkout cannot reproduce it even arithmetically.

## Provenance of `626 / 7936`

Declared at `27a818456` on **2026-10-26** (U7-1/EB2-C restatement — an **Alpha.5-phase** number on
master) as the CURRENT CORPUS line of the baseline document above:
`# files 626 | registered legs 7936 | titled reds 0 | collection-error files 0`. Its declared
capture conditions (same document): pristine host **provisioned and built in-worktree** at
`639ed01539` with `pnpm build` + `pnpm build:composition` run "so the composition arms RUN rather
than refuse", `--testTimeout=90000`, two captures, private cache dir — a **materialized and built**
world number. The pair is additionally **pinned by the gate's own `--self-test`**
(`scripts/ci-pr-gate.mjs`: `live.declaredTotals.files === 626 && live.declaredTotals.legs === 7936`,
verified present at the recorded head). The declared predecessor corpus was 558/7010, so totals have
always moved with the corpus; the baseline document itself states the 68-file / 926-leg arithmetic.

## The universe went 626 → 660 → 661 → 661, and the lane's commits add zero universe files

Universe = the root vitest include globs, enumerated per commit with:

```
git ls-tree -r --name-only <commit> \
  | grep -E '^packages/[^/]+/test/.*\.test\.ts$|^packages/runtime/controlled-fs/test/.*\.test\.ts$|^packages/tools/a5p5-tools/test/.*\.test\.ts$' \
  | grep -vE '(^|/)dist/|\.scratch\.test\.ts$|s3-client-generation-spike'
```

| commit | universe files |
| --- | --- |
| `27a818456` (declares 626) | **626** |
| `7b906b432` (stack base) | **660** |
| `a2bc18d78` | **661** |
| `9dd6ff48c` (lane head) | **661** |

The four committed lists make this re-derivable; `comm` of the last two lists is empty: **the lane's
real-host commit `9dd6ff48c` adds zero census-universe files** (its 11 added files are kits under
`tests/kits/` and evidence under `dev/` — neither is in the universe). The +34 files before the base
entered across 744 commits (Alpha.5 u7-master progression plus this stack's earlier alpha6 rounds);
exactly +1 file (`packages/runtime/test/a6-pri1a-writer.test.ts`) entered after the base and before
the head; the +1011 legs decompose as 965 from the 35 added files and 46 from cases added to
pre-existing files. **The delta is not lane-caused, and removing all of today's lane additions still
lands at 661f/8947l (runtime present), nowhere near 626/7936.**

## The verdict is an identity set against a tolerance set retired to empty — not the counts

`compareCensus()` fails the leg iff the red-identity set has a NEW member versus the baseline's
tolerance set; that set is empty by law (`# RETIRED-TO-EMPTY: 9 titled reds retired against
predecessor 2b1099d7`; `tolerated_ids = 0`). The counts enter the detail string as context only —
the instrument says so itself:

> `COUNTS ALSO MOVED (661f/8947l vs the baseline document's own 626 / 7936) — and the identity set moved too, so the set, not the counts, is what this verdict is drawn from`

Consequence, stated plainly because it bounds the options: **re-baselining the counts would not make
this leg pass.** The `661f/8947l vs 626 / 7936` clause is context prose; the verdict comes from the
identity set against the empty tolerance.

## Classification of the reds across five graded captures at the head

Five graded full-suite captures at head `9dd6ff48c`: A, B (lane worktree, built + runtime,
3 and 4 titled reds) and R1, R2, F (scratch clone, **unbuilt** + runtime, 5, 1 and 1 titled reds).
Solo runs = `pnpm exec vitest run <file>` ×3. Red identities per capture are in the matrix JSON.

| leg | full-suite record (red=g,r) | solo ×3 | class |
| --- | --- | --- | --- |
| `a4p7-merge-gate` — "the composition smoke leg … **is green**, asserted by arm name …" | green in built A/B; red in unbuilt R1/R2/F | **RED 3/3 in the unbuilt state** (`packages/client/dist … does not exist … Run pnpm build and re-run this leg.`) | **state-dependent** (build-output state): in the unbuilt state this leg can **never** be green |
| `a4p7-merge-gate` — "refuses the leg, by name, when the host module closure cannot be traversed" | red 2/2 built (A/B); green unbuilt | green in unbuilt clone | **state-dependent**: its premise (a closurable traversal) fails once the client tree is built — disclosed by this lane before the diagnosis |
| `a4p7-merge-gate` — "the client lane runs, and no failure appears outside the disclosed baseline" | red 2/2 built; green unbuilt | nested client lane | **state-dependent** (built-tree nested client suite), load-amplified — disclosed before the diagnosis |
| `alpha5-search-backend` — P11 overflow/Spill | red A,R1; green B,R2,F | GREEN 3/3 (`expected 'completed' to be 'cancelled'`) | **load/deadline race** — under suite load the op completes before the cancel fires |
| `alpha5-glob-backend` — X3 timeout arm settles cancelled | red R1 only | GREEN 3/3 (same token) | **load/deadline race** |
| `a5g6-install-face-render` — GLUE-6 LEG B | red B,R1 | GREEN 3/3 | **load-dependent** (parallel-worker race; JSON reporter swallows the throw) |
| `u7-f-agent-control-c1` — AC-1 gate ABSENT | red R1 only | GREEN 3/3 (797 ms solo) | **load-dependent** |
| `a5p4-lane-hygiene` — self-typechecks with strict settings | red B only | GREEN 3/3 | **load-dependent** (in-process `ts.createProgram` under memory pressure) |

Re-running clears only the rotating pool. It does **not** make the leg pass, because the `a4p7` reds
are not rotations but per-tree-state constants: a built materialized tree is red 2/2 (closure +
client lane), an unbuilt materialized tree is red 3/3 (composition smoke). None of the rotating reds
is deterministic, and none of the deterministic reds is lane-introduced. The baseline document's own
epistemic warning applies ("green solo is a SAMPLE, not a property").

## Reachability: on this branch topology the leg cannot be green in any reachable world

1. **Runtime unmaterialized** (any clean clone — the state every phase PR was authored in): the leg
   **refuses**, and refused is not passed.
2. **Materialized, unbuilt**: the `a4p7` composition-smoke leg is red 3/3 (token above).
3. **Materialized, built**: the `a4p7` closure leg + client-lane leg are red 2/2 (disclosed in the
   lane's own design memo banner on the PR-I1a branch).

Plus the load-race pool makes even a hypothetical all-green capture luck per capture. And **hosted CI
never fires for these branches**: every workflow trigger (`pr-gate`, `ci-required`,
`candidate-protection`, `census-runtime`) filters `branches: [master]` while these PRs target stack
branches — the local gate leg is the whole story. The counts clause can never be fixed by this lane
either: the verdict is drawn from the set, and the declared pair trails the corpus by 744+ commits.

## Decision recorded (2026-10-31)

**Option (c) now — change nothing** — classify this as an **inherited Alpha.5-era baseline/instrument
defect** and record it with the evidence pointers in this directory. Zero writes to any baseline,
booking, or script; matches the repo disciplines ("ENV-REFUSED is never counted as a pass", disclose
rather than hide). The earlier §8/environment-refusal sentences in the lane's PR bodies remain true
for their authoring world (unmaterialized clones, where the leg did only refuse); the honest
disclosure line for anything after this record is the reachability statement above.

**Plus: escalate option (a) — re-baseline — to the Alpha.5 phase authority**, the owner of the
baseline document and the `--self-test` pin (both must move together; re-capture on current master
with the declared capture discipline, never on a stack head, and decide explicitly whether the
tolerance set stays empty). Noted for the deciding owner: **a re-baseline cannot make this lane
green** — it changes only the context prose, while the verdict is the identity set against the empty
tolerance, where any single red is fatal; option (a) must be paired with fixing the two `a4p7`
built-state legs (or taming the race pool). Option (b) — scoping the leg's universe so the 46
host-bound files register identical case counts in both worlds — is likewise an instrument-semantics
change owned by the same authority, is not chosen here, and would not clear the state-determined
`a4p7` reds either. The choice among (a)/(b) is not this lane's; the risk is registered in the lane
execution plan's risk ledger with owner = Alpha.5 phase authority.

## Boundaries honored by this record

Diagnosis and this record only. No commits or pushes by the diagnosing round; this recording round
wrote exactly this file (plus the matrix JSON re-verification and the four re-derived lists) in this
evidence directory, one appended log entry, and one appended risk-ledger entry. The read-only
upstream harness checkout stayed at porcelain 0 before and after; the stable development instance on
port 3080 was never touched; no other lane worktree was written; CORE PATCH BUDGET remained 0.
