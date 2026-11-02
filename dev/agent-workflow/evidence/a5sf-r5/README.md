# a5sf-r5 — BL-13 (R5 黄金向量转换)

- **Branch**: `task/a5sf-r5-golden-20261102` (worktree `.worktrees/a5sf-r5-golden`), base
  `origin/master` @ `180088813`.
- **Scope**: convert retired Alpha.5 tool-family golden output vectors into a **regression
  comparison corpus** for the new Provider / Service / OS-runner lanes.
- **CORE PATCH BUDGET = 0**: no upstream source, no `AGENTS.md`, no `docs/plans/active/**`,
  no authority pointer, no `graph.yaml`, no other worktree, no Host boot, port 3080 untouched.
- **Artifacts**: `tests/kits/a5sf-golden/` (schema, corpus, comparator, host-free suite) and
  this directory (`VECTOR-INVENTORY.md`, `red-test.log`, `green-tests.log`).

## No-acceptance statement (exact)

> **No G2–G5 acceptance is claimed.** The converted corpus is a regression-comparison input
> only: the old vectors were recorded under the retired tool-family architecture, a MATCH is
> not acceptance evidence, and nothing in this evidence directory advances a Gate or a
> `TOOL-ACCEPTANCE-MATRIX` row.

The same rule is the `note` of `tests/kits/a5sf-golden/vectors.json`, phrased **without**
acceptance vocabulary precisely because the comparator refuses such tokens in a fixture; every
comparator result carries `comparison: "regression comparison"` and
`disclaimer: "regression comparison only — a MATCH is not acceptance evidence"`.

## Real numbers

| Metric | Value |
|---|---|
| Live gate-pinned old vectors found | **5,041** in 4 corpora (read 2893 · shell 299 · search 409 · mutation 1440; copies/round-1 recording disclosed in `VECTOR-INVENTORY.md` §1) |
| Adjacent single-assertion old output expectations inventoried | **3** (grep argv spelling, web admission delivery, direct-vs-stub effect parity) |
| Converted vectors | **12** (deliberately a small, explainable sample — see `VECTOR-INVENTORY.md` §3) |
| `REPLAY_AS_REGRESSION` | **6** |
| `RETIRE_AS_OLD_SEMANTICS` | **4** |
| `UNUSABLE` | **2** |

## Disposition table (summary)

| id | owner (new lane) | disposition |
|---|---|---|
| `read-path-unicode-nfc-locator` | `member-io-policy#toLocatorKey` | REPLAY-AS-REGRESSION |
| `read-path-nfd-not-folded` | `member-io-policy#toLocatorKey` | REPLAY-AS-REGRESSION |
| `read-path-dotdot-literal` | `member-io-policy#toLocatorKey` | REPLAY-AS-REGRESSION |
| `read-path-absolute-outside-denied` | `member-io-policy#matchLocator` | REPLAY-AS-REGRESSION |
| `read-path-absolute-stays-absolute` | `member-io-policy#toLocatorKey` | REPLAY-AS-REGRESSION (subset) |
| `read-golden-operation-fingerprint` | `member-io-policy#compileEffectiveIo` | RETIRE-AS-OLD-SEMANTICS |
| `shell-golden-command-fingerprint` | `sandbox-provider-os-runner#createTeamConfinedRunner` | RETIRE-AS-OLD-SEMANTICS |
| `shell-command-is-not-resplit-into-argv` | `sandbox-provider-os-runner#createTeamConfinedRunner` | REPLAY-AS-REGRESSION (argv) |
| `search-rg-argv-spelling` | `sandbox-provider-os-runner#createTeamConfinedRunner` | RETIRE-AS-OLD-SEMANTICS |
| `web-family-admission-delivery` | `sandbox-provider-os-runner#compileExecutionProfile` | RETIRE-AS-OLD-SEMANTICS |
| `read-image-attachment-projection` | `team-services#installToolBindingRealm` | UNUSABLE |
| `effect-fingerprint-backend-parity` | `team-services#createMemberFsGuard` | UNUSABLE |

Full `file:line` sources, what each old vector asserted, and the changed invariants:
`VECTOR-INVENTORY.md` §1–§2. Scripts/commands used to build the inventory: §0 there.

## RED → GREEN (real output)

RED was captured against a deliberately non-validating stub (`compareObservation` always
returned `MATCH`, no field validation), so the failures are assertion failures of the refusal
laws — not a missing module. The log was **regenerated on 2026-11-03** with the same stub
method after the C1–C3 review legs were added (the stub itself is not committed).

