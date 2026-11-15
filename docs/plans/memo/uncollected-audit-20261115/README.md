# Uncollected-test audit — 2026-11-15

> **Dated:** 2026-11-15 · **Base:** `origin/master` @ `6aba7365f` · **Branch:** `task/uncollected-audit-20261115` · **Worktree:** `.worktrees/uncollected-audit-20261115`
> **Scope:** classify all 91 files in `dev/ci/uncollected-baseline.json`; recommend one executable action per file. **No test was moved, no CI gate added or widened, and `--max-uncollected 91` was not touched.** Classification only.
> **Companion:** [`decisions.tsv`](decisions.tsv) — the same 91 rows, machine-readable (ranked in the same order as §5).

## 1. What "uncollected" means here

`scripts/test-catalog.mjs` derives the test population from `git ls-files` plus **the configs lanes actually run** (`vitest.config.ts` `include[]`, and the node:test predicate), never from file names. `dev/ci/uncollected-baseline.json` (`uncollected-baseline/1`) pins the reviewed set of discovered-but-not-executed files; the gate refuses `UNCOLLECTED_NEW` for any path outside it (`docs/plans/memo/tinf-trust-closeout-20261115/`). `--max-uncollected 91` is the weaker second bound: the number may stay, it may not grow.

Two layers, per `scripts/contract-tiers.mjs` (`TIERS`):

- **L1** = the node:test suites a **non-census** manifest leg dispatches (`dispatch-tests.mjs` resolves `suites[]`/`areas[]` from `dev/ci/eb3-ci-manifest.json`). There are 18 dispatcher legs today, all `ci-integration` except `pr-settlement-unit`.
- **L2** = the census population (`census-plan.mjs#deriveRoots()`, 11 roots / 705 vitest files at this base), run twice by `ci-census`.
- **product vitest** = the root `vitest.config.ts` population that `pnpm test` / the L1 contract leg / the census all read. Adding an `include[]` glob feeds both product-vitest and L2; there is no separate product-only vitest leg.

"Uncollected" is therefore a **set-diff debt**, not a quality verdict: it says no lane resolves the file, not that the file is bad. That distinction is the whole audit.

## 2. Method (and its limits)

1. **Read every one of the 91 files** (header contract, imports, assertions, skip guards), not the names. Files sharing a driver were read together with the driver (`dod20-ui-driver.mjs`, `ui-observe.mjs`, `stage2-observer.mjs`, `run-control.mjs`, `world-factory` libs).
2. **Ran all 80 node:test files** (`node --test <file>`, 120 s timeout) and, for the vitest ones, ran them under a **throwaway config** in `.artifacts/` (never committed): the 7 compatibility files and the 4 PoC files.
3. **Environment honesty.** This worktree has no `pnpm install`. I symlinked the main checkout's `node_modules` and the four per-package `node_modules` that exist, and set `NODE_PATH=<repo>/node_modules/.pnpm/node_modules`. That is enough for 58/80 on a first pass and **66/80** once the per-package link sets are in place; the remaining 14 split into 8 that need the pinned host tree, 1 that needs a current install, 3 genuine reds, and 2 env/heavy. "Green here" means "runs green in a checkout that has the repo's installed closure"; it is not a CI claim.
4. `tests/deepseek-harness-test-use` (the pinned pristine host, `TEST_METHODS.md` §1) is **absent** from this worktree, so any suite that asserts on real native tool packages or host presets is **UNKNOWN**, not "broken".
5. Nothing under `dev/ci/`, `.github/workflows/`, `package.json`, `vitest.config.ts` or `tests/` was modified. `node --test` was the only execution.

## 3. Counts

### 3.1 By layer

| layer | files | note |
| --- | ---: | --- |
| L1 (node:test, `ci-integration`) | **71** | 55 world-factory C1, 10 s2-authority, 3 kit/driver tests, 3 hygiene |
| product vitest (root config, also L2 population) | **7** | `packages/domain/compatibility/test/*.test.ts` — knowably one glob away |
| L2 census (dedicated) | **0** | none is vitest-exclusive to census; the 7 above become L2 too when included |
| not-a-test (PoC / historical instrument self-tests) | **13** | 5 PoC, 8 historical-kit files |
| **total** | **91** | |

### 3.2 By the three cases the audit distinguishes

| case | files | meaning |
| --- | ---: | --- |
| **(a) real regression test that should run in CI** | **74** | 67 L1 + 7 product vitest |
| **(b) driver / acceptance instrument whose behaviour test must run, but not in the unit population** | **4** | `boot-preflight`, `rc2 run-control`, `rc2 runner-wiring`, `a5sf-search-live` — the driver keeps its own entry point; the listed file *is* its behaviour test |
| **(c) historical PoC / dead experiment** | **13** | 5 PoC + 8 files of two kits that only finished plans cite |
| **total** | **91** | |

### 3.3 By recommended action

