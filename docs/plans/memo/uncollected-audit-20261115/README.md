# Uncollected-test audit — 2026-11-15

> **Dated:** 2026-11-15 · **Base:** `origin/master` @ `6aba7365f` · **Branch:** `task/uncollected-audit-20261115` · **Worktree:** `.worktrees/uncollected-audit-20261115`
> **Scope:** classify all 91 files in `dev/ci/uncollected-baseline.json`; recommend one executable action per file. **No test was moved, no CI gate added or widened, and `--max-uncollected 91` was not touched.** Classification only.
> **Companion:** [`decisions.tsv`](decisions.tsv) — the same 91 rows, machine-readable (same order as §7).
> **Rev 2** after review of PR #777: rev 1's "host-free" claim was **wrong for 18 files**. It said 37 files run host-free in the `a5sf-worldfactory-c1` leg; the measurement in §4 gives **31**, and 18 moved to a host-provisioned leg (§6.1).

## 1. What "uncollected" means here

`scripts/test-catalog.mjs` derives the test population from `git ls-files` plus **the configs lanes actually run** (`vitest.config.ts` `include[]`, and the node:test predicate), never from file names. `dev/ci/uncollected-baseline.json` (`uncollected-baseline/1`) pins the reviewed set of discovered-but-not-executed files; the gate refuses `UNCOLLECTED_NEW` for any path outside it (`docs/plans/memo/tinf-trust-closeout-20261115/`). `--max-uncollected 91` is the weaker second bound: the number may stay, it may not grow.

Two layers, per `scripts/contract-tiers.mjs` (`TIERS`):

- **L1** = the node:test suites a **non-census** manifest leg dispatches (`dispatch-tests.mjs` resolves `suites[]`/`areas[]` from `dev/ci/eb3-ci-manifest.json`). There are 18 dispatcher legs today, all `ci-integration` except `pr-settlement-unit`.
- **L2** = the census population (`census-plan.mjs#deriveRoots()`, 11 roots / 705 vitest files at this base), run twice by `ci-census`.
- **product vitest** = the root `vitest.config.ts` population that `pnpm test` / the L1 contract leg / the census all read. Adding an `include[]` glob feeds both product-vitest and L2; there is no separate product-only vitest leg.

"Uncollected" is therefore a **set-diff debt**, not a quality verdict: it says no lane resolves the file, not that the file is bad. That distinction is the whole audit.

## 2. Method

1. **Read every one of the 91 files** (header contract, imports, assertions, skip guards), not the names. Files sharing a driver were read together with the driver (`dod20-ui-driver.mjs`, `ui-observe.mjs`, `stage2-observer.mjs`, `run-control.mjs`, `world-factory` libs).
2. **Ran all 80 node:test files twice** — once against the installed closure in this worktree, and once with the pinned host tree **hidden** (§4). Ran the 11 vitest files under a throwaway config in `.artifacts/` (never committed).
3. **Environment.** This worktree has no `pnpm install`. I linked the main checkout's `node_modules` plus the four per-package `node_modules` that exist and set `NODE_PATH=<repo>/node_modules/.pnpm/node_modules`. That approximates an installed checkout, so every run result is reported as "green **here**", never as a CI claim.
4. Nothing under `dev/ci/`, `.github/workflows/`, `package.json`, `vitest.config.ts` or `tests/` was modified. `node --test` and `vitest run` were the only execution.

## 3. How this table was verified

The reviewer's question is the right one: which claims did I *run*, which did I *read*, and how can someone re-run them where `tests/deepseek-harness-test-use` is absent?

### 3.1 Executed (not inferred)

| claim | how |
| --- | --- |
| every "green" on an L1 row | `node --test <file>` per file: exit code + `ℹ pass/fail/skipped` |
| every "red" on an L1 row | same, plus the failing test title and error text |
| every "host-free" claim (batch **B3**) | **hidden-host sweep**: each file re-run with the pinned tree bind-mounted to an empty dir, `A5SF_REQUIRE_PINNED_HOST=1`, `A5SF_PD31_HOST_TREE=/nonexistent` |
| the 7 compatibility files (B1) | `vitest run --config <tmp>` with `packages/*/compatibility/test/**/*.test.ts` added: 76 tests / 0.42 s |
| the 4 PoC files | their own `vitest.poc.config.ts`: 49 tests / 3.3 s |
| the stale pins (B5) | run output: `registries` 11 pass / 1 fail (actual 16 vs expected 15); `pd30` 1 pass / 10 fail |
| batch costs | wall clock per file from the same runs; sums are serial and `node --test` runs files concurrently |

### 3.2 Read only (never executed)

- Archive decisions: last modifying commit, consumers (`grep` for driver/kit names across `docs/`, `scripts/`, `packages/`), and the file's own header ("PoC 不入生产判据", "historical instrument").
- Tier membership (`contract-tiers.mjs`, `census-plan.mjs`, `dispatch-tests.mjs`).
- Everything in §9 (UNKNOWN).

### 3.3 Re-running the host-free proof

The pinned tree is reachable two ways from a worktree: `findTestRepoRoot()` walks up out of `.worktrees/<task>` into the **main checkout**, and several suites hard-code the pinned path. `A5SF_REQUIRE_PINNED_HOST=1` alone is **not** sufficient — it only converts *declared* refusals into failures (`pty-contract`, `sub-contract`, `web-contract`); suites that import the pinned `web/lib` at module load stay green through the main checkout. Hide the tree for the test process only, with a private mount namespace:

```sh
EMPTY=.artifacts/tmp/empty && mkdir -p "$EMPTY"      # must be inside the workspace; /tmp is per-command
unshare -m -r sh -c '
  mount --bind "'"$PWD/$EMPTY"'" /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use
  export NODE_PATH=/home/armourpiercer/projects/dsh-agent-team/node_modules/.pnpm/node_modules
  export A5SF_REQUIRE_PINNED_HOST=1 A5SF_PD31_HOST_TREE=/nonexistent
  node --test tests/world-factory/a5sf-pty-contract.test.mjs
'
# expected: A5SF-PTY-CONTRACT-HOST-INCOMPLETE (red) — NOT 15 silent skips
```

The loop version writes one row per file (`path rc ms pass fail skip`); that file produced §4. Reviewers without `CAP_SYS_ADMIN` in a user namespace get the same isolation by cloning the branch **outside** the repo tree (any path with no ancestor containing `tests/deepseek-harness-test-use`); the mount is preferred because it also defeats `A5SF_PD31_HOST_TREE`'s main-checkout fallback.

Two consequences worth stating:

- A suite that **skips** when the host is absent is not evidence of anything; it is a green meaning "not run". That is exactly why 18 files moved out of B3 (§6.1).
- The host-provisioned leg (B4) must set `A5SF_REQUIRE_PINNED_HOST=1` itself, so a missing tree reds the leg instead of silently emptying it.

## 4. Hidden-host sweep result (the correction)

80 node:test files, pinned tree bind-mounted empty, `A5SF_REQUIRE_PINNED_HOST=1`:

| outcome | files |
| --- | ---: |
| **green** — genuinely host-free | **53** |
| red — needs the pinned host or the native sandbox assets | 18 |
| red — its own defect (2 stale pins, 1 test-side import) | 3 |
| red — heavy (netns, 108 s factory) | 2 |
| green only because the pinned tree supplied `jsdom` (archived kit files) | 3 |
| **total** | **80** |

(`pd16` is green; it sits in B6 for cost, not host dependence.)

## 5. Counts

### 5.1 By layer

| layer | files | note |
| --- | ---: | --- |
| L1 (node:test, `ci-integration`) | **71** | 55 world-factory C1, 10 s2-authority, 3 kit/driver tests, 3 hygiene |
| product vitest (root config, also L2 population) | **7** | `packages/domain/compatibility/test/*.test.ts` — one glob away |
| L2 census (dedicated) | **0** | none is vitest-exclusive to census; the 7 above become L2 too when included |
| not-a-test (PoC / historical instrument self-tests) | **13** | 5 PoC, 8 historical-kit files |
| **total** | **91** | |

### 5.2 By the three cases the audit distinguishes

| case | files | meaning |
| --- | ---: | --- |
| **(a) real regression test that should run in CI** | **74** | 67 L1 + 7 product vitest |
| **(b) driver / acceptance instrument whose behaviour test must run, but not in the unit population** | **4** | `boot-preflight`, `rc2 run-control`, `rc2 runner-wiring`, `a5sf-search-live` |
| **(c) historical PoC / dead experiment** | **13** | 5 PoC + 8 files of two kits cited only by finished or struck plans |
| **total** | **91** | |

### 5.3 By recommended action

| action | files |
| --- | ---: |
| collect into L1 — host-free leg `a5sf-worldfactory-c1` | 31 |
| collect into L1 — host-provisioned leg `a5sf-worldfactory-host` | 18 |
| collect into L1 — test fixed first | 3 |
| collect into L1 — heavy leg | 3 |
| collect into L1 — `authority-s2` leg | 10 |
| collect into L1 — `product-hygiene` + `kits-offline` legs | 6 |
| collect into product vitest | 7 |
| archive (case c) | 13 |

### 5.4 Safety-critical shortlist — 47 files

| property | files | green with the host hidden |
| --- | ---: | ---: |
| **isolation** (OS / realm / netns / read-axis / egress boundary) | 19 | 5 |
| **execution routing** (which plane, which surface, which declaration) | 12 | 7 |
| **authorization** (identity, authority, revocation, capability defaults) | 10 | 10 |
| **Stop** (pause/cancel/archive with zero further rounds) | 4 | 3 |
| **approval** (deny > ask > allow; control surface) | 2 | 1 |
| recovery | 0 | — (no uncollected file pins RECOVERY-01) |
| **total** | **47** | **26** |

Half the population being safety-relevant is not inflation — the Alpha.5 window wrote almost nothing but sandbox/tool-axis instruments — and **23 of the 26 green ones run in ≤1.5 s**, so the safety shortlist is also the cheapest thing to collect.

## 6. Findings that change what to do next

