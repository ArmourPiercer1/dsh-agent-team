**[dated settlement, 2026-11-23T09:46Z — round 90: behaviour-preserving decomposition of `agent-bindings.mjs`; head `b67a3eb38d617b2aa7dbe0cddd2fb9f2a49e334f`]**

Covered head: `b67a3eb38d617b2aa7dbe0cddd2fb9f2a49e334f` (parent `161767565`; four commits: the move,
the lint follow-up, the gate transcripts, the one-line count correction). PR #822 stays **DRAFT**, unmerged
(`state=OPEN`, `isDraft=true`, `headRefName=vnext/a1-cut`, checked with `gh pr view 822` immediately
before posting). :3080 and its DSH_HOME were never touched; no second server was started.

## Verdict

**A reviewability round with ZERO behaviour change.** No capability row moved (no row is PRODUCT-PROVEN,
`d4:routed-wake` stays REFUTED, BL-30 stays open), no test file / assertion / skip / timeout was edited,
no widened bound, no compatibility layer, no upstream patch (**CORE PATCH BUDGET = 0**). The only claim is
the diff shape: the glue shrank by moving already-encapsulated code out of it, byte for byte.

## What moved (old lines → new module → module size)

| span (what it owns) | source range in `agent-bindings.mjs` | new module | moved lines | module lines |
| --- | --- | --- | --- | --- |
| governed preset enabled row module specifiers + each row's declared `config` (SHAPE A) | 534–660 | `governed-preset-modules.mjs` | 127 | 156 |
| MCP CAPABILITY WITNESS: capability telemetry, F15 public tool-surface readers, fiber retirement | 1366–1523 | `mcp-witness-lane.mjs` | 158 | 205 |
| Root (Leader) input delivery ports: the ONE shared real-input path + the B6 context, TCM-M3 initial work, C1 control notification | 3811–4018 | `root-delivery.mjs` | 208 | 248 |
| Member stop lane: `interrupt` + PD-29 goal disarm, `recursiveDrainUnavailable`, `drainDescendants`, `residency` | 4279–4373, 4375–4386, 4420–4517 | `stop-drain-lane.mjs` | 205 (3 chunks) | 249 |

`agent-bindings.mjs` **4,967 → 4,301** lines (`wc -l` on this head); `root.ts` is **unchanged at 5,239**.
Every module is a factory over one row instance (`createXLane({ …closure consts })`) whose body holds the
moved lines at their original 2-space indent, so the text is identical; the glue replaces each span with
the factory construction + a destructure. Function declarations are hoisted in the original closure, so
constructing a factory at the original source position is behaviour-safe (all calls are later and async).

## How "verbatim" was proved (not asserted)

`dev/agent-workflow/evidence/ute-a1/round90/byte-identity.txt` — a two-way substring test against
`git show 161767565:…/agent-bindings.mjs`: each of the six original ranges is **present in its new module
AND absent from the rewritten glue**:

```
governed-preset-modules.mjs old-lines 534-660: lines=127 bytes=6863 verbatim_in_module=True absent_from_glue=True
mcp-witness-lane.mjs      old-lines 1366-1523: lines=158 bytes=7952 verbatim_in_module=True absent_from_glue=True
root-delivery.mjs         old-lines 3811-4018: lines=208 bytes=11601 verbatim_in_module=True absent_from_glue=True
stop-drain-lane.mjs       old-lines 4279-4373: lines=95  bytes=5862 verbatim_in_module=True absent_from_glue=True
stop-drain-lane.mjs       old-lines 4375-4386: lines=12  bytes=756  verbatim_in_module=True absent_from_glue=True
stop-drain-lane.mjs       old-lines 4420-4517: lines=98  bytes=4673 verbatim_in_module=True absent_from_glue=True
ALL_MOVED_BYTES_IDENTICAL_AND_ABSENT_FROM_GLUE=True
```

The only new lines at a move site are `const x = createXLane({…})` + the destructure + a comment; the only
deleted lines are the moved ones. The glue's public surface is unchanged
(`createAgentBindings`, `a5PlaneSubtreeContains`, `createPtcEscalationRouter`).

## Same counts, same digest, before and after

| gate | before (`161767565`) | after (this head) |
| --- | --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | `suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975` | **identical** |
| bound vitest leg | `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` | **identical** |
| `run-boot.mjs --boots 1` (rc.2) | `RESULT FAIL` — `overall=FAIL cases=6 FAIL:1 PASS:5` (`d:remote-creation`), exit 1 | **identical** |
| `run-boot-d2.mjs --boots 1` | `RESULT PASS` — `cases=4 PASS:4`, exit 0 | **identical** |
| `run-boot-d3.mjs --boots 1` | `evidence-complete=true allProven=true` — `cases=4 PASS:4`, exit 0 | **identical** |