| action | files |
| --- | ---: |
| collect into L1 (incl. 2 that need a test-side fix first) | **67** |
| collect into product vitest | **7** |
| keep as driver, collect its behaviour test into L1 | **4** |
| archive (case c) | **13** |

### 3.4 Safety-critical shortlist — 47 files

| property | files |
| --- | ---: |
| **isolation** (OS / realm / netns / read-axis / egress boundary) | **19** |
| **execution routing** (which plane, which surface, which declaration) | **12** |
| **authorization** (identity, authority, revocation, capability defaults) | **10** |
| **Stop** (pause/cancel/archive with zero further rounds) | **4** |
| **approval** (deny > ask > allow; control surface) | **2** |
| recovery | **0** — no uncollected file pins RECOVERY-01; that contract's tests are already collected |
| **total** | **47** |

That is half the population, and it is not inflation: the Alpha.5 window wrote almost nothing but sandbox/tool-axis instruments. The useful part: **32 of the 47 run green in 1.5 s or less each**, so the safety shortlist is also the cheapest thing to collect; the four expensive ones are named in §6.

## 4. Findings that change what to do next

1. **Two uncollected files are RED on `master` today.** They are the argument for collecting, and they must be fixed *in the same batch* that collects them:
   - `tests/world-factory/registries.test.mjs` — asserts a **11**-suite registry; `tests/world-factory/suites/` now has **16** (five lane suites landed after the pin). Update the expected set; do not weaken the loader.
   - `tests/world-factory/a5sf-pd30-web-preview.test.mjs` — asserts the **pre-PD37** manifest shape (`dsh-web-fetch-http` in `dependencies`, peer census = 10). PD37 (`b5233f440`) moved it to an optional exact peer and the census is now **18**. The assertion should pin the *rule* (one audited dependency, every host name an optional exact peer), not a count.
2. **One test-side import defect.** `a5sf-native-bash-preservation.test.mjs` does `await import('@deepseek-ai/cordis')` from `tests/`, where pnpm's hoist (`node_modules/.pnpm/node_modules`) is not on the ESM resolution path. Import through `packages/runtime` (the PoC config already shows the `createRequire` pattern).
3. **Eight suites need the pinned host tree, not a rewrite.** They fail on absent `tests/deepseek-harness-test-use/packages/...` paths and say so in their own assertion text. Collection is gated on provisioning (TEST_METHODS §1), which the `ci-integration` job does not do today.
4. **`host-sandbox-assets.test.mjs` is the honest one.** It reds (11/17) precisely because the native sandbox assets are not provisioned; TEST_METHODS §9 already gives the remedy (`provision-host-sandbox.mjs --check`).
5. **The expensive four are not expensive for the PR.** `ci-integration` runs at **89 s median** (75–115 s) while the required run is pinned by the **census job at ~1417 s** (TINF M6 `METRICS.md`). Adding ~36 s of node:test to `ci-integration` does **not** move the run's wall clock; only the heaviest two (`world-factory.test` 108 s, `a5sf-bl42-netdeny` 30 s) are worth routing to `ci-census`.
6. **The historical kits are genuinely historical.** `team-view-sync-complete-e2e` is cited only by finished pre-alpha3 documents; `pr-e-requirement-recovery-smoke` only by the finished alpha4 plan; neither driver has a consumer in the tree, and both live lanes need the pre-alpha3 client-panel branch (`origin/task/pre-alpha3-pr56-client-panel`, still present but unused). Their 8 offline files pass (411 checks) — archiving loses an instrument's self-check, not product coverage.

## 5. The table (91 rows, ranked: safety → cheap-and-real → drivers → deletions)

Layer codes: `L1` = node:test manifest leg; `product vitest` = root vitest population; `not-a-test` = never belongs in the unit population. `batch` refers to §6.