```bash
$ node --test tests/kits/a5sf-golden/compare.test.mjs      # RED, stub comparator
ℹ tests 19
ℹ pass 6
ℹ fail 13
✖ DIVERGED: a folded Unicode path names the field that moved
✖ DIVERGED: a relaxed lane decision is reported with both decisions named
✖ DIVERGED: a subset expectation still catches a changed pinned field
✖ DIVERGED: a re-split argv is reported at the argv index
✖ REFUSED: a fixture without regressionOnly: true is not a comparison input
✖ REFUSED: an acceptance-shaped token is refused in EVERY case and inflection
✖ REFUSED: a verdict/status-bearing KEY is refused even with a benign value
✖ REFUSED: an argv expectation must be a string[] (C2)
✖ REFUSED: a subset expectation must be an object (C2, no array-kind escape)
✖ NOT_APPLICABLE: a RETIRE vector never matches, even with a byte-identical observation
✖ NOT_APPLICABLE: an UNUSABLE vector never matches, and says why there is no equivalent
✖ NOT_APPLICABLE: every retired vector is refused BEFORE the observation is inspected
✖ the closed result vocabulary has exactly three statuses and none is a verdict
# full log: dev/agent-workflow/evidence/a5sf-r5/red-test.log

$ node --test tests/kits/a5sf-golden/compare.test.mjs      # GREEN, shipping comparator
✔ the corpus is well-formed: every vector is regression-only and names a new-lane owner
✔ the corpus and every fixture are free of acceptance-shaped vocabulary
✔ MATCH: a same-shape new-lane observation is a regression comparison, not acceptance
✔ MATCH: an absolute-outside locator is denied by a restricted lane (lane decision)
✔ DIVERGED: a folded Unicode path names the field that moved
✔ DIVERGED: a relaxed lane decision is reported with both decisions named
✔ MATCH: a subset expectation pins only the field it names
✔ DIVERGED: a subset expectation still catches a changed pinned field
✔ MATCH: the OS runner passes an explicit argv element through unchanged
✔ DIVERGED: a re-split argv is reported at the argv index
✔ REFUSED: a fixture without regressionOnly: true is not a comparison input
✔ REFUSED: an acceptance-shaped token is refused in EVERY case and inflection
✔ REFUSED: a verdict/status-bearing KEY is refused even with a benign value
✔ REFUSED: an argv expectation must be a string[] (C2)
✔ REFUSED: a subset expectation must be an object (C2, no array-kind escape)
✔ NOT_APPLICABLE: a RETIRE vector never matches, even with a byte-identical observation
✔ NOT_APPLICABLE: an UNUSABLE vector never matches, and says why there is no equivalent
✔ NOT_APPLICABLE: every retired vector is refused BEFORE the observation is inspected
✔ the closed result vocabulary has exactly three statuses and none is a verdict
ℹ tests 19
ℹ pass 19
ℹ fail 0
# full log: dev/agent-workflow/evidence/a5sf-r5/green-tests.log
```

## CI enrolment

Exactly the `tests/world-factory/a5sf-harness.test.mjs` pattern (no new workflow):

- `.github/workflows/ci-integration.yml` — new step
  `a5sf golden-vector regression corpus (R5/BL-13 — node:test, host-free)` with
  `run: node --test tests/kits/a5sf-golden/compare.test.mjs`.
- `dev/ci/eb3-ci-manifest.json` — new `ci-integration` leg `a5sf golden-vector regression corpus`
  (`cmd: ["node","--test"]`, `check: ["tests/kits/a5sf-golden/compare.test.mjs"]`), so dropping the
  file from the step or the check list is `CI_LAYER_LEG_WEAKENED`.

```bash
$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=9 findings=0
```

No `packages/**` file was added or edited, so
`packages/testkit/test/p4t6-bookings/a5sf.json` is untouched (the booking census is not affected).

## Honest limits

- **No G2–G5 acceptance** (statement above). A MATCH only says "the new-lane observation still
  has the recorded shape".
- **Only 12 of the 5,041 live gate-pinned old vectors were converted.** The other 5,029 stay in their evidence dirs
  and keep running in the legacy vitest world; importing them would assert dead fingerprints.
- **Effects with NO old vector at all** (so R5 cannot pin them): OS-level Landlock confinement of
  a real child; network as a hard/destination ceiling; per-Member Service realm + install
  rollback + stale generation; approval single-use/revocation/epoch; real persistent PTY
  receipts; large-file read window/streaming; spill/truncation in the new pipeline. Full table:
  `VECTOR-INVENTORY.md` §4.
