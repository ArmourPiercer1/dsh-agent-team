# `tests/ute-g1-search` — UTE G1 SEARCH family, old-path baseline (B1) + new-path reproduction (B2)

The reproducible, observed **old-path baseline** for the two model-visible
members of the `dsh.search-family` retirement unit — `grep` and `glob` — plus a
family-level and a **real per-member negative control** (B1), and the **new-path
reproduction on the pinned rc.5 host** (B2).

This lane claims exactly three things:

1. the CURRENT product composition (pinned host `0.2.0-rc.2` + the PD-16
   confined search shadow) behaves as the reviewed fixture says it does;
2. every refusal in that fixture is a decision of the declared lane / the
   regex engine / the caller's cancellation — proven by a mutation that turns it
   RED;
3. the **new path** — the pinned next host `0.2.2-rc.5`'s own
   `@deepseek-ai/dsh-tool-fs-search` module, mounted on the Member's isolated
   scope by the same PRODUCT route-C seam and executed by the host's own
   `ToolsService` batch — reproduces **every one** of the 15 golden rows
   cell-for-cell, with executor provenance pinned to the next tree.

It claims **no** retirement and **no** end-to-end confinement proof. All three
declared semantic differences stay **blocking and unapproved**; see §5 and §7.

## 0.1 The new path (B2) — what is actually new

`lib/new-path.mjs` + `run-new-path.mjs`. The governance seam, the one policy
compiler, the confined OS provider and the guard-fact reader are the SAME Team
modules the old path uses. What differs is the host generation and the
definition route:

| | old path (B1) | new path (B2) |
|---|---|---|
| host | `tests/deepseek-harness-test-use` `0.2.0-rc.2 @ 639ed01539` | `tests/deepseek-harness-next` `0.2.2-rc.5 @ 9c2670d3bc` |
| search definitions | PD-16 shadow (`confined-search-tool.mjs`) delegating to the installed `dsh-tool-fs-search` | the next host's OWN `dsh-tool-fs-search` package, declared by the composition (`a5sfNativeToolModules[].expectedTools`) so the shadow stays silent |
| dispatch | host `ctx.tools.execute` on a hand-built C1 context | the next host's real harness agent (`mountAgentLoopTestDependencies` / `mountAgentLoopTestHarness`) + `executeModelToolFixture` (the host's `ToolsService` batch) |
| provenance | `OLD-PATH-IDENTITY` line | `NEW-PATH-PROVENANCE` lines: served module entry and every spawn program must live inside the next tree |

There is still **no test-only composition and no re-implemented tool body**:
the definition, the argv templates, the parser and the formatter are the host
package's, and the tool body is executed by the host's executor. What Team
supplies is the confined `subprocess` face (the same one B1 measured).