| # | path | layer | what it actually verifies | safety-critical | recommended action | effort | blocker | batch |
| ---: | --- | --- | --- | --- | --- | :---: | --- | :---: |
| 1 | `tests/s2-authority/current-authority-pointer.test.mjs` | L1 | pointer load + switch transaction: precondition mismatch, digest mismatch, symlink target, injected failure restores EXACT previous bytes, two-current guard, forged post-publish edit, missing pointer with no graph fallback | YES:authorization | collect -> L1 new leg authority-s2 (ci-integration) | S | none (custom harness; node --test wraps it as one case) | B2 |
| 2 | `tests/s2-authority/authority-snapshot-isolated.test.mjs` | L1 | F0 canonical digest (content_digest removed, published_utc covered), publisher whitelist = snapshots path only, docs:sync whitelist does not expand, no pointer/registry write | YES:authorization | collect -> L1 authority-s2 | S | none | B2 |
| 3 | `tests/s2-authority/candidate-track-negative-control.test.mjs` | L1 | a candidate-scoped claim NEVER satisfies a master claim (Q7 drift red stays); negative control that reds if a verifiedFor parser starts counting it | YES:authorization | collect -> L1 authority-s2 | S | none; must be tightened when verifiedFor parser lands | B2 |
| 4 | `tests/s2-authority/authority-dual-read.test.mjs` | L1 | read-only dual-read: CONF-02/03 divergence, MIS missing fields, DERIV backfill refusal, six-field positive; fixture roots only, repo never read as authority | YES:authorization | collect -> L1 authority-s2 | S | none | B2 |
| 5 | `tests/s2-authority/ci-snapshot-reader.test.mjs` | L1 | CI reader semantics against mock providers; template read via git show; temp snapshot only | YES:authorization | collect -> L1 authority-s2 | S | none | B2 |
| 6 | `tests/s2-authority/consumer-candidate.test.mjs` | L1 | derived-view consumer: explicit candidate mode only; default stays legacy with unchanged output; refusal never falls back to graph/current-state | YES:authorization | collect -> L1 authority-s2 | S | none | B2 |
| 7 | `tests/s2-authority/verify-candidate.test.mjs` | L1 | candidate verification pipeline incl. digest/schema refusals (8.4 s of the leg) | YES:authorization | collect -> L1 authority-s2 | M | none | B2 |
| 8 | `tests/world-factory/a5sf-pd1-revocation-escape.test.mjs` | L1 | mid-flight permission revocation cannot still produce the effect; escape paths typed-refused | YES:authorization | collect -> L1 new leg a5sf-worldfactory-c1 | S | none (green 5/5) | B3 |
| 9 | `tests/world-factory/a5sf-ask-precedence.test.mjs` | L1 | deny > ask > allow on the only observable shape (deny+ask overlap); a reordered matcher silently turns refusal into prompt | YES:approval | collect -> L1 a5sf-worldfactory-c1 | S | none (green 4/4) | B3 |
| 10 | `tests/world-factory/a5sf-pd23-control-surface.test.mjs` | L1 | control/approval surface: deferred control names typed-refused, execute nothing, entry set closed | YES:approval | collect -> L1 a5sf-worldfactory-c1 | S | pristine host tree (reads bundle/web-app preset + native tool packages) | B4 |
| 11 | `tests/world-factory/a5sf-pd24-surface-ledger.test.mjs` | L1 | which surface answered each tool, recorded in the surface ledger | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | none (green 5/5) | B3 |
| 12 | `tests/world-factory/a5sf-pd34-member-stop.test.mjs` | L1 | Stop: the four UI RPCs get -> pause -> cancel -> get in measured order, mount injects no private endpoint, no optimistic projection patch, mutation arm has teeth | YES:Stop | collect -> L1 a5sf-worldfactory-c1 | S | none (green 8/8) | B3 |
| 13 | `tests/world-factory/a5sf-pd29-goal-stop.test.mjs` | L1 | Leader archive on a running goal: durable pause, 0 further rounds, base-commit pin | YES:Stop | collect -> L1 a5sf-worldfactory-c1 | S | none (green 4/4) | B3 |
| 14 | `tests/world-factory/a5sf-pd33-preview-e2e.test.mjs` | L1 | cross-cutting Preview: Leader -> Members -> governed I/O -> artefact, plus three Stop windows and deferred-name refusals | YES:Stop | collect -> L1 a5sf-worldfactory-c1 | S | pristine tree for full arms; 14/14 green on the host-free arms | B4 |
| 15 | `tests/world-factory/a5sf-pd25-unbounded-turn.test.mjs` | L1 | ask_user_question/goal trio bounded; the deferred names are UNKNOWN_TOOL and execute nothing | YES:Stop | collect -> L1 a5sf-worldfactory-c1 | S | pristine host tree | B4 |
| 16 | `tests/world-factory/a5sf-pd12-bash-governance.test.mjs` | L1 | governed bash lane: admission, ask row, refusal with zero effect | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | none (green 7/7) | B3 |
| 17 | `tests/world-factory/a5sf-window-taxonomy.test.mjs` | L1 | activation-window defect class: realm mounted inside createChildSession while the MemberInstance row commits later; ordering fixture must match production | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | none (green 9/9) | B3 |
| 18 | `tests/world-factory/a5sf-pd14-sandbox-root.test.mjs` | L1 | sandbox root selection and the per-Member root face | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (9/9 green, 3 env skips) | B3 |
| 19 | `tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs` | L1 | a capability face is bound to the declaring realm, not to the caller | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (6/6 green) | B3 |
| 20 | `tests/world-factory/a5sf-pd16-search-read-axis.test.mjs` | L1 | search/glob/grep read axis and its budget (23 s of wall clock) | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | M | none; trim the budget arm or run in ci-census (adds 23 s to ci-integration) | B6 |
| 21 | `tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs` | L1 | fs read axis: in-lane body returned, out-of-lane typed denial with 0 bytes / 1 read | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | pristine host tree (packages/fs/tool-fs/lib/index.js) | B4 |
| 22 | `tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs` | L1 | terminal read axis: in-lane answer, out-of-lane refusal, fact accounting | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (12/12 green) | B3 |
| 23 | `tests/world-factory/a5sf-pd18-web-ptc.test.mjs` | L1 | web face under PTC: workflow/web_fetch typed UNKNOWN_TOOL, no provider entry | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | pristine tree (bundle/web-app presets) | B4 |
| 24 | `tests/world-factory/a5sf-pd19-fact-attribution.test.mjs` | L1 | every governed effect is attributed to the declaring member/surface, not to the call | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | pristine tree (native tool package) | B4 |
| 25 | `tests/world-factory/a5sf-pd21-subagent.test.mjs` | L1 | subagent/subagent_fork: realm isolation + typed refusal that starts zero children | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | pristine tree | B4 |
| 26 | `tests/world-factory/a5sf-pd26-confined-skill.test.mjs` | L1 | confined `skill` capability: in-lane body, out-of-lane denial, parity with pinned host definition | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | M | 4 of 6 arms are env-skipped (PIN / FORK packages); collecting it buys 2 arms unless the fork packages are provisioned | B5 |
| 27 | `tests/world-factory/a5sf-pd27-confined-web.test.mjs` | L1 | confined web face: transport + provider refusals, zero provider entries on denial | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (9/9 green) | B3 |
| 28 | `tests/world-factory/a5sf-pd29-service-seam.test.mjs` | L1 | `skill`/`present` are served by the public seam, not by forked consumer tools; pinned host rows byte-untouched | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | M | needs a current pnpm install (installed tree here lacks @deepseek-ai/dsh-tool-present under packages/runtime/node_modules) | B5 |
| 29 | `tests/world-factory/a5sf-pd30-web-preview.test.mjs` | L1 | governed web transport + real search backend + SSRF/malformed-URL/missing-provider negatives; no base-web fallback | YES:isolation | fix test then collect -> L1 a5sf-worldfactory-c1 | M | RED today: asserts the pre-PD37 shape (fetch-http in dependencies, peer census 10); post-PD37 it is an optional exact peer and the census is 18 | B5 |
| 30 | `tests/world-factory/a5sf-pd31-read-image.test.mjs` | L1 | read_image route gate: allowed route answers, out-of-lane route refused | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (7/7 green) | B3 |
| 31 | `tests/world-factory/a5sf-p01-realm-binding.test.mjs` | L1 | realm binding: the Member's realm identity is what the guard consults | YES:authorization | collect -> L1 a5sf-worldfactory-c1 | S | none (9/9 green) | B3 |
| 32 | `tests/world-factory/a5sf-bash.test.mjs` | L1 | shell-class admission on the confined subprocess face: realm + declared invocation required before any provider call, write-only cannot read, out-of-lane chmod/create refused, network=deny refused (host provider set does not enforce it), governed realm refuses a terminals consumer | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | none (21/21 green) | B3 |
| 33 | `tests/world-factory/a5sf-tool-axis.test.mjs` | L1 | member x tool upper-bound compilation on the real pinned tool package | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | pristine host tree (native tool package) | B4 |
| 34 | `tests/world-factory/a5sf-native-bash-preservation.test.mjs` | L1 | native bash preserved under plane takeover; stale-PTY refusal; superseded-install boundary | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | M | RED today on one arm (P8): the test file itself does `await import('@deepseek-ai/cordis')`, which no hoist can resolve from tests/; import via packages/runtime instead | B5 |
| 35 | `tests/world-factory/a5sf-sub-contract.test.mjs` | L1 | subprocess contract: deny lane kernel-refused in a distinct netns, allow lane connects; admission vs kernel refusal | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | M | none (15/15 green but 26 s) | B6 |
| 36 | `tests/world-factory/a5sf-pty-contract.test.mjs` | L1 | pty/terminal contract: revoke idempotence, no allocation after revoke, deferred-injection finding | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (15/15 green) | B3 |
| 37 | `tests/world-factory/a5sf-bl42-netdeny.test.mjs` | L1 | network=deny reaches the provider once and the child runs in a DISTINCT netns with a kernel errno while listener counters stay put | YES:isolation | collect -> ci-census leg or a dedicated heavy leg | L | 30 s wall + user namespaces; doubles ci-integration if added there | B6 |
| 38 | `tests/world-factory/a5sf-dual-plane.test.mjs` | L1 | two execution planes (product + Team) and the admission precedence between them | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | none (53/53 green) | B3 |
| 39 | `tests/world-factory/a5sf-assembly.test.mjs` | L1 | shipped product assembly: rows, subpath exports, no second host core | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | none (35/35 green) | B3 |
| 40 | `tests/world-factory/a5sf-governed-preset.test.mjs` | L1 | the shipped opt-in governed-member preset composition | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | none (17/17 green) | B3 |
| 41 | `tests/world-factory/a5sf-capability-defaults.test.mjs` | L1 | capability defaults are deny/allow as declared; no implicit grant | YES:authorization | collect -> L1 a5sf-worldfactory-c1 | S | none (3/3 green) | B3 |
| 42 | `tests/world-factory/a5sf-web-contract.test.mjs` | L1 | web face contract: names, provider object, refusal shapes | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (10/10 green) | B3 |
| 43 | `tests/world-factory/a5sf-web-row.test.mjs` | L1 | web tool row wiring: the shipped row names the Team module, not a file URL | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (10/10 green) | B3 |
| 44 | `tests/world-factory/a5sf-web.test.mjs` | L1 | web face end-to-end against a local endpoint, transport selection | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (12/12 green) | B3 |
| 45 | `tests/world-factory/host-sandbox-assets.test.mjs` | L1 | host sandbox assets are provisioned and hashed (the OS half of isolation); absent assets must red, not silently degrade | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | M | RED today (11 pass / 17 fail): assets not provisioned; run `provision-host-sandbox.mjs` per TEST_METHODS §9 | B4 |
| 46 | `tests/world-factory/u6-arc-d.test.mjs` | L1 | ARC-D C1: probe family refusals hold at the real kernel with zero effect; blueprint closed grammar | YES:isolation | collect -> L1 a5sf-worldfactory-c1 | S | none (8/8 green) | B3 |
| 47 | `tests/world-factory/u7-tbash.test.mjs` | L1 | governed bash lane: one-row resolver, tool_use_id pairing, fence never self-satisfies | YES:execution-routing | collect -> L1 a5sf-worldfactory-c1 | S | none (8/8 green) | B3 |
| 48 | `packages/domain/compatibility/test/t5-complete-true.test.ts` | product vitest | `complete:true` on a persona/tool requirement is a structural FATAL with no Continue Anyway (Architecture §13.5/§27.2) | no | collect -> product vitest (root vitest.config.ts include) + regenerate census population | S | none; measured 7 files / 76 tests / 0.42 s together | B1 |
| 49 | `packages/domain/compatibility/test/t5-engine-outcomes.test.ts` | product vitest | PASS/WARNING/FATAL classification: structural missing capability is FATAL, ordinary mismatch WARNING | no | collect -> product vitest | S | none | B1 |
| 50 | `packages/domain/compatibility/test/t5-drift-invalidation.test.ts` | product vitest | an ack is bound to an environment fingerprint; any drift invalidates the previous result (different fingerprint) | no | collect -> product vitest | S | none | B1 |
| 51 | `packages/domain/compatibility/test/t5-environment-facts.test.ts` | product vitest | environment-fact parsing/fingerprinting and generation bumps | no | collect -> product vitest | S | none | B1 |
| 52 | `packages/domain/compatibility/test/t5-requirement-validation.test.ts` | product vitest | requirement parsing/validation, Requirement != Policy | no | collect -> product vitest | S | none | B1 |
| 53 | `packages/domain/compatibility/test/t5-purity-serialization.test.ts` | product vitest | compatibility result purity + remote-safe serialization round-trip | no | collect -> product vitest | S | none | B1 |
| 54 | `packages/domain/compatibility/test/t5-warning-ack.test.ts` | product vitest | warning acknowledgement: scope, operator, timestamp, ack does not cover a new mismatch | no | collect -> product vitest | S | none | B1 |
| 55 | `tests/s2-authority/freeze-candidate.test.mjs` | L1 | candidate freeze: atomicity + digest pinning of the frozen record | partial | collect -> L1 authority-s2 | S | none | B2 |
| 56 | `tests/s2-authority/probe-candidate.test.mjs` | L1 | candidate probe surface (read-only) | no | collect -> L1 authority-s2 | S | none | B2 |
| 57 | `tests/s2-authority/sync-candidate-resolver.test.mjs` | L1 | candidate/resolver sync ordering + refusals | no | collect -> L1 authority-s2 | S | none | B2 |
| 58 | `tests/world-factory/u7-tbash-seam.test.mjs` | L1 | ARC-B runner seam: no flags = byte-for-byte old defaults; flags win; boot budget enforced | partial | collect -> L1 a5sf-worldfactory-c1 | S | none (9/9 green) | B3 |
| 59 | `tests/world-factory/u7-tbash-offline-drive.test.mjs` | L1 | the offline drive of the u7-tbash assembly (1 case) | no | collect -> L1 a5sf-worldfactory-c1 | S | thin: one case, overlaps u7-tbash.test.mjs | B3 |
| 60 | `tests/world-factory/u7-uileg0-answer-drive.test.mjs` | L1 | UI answer RPC framing: token exchange, cookie, mux frames, waterfall answer | no | collect -> L1 a5sf-worldfactory-c1 | S | none (10/10 green) | B3 |
| 61 | `tests/world-factory/a5sf-acceptance-preflight.test.mjs` | L1 | 73 pins over the acceptance claim records: id/path/anchor resolution, no branch-pinned row after landing | no | collect -> L1 a5sf-worldfactory-c1 | S | none (73/73 green) | B3 |
| 62 | `tests/world-factory/a5sf-instrument-graph.test.mjs` | L1 | the World's profile module graph is provisioned like an install and verified at creation | no | collect -> L1 a5sf-worldfactory-c1 | S | none (7/7 green) | B3 |
| 63 | `tests/world-factory/a5sf-run-record-binding.test.mjs` | L1 | a run record is evidence only when it binds teamSha + hostSha at WRITE time | no | collect -> L1 a5sf-worldfactory-c1 | S | none (6/6 green) | B3 |
| 64 | `tests/world-factory/a5sf-debt-register.test.mjs` | L1 | debt register: row/evidence/anchor agreement, contiguous ids, closed consequence set | no | collect -> L1 a5sf-worldfactory-c1 | S | none (10/10 green) | B3 |
| 65 | `tests/world-factory/a5sf-dev-live.test.mjs` | L1 | dev-live vs candidate scope separation: a dev record cannot claim V@B, caps are per-scope | no | collect -> L1 a5sf-worldfactory-c1 | S | none (15/15 green) | B3 |
| 66 | `tests/world-factory/a5sf-dev-live-slots.test.mjs` | L1 | slot leak pin + cross-namespace slot liveness (pid in the acquirer's namespace) | partial | collect -> L1 a5sf-worldfactory-c1 | S | none (9/9 green) | B3 |
| 67 | `tests/world-factory/arm-verdict.test.mjs` | L1 | ENV_BLOCK vs NOT_REACHED algebra: a product refusal quote never buys ENV_BLOCK, forged signals buy nothing | no | collect -> L1 a5sf-worldfactory-c1 | S | none (17/17 green) | B3 |
| 68 | `tests/world-factory/binding-digests.test.mjs` | L1 | digest bindings between assemblies and their rows | no | collect -> L1 a5sf-worldfactory-c1 | S | none (14/14 green) | B3 |
| 69 | `tests/world-factory/registries.test.mjs` | L1 | world-kind and C2-suite registries are fail-closed: removed/malformed/dup entries become typed refusals | no | fix test then collect -> L1 a5sf-worldfactory-c1 | S | RED today: the pin expects 11 suites, 16 exist (lanes added after the pin); update the expected set, not the loader | B5 |
| 70 | `tests/world-factory/port-probe.test.mjs` | L1 | portInUse three-way classification + lease second guard; 3080/3180 asserted out of range | partial | collect -> L1 a5sf-worldfactory-c1 | S | none but binds sanctioned-band ports for ms; 6.2 s | B3 |
| 71 | `packages/runtime/root-binding/harness/bounded-run.regression.test.mjs` | L1 | bounded-run wrapper: refuses to start outside sanctioned ports (nothing spawned), kills only the group it owns on cap expiry, passes the child's exit through | partial | collect -> L1 new leg product-hygiene | S | none (6/6 green, 1.9 s) | B7 |
| 72 | `scripts/sanitize-evidence.regression.test.mjs` | L1 | evidence sanitizer: alias preflight, quote handling, format coverage over synthetic fixtures | no | collect -> L1 product-hygiene | S | none (25/25 green, 2.3 s) | B7 |
| 73 | `tests/evidence-store/evidence-store.test.mjs` | L1 | evidence relocation store against throwaway git repos: symlink/hardlink, hashing, lstat refusals | no | collect -> L1 product-hygiene | S | none (10/10 green, 1.8 s) | B7 |
| 74 | `tests/world-factory/a5sf-search-live.test.mjs` | L1 | the Search acceptance instrument's judges are THREE-WAY: NOT_REACHED, REFUTED and PROVEN must differ for every row, and the refutation twins (leaked byte, process on refusal, ALLOW on denial, fabricated no-match after cancel, rg exit 2 swallowed) stay distinguishable | partial | keep driver; collect its behaviour test -> L1 a5sf-worldfactory-c1 | S | none (52/52 green, 0.14 s) | B3 |
| 75 | `tests/kits/_shared/boot-preflight.test.mjs` | L1 | shared boot-preflight closed set: NOT_SELECTED must not block a start; FAIL/NOT_REACHED/ENV_BLOCK cannot blur | no | keep driver; collect its behaviour test -> L1 kits-offline | S | none (15/15 green) | B8 |
| 76 | `tests/kits/rc2-real-host-smoke/run-control.regression.test.mjs` | L1 | the live smoke kit's run-control: start/stop ordering, teardown identity | no | keep driver; collect its behaviour test -> L1 kits-offline | S | none (6/6 green) | B8 |
| 77 | `tests/kits/rc2-real-host-smoke/runner-wiring.regression.test.mjs` | L1 | live smoke runner wiring: wire shape + mock-provider script against the shaped request | no | keep driver; collect its behaviour test -> L1 kits-offline | S | none (51/51 green) | B8 |
| 78 | `tests/world-factory/world-factory.test.mjs` | L1 | the factory itself: leases, verdict algebra, oracle fault-planting sensitivity, cleanup ownership, capped ledgers, dry-run hold ordering | no | collect -> ci-census / heavy leg after runtime cut | L | 108 s here and 2/45 red (one arm needs the pristine tree, one needs real teamSha/hostSha bindings); adding it doubles ci-integration | B6 |
| 79 | `tests/world-factory/poc/poc-native-present.test.mjs` | not-a-test | PoC probe: a native `present` row can be mounted and answer | no | archive (PoC; superseded by the PD-29 seam) | S | none | B9 |
| 80 | `tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs` | not-a-test | PR-E stage-2 read-only UI observer (100 offline checks over mocked UI truth) | no | archive (historical instrument; only the finished alpha4 plan cites the kit) | M | none (100/100 green); archiving loses a historical instrument's self-check, not product coverage | B9 |
| 81 | `tests/kits/pr-e-requirement-recovery-smoke/ui-observe.test.mjs` | not-a-test | PR-E UI observe hold-points (51 checks) over mocked remote IO | no | archive (historical instrument, same kit) | M | none (51/51 green) | B9 |
| 82 | `tests/kits/team-view-sync-complete-e2e/carrier-import-preflight.test.mjs` | not-a-test | carrier import preflight for the DDoD20 UI e2e kit: absent dep refuses by name | no | archive (historical instrument; kit referenced only by finished pre-alpha3 docs) | M | none (6/6 green) | B9 |
| 83 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs` | not-a-test | the DDoD20 UI driver's pure navigation/locator/verdict core + real jsdom dialog probe | no | archive (historical instrument) | M | none (82/82 green) | B9 |
| 84 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-orchestration.test.mjs` | not-a-test | caller-side leg orchestration driven through fake pages/networks | no | archive (historical instrument) | M | none (49/49 green) | B9 |
| 85 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-ownership.test.mjs` | not-a-test | driver ownership/cleanup of pages it opened | no | archive (historical instrument) | M | none (12/12 green) | B9 |
| 86 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-dom.test.mjs` | not-a-test | rail locator against faithful DOM fixtures | no | archive (historical instrument) | M | none (17/17 green) | B9 |
| 87 | `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-identity.test.mjs` | not-a-test | the three rail locator-IDENTITY defects: positional traversal, unscoped collector, leaves-are-not-rows | no | archive (historical instrument) | M | none (22/22 green) | B9 |
| 88 | `tests/poc-web-native-reuse/poc-w1-native-shape.test.ts` | not-a-test | A5W PoC: native web_search/web_fetch registration/inheritance/shadowing under a closed-world guard | no | archive (PoC, explicitly not acceptance; superseded by the shipped confined web face PD-27/PD-30) | S | needs the PoC vitest alias config; no lane passes --config | B9 |
| 89 | `tests/poc-web-native-reuse/poc-w2-ctx-web-adapter.test.ts` | not-a-test | A5W PoC: ctx-web adapter over the governed plane | no | archive (PoC) | S | same | B9 |
| 90 | `tests/poc-web-native-reuse/poc-w3-fetch-parity.test.ts` | not-a-test | A5W PoC: fetch parity + timeout bound against a stub | no | archive (PoC) | S | same | B9 |
| 91 | `tests/poc-web-native-reuse/poc-w4-e4-public-accept.test.ts` | not-a-test | A5W PoC: resolvePublicAddresses accept leg with REAL public DNS | no | archive (PoC; also network-dependent, which alone disqualifies it from CI) | S | same; live DNS | B9 |

## 6. Proposed batch order

Batch = one module or one bucket = one future PR. Each is executable on its own; none changes the ratchet (`--max-uncollected 91` stays until the last batch), and each batch's collected files are removed from `uncollected-baseline.json` **by regenerating it in that same PR** (the tool's own rule).

