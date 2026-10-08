# 7.8 — battery: base vs rebuilt, per file, with literal outputs

Everything below was run in `.worktrees/a4-dist-rebase` on `feat/a4-dist-rebase`, at
`f0485b15` (BASE, dist == committed-stale) and at `e75e1821` (FINAL, dist re-based + the
freshness leg). `rm -rf packages/testkit/test/.tmp-fault` before every vitest run. No root
`pnpm test`, no host boot, no port 3180/3080, no push. `pnpm install` was run un-piped with
`--store-dir <repo>/.pnpm-store` and exited 0; `yaml` resolves from the packages that
declare it (`packages/domain`, `packages/runtime`), and no test file imports it from
`packages/testkit`, so the `Cannot find package 'yaml'` collection failure never appeared.

## 1. Population red-identity vs the disclosed base set

Command (both states, identical):
`npx vitest run packages/{runtime,domain,legacy,storage,contracts}/test --reporter=json`

| capture | registered legs | files failed | titled red | collection-error files |
| --- | --- | --- | --- | --- |
| BASE `f0485b15` | **5043** | 8 | 18 | 3 |
| AFTER rebuild, run 1 (`2683653a`) | 5043 | 9 | 20 | 3 |
| AFTER rebuild, run 2 | 5043 | 9 | 23 | 3 |
| FINAL `e75e1821` | **5043** | 8 | 18 | 3 |

**FINAL vs BASE: NEW 0, RESOLVED 0, legs 5043 → 5043, collection-error identities byte-equal**
(`logs/diff-base-vs-final.txt`). The base set reproduced the disclosed debt exactly —
`t1-capability-schema` ×9, `t2-blueprint-hash > t2 hash: hashable projection projects absent
optional singles as explicit null`, `p6t3-mediation` ×5, `p6t3-restart` ×2,
`d3-member-identity-context > … D3-4 FAIL CLOSED: wrong/missing rootSessionId stays
rejected …`, plus collection errors in `p8s3b-result-effects`
(`sessionPersistence.exists public seam is unavailable`), `t12a-b2-child-identity`
(`capability template unresolved … code: capability-template-unresolved`) and
`t12a-glue-handoff-ports` (`blueprint document must start with a --- frontmatter delimiter
line`). **`d3-member-identity-context > D3-4` is red at base and still red after** — its file
carries exactly 1 red in every capture, so it did not die; `RESOLVED 0` is the assertion that
says so, and it is why a NEW/RESOLVED pair alone is not the report (`p6t1-parallel` shows a
file can move pass→red→pass while `RESOLVED` stays empty).

Per-file red counts across the four captures:

| file | base | after-1 | after-2 | final |
| --- | --- | --- | --- | --- |
| `domain/test/t1-capability-schema` | 9 | 9 | 9 | 9 |
| `domain/test/t2-blueprint-hash` | 1 | 1 | 1 | 1 |
| `runtime/test/d3-member-identity-context` | 1 | 1 | 1 | 1 |
| `runtime/test/p6t3-mediation` | 5 | 5 | 5 | 5 |
| `runtime/test/p6t3-restart` | 2 | 2 | 2 | 2 |
| `runtime/test/p6t1-parallel` | 0 | **2** | **5** | 0 |
| `p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports` | collection error | same | same | same |

Every delta in either direction is inside `p6t1-parallel.test.ts`, and the five identities
are the disclosed group: `7-6-merge-gate/FINDINGS.md` §6 records "`p6t1-parallel` has three
load-sensitive identities … `P1: N=2 same-template parallel activations both succeed …` ×2
and `P3: the quota race — five parallel, two may admit (no over-create) …`, which passes 9/9
when run alone", moving in both directions. Two independent confirmations here:

* solo runs of the file alone on the AFTER tree: `9/9`, `9/9`, **`2 failed | 7 passed`** —
  the flake fires even with the machine to itself, so it is not load-only and not tree-related;
* `grep` of the file shows no `dist`, no `composition-shim`, no spawn: it builds an in-memory
  world over `src`. A rebuilt `dist` cannot reach it structurally.

