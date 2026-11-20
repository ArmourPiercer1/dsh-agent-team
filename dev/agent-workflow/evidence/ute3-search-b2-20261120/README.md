# UTE-3 PR B2 — SEARCH new-path reproduction (2026-11-20)

Raw transcripts for the second half of the SEARCH family's retirement predicate:
the **new path** (the pinned next host's own `@deepseek-ai/dsh-tool-fs-search`
module, mounted on a Member's isolated scope by the SAME product route-C seam
and executed by the host's own `ToolsService` batch) against the B1 golden rows.

* branch `task/ute3-search-b2-20261120`
* base `origin/master` = `60dfe5e03` (the ref this evidence was produced on;
  the PR head is named in the settlement comment)
* old-path host: `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`
* new-path host: `0.2.2-rc.5 @ 9c2670d3bce5275e0d1610272958121af87787bb`
  (tag `dsh-v0.2.2-rc.5`, `tests/deepseek-harness-next`)

**No product code changed. No authority moved. No route was switched. No legacy
file was deleted. CORE PATCH BUDGET = 0.**

## Files

| file | what it is |
|---|---|
| `new-path-run.txt` | `node tests/ute-g1-search/run-new-path.mjs` — the graded new-path run: 15 `NEW-PATH-VECTOR … PASS` lines, provenance, divergence total, GREEN verdict. **This is the `newPathVerified` evidence pointer.** |
| `old-path-recapture.txt` | `node tests/ute-g1-search/capture-old-path.mjs` — the old path re-captured on the same tree, `OLD-PATH-GOLDEN compare=identical` against the reviewed fixture (the golden TSV did not move) |
| `new-path-controls.txt` | `node tests/ute-g1-search/new-path-controls.mjs` — 12 mutation controls, `NEW-PATH-NC-VERDICT GREEN controls=12 failed=0` |
| `negative-controls.txt` | `node tests/ute-g1-search/negative-controls.mjs` — B1's 8 controls, unchanged, `NC-VERDICT GREEN controls=8 failed=0` |
| `lane-suite.txt` | `node --test … tests/ute-g1-search/lane-suite.test.mjs` — all 8 lane gates GREEN, one verdict line |
| `gates.txt` | every repository gate, run verbatim, with its exit status |

## Per-vector result (old path = golden row, new path = measured on rc.5)

Every row is **exact**: canonical match set, tree digest `unchanged`,
presented/retained counts, confined spawn count, guard facts, and the refusal
category through the closed vocabulary (`tests/ute-g1-fs/lib/refusal-categories.mjs`,
imported — not forked).

| vector | member | golden outcome / refusal | rc.5 new path | result |
|---|---|---|---|---|
| `SR-G1-inlane-match` | grep | allow / — | allow / — | exact |
| `SR-G2-no-path-stdin` | grep | allow / — (**0 matches**) | allow / — (**0 matches**) | exact |
| `SR-G3-outside-denied` | grep | deny / `denied-by-lane` | deny / `denied-by-lane` | exact |
| `SR-G4-lane-bound` | grep | deny / `denied-by-lane` | deny / `denied-by-lane` | exact |
| `SR-G5-missing-target` | grep | deny / `missing-path` | deny / `missing-path` | exact |
| `SR-G6-invalid-pattern` | grep | deny / `invalid-argument` | deny / `invalid-argument` | exact |
| `SR-G7-cancel-before-dispatch` | grep | deny / `cancelled` | deny / `cancelled` | exact |
| `SR-G8-retention-limit` | grep | allow / — | allow / — | exact |
| `SR-G9-binary-file` | grep | allow / — | allow / — | exact |
| `SR-L1-inlane-known-set` | glob | allow / — | allow / — | exact |
| `SR-L2-outside-denied` | glob | deny / `denied-by-lane` | deny / `denied-by-lane` | exact |
| `SR-L3-lane-bound` | glob | deny / `denied-by-lane` | deny / `denied-by-lane` | exact |
| `SR-L4-missing-target` | glob | deny / `missing-path` | deny / `missing-path` | exact |
| `SR-L5-invalid-pattern` | glob | deny / `invalid-argument` | deny / `invalid-argument` | exact |
| `SR-L6-cancel-before-dispatch` | glob | deny / `cancelled` | deny / `cancelled` | exact |

Member coverage on this axis: `grep` 9/9 + `glob` 6/6 ⇒ the retirement gate
derives `unit=2/2`.

## Declared divergences: NONE — and that is a measurement, not an omission

`NEW-PATH-DIVERGENCE-TOTAL declared=0 observed=0 ids=-`.

The run was **expected** (by the task brief) to find at least one legitimate
non-reproduction around `SR-G2-no-path-stdin`, on the premise that the governed
row returns 2 matches while route C returns 0. **The measured facts are
different and are recorded as measured:**

* the B1 golden row for `SR-G2` is `outcome=allow`, `refusal=-`, **0 matches** —
  that IS the route-C product behaviour, captured and reviewed in B1;
* the rc.5 new path also returns **0 matches**, for the same
  generation-independent reason: the host module's `grep` argv carries no path
  operand when the caller omits `path`, and the confined child's fd 0 is a
  readable socket, so `rg` searches stdin instead of the workspace;
* the governed row's 2-match behaviour is a difference between the **route-C
  face and the governed plane** — already declared as
  `SD-SEARCH-1-grep-path-default`, blocking and unapproved.

So the new-vs-old comparison has **zero** divergences, while the semantic-
difference term stays **unresolved**. Fabricating a divergence to satisfy the
brief, deleting the vector, or calling `SD-SEARCH-1` resolved would all be
false; the divergence channel is implemented, exercised by controls, and its
empty table is asserted in both directions (an undeclared diff is RED, a stale
declaration is RED).

The three differences (unchanged from B1, still `blocking:true`,
`approval:null`, so `semanticDifferencesResolved` stays **false** and the state
stays `NOT_RETIREABLE`):

* `SD-SEARCH-1-grep-path-default`
* `SD-SEARCH-2-grep-vcs-ignore`
* `SD-SEARCH-3-refusal-surface`

## Executor provenance (asserted, not assumed)

`NEW-PATH-PROVENANCE` lines in `new-path-run.txt` name, per vector, the served
module entry and every spawn program. Both are resolved with realpath
containment inside `tests/deepseek-harness-next`:

* entry: `…/deepseek-harness-next/packages/fs/tool-fs-search/lib/index.js`
* spawn `argv[0]`: `…/deepseek-harness-next/node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/…/bin/rg`

A legacy-tree (or out-of-tree) resolution is a typed provenance failure and
turns the run RED (`NPNC-PROVENANCE-BITES`).

## Mutation controls (12, all GREEN)

`new-path-controls.txt`:

| control | mutation | what must turn RED |
|---|---|---|
| `NPNC-MATCHSET-BITES` | change one expected match cell | the comparator reports the `effects` field |
| `NPNC-UNDECLARED-DIVERGENCE-BITES` | inject a real difference, declare nothing | `UNDECLARED_DIVERGENCE` |
| `NPNC-STALE-DECLARATION-BITES` | declare a difference that no longer occurs | `STALE_DECLARED_DIVERGENCE` |
| `NPNC-DIVERGENCE-PIN-BITES` | declare a difference, pin the wrong observed cell | `DIVERGENCE_VALUE_DRIFT` |
| `NPNC-PINNED-DIVERGENCE-PASSES` | declare + pin correctly | the vector must PASS as a declared divergence (the channel may not reject honest divergence) |
| `NPNC-DIFFERENCE-ID-BITES` | cite an id outside the declared set | `DIFFERENCE_ID_UNKNOWN` |
| `NPNC-PENDING-MARKER-BITES` | park a vector as pending | `PENDING_MARKER` |
| `NPNC-MISSING-VECTOR-BITES` | drop a vector from the run | `MISSING_OBSERVED` |
| `NPNC-PROVENANCE-BITES` | move a definition or spawn program outside the next tree | `PROVENANCE_*` |
| `NPNC-DECLARATION-TABLE-BITES` | declare a non-vector / unknown id / no-op cell | `checkDeclarations` refuses the table |
| `NPNC-LANE-BITES-GREP` | widens ONLY the read lane around `SR-G3` | the same call must be **allowed** and return the secret (a lane denial really is the lane's decision) |
| `NPNC-LANE-BITES-GLOB` | widens ONLY the read lane around `SR-L2` | the same walk must be **allowed** and list the out-of-lane path (a listing carries no bytes, so the witness is the path) |

## Gates (verbatim, in `gates.txt`)

```
node scripts/eb3-ci-required.mjs                                   → pass workflows=10 findings=0
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7 → refused=0 findings=0 (tests=888, uncollected=41, excluded=14)
node scripts/eb3-family-definitions.mjs                            → pass files=37 findings=0
node scripts/ute-family-inventory.mjs                              → findings=0 (9 families, 92 files)
node scripts/ute-retirement-gate.mjs --all                         → fs REFUSED codes=UTE_SEMANTIC_DIFFERENCES_UNRESOLVED unit=4/4;
                                                                     search REFUSED codes=UTE_SEMANTIC_DIFFERENCES_UNRESOLVED unit=2/2;
                                                                     SUMMARY requested=2 allowed=0 refused=2
node scripts/docs-sync.mjs --check                                 → findings=0 blocking=0
node scripts/check-append-only-log.mjs                             → verdict=pass (append-only)
git diff --check                                                   → clean
node --check <each new/modified .mjs>                              → ok
node --test tests/ute-g1-search/lane-suite.test.mjs                → 8/8 pass, retirement=FORBIDDEN
node --test scripts/ute-retirement-gate.test.mjs                   → 31/31 pass
node --test scripts/ute-family-inventory.test.mjs                  → 35/35 pass
```

`ute-retirement-gate.mjs --all` exits **1** by design: it refuses both
non-retireable families. Both refusals are the *unapproved* semantic
differences, not a coverage gap.

## §UNKNOWN — what this evidence does NOT establish

* **Confinement is not PROVEN.** A refusal record pins the refusal, the absent
  secret and an unchanged tree; it cannot prove an unauthorized read never
  happened. (Same limit as B1.)
* **The governed plane's real dispatch is NOT run.** `team_grep`/`team_glob`
  through the governed kernel/PA mount is unmeasured here; only the route-C face
  and the argv builder are. `SD-SEARCH-2` is about that difference and stays
  open.
* **No live boot.** C1 host-free capture; boot would add transport, not
  evidence, for an effect record.
* **Not covered by the 15 vectors**: caller-supplied caps (`head_limit`,
  context, case modes, multiline are absent from the host schema), glob
  over-cap sampling, glob ORDER (walk-dependent), mid-search cancellation,
  symlink escapes, stream-drain truncation, `--pre`/config steering and
  `spillStore` (the world has none).
* **The zero-divergence result is bounded by the corpus.** A behavioural
  difference outside these 15 vectors is not measured by this run; the mutation
  controls prove the comparator would catch it, not that it does not exist.
* **`rg` version.** Provenance pins the packaged binary's path inside the next
  tree; it does not pin a semantic version of `@vscode/ripgrep` beyond what that
  tree ships.
* **No retirement.** `newPathVerified=true` + `oldBaseline=true` +
  `negativeControlsPass=true` + `semanticDifferencesResolved=false` ⇒
  `state=NOT_RETIREABLE`. This PR does not claim otherwise and contains no
  approval record or signature.