| # | batch | files | measured cost | uncollected after | why in this position |
| --- | --- | ---: | --- | ---: | --- |
| **B1** | **product vitest — the 7 T5 compatibility suites** | 7 | **76 tests / 0.42 s** (measured, whole set) | 84 | cheapest real coverage in the repo: one `include[]` glob in `vitest.config.ts` (`packages/*/compatibility/test/**/*.test.ts`), zero new leg, zero host dependency. Must regenerate `dev/ci/census-population-baseline.json` because the 7 also enter the L2 population (705 → 712 files). |
| **B2** | **new L1 leg `authority-s2` — `tests/s2-authority/`** | 10 | **~17.5 s** serial (10 files; `verify-candidate` alone 8.4 s, `freeze-candidate` 4.1 s) | 74 | the authority/pointer/forged-snapshot refusals are the highest-severity uncollected surface and all 10 are green today. They use a hand-rolled `t()` harness (`process.exit`), so `node --test` reports one case per file — acceptable, but the leg should be its own so a 17 s leg does not hide inside a shared one. |
| **B3** | **new L1 leg `a5sf-worldfactory-c1` — the green host-free C1 slice** | **37** | **~17.6 s** serial sum (largest single: `pd16` 23 s already excluded to B6; next is `port-probe` 6.2 s); `node --test` runs files concurrently, so wall clock is lower | 37 | biggest real gain and the densest safety cluster: 30+ files, 458 assertions, all green with a correct install. Keep `pd26` (env-skipped arms) out of the *claim*, not out of the leg. |
| **B4** | **pristine-tree-gated world-factory arms** (same leg) | 9 | +~4 s once the tree is provisioned | 28 | blocked on a provisioning decision inside `ci-integration` (clone + install + build of `639ed01539`), which is a **gate change** and therefore its own reviewed PR. |
| **B5** | **test-side repairs then collect** (`registries`, `pd30`, `native-bash` P8, `pd29-service-seam`, `pd26` arms) | 5 | <1 s each after repair | 23 | these are the files that prove collection has value; fixing them is test-only, no product change. |
| **B6** | **heavy four → `ci-census` (or a `heavy` leg)** | 4 | **~251 s** measured serial sum (`world-factory.test` 108 s, `bl42` 30 s standalone / 120 s on the timeout path, `sub-contract` 26.5 s, `pd16` 23 s) | 19 | the only batch that would materially slow `ci-integration` (node --test parallelises, but this is still multiples of an 89 s job). `ci-census` has 45 min and a 1417 s critical path, so put them there or cut `U5_RACE_TRIALS`. |
| **B7** | **new L1 leg `product-hygiene`** — `bounded-run`, `sanitize-evidence`, `evidence-store` | 3 | **~6 s** serial (41 assertions) | 16 | three unrelated-but-real scripts/runtime regressions; one small leg, no env dependencies. |
| **B8** | **new L1 leg `kits-offline`** — the live-kit drivers' own behaviour tests | 3 | **~1.2 s** (72 assertions) | 13 | case (b) done properly: the `rc2-real-host-smoke` driver is the active real-host smoke instrument (TEST_METHODS §4.2) and `boot-preflight.mjs` is imported by two current kits; their behaviour tests exist, pass, and cost nothing. |
| **B9** | **archive the historical instruments** | 13 | 0 (removal) | **0** | 5 PoC (`tests/poc-web-native-reuse/**` + `world-factory/poc/`) and two historical kits. Evidence: PoC headers say "not acceptance criteria" and both routes shipped (PD-27/PD-30 web face, PD-29 seam); the kits are cited only by finished plans. Archiving is the *conservative* form of deletion — move the kit dirs under `docs/plans/finished/` evidence or delete in a PR that prints `git log -1` per file. |

