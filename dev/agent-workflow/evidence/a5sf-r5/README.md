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
| Old recorded golden vectors found | **5,041** in 4 corpora (read 2893 · shell 299 · search 409 · mutation 1440) |
| Adjacent single-assertion old output expectations inventoried | **3** (grep argv spelling, web admission delivery, direct-vs-stub effect parity) |
| Converted vectors | **10** (deliberately a small, explainable sample — see `VECTOR-INVENTORY.md` §3) |
| `REPLAY_AS_REGRESSION` | **4** |
| `RETIRE_AS_OLD_SEMANTICS` | **4** |
| `UNUSABLE` | **2** |

## Disposition table (summary)

| id | owner (new lane) | disposition |
|---|---|---|
| `read-path-unicode-nfc-locator` | `member-io-policy#toLocatorKey` | REPLAY-AS-REGRESSION |
| `read-path-nfd-not-folded` | `member-io-policy#toLocatorKey` | REPLAY-AS-REGRESSION |
| `read-path-dotdot-literal` | `member-io-policy#toLocatorKey` | REPLAY-AS-REGRESSION |
| `read-path-absolute-outside-denied` | `member-io-policy#matchLocator` | REPLAY-AS-REGRESSION |
| `read-golden-operation-fingerprint` | `member-io-policy#compileEffectiveIo` | RETIRE-AS-OLD-SEMANTICS |
| `shell-golden-command-fingerprint` | `sandbox-provider-os-runner#createTeamConfinedRunner` | RETIRE-AS-OLD-SEMANTICS |
| `search-rg-argv-spelling` | `sandbox-provider-os-runner#createTeamConfinedRunner` | RETIRE-AS-OLD-SEMANTICS |
| `web-family-admission-delivery` | `sandbox-provider-os-runner#compileExecutionProfile` | RETIRE-AS-OLD-SEMANTICS |
| `read-image-attachment-projection` | `team-services#installToolBindingRealm` | UNUSABLE |
| `effect-fingerprint-backend-parity` | `team-services#createMemberFsGuard` | UNUSABLE |

Full `file:line` sources, what each old vector asserted, and the changed invariants:
`VECTOR-INVENTORY.md` §1–§2. Scripts/commands used to build the inventory: §0 there.

## RED → GREEN (real output)

RED was captured against a deliberately non-validating stub (`compareObservation` always
returned `MATCH`, no field validation), so the failures are assertion failures of the refusal
laws — not a missing module.

```bash
$ node --test tests/kits/a5sf-golden/compare.test.mjs      # RED, stub comparator
ℹ tests 12
ℹ pass 4
ℹ fail 8
✖ DIVERGED: a folded Unicode path names the field that moved
✖ REFUSED: a fixture without regressionOnly: true is not a comparison input
✖ REFUSED: a fixture carrying an acceptance-shaped token is not converted corpus
✖ NOT_APPLICABLE: a RETIRE vector never matches, even with a byte-identical observation
...
# full log: dev/agent-workflow/evidence/a5sf-r5/red-test.log

$ node --test tests/kits/a5sf-golden/compare.test.mjs      # GREEN, shipping comparator
✔ the corpus is well-formed: every vector is regression-only and names a new-lane owner
✔ the corpus and every fixture are free of acceptance-shaped vocabulary
✔ MATCH: a same-shape new-lane observation is a regression comparison, not acceptance
✔ MATCH: an absolute-outside locator is denied by a restricted lane (lane decision)
✔ DIVERGED: a folded Unicode path names the field that moved
✔ DIVERGED: a relaxed lane decision is reported with both decisions named
✔ REFUSED: a fixture without regressionOnly: true is not a comparison input
✔ REFUSED: a fixture carrying an acceptance-shaped token is not converted corpus
✔ NOT_APPLICABLE: a RETIRE vector never matches, even with a byte-identical observation
✔ NOT_APPLICABLE: an UNUSABLE vector never matches, and says why there is no equivalent
✔ NOT_APPLICABLE: every retired vector is refused BEFORE the observation is inspected
✔ the closed result vocabulary has exactly three statuses and none is a verdict
ℹ tests 12
ℹ pass 12
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
- **Only 10 of 5,041 old vectors were converted.** The other 5,031 stay in their evidence dirs
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