**No suite flipped because of the rebuild. Nothing was "fixed", no suite was edited.**
Per §STALENESS §4 the stronger statement is that *nothing could have*: no test in the
repository imports the five drifted modules.

## 2. Named instruments — identical before and after (14 files / 263 legs, both states)

| file | base | final |
| --- | --- | --- |
| `testkit/a4p7-blueprint-version-clean` | 60 ✓ | 60 ✓ |
| `testkit/p4t6-session-event-scan` | 10 ✓ | 10 ✓ |
| `testkit/a4p75-composition-smoke-classification` | 54 ✓ | 54 ✓ |
| `testkit/a4-artifacts-nonempty` | 4 ✓ | 4 ✓ |
| `domain/a4p7-v3-identity-binds-grammar` (§7.3 identity twin) | 13 ✓ | 13 ✓ |
| `runtime/a4p7-v3-grammar-enforced` (§7.3 enforcement twin) | 8 ✓ | 8 ✓ |
| `runtime/a4p7-shipped-composition-blueprint` | 3 ✓ | 3 ✓ |
| `runtime/persona-kind-shipped-dist-smoke` | 2 ✓ | 2 ✓ |
| `runtime/p8s5a-host-loadability` | 3 ✓ | 3 ✓ |
| `runtime/team-skills` | 9 ✓ | 9 ✓ |
| `runtime/pbf-default-artifact-urls` | 9 ✓ | 9 ✓ |
| `runtime/a3p5-permission-notification-lane-hygiene` | 9 ✓ | 9 ✓ |
| `runtime/a4p3-intervention-lane-hygiene` | 9 ✓ | 9 ✓ |
| `runtime/a4p7-v3-cutover-acceptance` | 70 ✓ | 70 ✓ |
| **total** | **263 passed** | **263 passed** |

`p4t6`'s derived total is **untouched**: the scanner's roots are the nine `packages/` dirs
(`packages/testkit/fault-injection/session-event-scan.mjs:202`), and this lane added no file
under `packages/**` — so `983 + Σ SCANNED_PATHS_*` = 1031 was never moved and no number was
hand-written. The `a4-artifacts-nonempty` 4 legs cover the surfaces' non-emptiness.

Shipped-dist surface readers enumerated rather than guessed (`grep -rn
"dist/packages\|composition-shim" packages/*/test/`): the seven files above that name a dist
path, plus `testkit/a4p7-merge-gate` and `testkit/a4p75-composition-smoke-classification`.
None reads `activation/provider`, `admission/requirement-gate`, `compatibility/blueprint`,
`requirements/creation-preflight` or `requirements/scope-requirements`.

## 3. The merge gate, before and after — literal

BASE (`f0485b15`, stale committed dist):

```
 ✓ packages/testkit/test/a4p7-merge-gate.test.ts (26 tests) 41594ms
 Test Files  1 passed (1)
      Tests  26 passed (26)
VITEST_EXIT=0
```

Its install-surface leg therefore reported `verdict: 'passed'`, `why: OK: 1508 files` — the
text comes from `classifyArtifactsRun` matching the `OK: (\d+) files` line on stdout, and
that is the whole of what the leg knows.

DRIFTED-BUT-UNSTAGED (rebuilt, not staged) — the leg's teeth, one leg selected with `-t`:

```
 × the committed install surface is fresh against the tree, and a missing surface is refused 101ms
 AssertionError: check:artifacts did not pass. why: stale install-surface artifacts:   C content-drift (git add): …
 Expected: "passed"  Received: "failed"
 Tests  1 failed | 25 skipped (26)
```

Note the message names 12 of the 20 paths: `tail(out)` keeps the last 8 lines. The refusal is
correct and the truncation is the instrument's, recorded here so nobody reads "12" as a count.

FINAL (`e75e1821`, dist re-based + the new leg):