**Top three, in order: B1, B2, B3.** B1 because 76 assertions cost 0.42 s and one line of config; B2 because authority isolation is the highest-severity surface and is already green; B3 because it is the single largest coverage gain (37 files) and is green today. Together they take 91 → 37 uncollected and add ~36 s to an 89 s job whose required run is pinned by a 1417 s census — i.e. **no observable slowdown of the required check**.

Explicitly *not* first: B6. It is 4 files for +187 s; doing it before B1–B3 would buy the least coverage for the most budget.

## 7. UNKNOWN (not guessed)

- **Whether the 8 pristine-tree-gated files pass** (9 if `pd33`’s live arms are counted, which need the same tree). `tests/deepseek-harness-test-use` is absent here; I did not clone/install/build the pinned host (out of scope, and it would be a multi-minute network operation).
- **`world-factory.test.mjs`'s 2 reds** (43/45 green): one arm needs a real `teamSha`/`hostSha` binding, one is a supervisor dry-run assertion that likely needs the pristine tree. UNKNOWN which become green in CI shape.
- **`pd29-service-seam`'s 3 reds**: the installed tree in this environment is stale (`@deepseek-ai/dsh-tool-present` missing under `packages/runtime/node_modules` even though it is a declared dependency). UNKNOWN whether a fresh `pnpm install` turns it green; it probably does.
- **Internal case counts of the 10 s2-authority files** — each is one `node:test` case wrapping dozens of `t()` asserts; I read and ran them but did not enumerate every case.
- **Whether `pr-e` / `team-view` kits are used outside this repo** (operator runbooks, a saved browser session). In-repo evidence says no; absence of evidence outside the repo is not evidence of absence.
- **The L2 census cost of adding the 7 compatibility files** — measured 0.42 s standalone; the census re-runs two captures and compares roots, so the delta is expected to be negligible but was not measured.
- **Why `pd16` takes 23 s** on an otherwise sub-second suite — not diagnosed (not needed for the decision, but it is the one C1 file whose cost is unexplained).

## 8. Explicitly not done (per the brief)

- No CI gate, leg, area or `include` change; no `--max-uncollected` change; no ratchet change.
- No test moved, renamed, rewritten, archived or deleted. B1–B9 are recommendations for future PRs.
- No PR opened, nothing pushed.