1. **B3 had to be split: "green in this worktree" was riding the main checkout's host tree.** Eighteen files are host-dependent, in four shapes: **9** fail at module load or on their first host assertion (`pd15`, `pd17`, `pd19`, `pty-contract`, `sub-contract`, `tool-axis`, `web-contract`, `web-row`, `web`); **4** red most arms (`pd18`, `pd27`, `pd29-service-seam`, `pd31`); **4** keep most arms and red only their **positive control**, which reads the pinned `packages/bundle/web-app/presets/standard.patch.yml` (`pd21`, `pd23`, `pd24`, `pd25`); and `host-sandbox-assets` needs the provisioned sandbox assets. A positive control that skips is the "vacuous green" this repo already documents, so those files go to the host-provisioned leg instead of being collected with the control skipped.
2. **Two uncollected files are RED on `master`, and one is red for a test-side defect.** Fix them in the batch that collects them:
   - `tests/world-factory/registries.test.mjs` — the pin at `:224` holds **15** lane suites; `tests/world-factory/suites/` has **16** (only `a5sf-read` is new). Run: 11 pass / 1 fail, "actual 16 vs expected 15". The test *title* still says "the ELEVEN lane suites", so read the array, not the title.
   - `tests/world-factory/a5sf-pd30-web-preview.test.mjs` — asserts the **pre-PD37** manifest shape (`dsh-web-fetch-http` in `dependencies`, peer census 10). PD37 (`b5233f440`) made it an *optional exact peer* and the census is now **18**; 1 pass / 10 fail. Pin the rule, not a count.
   - `tests/world-factory/a5sf-native-bash-preservation.test.mjs` — P8 does `await import('@deepseek-ai/cordis')` from `tests/`, which no pnpm hoist can resolve from there (ESM ignores `NODE_PATH`). Import through `packages/runtime`; 14 pass / 1 fail.
3. **The heavy three are not expensive for the PR.** `ci-integration` runs at **89 s median** (75–115 s) while the required run is pinned by the **census job at ~1417 s** (TINF M6 `METRICS.md`). Adding ~35 s of node:test does not move the run's wall clock; only `world-factory.test` (108 s) and `bl42` (30 s standalone, 120 s on the timeout path) are worth routing to `ci-census`.
4. **The historical kits are historical — but their drivers must stay.** `team-view-sync-complete-e2e` is cited only by finished pre-alpha3 documents. `pr-e-requirement-recovery-smoke` is still named at `docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md:804` (as a site to re-pin — live text, not an archived claim), and decisively, its **driver** `pr-e-requirement-recovery-smoke.mjs` is a pinned DEFERRALS row at `packages/testkit/test/a4p7-blueprint-version-clean.test.ts:249`: deleting it reddens the exactness assertion. **B9 deletes the 13 listed test files only; both drivers stay.**
5. **B1's baseline regeneration is hygiene, not a requirement.** `scripts/census-plan.mjs` reports a grown population as `POPULATION_GREW` and treats only removal/swap as `POPULATION_SHRANK`; the baseline is membership, not a digest, precisely so an addition is not a false RED. The 7 compat files add a **new root** (`packages/domain/compatibility`) and 705→712 files; regenerate the baseline to keep the diff honest, but nothing blocks if you do not.

## 7. The table (91 rows, ranked: safety → cheap-and-real → drivers → deletions)

Layer codes: `L1` = node:test manifest leg; `product vitest` = root vitest population; `not-a-test` = never belongs in the unit population. `batch` refers to §8; `blocker` carries that row's measured evidence.