The `run-boot` FAIL is the pre-existing `d:remote-creation` arm at this HEAD; identical verdicts was the
requirement, not a green. Driver logs: `round90/drivers-before.log`, `round90/drivers-after.log`.

## Gates at this head

```
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
  (DISCOVERED_AND_COLLECTED 733 / EXCLUDED_WITH_REASON 14 / UNCOLLECTED 38; bounds --max-uncollected 41 --max-excluded 7)
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (34 placement(s))   — every line (byte-identical); 30 → 34 (scripts/dist-placements/260-ute-a1-decomposition.json)
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
node --test (UTE G1 nine-file argv): tests 89 / pass 89 / fail 0 / skipped 0, exit 0
p4t6 scannable ledger: PASS (20/20) with round90decomposition.json booked; MEASURED delta 1313 → 1317
```

`ci-pr-gate --full --census-captures 2` at `ea9104d5b` (the code head; the two later commits are
evidence/docs only):

```
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=275.8
  census: captured 599f/7416l, 599f/7416l vs baseline-declared 626 / 7936 — 2 captures, identical identity sets — COUNTS MOVED, SET DID NOT
```

and the code-only legs re-run at the settlement head `b67a3eb38`:
`DSH-CI-VERDICT pass pass=6 fail=0 skip=0 legs=6 seconds=29.7` (graph-parse, state-freshness,
append-only-log, blueprint-fence, lint-identities, artifacts-at-head — the last one
`compared=1945 drift=0 · HEAD carries its own build`).

**Disclosed red-attribution.** The FIRST full attempt at `ea9104d5b` graded the census leg RED with one new
identity — `a4p7-merge-gate.test.ts §7.6`, whose failure text is an **eslint crash inside the test's own
scratch worktree** (`lint-identities: NOT RUN :: eslint produced no JSON (status 2)`, `ENOENT` in
`readAndVerifyFile`), not an assertion about this round. Per the rule the SAME head was re-run:
`--only census --census-captures 2` → **pass**, 2 identical captures (`round90/census-rerun.log`), the red
suite alone → **35/35 in 102 s**, and the third full run → **10/10**. Both flake comparisons are kept in
`dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/`.

## Deliberately NOT moved, each with its reason

- `observeMcpOperationalWitness`, `deliverRootWorkCompletionNotification`, `deliverReviewWake` read the row's
  `closing` primitive (`let closing`, sole writer `close()`). A primitive cannot be passed by reference, so a
  move would have forced an edit to the moved condition — a logic edit this round refuses. They stay and
  consume the moved readers through the factory return.
- `reconcileMcpSet` (the mount/dispose transaction) and the plugin-owned cooldown/reconnect constants stay:
  `f15-mcp-live-loss.test.ts §9.2` is a **STATIC call-site witness** that reads `agent-bindings.mjs` and pins
  exactly ONE `state.mcpMountCtx.plugin(mcpClient,` site plus the literal policy constants. Moving the
  transaction would have required editing that test (forbidden) or leaving it pointing at a file with no call
  site (a silent weakening). **This is the one span the round wanted and could not take without a test edit,
  and it is reported, not worked around.** The witness half did move (`mcp-witness-lane.mjs`), and the module
  header documents the split.

## Explicitly NOT done

No logic edit, rename-for-clarity, merge, reformat, or "while I'm here" cleanup inside the moved spans. No
test/assertion/skip/timeout change. No new p4t6 arm relaxed — the four new files are **booked** with the
measured delta. No `.github/workflows/`, `dev/ci/` or branch-protection change. No force-push, no rebase, no
history rewrite (forward-only push `161767565..b67a3eb38`). No upstream file touched.

## Limits / NOT proven

Nothing new is proven — that is the claim. (a) The moved modules have no separate unit test; they are
exercised through the same glue suites (adding a factory-boundary test would be new surface, not
preservation). (b) **`root.ts` was not decomposed** — 5,239 lines remain, so the reviewer's size concern is
only partly addressed. (c) The decomposition makes the assembly easier to *review*, not easier to *test*; that
is a diff-shape claim, not an acceptance level. (d) `d:remote-creation` is still red at `run-boot` and still
open (§10 register of `D-ACCEPTANCE-REPORT.md`). (e) The census first-attempt flake is disclosed, not
explained away: one red, one green at the same head on the re-run, with the failure text naming a crashed
eslint process rather than a product assertion.