```
 ✓ packages/testkit/test/a4p7-merge-gate.test.ts (27 tests) 62170ms
       ✓ the commit carries its own build, judged in a scratch worktree — the question the working tree cannot ask  12144ms
 Test Files  1 passed (1)
      Tests  27 passed (27)
GATE_EXIT=0
```

## 4. Script-level legs, literal (both states)

| instrument | BASE | FINAL |
| --- | --- | --- |
| `pnpm -r run typecheck` (bailing) | exit **0**, `error TS` lines **0** | exit **0**, `error TS` lines **0** |
| `pnpm -r --no-bail run typecheck` | exit **0**, `error TS` lines **0** | exit **0**, `error TS` lines **0** |
| `lint-identities.mjs --diff …/lint-identities-0237d487.txt` | `160 identity lines, 76 distinct`; universe `1108 file(s) linted`; **new 0, resolved 0** | **new 0, resolved 0**; universe `1109` (+1 = the new script) |
| `pnpm smoke:composition` | exit **0**, `PASS composition-smoke`, 11 `PASS` arm lines, **zero `SKIP` lines** | same, exit 0 |
| `node scripts/verify-blueprint-version-clean.mjs` | exit 1 — see classes below | exit 1, same classes |
| `pnpm run check:artifacts` (clean tree) | exit **0** `OK: 1508 files` — **over a stale surface** | exit 0, over a fresh one |

`pnpm smoke:composition` did **not** reproduce the A1.2.7 client-package cause. The client
step now runs and passes by name, and no `SKIP` line appears:

```
PASS host plugin (packages/runtime): name="dsh-agent-team", apply fails loud on degenerate context (ready code=TEAM_PLUGIN_CONFIG_INVALID)
PASS client plugin (packages/client): name="dsh-agent-team-client", apply fails loud on degenerate context
PASS client bundle composition-output-present (packages/client/composition-shim): …
PASS client bundle composition-bundle-is-install-surface (packages/client/composition-shim): all 5 path(s) the built shim manifest advertises land inside an install surface …
PASS client bundle manifest-targets-resolve / shim-recorded-values / plugin-row-registrations /
     bundle-module-graph-evaluates / plugin-row-exports / external-specifier-set / derived-urls-resolve
PASS composition-smoke
```

No dependency, pin or exemption was added, and none was needed. The stack trace printed
mid-run (`bootstrap FAILED: TeamPluginError: dsh-agent-team row config: must be a plain
object`) is the *expected* loud-fail probe — the `PASS host plugin …` line immediately after
it asserts exactly that.

## 5. The fence, twice, byte-identical, after `git add`

Three pairs were captured; all runs in each pair are sha256-equal.

| when | sha256 (pair) | classes |
| --- | --- | --- |
| BASE (tree == `f0485b15`) | `6c0e5249ec4e10d3…d188180` (both runs) | `dirty(6 files, 15 sites)`, `unknown(0 files, 0 sites)`, `advisory(6 files, 8 sites)`, `refused(52 files, 115 sites)`, `prose(5 files, 5 sites)`, `adjudicated(16 files, 24 sites)`, `scanned-in-scope: 754 tracked files`, verdict `dirty-or-unknown` |
| after staging the 20 dist files (`2683653a`) | same sha256 | **byte-identical to base** — every class unmoved |
| after staging the mechanism (`e75e1821`) | `dirty(6,15)` unchanged … `scanned-in-scope: 755` | the single movement is `scanned-in-scope 754 → 755` |

The 15 dirty sites are the 6 disclosed paths (`blueprint-v1-frozen-resume.test.ts:156`,
`t2-blueprint-v2-requirements.test.ts:356`, `p7t6-teammates-adapter.test.ts` ×9,
`a3p4-r4-authority-binding.test.ts` ×2, `tests/kits/pr-e-…mjs:447`,
`tests/kits/pr-f-…mjs:376`) and **no class moved**, because the fence excludes `dist/` by
scope — 0 mentions of `packages/runtime/dist` anywhere in its output, before or after. The
`754 → 755` line is this lane's one new tracked `scripts/` file entering scan scope; it
carries no `schemaVersion:`-digit literal, which is why no class moved with it.
