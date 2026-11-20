# ute3-search-b1-20261120 — UTE G1 SEARCH family, old-path baseline (PR B1)

Evidence for the Search family's OLD-PATH half: a reproducible baseline for
`grep` and `glob` on the pinned host through the PRODUCT route-C seam, plus a
family-level and per-member negative-control transcript, plus three MEASURED
retirement-blocking semantic differences.

One writer, one branch (`task/ute3-search-b1-20261120`), one worktree, base
`origin/master` @ `4aaae4c0b6888c07ff8c50002965a09d702f9e9f`. No master/stable
push, no force-push, no merge.

## The composition answer (STEP 0, measured before anything was captured)

`composition-probe.txt` — `node tests/ute-g1-search/probe-composition.mjs`

| member | reachable on route C | reaches the CONFINED provider | inherited unconfined service |
|---|---|---|---|
| `grep` | yes (`PROBE-REGISTRY grep=registered`) | yes (`providerCalls=1`) | never (`inheritedServiceCalls=0`) |
| `glob` | yes (`PROBE-REGISTRY glob=registered`) | yes (`providerCalls=1` for its own allow call) | never (`inheritedServiceCalls=0`) |

The product route is `mountMemberA5sfRealm` + `attachA5sfNativeToolModules`; the
attach places the PD-16 confined search shadow
(`packages/runtime/src/plugin/live/confined-search-tool.mjs`), which binds the
native `grep`/`glob` definitions to the confined `subprocess` face. The
composition that served the observation is the one a live Member uses — there is
no test-only composition in this harness.

The LEGACY GOVERNED PLANE (`packages/tools/families/search.mjs` via
`createTeamToolPlaneAssembly`) does **not** serve the native names:

* `PROBE-PLANE names=native gate=PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`
* `PROBE-PLANE assembly-native=PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` (a real
  mount attempt, not just the name predicate)
* `PROBE-PLANE names=alias gate=accepted`, `assembly-alias=TOOL_BINDING_UNVERIFIED`
  (past the name gate; a full governed mount needs the PA kernel)

So the governed plane mounts Search only as `team_grep`/`team_glob`, and
`grep`/`glob` reach the model through route C alone. **No mounting gap for
either member** — recorded, not papered over, and no member had to be stopped.

## What is PROVEN here

1. **The old path is reproducible.** `capture-run-1.txt` and
   `capture-run-2.txt` are two independent captures; all 15 `OLD-PATH-VECTOR`
   lines are identical and run 2 prints
   `OLD-PATH-GOLDEN compare=identical fixture=tests/ute-g1-search/golden/old-path.tsv`.
2. **Both members are covered by real effects.**
   `OLD-PATH-COVERAGE grep=9 glob=6 vectors=15`; every returned match is
   corroborated against the filesystem before it becomes an effect, and every
   vector's fixture tree is `unchanged`.
3. **Every refusal is a decision of the declared lane / the engine / the
   caller**, and every refusal is mapped onto the CLOSED nine-category
   vocabulary (reused from `tests/ute-g1-fs/lib/refusal-categories.mjs`), with
   the residual `unknown` unreachable. An explanation the mapping lacks raises
   `REFUSAL_VOCABULARY_INCOMPLETE` — never a bucket, never an `other`.
4. **The harness bites on both members.** `negative-controls.txt`:
   `NC-VERDICT GREEN controls=8 failed=0`, including `NC-MEMBER grep ok`,
   `NC-MEMBER glob ok` and their `-POSITIVE` arms
   (`lane-suite.txt` re-runs the same transcript).
5. **The differences are real and declared.** `semantic-differences.txt`:
   `SD-TOTAL declared=3 blocking=3 approved=0`.
6. **Retirement is refused.** `UTE-G1-SEARCH-VERDICT old-baseline=REPRODUCIBLE
   new-path=PENDING semantic-differences=UNRESOLVED negative-controls=GREEN
   retirement=FORBIDDEN` (`lane-suite.txt`).

## What is UNKNOWN here (and why it stays unknown)

| unknown | why it is not closed |
|---|---|
| a governed-plane `team_grep`/`team_glob` DISPATCH | needs the full governed kernel/PA mount (the `u6-arc-a` boot lane). Only the plane's native-name mount refusal and its own argv builder were measured. The probe prints `governed-plane-dispatch=NOT-RUN`. |
| read CONFINEMENT as a safety property | a refusal record pins the refusal, the absent secret token and an unchanged tree. It cannot prove that no unauthorized read happened (`CLAIM_NOT_OBSERVABLE`). |
| a live boot | C1 host-free capture. For an effect record a boot would add transport, not evidence. |
| glob ORDER | `--sort=modified` makes walk order mtime-dependent and ties non-deterministic; the fixture digests the SORTED set and claims nothing about order. |
| caller limbs: `head_limit`, context lines, case modes, multiline | the host `grep`/`glob` schemas expose none of them, so no old-path vector can exist. |
| glob over-cap sampling, mid-search cancellation, symlink escapes, stream-drain truncation, `--pre`/config steering, `spillStore` | not reachable/configured on this composition. The world has no `spillStore`, so the retention vector pins the deterministic "complete result could not be saved" branch. |
| the path-less `grep` defect | MEASURED and recorded (`SD-SEARCH-1`, golden row `SR-G2-no-path-stdin`), NOT fixed — fixing it is a product task with its own baseline movement. |

## Files

| file | produced by |
|---|---|
| `composition-probe.txt` | `node tests/ute-g1-search/probe-composition.mjs` |
| `capture-run-1.txt`, `capture-run-2.txt` | `node tests/ute-g1-search/capture-old-path.mjs` (twice) |
| `semantic-differences.txt` | `node tests/ute-g1-search/probe-semantic-differences.mjs` |
| `negative-controls.txt` | `node tests/ute-g1-search/negative-controls.mjs` |
| `lane-suite.txt` | `node --test --test-force-exit tests/ute-g1-search/lane-suite.test.mjs` |
| `gate-refusal.txt` | `node scripts/ute-retirement-gate.mjs --all` |
| `new-path-absent.txt` | the explicit statement that no new path exists (the `newPathVerified` evidence pointer) |

All commands were run in `/home/armourpiercer/projects/dsh-agent-team/.worktrees/ute3-search-b1-20261120`.