| # | path | layer | what it actually verifies | safety-critical | recommended action | effort | blocker / evidence | batch |
| ---: | --- | --- | --- | --- | --- | :---: | --- | :---: |
| 1 | `tests/s2-authority/authority-dual-read.test.mjs` | L1 | read-only dual-read: CONF-02/03 divergence, MIS missing fields, DERIV backfill refusal, six-field positive; fixture roots only, repo never read as authority | YES:authorization | collect -> L1 authority-s2 | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 2 | `tests/s2-authority/authority-snapshot-isolated.test.mjs` | L1 | F0 canonical digest (content_digest removed, published_utc covered), publisher whitelist = snapshots path only, docs:sync whitelist does not expand, no pointer/registry write | YES:authorization | collect -> L1 authority-s2 | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 3 | `tests/s2-authority/candidate-track-negative-control.test.mjs` | L1 | a candidate-scoped claim NEVER satisfies a master claim (Q7 drift red stays); negative control that reds if a verifiedFor parser starts counting it | YES:authorization | collect -> L1 authority-s2 | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 4 | `tests/s2-authority/ci-snapshot-reader.test.mjs` | L1 | CI reader semantics against mock providers; template read via git show; temp snapshot only | YES:authorization | collect -> L1 authority-s2 | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 5 | `tests/s2-authority/consumer-candidate.test.mjs` | L1 | derived-view consumer: explicit candidate mode only; default stays legacy with unchanged output; refusal never falls back to graph/current-state | YES:authorization | collect -> L1 authority-s2 | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 6 | `tests/s2-authority/current-authority-pointer.test.mjs` | L1 | pointer load + switch transaction: precondition mismatch, digest mismatch, symlink target, injected failure restores EXACT previous bytes, two-current guard, forged post-publish edit, missing pointer with no graph fallback | YES:authorization | collect -> L1 new leg authority-s2 (ci-integration) | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 7 | `tests/s2-authority/freeze-candidate.test.mjs` | L1 | candidate freeze: atomicity + digest pinning of the frozen record | partial | collect -> L1 authority-s2 | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 8 | `tests/s2-authority/probe-candidate.test.mjs` | L1 | candidate probe surface (read-only) | no | collect -> L1 authority-s2 | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 9 | `tests/s2-authority/sync-candidate-resolver.test.mjs` | L1 | candidate/resolver sync ordering + refusals | no | collect -> L1 authority-s2 | S | none (custom harness; node --test wraps each file as one case) | B2 |
| 10 | `tests/s2-authority/verify-candidate.test.mjs` | L1 | candidate verification pipeline incl. digest/schema refusals (8.4 s of the leg) | YES:authorization | collect -> L1 authority-s2 | M | none (custom harness; node --test wraps each file as one case) | B2 |
| 11 | `tests/world-factory/a5sf-capability-defaults.test.mjs` | L1 | capability defaults are deny/allow as declared; no implicit grant | YES:authorization | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 3/3 arms | B3 |
| 12 | `tests/world-factory/a5sf-p01-realm-binding.test.mjs` | L1 | realm binding: the Member's realm identity is what the guard consults | YES:authorization | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 9/9 arms | B3 |
| 13 | `tests/world-factory/a5sf-pd1-revocation-escape.test.mjs` | L1 | mid-flight permission revocation cannot still produce the effect; escape paths typed-refused | YES:authorization | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 5/5 arms | B3 |
| 14 | `tests/world-factory/a5sf-ask-precedence.test.mjs` | L1 | deny > ask > allow on the only observable shape (deny+ask overlap); a reordered matcher silently turns refusal into prompt | YES:approval | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 4/4 arms | B3 |
| 15 | `tests/world-factory/a5sf-pd23-control-surface.test.mjs` | L1 | control/approval surface: deferred control names typed-refused, execute nothing, entry set closed | YES:approval | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | positive control reads pinned `standard.patch.yml`; the other 3 arms are host-free | B4 |
| 16 | `tests/world-factory/a5sf-pd29-goal-stop.test.mjs` | L1 | Leader archive on a running goal: durable pause, 0 further rounds, base-commit pin | YES:Stop | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 4/4 arms | B3 |
| 17 | `tests/world-factory/a5sf-pd33-preview-e2e.test.mjs` | L1 | cross-cutting Preview: Leader -> Members -> governed I/O -> artefact, plus three Stop windows and deferred-name refusals | YES:Stop | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 3/3 arms | B3 |
| 18 | `tests/world-factory/a5sf-pd34-member-stop.test.mjs` | L1 | Stop: the four UI RPCs get -> pause -> cancel -> get in measured order, mount injects no private endpoint, no optimistic projection patch, mutation arm has teeth | YES:Stop | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 8/8 arms | B3 |
| 19 | `tests/world-factory/a5sf-pd25-unbounded-turn.test.mjs` | L1 | ask_user_question/goal trio bounded; the deferred names are UNKNOWN_TOOL and execute nothing | YES:Stop | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | positive control reads pinned `standard.patch.yml`; the other 3 arms are host-free | B4 |
| 20 | `tests/world-factory/a5sf-assembly.test.mjs` | L1 | shipped product assembly: rows, subpath exports, no second host core | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 35/35 arms | B3 |
| 21 | `tests/world-factory/a5sf-bash.test.mjs` | L1 | shell-class admission on the confined subprocess face: realm + declared invocation required before any provider call, write-only cannot read, out-of-lane chmod/create refused, network=deny refused (host provider set does not enforce it), governed realm refuses a terminals consumer | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 21/21 arms | B3 |
| 22 | `tests/world-factory/a5sf-dual-plane.test.mjs` | L1 | two execution planes (product + Team) and the admission precedence between them | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 53/53 arms | B3 |
| 23 | `tests/world-factory/a5sf-governed-preset.test.mjs` | L1 | the shipped opt-in governed-member preset composition | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 17/17 arms | B3 |
| 24 | `tests/world-factory/a5sf-pd12-bash-governance.test.mjs` | L1 | governed bash lane: admission, ask row, refusal with zero effect | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 7/8 arms (1 declared skips) | B3 |
| 25 | `tests/world-factory/a5sf-window-taxonomy.test.mjs` | L1 | activation-window defect class: realm mounted inside createChildSession while the MemberInstance row commits later; ordering fixture must match production | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 9/9 arms | B3 |
| 26 | `tests/world-factory/u7-tbash.test.mjs` | L1 | governed bash lane: one-row resolver, tool_use_id pairing, fence never self-satisfies | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 8/8 arms | B3 |
| 27 | `tests/world-factory/a5sf-native-bash-preservation.test.mjs` | L1 | native bash preserved under plane takeover; stale-PTY refusal; superseded-install boundary | YES:execution-routing | fix test then collect -> L1 a5sf-worldfactory-c1 (host-free) | M | RED today: P8 does `await import('@deepseek-ai/cordis')` from tests/, unreachable through pnpm's hoist; 14 pass / 1 fail (33 s) | B5 |
| 28 | `tests/world-factory/a5sf-pd19-fact-attribution.test.mjs` | L1 | every governed effect is attributed to the declaring member/surface, not to the call | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | 11 arms need the pinned native tool package (module load + attribution source) | B4 |
| 29 | `tests/world-factory/a5sf-pd24-surface-ledger.test.mjs` | L1 | which surface answered each tool, recorded in the surface ledger | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | positive control reads pinned `standard.patch.yml`; the other 4 arms are host-free | B4 |
| 30 | `tests/world-factory/a5sf-pd29-service-seam.test.mjs` | L1 | `skill`/`present` are served by the public seam, not by forked consumer tools; pinned host rows byte-untouched | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | M | needs the pinned `@deepseek-ai/dsh-tool-present` + built skill packages; 1/4 arms + 1 skip without them | B4 |
| 31 | `tests/world-factory/a5sf-tool-axis.test.mjs` | L1 | member x tool upper-bound compilation on the real pinned tool package | YES:execution-routing | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | compiles against the real pinned native tool package; 0/1 without it | B4 |
| 32 | `tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs` | L1 | terminal read axis: in-lane answer, out-of-lane refusal, fact accounting | YES:isolation | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 12/13 arms (1 declared skips) | B3 |
| 33 | `tests/world-factory/a5sf-pd14-sandbox-root.test.mjs` | L1 | sandbox root selection and the per-Member root face | YES:isolation | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 9/12 arms (3 declared skips) | B3 |
| 34 | `tests/world-factory/a5sf-pd26-confined-skill.test.mjs` | L1 | confined `skill` capability: in-lane body, out-of-lane denial, parity with pinned host definition | YES:isolation | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | M | none — host-free green under the hidden-host sweep, 2/6 arms (4 declared skips: PIN/FORK packages) | B3 |
| 35 | `tests/world-factory/u6-arc-d.test.mjs` | L1 | ARC-D C1: probe family refusals hold at the real kernel with zero effect; blueprint closed grammar | YES:isolation | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 8/8 arms | B3 |
| 36 | `tests/world-factory/a5sf-pd30-web-preview.test.mjs` | L1 | governed web transport + real search backend + SSRF/malformed-URL/missing-provider negatives; no base-web fallback | YES:isolation | fix test then collect -> L1 a5sf-worldfactory-c1 (host-free) | M | RED today: asserts the pre-PD37 manifest shape (fetch-http in dependencies, peer census 10) vs post-PD37 optional exact peer + census 18; 1 pass / 10 fail | B5 |
| 37 | `tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs` | L1 | a capability face is bound to the declaring realm, not to the caller | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | module load imports the pinned built `packages/web/web/lib/index.js` (via lib/a5sf-web-arms.mjs); 0/1 arms load without it | B4 |
| 38 | `tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs` | L1 | fs read axis: in-lane body returned, out-of-lane typed denial with 0 bytes / 1 read | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | asserts the real native `packages/fs/tool-fs/lib/index.js` exists in the pinned tree; 0/1 without it | B4 |
| 39 | `tests/world-factory/a5sf-pd18-web-ptc.test.mjs` | L1 | web face under PTC: workflow/web_fetch typed UNKNOWN_TOOL, no provider entry | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | 1 positive-control arm reads pinned `packages/bundle/web-app/presets/standard.patch.yml`; the web allow/deny arms need the pinned web lib | B4 |
| 40 | `tests/world-factory/a5sf-pd21-subagent.test.mjs` | L1 | subagent/subagent_fork: realm isolation + typed refusal that starts zero children | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | positive control reads pinned `standard.patch.yml`; the other 2 arms are host-free | B4 |
| 41 | `tests/world-factory/a5sf-pd27-confined-web.test.mjs` | L1 | confined web face: transport + provider refusals, zero provider entries on denial | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | needs the pinned web face/lib; 3 pass / 6 fail / 1 skip without it | B4 |
| 42 | `tests/world-factory/a5sf-pd31-read-image.test.mjs` | L1 | read_image route gate: allowed route answers, out-of-lane route refused | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | one arm pins `packages/llm/llm-deepseek/src/models.ts` under `A5SF_PD31_HOST_TREE`; 4 pass / 3 fail without the tree | B4 |
| 43 | `tests/world-factory/a5sf-pty-contract.test.mjs` | L1 | pty/terminal contract: revoke idempotence, no allocation after revoke, deferred-injection finding | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | declared host refusal (throws with A5SF_REQUIRE_PINNED_HOST=1): needs the built terminal/agent/session/persistent-bash libs; 15 arms | B4 |
| 44 | `tests/world-factory/a5sf-sub-contract.test.mjs` | L1 | subprocess contract: deny lane kernel-refused in a distinct netns, allow lane connects; admission vs kernel refusal | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | M | declared host refusal (throws): needs built subprocess/subprocess-local/bash-local/http-proxy libs; 15 arms | B4 |
| 45 | `tests/world-factory/a5sf-web-contract.test.mjs` | L1 | web face contract: names, provider object, refusal shapes | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | declared host refusal: needs the pinned web seams; 10 arms | B4 |
| 46 | `tests/world-factory/a5sf-web-row.test.mjs` | L1 | web tool row wiring: the shipped row names the Team module, not a file URL | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | module load imports the pinned `packages/web/web/lib/index.js`; 0/1 without it | B4 |
| 47 | `tests/world-factory/a5sf-web.test.mjs` | L1 | web face end-to-end against a local endpoint, transport selection | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | S | module load imports the pinned `packages/web/web/lib/index.js`; 0/1 without it | B4 |
| 48 | `tests/world-factory/host-sandbox-assets.test.mjs` | L1 | host sandbox assets are provisioned and hashed (the OS half of isolation); absent assets must red, not silently degrade | YES:isolation | collect -> L1 new leg a5sf-worldfactory-host (pinned host provisioned, A5SF_REQUIRE_PINNED_HOST=1) | M | needs `provision-host-sandbox.mjs` assets (5 pass / 23 fail otherwise); TEST_METHODS §9 | B4 |
| 49 | `tests/world-factory/a5sf-bl42-netdeny.test.mjs` | L1 | network=deny reaches the provider once and the child runs in a DISTINCT netns with a kernel errno while listener counters stay put | YES:isolation | collect -> ci-census (heavy leg) | L | 6 arms red without a current install + user namespaces; 120 s on the timeout path (30 s standalone). Heavy leg | B6 |
| 50 | `tests/world-factory/a5sf-pd16-search-read-axis.test.mjs` | L1 | search/glob/grep read axis and its budget (23 s of wall clock) | YES:isolation | collect -> ci-census (heavy leg) | M | host-free green but 23.3 s — the only expensive C1 file; heavy leg | B6 |
| 51 | `packages/domain/compatibility/test/t5-complete-true.test.ts` | product vitest | `complete:true` on a persona/tool requirement is a structural FATAL with no Continue Anyway (Architecture §13.5/§27.2) | no | collect -> product vitest (root vitest.config.ts include) + regenerate census population | S | none; measured 7 files / 76 tests / 0.42 s together | B1 |
| 52 | `packages/domain/compatibility/test/t5-drift-invalidation.test.ts` | product vitest | an ack is bound to an environment fingerprint; any drift invalidates the previous result (different fingerprint) | no | collect -> product vitest | S | none | B1 |
| 53 | `packages/domain/compatibility/test/t5-engine-outcomes.test.ts` | product vitest | PASS/WARNING/FATAL classification: structural missing capability is FATAL, ordinary mismatch WARNING | no | collect -> product vitest | S | none | B1 |
| 54 | `packages/domain/compatibility/test/t5-environment-facts.test.ts` | product vitest | environment-fact parsing/fingerprinting and generation bumps | no | collect -> product vitest | S | none | B1 |
| 55 | `packages/domain/compatibility/test/t5-purity-serialization.test.ts` | product vitest | compatibility result purity + remote-safe serialization round-trip | no | collect -> product vitest | S | none | B1 |
| 56 | `packages/domain/compatibility/test/t5-requirement-validation.test.ts` | product vitest | requirement parsing/validation, Requirement != Policy | no | collect -> product vitest | S | none | B1 |
| 57 | `packages/domain/compatibility/test/t5-warning-ack.test.ts` | product vitest | warning acknowledgement: scope, operator, timestamp, ack does not cover a new mismatch | no | collect -> product vitest | S | none | B1 |
| 58 | `tests/world-factory/a5sf-acceptance-preflight.test.mjs` | L1 | 73 pins over the acceptance claim records: id/path/anchor resolution, no branch-pinned row after landing | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 73/73 arms | B3 |
| 59 | `tests/world-factory/a5sf-debt-register.test.mjs` | L1 | debt register: row/evidence/anchor agreement, contiguous ids, closed consequence set | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 10/10 arms | B3 |
| 60 | `tests/world-factory/a5sf-dev-live-slots.test.mjs` | L1 | slot leak pin + cross-namespace slot liveness (pid in the acquirer's namespace) | partial | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 9/9 arms | B3 |
| 61 | `tests/world-factory/a5sf-dev-live.test.mjs` | L1 | dev-live vs candidate scope separation: a dev record cannot claim V@B, caps are per-scope | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 15/15 arms | B3 |
| 62 | `tests/world-factory/a5sf-instrument-graph.test.mjs` | L1 | the World's profile module graph is provisioned like an install and verified at creation | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 7/7 arms | B3 |
| 63 | `tests/world-factory/a5sf-run-record-binding.test.mjs` | L1 | a run record is evidence only when it binds teamSha + hostSha at WRITE time | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 6/6 arms | B3 |
| 64 | `tests/world-factory/a5sf-search-live.test.mjs` | L1 | the Search acceptance instrument's judges are THREE-WAY: NOT_REACHED, REFUTED and PROVEN must differ for every row, and the refutation twins (leaked byte, process on refusal, ALLOW on denial, fabricated no-match after cancel, rg exit 2 swallowed) stay distinguishable | partial | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 52/52 arms | B3 |
| 65 | `tests/world-factory/arm-verdict.test.mjs` | L1 | ENV_BLOCK vs NOT_REACHED algebra: a product refusal quote never buys ENV_BLOCK, forged signals buy nothing | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 17/17 arms | B3 |
| 66 | `tests/world-factory/binding-digests.test.mjs` | L1 | digest bindings between assemblies and their rows | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 14/14 arms | B3 |
| 67 | `tests/world-factory/port-probe.test.mjs` | L1 | portInUse three-way classification + lease second guard; 3080/3180 asserted out of range | partial | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 5/5 arms | B3 |
| 68 | `tests/world-factory/u7-tbash-offline-drive.test.mjs` | L1 | the offline drive of the u7-tbash assembly (1 case) | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 1/1 arms | B3 |
| 69 | `tests/world-factory/u7-tbash-seam.test.mjs` | L1 | ARC-B runner seam: no flags = byte-for-byte old defaults; flags win; boot budget enforced | partial | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 9/9 arms | B3 |
| 70 | `tests/world-factory/u7-uileg0-answer-drive.test.mjs` | L1 | UI answer RPC framing: token exchange, cookie, mux frames, waterfall answer | no | collect -> L1 new leg a5sf-worldfactory-c1 (host-free) | S | none — host-free green under the hidden-host sweep, 10/10 arms | B3 |
| 71 | `tests/world-factory/registries.test.mjs` | L1 | world-kind and C2-suite registries are fail-closed: removed/malformed/dup entries become typed refusals | no | fix test then collect -> L1 a5sf-worldfactory-c1 (host-free) | S | RED today: the pin expects 15 lane suites (this file:224), `suites/` has 16 (only `a5sf-read` is new); 11 pass / 1 fail, actual 16 vs expected 15 | B5 |
| 72 | `packages/runtime/root-binding/harness/bounded-run.regression.test.mjs` | L1 | bounded-run wrapper: refuses to start outside sanctioned ports (nothing spawned), kills only the group it owns on cap expiry, passes the child's exit through | partial | collect -> L1 new leg product-hygiene | S | none (6/6 green, 1.9 s) | B7 |
| 73 | `scripts/sanitize-evidence.regression.test.mjs` | L1 | evidence sanitizer: alias preflight, quote handling, format coverage over synthetic fixtures | no | collect -> L1 product-hygiene | S | none (25/25 green, 2.3 s) | B7 |
| 74 | `tests/evidence-store/evidence-store.test.mjs` | L1 | evidence relocation store against throwaway git repos: symlink/hardlink, hashing, lstat refusals | no | collect -> L1 product-hygiene | S | none (10/10 green, 1.8 s) | B7 |
| 75 | `tests/kits/_shared/boot-preflight.test.mjs` | L1 | shared boot-preflight closed set: NOT_SELECTED must not block a start; FAIL/NOT_REACHED/ENV_BLOCK cannot blur | no | keep driver; collect its behaviour test -> L1 kits-offline | S | none (15/15 green) | B8 |
| 76 | `tests/kits/rc2-real-host-smoke/run-control.regression.test.mjs` | L1 | the live smoke kit's run-control: start/stop ordering, teardown identity | no | keep driver; collect its behaviour test -> L1 kits-offline | S | none (6/6 green) | B8 |
| 77 | `tests/kits/rc2-real-host-smoke/runner-wiring.regression.test.mjs` | L1 | live smoke runner wiring: wire shape + mock-provider script against the shaped request | no | keep driver; collect its behaviour test -> L1 kits-offline | S | none (51/51 green) | B8 |
| 78 | `tests/world-factory/world-factory.test.mjs` | L1 | the factory itself: leases, verdict algebra, oracle fault-planting sensitivity, cleanup ownership, capped ledgers, dry-run hold ordering | no | collect -> ci-census (heavy leg) | L | 42 pass / 3 fail with the host hidden (37 s here, 108 s with the host) + 1 arm needs real teamSha/hostSha bindings. Heavy leg | B6 |
| 79 | `tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs` | not-a-test | PR-E stage-2 read-only UI observer (100 offline checks over mocked UI truth) | no | archive (historical instrument; only the finished alpha4 plan cites the kit) | M | none (100/100 green); archiving loses a historical instrument's self-check, not product coverage | B9 |
| 80 | `tests/kits/pr-e-requirement-recovery-smoke/ui-observe.test.mjs` | not-a-test | PR-E UI observe hold-points (51 checks) over mocked remote IO | no | archive (historical instrument, same kit) | M | none (51/51 green) | B9 |
| 81 | `tests/kits/team-view-sync-complete-e2e/carrier-import-preflight.test.mjs` | not-a-test | carrier import preflight for the DDoD20 UI e2e kit: absent dep refuses by name | no | archive (historical instrument; kit referenced only by finished pre-alpha3 docs) | M | none (6/6 green) | B9 |
| 82 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-orchestration.test.mjs` | not-a-test | caller-side leg orchestration driven through fake pages/networks | no | archive (historical instrument) | M | green only where the pristine tree is visible: jsdom is resolved through it (49 pass / 0 fail with the host hidden here) | B9 |
| 83 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-ownership.test.mjs` | not-a-test | driver ownership/cleanup of pages it opened | no | archive (historical instrument) | M | green only where the pristine tree is visible: jsdom is resolved through it (12 pass / 0 fail with the host hidden here) | B9 |
| 84 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-dom.test.mjs` | not-a-test | rail locator against faithful DOM fixtures | no | archive (historical instrument) | M | green only where the pristine tree is visible: jsdom is resolved through it (0 pass / 17 fail with the host hidden here) | B9 |
| 85 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-identity.test.mjs` | not-a-test | the three rail locator-IDENTITY defects: positional traversal, unscoped collector, leaves-are-not-rows | no | archive (historical instrument) | M | green only where the pristine tree is visible: jsdom is resolved through it (5 pass / 17 fail with the host hidden here) | B9 |
| 86 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs` | not-a-test | the DDoD20 UI driver's pure navigation/locator/verdict core + real jsdom dialog probe | no | archive (historical instrument) | M | green only where the pristine tree is visible: jsdom is resolved through it (71 pass / 11 fail with the host hidden here) | B9 |
| 87 | `tests/poc-web-native-reuse/poc-w1-native-shape.test.ts` | not-a-test | A5W PoC: native web_search/web_fetch registration/inheritance/shadowing under a closed-world guard | no | archive (PoC, explicitly not acceptance; superseded by the shipped confined web face PD-27/PD-30) | S | needs the PoC vitest alias config; no lane passes --config | B9 |
| 88 | `tests/poc-web-native-reuse/poc-w2-ctx-web-adapter.test.ts` | not-a-test | A5W PoC: ctx-web adapter over the governed plane | no | archive (PoC) | S | same | B9 |
| 89 | `tests/poc-web-native-reuse/poc-w3-fetch-parity.test.ts` | not-a-test | A5W PoC: fetch parity + timeout bound against a stub | no | archive (PoC) | S | same | B9 |
| 90 | `tests/poc-web-native-reuse/poc-w4-e4-public-accept.test.ts` | not-a-test | A5W PoC: resolvePublicAddresses accept leg with REAL public DNS | no | archive (PoC; also network-dependent, which alone disqualifies it from CI) | S | same; live DNS | B9 |
| 91 | `tests/world-factory/poc/poc-native-present.test.mjs` | not-a-test | PoC probe: a native `present` row can be mounted and answer | no | archive (PoC; superseded by the PD-29 seam) | S | needs the pinned host `present` row; PoC, superseded by the PD-29 seam | B9 |

## 8. Proposed batch order

Batch = one module or one bucket = one future PR. Each is executable on its own; `--max-uncollected 91` stays until the last batch, and each batch's collected files leave `uncollected-baseline.json` in that same PR.

| # | batch | files | measured cost | uncollected after | why in this position |
| --- | --- | ---: | --- | ---: | --- |
| **B1** | **product vitest — the 7 T5 compatibility suites** | 7 | **76 tests / 0.42 s** (whole set) | 84 | cheapest real coverage: one `include[]` glob (`packages/*/compatibility/test/**/*.test.ts`), zero new leg, zero host. Regenerate the population baseline (hygiene; growth is `POPULATION_GREW`, non-blocking). |
| **B2** | **new L1 leg `authority-s2`** | 10 | **~15–19 s** serial (review 14.59 s; 18.8 s here; `verify-candidate` 6.6 s, `consumer-candidate` 4.2 s, `freeze-candidate` 4.0 s) | 74 | highest-severity uncollected surface, all 10 green with the host hidden. Hand-rolled `t()` harness → one `node:test` case per file; give it its own leg so 15 s does not hide inside a shared one. |
| **B3** | **new L1 leg `a5sf-worldfactory-c1` (host-free)** | **31** | **456 arms, 15.0 s** serial, 9 declared skips | 43 | the largest genuinely host-free block, verified by the sweep in §4. |
| **B4** | **new L1 leg `a5sf-worldfactory-host` (pinned host provisioned)** | **18** | **173 arms** once the tree is built; 0 green without it | 25 | the reviewer's three (`pd31`, `pty-contract`, `web-contract`) plus 15 more. Needs the provisioning step inside `ci-integration` (clone + install + build of `639ed01539`) and **must** set `A5SF_REQUIRE_PINNED_HOST=1`. Provisioning is a **gate change** → its own reviewed PR. |
| **B5** | **test-side repairs, then collect** (`registries` 15→16, `pd30` post-PD37 pin, `native-bash` P8 import) | 3 | 26 arms, 34.4 s (33 s of it `native-bash`'s PTY arm) | 22 | these prove collection has value; test-only changes, no product change. |
| **B6** | **heavy leg (`ci-census` or a `heavy` leg)** | 3 | **181 s** serial (`world-factory.test` 108 s, `bl42` 30–120 s, `pd16` 23.3 s) | 19 | the only batch that would materially slow `ci-integration`; `ci-census` has 45 min and a 1417 s critical path. |
| **B7** | **new L1 leg `product-hygiene`** (`bounded-run`, `sanitize-evidence`, `evidence-store`) | 3 | **6.1 s**, 41 arms | 16 | three unrelated-but-real script/runtime regressions, no env dependencies. |
| **B8** | **new L1 leg `kits-offline`** — the live-kit drivers' own behaviour tests | 3 | **1.2 s**, 72 arms | 13 | case (b) done properly: `rc2-real-host-smoke` is the active real-host smoke instrument (TEST_METHODS §4.2) and `boot-preflight.mjs` is imported by two current kits. |
| **B9** | **archive the historical instruments (test files only)** | 13 | 0 (removal) | **0** | 5 PoC + 8 kit **test files**. Drivers stay: `pr-e-requirement-recovery-smoke.mjs` is a pinned DEFERRALS row (`a4p7-blueprint-version-clean.test.ts:249`) and `dod20-ui-driver.mjs` is what the archived tests exercise. Delete only the `.test.mjs` listed here, in a PR that prints `git log -1` per file. |

**Top three, in order: B1, B2, B3.** B1 because 76 assertions cost 0.42 s and one line of config; B2 because authority isolation is the highest-severity surface and is green with the host hidden; B3 because it is the largest genuinely host-free block (31 files, 456 arms). Together they take 91 → 43 uncollected and add ~35 s to an 89 s job whose required run is pinned by a 1417 s census — no observable slowdown of the required check.

Explicitly *not* first: B6 (3 files, +181 s), and B4 until the provisioning decision is made — B4 is a gate change disguised as a test move.

## 9. UNKNOWN (not guessed)

- **Whether B4's 18 files pass in a real `ci-integration` shape.** They pass in the main checkout, which has a provisioned tree; I did not verify that tree's build freshness against the pin, and `ci-integration` provisions nothing today.
- **`world-factory.test.mjs`'s 3 reds** with the host hidden (42/45): one arm needs real `teamSha`/`hostSha` bindings, one is a supervisor dry-run assertion, one is host-shaped. UNKNOWN which are env-only.
- **`bl42`'s 6 reds**: they persist with and without the host, so they are install/netns-shaped, not host-shaped; a current `pnpm install` may fix the `@deepseek-ai/cordis-plugin-include` resolution they hit. Not verified.
- **Internal case counts of the 10 s2-authority files** — each is one `node:test` case wrapping dozens of `t()` asserts.
- **Whether the `pr-e` / `team-view` kits are used outside this repo** (operator runbooks, a saved browser session). In-repo evidence says no.
- **The L2 census cost of the 7 compatibility files** — 0.42 s standalone; the census runs two captures and compares roots, so the delta is expected to be negligible but was not measured.
- **Why `pd16` takes 23 s** on an otherwise sub-second suite — not diagnosed.

## 10. Explicitly not done (per the brief)

- No CI gate, leg, area or `include` change; no `--max-uncollected` change; no ratchet change.
- No test moved, renamed, rewritten, archived or deleted.
- No PR opened, nothing pushed.