- **No npm/pnpm build was run** (the three-lane constraint and the known `ERR_SQLITE_ERROR` on
  `pnpm install` in this environment). The suite runs on plain `node --test` (Node 24 native TS
  type-stripping + the repo's existing `scripts/run-tests-hooks.mjs` hook), no build required.
- **Vectors 1–4 are derived effect claims, not the old fingerprints.** The derivation is
  recorded per vector (`derivation`) so a reviewer can reject any claim that reads as a copied
  expectation.

## Reviewer risk (one)

The converted REPLAY claims deliberately **narrow** the old assertion to the effect the new lane
actually computes (path-locator identity / lane decision) and drop the old fingerprint. If a
reviewer considers that narrowing too generous, the corpus could still "match" while an old
durable-grant identity silently changed — but that identity is retired by design (`VECTOR-INVENTORY.md`
§2), and the legacy vitest digests still pin it in the old world. The residual risk is a
**semantic gap between "old fingerprint stayed stable" and "new locator identity stayed stable"**;
the corpus states it explicitly and never claims the two are the same.

## 2026-11-03 — review response (APPROVE-WITH-CONDITIONS → conditions closed)

Independent review returned **APPROVE-WITH-CONDITIONS** and reproduced the four
corpus counts independently (5,041). The branch was rebased onto
`origin/master` `65bcea4ed` (PR #541) before any change; the base was
`180088813` at the first push. Conditions C1–C4 are closed below, with the
mutations that would re-open each one shown RED against the same suite.

### C1 — acceptance-vocabulary refusal is now case-insensitive, inflected, and key-based

`compare.mjs` keeps the **single** blocklist and widens it:
`accept(s|ed|ing|ance)`, `approve(s|d|ing|al)`, `pass(es|ed|ing)`, `go`,
`green`, `live-confirmed`. Matching is whole-word over a **lowercased**
haystack, so the reviewer's four escapes (`verdict:"pass"`, `"PASSED"`,
`"Accepted"`, `"approved"`) are now all refused. In addition,
`VERDICT_BEARING_KEYS` (`verdict`, `grade`, `status`, `acceptance`,
`decision`, `result`, `signoff`, `sign-off`) is refused **by key at any
depth, regardless of value**; `disposition` is deliberately not in that set
(it is the R5 classification, not a verdict). The set and its rationale are
documented in `SCHEMA.md` §Comparator contract 2, which is the single
documented source; the corpus `note` and every fixture were re-worded so the
corpus itself carries no token. Pinned by
`REFUSED: an acceptance-shaped token is refused in EVERY case and inflection`
(22 carried forms × value and key) and
`REFUSED: a verdict/status-bearing KEY is refused even with a benign value`.

### C2 — `argv` expectations are validated as `string[]`

`validateVector` now refuses a non-array / non-string `argv` expectation (and a
non-object `subset` expectation) as `FIXTURE_FIELD_INVALID` **before**
comparison, so an empty observation can no longer MATCH a malformed `argv`
vector. Pinned by `REFUSED: an argv expectation must be a string[] (C2)` and
`REFUSED: a subset expectation must be an object (C2, no array-kind escape)`.

### C3 — the two declared kinds are now corpus-pinned (both added, neither dropped)

- `compare.kind: "subset"` → `read-path-absolute-stays-absolute` (same old
  recording idx 2459): pins only `absolute:true`; segments deliberately free.
- `compare.kind: "argv"` → `shell-command-is-not-resplit-into-argv` (old shell
  recording idx 8, `bash({command:'a | b && c || d ; e'})`): pins that the
  retired command text reaches the OS runner as **one explicit argv element**
  and is passed through unchanged. The search-family argv *builder* still
  retires; this is the argv *boundary* that replaced it.

Both observations are taken from shipping code (`toLocatorKey`,
`createTeamConfinedRunner(...).plan()` with a probe-only provider) and never
spawn a process. Pinned by the two MATCH and two DIVERGED legs.

### C4 — the 5,041 figure is stated as live gate-pinned corpora, copies disclosed

`VECTOR-INVENTORY.md` §1 now says **"Live gate-pinned corpus total"** and, in
the same section, discloses that `golden-vectors-after-pr2.json` is a
superseded round-1 recording of **877 vectors** (digest `7fbb3ab9…`) and that
the family/master files are **byte-identical copies** (2893 / 299 / 409 each,
family digest = master digest, 750,899 B for the read pair), so no reader can
inflate 5,041 by adding them. The converted-disposition summary moved to
**6 REPLAY / 4 RETIRE / 2 UNUSABLE (total 12)** everywhere.

### Re-run (real output)

```text
$ node --test tests/kits/a5sf-golden/compare.test.mjs
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=9 findings=0

$ node scripts/eb3-ci-negative-controls.mjs
24/24 control(s) behaved as required
```

### Mutation table — each fix reverted in isolation, same suite

| mutation (reverts one condition) | `tests/pass/fail` | the leg that went RED |
|---|---|---|
| M1: uppercase-only + case-sensitive + verdict keys disabled (restores the reviewed escape) | 19 / 17 / **2** | `REFUSED: an acceptance-shaped token is refused in EVERY case and inflection`; `REFUSED: a verdict/status-bearing KEY is refused even with a benign value` |
| M2: remove the `argv` `Array.isArray` validation (restores the empty-observation MATCH) | 19 / 18 / **1** | `REFUSED: an argv expectation must be a string[] (C2)` |
| M3: `subset` returns MATCH without diffing (a declared-but-unpinned kind) | 19 / 18 / **1** | `DIVERGED: a subset expectation still catches a changed pinned field` |
| M4: `argv` returns MATCH without comparing (the other declared-but-unpinned kind) | 19 / 18 / **1** | `DIVERGED: a re-split argv is reported at the argv index` |

Every mutation was applied to a copy of the green comparator
(`.artifacts/tmp/a5sf-r5-mutations/`, gitignored) and reverted before the
green run above. The mutation harness is not committed; the table is the
evidence.

**No G2–G5 acceptance is claimed.** Closing a review condition is a quality
change to a regression-comparison input, not acceptance evidence.