`run-new-path.mjs` grades the run against the **same** `golden/old-path.tsv`
through `lib/new-path-compare.mjs`, whose declaration channel is total in both
directions: an undeclared divergence, a stale declaration, a drifted pinned
value, an unknown difference id, a pending marker or a missing vector are all
RED. **The measured state is zero divergences** — e.g. the path-less `grep`
(`SR-G2`) still returns 0 matches on rc.5 exactly as the golden row records,
because the cause is generation-independent (the host module omits the path
operand and the confined child's fd 0 is a readable socket). The governed row's
2-match behaviour remains the declared difference `SD-SEARCH-1`; this lane does
not resolve it.

## 0. Composition — measured first, not assumed

`probe-composition.mjs` is STEP 0. Its transcript
(`dev/agent-workflow/evidence/ute3-search-b1-20261120/composition-probe.txt`)
contains:

* `PROBE-REGISTRY grep=registered glob=registered`
* `PROBE-MEMBER <m> reachable=yes`, `confined=yes`, `providerCalls=1`,
  `inheritedServiceCalls=0` for both members
* `PROBE-MEMBER <m> out-of-lane … code=IO_READ_DENIED`
* `PROBE-PLANE names=native gate=PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`
* `PROBE-PLANE assembly-native=PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`
* `PROBE-PLANE names=alias gate=accepted`

So: **both members are reachable on the product route and both reach the
confined provider.** The legacy governed plane does not serve the native names
at all — it mounts Search only under the aliases `team_grep`/`team_glob`. There
is no mounting gap in this family, and this fixture therefore records the
PRODUCT route for both members. No test-only composition is used anywhere.

A governed-plane `team_grep`/`team_glob` dispatch is not run (it needs the full
governed kernel/PA mount); see §7.

## 1. Layout

| file | role |
|---|---|
| `lib/world.mjs` | the host-free C1 world: real Cordis `Context`, real `ToolRuntime`, the real confined provider (Landlock launcher + packaged ripgrep), and the product route-C seam `mountMemberA5sfRealm` + `attachA5sfNativeToolModules` |
| `lib/corpus.mjs` | the fifteen declared vectors (lane + fixture + ordered calls + design claim) |
| `lib/scenario.mjs` | one execution of one vector; serializes the witnesses; TSV cells |
| `lib/effect-oracle.mjs` | the witnesses (match set corroborated against the filesystem, tree digest, retention, leak scan) and the TOTAL search→category refusal mapping |
| `lib/compare.mjs` | field-by-field grading of a capture, and the corpus design-claim check |
| `lib/semantic-differences.mjs` | the three measured, retirement-blocking differences between the governed row and the product face |
| `lib/old-path.mjs` | the capture loop (one world per vector) |
| `capture-old-path.mjs` | CLI: `--write` re-derives the fixture; bare run verifies it |
| `probe-composition.mjs` | STEP 0 composition measurement |
| `probe-semantic-differences.mjs` | measures the two argv-level differences on one fixture |
| `negative-controls.mjs` | 8 controls (2 family-level + 2 per-member + 2 positive arms + 2 composition) |
| `lib/host-next.mjs` | tree-anchored resolution of the pinned next host's PUBLIC package entries (containment-checked; no legacy fallback) |
| `lib/new-path.mjs` | the B2 harness: the next host's real agent + the product route-C seam + the confined `subprocess` face, one fresh world per vector |
| `lib/new-path-compare.mjs` | grading against the same golden rows with the declared-divergence channel and the executor-provenance check |
| `run-new-path.mjs` | CLI: run the corpus on the new path, print `NEW-PATH-VECTOR … PASS`, exit 1 on any divergence/provenance failure |
| `new-path-controls.mjs` | 12 mutation controls (comparator, declaration channel, provenance, two real-run lane widenings) |
| `lane-suite.test.mjs` | the lane's own gates (8 tests) and the one verdict line |
| `golden/old-path.tsv` | the reviewed fixture (15 rows) |
| `golden/old-path.meta.txt` | identity, record shape, retained semantics, non-coverage |
| `golden/COVERAGE.md` | member → vectors → control table (gate-checkable) |

## 2. Run it

```bash
node tests/ute-g1-search/probe-composition.mjs
node tests/ute-g1-search/capture-old-path.mjs --write   # re-derive the fixture
node tests/ute-g1-search/capture-old-path.mjs           # verify: OLD-PATH-GOLDEN compare=identical
node tests/ute-g1-search/probe-semantic-differences.mjs
node tests/ute-g1-search/negative-controls.mjs          # NC-VERDICT GREEN controls=8 failed=0
node tests/ute-g1-search/run-new-path.mjs               # NEW-PATH-VERDICT GREEN vectors=15 exact=15 divergences=0
node tests/ute-g1-search/new-path-controls.mjs          # NEW-PATH-NC-VERDICT GREEN controls=12 failed=0
node --test --test-force-exit tests/ute-g1-search/lane-suite.test.mjs
```

All of these are host-free (no boot, no DSH_HOME, no port) but the new-path run
needs the pinned next host tree (`tests/paths.mjs#NEXT_HOST`, provisioned per
`docs/TEST_METHODS.md` §11) and the repo's `node_modules`; a missing/drifted
tree is a module-load THROW, never a skip. That is why the CI leg is post-build
and already provisions the next tree.

## 3. What a record means

See `golden/old-path.meta.txt` §Record shape. The short version: the effect is
the **canonically sorted match set** (every match re-checked against the
filesystem), the **tree digest**, the **retained/presented count**, the
**confined spawn count** and the realm's **guard facts**. The tool's own prose is
evidence of NOTHING except the refusal class it is mapped through, and that
mapping is total: an explanation no entry covers raises
`REFUSAL_VOCABULARY_INCOMPLETE` instead of being bucketed.

Walk order never enters a record: `glob` runs `--sort=modified` and ties are
walk-dependent, so the fixture digests the SORTED set and claims nothing about
order.

## 4. The refusal vocabulary is REUSED

`lib/effect-oracle.mjs` imports `REFUSAL_CATEGORIES`, `CATEGORY_IDS` and
`RefusalVocabularyError` from `tests/ute-g1-fs/lib/refusal-categories.mjs`. That
module's `LEGACY_REFUSAL_MAP` holds the FS surface only, and
`tests/ute-g1-fs/**` is out of this task's write scope — so the SEARCH mapping
lives here, with the same invariants:

* **TOTAL** — an observed refusal no entry explains raises
  `REFUSAL_VOCABULARY_INCOMPLETE`;
* **`unknown` is UNREACHABLE** — no entry maps to it, and both the capture guard
  and the lane suite refuse a row that rests there;
* the mapping never decides *whether* a refusal was right, only *why* the bytes
  were withheld.

The `IO_READ_DENIED` code is generic on this composition (it covers a lane
denial AND a missing target). The class is therefore derived from the deny
locator plus a **filesystem witness**: an absent locator ⇒ `missing-path`, a
locator outside every declared read root ⇒ `denied-by-lane`. A locator that
EXISTS and is INSIDE the lane but is still denied raises
`REFUSAL_VOCABULARY_INCOMPLETE` — this corpus has never observed that condition
and refuses to invent a bucket for it.

## 5. Semantic differences (blocking, unapproved)

Declared in `lib/semantic-differences.mjs`, measured by
`probe-semantic-differences.mjs`:

| id | what the measurement shows |
|---|---|
| `SD-SEARCH-1-grep-path-default` | a path-less `grep` returns **0** matches on the product face (argv carries no path operand; the confined child's fd 0 is a readable socket, so ripgrep reads stdin) while the governed row always appends `.` and returns the real set |
| `SD-SEARCH-2-grep-vcs-ignore` | the same call selects different sets: route C runs `--no-ignore-parent --no-ignore-vcs` (a `.gitignore`d file IS searched), the governed row runs `--no-ignore-parent --no-ignore-global` (it is NOT) |
| `SD-SEARCH-3-refusal-surface` | every confined denial surfaces as the SAME model-facing text with the cause only in the guard fact (`IO_READ_DENIED` for both a lane denial and a missing target), where the governed row owns a closed per-cause `SEARCH_REFUSAL_TEXT` table |

All three are `blocking: true` with `approval: null`. No owner has approved a
reinterpretation, so `semanticDifferencesResolved` is **false** — and the lane
suite asserts that it stays false.

## 6. Negative controls

`negative-controls.mjs` prints one `NC <id> ok|FAIL` line per control, the
per-member lines `NC-MEMBER grep|glob` / `NC-MEMBER-POSITIVE grep|glob`, and the
final `NC-VERDICT GREEN controls=8 failed=0`.

| control | mutation | what turns RED |
|---|---|---|
| `NC-HARNESS-BITES` | flip the `SR-G1` match digest in memory | the comparator must report the `effects` field |
| `NC-CATEGORY-TOTAL` | feed the classifier an unexplained refusal | must raise `REFUSAL_VOCABULARY_INCOMPLETE`; `unknown` must be unreachable from every entry |
| `NC-MEMBER grep` | widen ONLY the read lane around `SR-G3` | the same call succeeds and returns the planted secret |
| `NC-MEMBER glob` | widen ONLY the read lane around `SR-L2` | the same walk succeeds and lists the out-of-lane path |
| `NC-MEMBER-POSITIVE grep` | none (re-run unmodified) | the `SR-G3` golden row must still reproduce |
| `NC-MEMBER-POSITIVE glob` | none (re-run unmodified) | the `SR-L2` golden row must still reproduce |
| `NC-SHADOW-LOAD-BEARING` | dispose the realm's own PD-16 search shadow | the refused out-of-lane `grep` succeeds with the secret |
| `NC-STDIN-LOAD-BEARING` | the same disposal on `SR-G2` | the path-less zero becomes real matches |

The widening changes the declared **authority**, never the implementation: a
refusal that disappears under a wider lane was the lane's decision. The shadow
disposal is the realm's own API (`disposeNativeToolModules`), not a test-only
mount.

## 7. What this lane does NOT prove (UNKNOWN, stated)

* **The new path is REPRODUCED, not semantically resolved.**
  `newPathVerified=true`, `semanticDifferencesResolved=false`,
  `negativeControlsPass=true`, `oldBaseline=true` ⇒ retirement is still
  forbidden. Zero declared divergences is a measurement of equal *effects* on
  this corpus, not a claim that the two implementations are equivalent: the
  three declared differences (§5) are exactly the ways they are not.
* **The next host's `rg` is the packaged binary inside the next tree.** The
  provenance check asserts containment; it does not pin a version string of
  `@vscode/ripgrep` beyond what the tree ships.
* **No cross-generation behavioural claim beyond the corpus.** The 15 vectors
  cover what §7 lists; a difference outside them is not measured by this run.
* **The governed plane's alias dispatch** (`team_grep`/`team_glob` on the real
  governed kernel/PA mount) is NOT run and NOT compared. Only its argv builder
  and its native-name mount refusal are measured.
* **Confinement is not PROVEN** — a refusal record pins the refusal, the absent
  secret and an unchanged tree; it cannot prove an unauthorized read never
  happened.
* **No live boot** — C1 host-free capture. Boot would add transport, not
  evidence, for an effect record.
* **Not covered**: caller-supplied caps (`head_limit`, context, case modes,
  multiline are absent from the host schema), glob over-cap sampling, glob
  ORDER, mid-search cancellation, symlink escapes, stream-drain truncation,
  `--pre`/config steering, and `spillStore` (the world has none, so the fixture
  pins the deterministic "complete result could not be saved" branch).
* **One measured product defect is recorded, not fixed**:
  `SD-SEARCH-1-grep-path-default` (path-less `grep` = zero matches). Fixing it is
  a product task with its own baseline movement.
