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
| FINAL2 `b3d9edd6` (evidence commit) | 5043 | 9 | 19 | 3 |

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

| file | base | after-1 | after-2 | final | final2 |
| --- | --- | --- | --- | --- | --- |
| `domain/test/t1-capability-schema` | 9 | 9 | 9 | 9 | 9 |
| `domain/test/t2-blueprint-hash` | 1 | 1 | 1 | 1 | 1 |
| `runtime/test/d3-member-identity-context` | 1 | 1 | 1 | 1 | 1 |
| `runtime/test/p6t3-mediation` | 5 | 5 | 5 | 5 | 5 |
| `runtime/test/p6t3-restart` | 2 | 2 | 2 | 2 | 2 |
| `runtime/test/p6t1-parallel` | 0 | **2** | **5** | 0 | **1** |
| `p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports` | collection error | same | same | same |

Every delta in either direction is inside `p6t1-parallel.test.ts`, and no delta is a
rebuild effect — but reading them is worth the trouble, because **one of them is not in the
disclosed group**. Per-identity, per-capture:

| capture | red identities inside `p6t1-parallel.test.ts` |
| --- | --- |
| BASE | none |
| AFTER run 1 | `P1: N=2 … both succeed` ×2 |
| AFTER run 2 | `P1: N=2 …` ×2 + `P3: the quota race — five parallel, two may admit` ×3 |
| FINAL `e75e1821` | none |
| FINAL2 `b3d9edd6` | **`P2: N=5 same-template parallel activations all succeed (raised quotas)` ×1** |

`7-6-merge-gate/FINDINGS.md` §6 discloses *three* load-sensitive identities — "`P1: N=2
same-template parallel activations both succeed …` ×2 and `P3: the quota race — five
parallel, two may admit (no over-create) …`, which passes 9/9 when run alone" — and the
first four rows above are exactly that group, appearing and disappearing on identical trees.
**The fifth movement is a fourth identity that §6 does not list.** Disclosure in that
document is therefore an undercount, not a lie: the file has at least four load-sensitive
identities, `P2` included. Reported rather than smoothed over, because "matches the
disclosed flake set" is only a discriminator if the disclosed set is complete.

Three independent confirmations that none of it is the rebuild:

* solo runs of the file alone: `9/9`, `9/9`, **`2 failed | 7 passed`** on the AFTER tree and
  `9/9`, `9/9` on the FINAL tree (`logs/p6t1-solo-run*.txt`) — it flakes with the machine to
  itself, so "green alone" was never a sound discriminator and load is not the whole story;
* `grep` of the file shows no `dist`, no `composition-shim`, no spawn: it builds an in-memory
  world over `src`. A rebuilt `dist` cannot reach it structurally;
* `RESOLVED 0` in every capture and 5043 registered legs in every capture — a rebuild that
  changed behaviour would have had to move a leg count or retire a base failure.

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

All rows re-measured on the final committed tree `b3d9edd6` where the instrument can be
re-run cheaply: `pnpm run check:artifacts` → `OK: 1508 files … (incl. 1 glue placement(s))`,
exit **0** (now a true sentence); `pnpm smoke:composition` → exit **0**, 12 `^PASS` lines,
**0 `^SKIP` lines**; `pnpm check:artifacts:head` → exit **0**, `HEAD carries its own build:
the committed surface IS a fresh build of itself (1508 compared file(s))`; the merge gate →
**27 passed (27)**, exit **0**.

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

## 6. Restated on merged master — nothing inherited from §1–§5

`origin/master` moved twice under this branch while the work was in flight. Both were
**merged**, not rebased, because §1's attribution table cites commits by SHA and the parent's
instruction was to merge rather than assume: `0fb4f7df` brought `e829380a`, `5973b423` brought
`6174f1e5` (PR #177, the ceiling-pin instrument). Every figure below was re-run on the merged
tree; the §1–§5 numbers are kept as the pre-merge record they are.

### Population, on `5973b423` (`pop-MERGED-6174f1e5.log`, `mg-pop/`)

```
Test Files  9 failed | 408 passed (417)
     Tests  21 failed | 5026 passed (5047)
```

**417 files, 5047 registered legs.** Red is reported as identities, never as a count:
21 titled red identities + the same 3 collection-error file identities as the base set, byte-
identical messages (`p8s3b-result-effects` seam unavailable, `t12a-b2-child-identity`
capability-template-unresolved, `t12a-glue-handoff-ports` frontmatter delimiter).

Against the disclosed base (18 titled + 3 collection): **RESOLVED 0** — no base identity
stopped being red, so nothing died — and **NEW 3**, all in `p6t1-parallel`:

```
NEW  P6-T1 P1: N=2 … two COMMITTED operations, two members, two distinct child Sessions
NEW  P6-T1 P1: N=2 … two activated results with distinct instance ids and child Sessions
NEW  P6-T1 P2: N=5 same-template parallel activations all succeed (raised quotas) …
```

That is the disclosed load-sensitive family, and it is the *fourth* identity of it: §6 of
`7-6-merge-gate/FINDINGS.md` lists three (`P1 ×2`, `P3`), so that disclosure is short by one
and this lane reports the set rather than a number. Solo on the final tree the file is
`9/9`, twice. The parent's parallel census of the same commit counted 20 titled reds (18 + 2
`p6t1`); this run saw 3 `p6t1` identities. The identity sets differ by exactly that
load-sensitive one, and both runs agree the base set is intact — which is the only thing the
diff can prove.

### Where 5047 comes from — derived, not asserted

`5043` (base) **+ 6 − 2 = 5047**, and both terms come out of the two runs rather than out of a
commit message: `a4p7-ceiling-port-assembly-pin.test.ts` contributes 6 legs in 1 file, present
only in the merged tree; `a4p1-blueprint-v3-governance.test.ts` contributes 18 legs where the
base run recorded 20. Files 416 → 417, one new file.

### Named instruments on the merged tree

**15 files / 269 legs passed** (`battery-15files-on-merged-master.log`) — the 14 files and 263
legs of §2 plus the merged ceiling-pin instrument (6 legs). The list is not inherited either:
the pin instrument is a shipped-surface-adjacent guard, so it joined the named set here.

### Gate, scripts, fence, lint, typechecks

```
merge gate:  Tests 29 passed (29), 172.9 s, exit 0     (merge-gate-29-legs-on-merged-master.log)
             27 → 29: the scratch-independence leg (58.2 s) and the sweep-rule leg
check:artifacts          verdict=ok compared=1508 glue=1, exit 0
check:artifacts:head     verdict=ok compared=1508 drift=0, exit 0, 12.2 s
smoke:composition        exit 0, PASS composition-smoke
pnpm --no-bail -r run typecheck   exit 0, 0 × error TS, 8 packages reported typecheck: Done
lint-identities --diff   universe: 1112 file(s) linted, 0 of them gitignored
                         baseline …: 76 distinct; new 0, resolved 0
fence (twice, byte-identical, after `git add`; sha256 b2a9433426d5efc4…)
  scanned-in-scope: 758 tracked files
  dirty(6 files, 15 sites)  unknown(0 files, 0 sites)  advisory(6 files, 8 sites)
  refused(52 files, 115 sites)  prose(5 files, 5 sites)  adjudicated(16 files, 24 sites)
```

The six tuples are the same six as every earlier pair; `scanned-in-scope` rose 755 → 758 and
the +3 is attributable: +1 from `6174f1e5`'s new pin test (`packages/*/test/` is fence scope)
and +2 from this lane's `scripts/artifact-check-scratch.mjs` + its `.d.mts` — measured by
diffing the index against `HEAD` under the fence's own scope prefixes, not inferred.

The typecheck line states its invocation because a wrong one is not harmless:
`pnpm -r run typecheck --no-bail` puts the flag in front of `tsc` and produces four plausible
`error TS5023: Unknown compiler option '--no-bail'` lines. `pnpm --no-bail -r run typecheck`
is the form that reaches pnpm, and it is the one quoted above.

`p4t6` on the merged tree: 10/10 green, derived total **1033** — the referee scanner
independently reports `filesScanned = 1033`, and evaluating the test's own array literals gives
15 sets, Σ = 50, `983 + 50 = 1033` (the merged branch's `SCANNED_PATHS_A4P76PIN` = 1 element).
The 1032 of the earlier round was correct for its tree; both figures are derived, neither is
quoted.
