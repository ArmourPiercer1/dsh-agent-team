# §7.3 flip — measured blast radius and work list (checkpoint 1)

**Lane:** `feat/a4-73-flip` § step 3 of 3 (the version flip itself).
**Base:** `f61dc13f06271049c41bb38c3cb28f513c0d92f5` = `origin/master` at session start after
`git fetch` (verified, not quoted). Worktree `.worktrees/a4-73-flip`, real
`pnpm install --store-dir …/.pnpm-store` → exit 0, 815 packages reused, `yaml@2.9.0` resolves
(check run: `require.resolve('yaml')` → `.pnpm/yaml@2.9.0/…`; the ERR_SQLITE_ERROR class did not
recur here).

**`origin/master` moved mid-session** to `22b36d28` (PR #168, round-25 records). `git diff
--name-only f61dc13f 22b36d28` = `SESSION_ROUTER_LOG.md`, `graph.yaml` — **0 files in this
lane's surface**. The branch stays on the base it was told to use; every number below is
against `f61dc13f`, and the third-dot diff form is used throughout.

The flip under measurement is exactly two lines:

- `packages/domain/blueprint/src/schema.ts:75` `[1, 2, 3]` → `[3]`
- `packages/domain/blueprint/src/types.ts:416` `readonly schemaVersion: 1 | 2 | 3` → `3`

`RETIRED_BLUEPRINT_DOCUMENT_VERSIONS` (`schema.ts:117`) is **derived** from the two sets, so it
becomes `[1, 2]` on its own — no third edit, and nothing to forget.

---

## 1. Typecheck — the plan's number and the dispatch's number are both stale, with a named cause

| invocation | exit | error lines | real files | TS2367 | TS2322 |
| --- | --- | --- | --- | --- | --- |
| `pnpm -r run typecheck` (bailing), base | 0 | 0 | 0 | 0 | 0 |
| `pnpm -r run typecheck` (bailing), **flip** | **2** | **5** | 3 | 0 | 5 |
| `pnpm -r --no-bail run typecheck`, **flip** | **1** | **20** | **18** | **0** | **20** |

**The bailing invocation is the one that hid the surface, exactly as the dossier said**: it
stops inside `packages/domain` and never compiles `packages/runtime`, where every remaining
carrier except three lives. `packages/domain typecheck: Failed` is the only `Failed` line it
prints.

**The dispatch predicted 31 error lines in 23 real files (11 `TS2367` + 20 `TS2322`). That is
falsified, and the cause is not a measurement disagreement — it is a landed commit.** The 11
`TS2367` lines were the five production `=== 2` requirement gates (`activation/provider.ts:821`,
`admission/requirement-gate.ts:460`, `compatibility/blueprint.ts:81`,
`requirements/creation-preflight.ts:217`, `requirements/scope-requirements.ts:108`) reported
twice by `runtime` and `tools`, plus the test mirror at
`requirement-d1-d3-decision-scoping.test.ts:890`. **§7.3 option A landed all six of those
comparisons away** (`3b253775 feat(a4-pr7): 7.3 Option A — make the §E.2 grammar
version-agnostic (pre-flip)`, PR #161). Verified at source, not quoted: `compatibility/blueprint.ts:83`
now reads `if (blueprint.teamRequirements !== undefined)`, no `schemaVersion` comparison
survives at any of the five gates, and the test mirror carries the widening comment "the mirror
drops its own `bp.schemaVersion === 2` conjunct and widens WITH the gate".

The dossier's own table predicted `flip + A` = **21 lines / 18 files / 1 TS2367**. Measured
**20 / 18 / 0**: the residual 1 was the mirror, and option A widened it in the same commit.
So the true surface of the flip, on *this* tree, is **20 error lines in 18 files, all TS2322**.

`tools` typechecks `runtime` sources but **not** `runtime/test`, which is why the doubling that
produced 10 of the dossier's 11 TS2367 lines no longer applies: every remaining error is in a
test file and is reported once.

## 2. The 18 carrier files (20 sites) — the typed-version work list

| file | sites | declared |
| --- | --- | --- |
| `packages/domain/test/blueprint-v1-frozen-resume.test.ts` | 1 | `1` |
| `packages/domain/test/t2-blueprint-v2-hash.test.ts` | 2 | `2`, `1` |
| `packages/domain/test/t2-blueprint-v2-requirements.test.ts` | 2 | `2`, `1` |
| `packages/runtime/test/consent-scope-hash-binding.test.ts` | 1 | `2` |
| `packages/runtime/test/fix-control-authz-c-abandon-terminal.test.ts` | 1 | `2` |
| `packages/runtime/test/leader-disable-no-requirements-initial-work.test.ts` | 1 | `2` |
| `packages/runtime/test/leader-recovery-next-boundary-exit.test.ts` | 1 | `2` |
| `packages/runtime/test/leader-template-required-boundary.test.ts` | 1 | `2` |
| `packages/runtime/test/mcp-target-materialization-unit.test.ts` | 1 | `2` |
| `packages/runtime/test/mcp-target-materialization.test.ts` | 1 | `2` |
| `packages/runtime/test/p5t5-helpers.ts` | 1 | `1` |
| `packages/runtime/test/persona-kind-provider-preflight.test.ts` | 1 | `2` |
| `packages/runtime/test/requirement-d1-d3-decision-scoping.test.ts` | 1 | `2` |
| `packages/runtime/test/startup-all-templates-real-authority.test.ts` | 1 | `2` |
| `packages/runtime/test/startup-consent-production.test.ts` | 1 | `2` |
| `packages/runtime/test/startup-preflight-production-create.test.ts` | 1 | `2` |
| `packages/runtime/test/startup-template-disable-production.test.ts` | 1 | `2` |
| `packages/runtime/test/template-disable-no-requirements-gate.test.ts` | 1 | `2` |

17 of the 18 are v2 subjects; `p5t5-helpers.ts` and `blueprint-v1-frozen-resume` carry v1.
Six of them (`t2-blueprint-v2-hash`, `t2-blueprint-v2-requirements`,
`blueprint-v1-frozen-resume`, plus their runtime counterparts) have a **v1/v2 document as their
own subject** and take the `invert-to-refusal` disposition, not a digit edit.

## 3. Tests — 132 new red identities in 46 files, and 29 of them register nothing

Same population, same command, same worktree shape, run twice (base worktree at `f61dc13f`,
flip worktree at `f61dc13f`+2 lines). Population = `packages/{domain,runtime,storage,remote,
tools,testkit,legacy}/test`, run per package (root-wide `pnpm test` not used).

| | base | flip |
| --- | --- | --- |
| registered files | 458 | 458 |
| **registered legs** | **5611** | **5280 (−331)** |
| red named tests | 22 | 123 |
| **red collection errors (0 legs)** | 4 | **32** |

**Identity diff: NEW = 132 named/collecting identities in 46 files, RESOLVED = 3.**

The **−331 registered legs** is the point of comparing totals and not red counts: 29 files went
from "collected, N legs" to "module-scope throw, 0 legs". A report of "123 red tests" would
have under-stated the damage by roughly a quarter, and `RESOLVED = 3` is *itself* partly an
artifact of it — see §5.

Per-file NEW (`transcripts/flip-new-identities.txt` is the verbatim list,
`transcripts/flip-identity-diff.txt` the comparison):

| file | NEW | | file | NEW |
| --- | ---: | --- | --- | ---: |
| `t2-blueprint-v2-requirements` | 16 | | `blueprint-v1-frozen-resume` | 4 |
| `a3p4-pr4-production-entry-regression` | 14 | | `a4p1-blueprint-v3-governance` | 4 |
| `p7t6-teammates-adapter` (legacy) | 11 | | `startup-preflight-production-create` | 3 |
| `a3p5-glue-permission-receipt` | 10 | | `team-session-durability` | 2 |
| `a3p4-r4-authority-binding` | 10 | | `t2-blueprint-immutability` | 1 |
| `t2-blueprint-v2-hash` | 8 | | `leader-recovery-next-boundary-exit` | 1 |
| `leader-template-required-boundary` | 7 | | `fix-control-authz-c-abandon-terminal` | 1 |
| `template-disable-no-requirements-gate` | 5 | | `a4p7-v3-cutover-acceptance` | 1 |
| `leader-disable-no-requirements-initial-work` | 5 | | `a4p7-merge-gate` | 1 |
| `startup-all-templates-real-authority` † | 1 | | `startup-consent-production` † | 1 |

† plus **29 collection-error files** (each 1 NEW, each registering 0 legs):
`t12a-m1-effective-cwd`, `t12a-m2-persona`, `t12a-m3-recursive-drain`, `t12a-h1-nullable-mcp`,
`t12a-b3-external-deny`, `t12a-team-tools-registration`, `t4a-capability-wiring`,
`tcm-d4-root-context`, `tcm-m3-root-work-glue`, `team-session-activation-glue`,
`work-completion-notification-glue`, `send-message-liveness`, `multi-mcp-wiring`,
`d1-member-base-tools`, `c1-production-wiring`, `c1-leader-notification-glue`,
`bp1-red-glue-probe`, `consent-scope-hash-binding`, `d3-member-identity-context`,
`mcp-target-materialization`, `mcp-target-materialization-unit`, `persona-kind-provider-preflight`,
`requirement-d1-d3-decision-scoping`, `startup-all-templates-real-authority`,
`startup-consent-production`, `startup-template-disable-production`, `a4f1-row-version-not-document-version`,
`a4p7-v8-catalog-migration-state`.

`a4p7-merge-gate > the static legs > every workspace package that declares a typecheck script
typechecks` is red **because the merge gate runs typecheck itself** and read the 5 lines the
bailing invocation reports. That instrument works; it needs no change.

## 4. The two hazards, priced before anything else

### 4.1 `t12a-live-bridge.mjs` — the dispatch's expectation is FALSIFIED

The dispatch says "`t12a-live-bridge.mjs` staying dirty is correct", and the fence's `DEFERRALS`
row records a coordinator ruling that it "stays DIRTY BY DESIGN" as the wrapper's `packages/*/test`
by-path positive control. **Measured, it cannot stay v1.** Its default `blueprintSource` is a
live document: 29 files die at module scope under the flip with

```
TeamContractError: unsupported blueprint schema version 1; this build supports [3]
```

and the cluster is precisely its importer set (`t12a-m1/m2/m3`, `t12a-h1-nullable-mcp`,
`t12a-b3-external-deny`, `t12a-team-tools-registration`, `t4a-capability-wiring`,
`tcm-d4-root-context`, `tcm-m3-root-work-glue`, `team-session-activation-glue`,
`work-completion-notification-glue`, `send-message-liveness`, `multi-mcp-wiring`,
`d1-member-base-tools`, `c1-production-wiring`, `c1-leader-notification-glue`, …). The
`DEFERRALS` row itself already recorded the live-ness ("a probe digit no build runs reddens
t12a-m2-persona, t12a-h1-nullable-mcp and t4a-capability-wiring") — pre-flip a *bad digit* was
hypothetical, post-flip `1` **is** the bad digit.

Disposition therefore: **promote the default document to v3 with both envelopes at the honest
zero `rules: []`** (the row's own measured claim: "promoting it to v3 with both documents
declared `rules: []` keeps 5/5 measurable consumers green"), and **re-home the by-path positive
control in the same commit** — there is an in-file precedent for exactly that move (the leg
`the YAML-string factory file … is DIRTY by path and line` carries a "THE ARCHETYPE MOVED, AND
THAT IS NOT A MUTE" note from the `fixtures.ts` migration). Keeping the file dirty is only
correct at the cost of a half-migration, which the all-or-nothing rule forbids.

### 4.2 The two `tests/kits/*` smokes — the anchor still produces its refusal (measured)

Probed through the real `parseBlueprint`, reading the bytes **out of the kit files themselves**
so the probe cannot drift from the kit:

```
[[ANCHOR]] kit=…/pr-e-requirement-recovery-smoke.mjs refused=true threw=TeamContractError: unsupported blueprint schema version 1; this build supports [3] pinnedMatch=false
[[ANCHOR]] kit=…/pr-f-closure-smoke.mjs             refused=true threw=TeamContractError: unsupported blueprint schema version 1; this build supports [3] pinnedMatch=false
```

So the condition the disposition states ("REFUSE post-flip") **holds**: the anchor's value is
still its own historical v1 bytes and it now refuses rather than silently parsing. Both kits
stay dirty on purpose, and `intentional-retired.md` rows 1–2 can be written as measured fact.

**Reported, not re-dressed:** `pr-e`'s S13 legs assert the *pre-flip success*
(`registry contentHash == V1_ANCHOR_HASH_PRE_PR_E` and `team_sessions blueprint hash == …`), i.e.
their subject is "a v1 document parses and hashes stably under current code" — the retired
contract itself. Their honest disposition is `invert-to-refusal`, but that file runs only
against a booted host plus a mock model, and host boots are outside this lane. Rewriting an
instrument this lane cannot execute would be writing an unverified assertion, so the two legs
are **named in `intentional-retired.md` row 1 as owed to the kit owner** rather than edited here.

## 5. `RESOLVED = 3` is not three wins

| resolved identity | truth |
| --- | --- |
| `d3-member-identity-context > D3-4 FAIL CLOSED: …` | **base-red named → flip collection error.** It did not get greener; the file stopped registering. The `NEW` list contains `d3-member-identity-context::COLLECTION` for the same reason. |
| `p6t1-parallel > two COMMITTED operations…` ×2 | the declared flake, base-red either way. |

An identity diff alone reads these as improvements. Comparing the **registered-leg totals** and
reading the `NEW` list for the same file name is what shows one of them for what it is.

## 6. Base debt in this population (reported by identity, not absorbed)

Re-derived here at `f61dc13f` on a clean tree, 12 red files / 22 named + 4 collection:

`t1-capability-schema` ×9 · `t2-blueprint-hash > projects absent optional singles as explicit
null` · `d3-member-identity-context > D3-4 …` · `p6t1-parallel` ×2 (declared flake) ·
`p6t3-mediation` ×5 · `p6t3-restart` ×2 · `p8s3b-result-effects` (collection) ·
`a4pr0a-fact-type-closed-set` (collection) · `t12a-b2-child-identity` (collection) ·
`t12a-glue-handoff-ports` (collection) · `tools/p6t6-actions > messaging: worker -> leader …` ·
`a4p7-merge-gate > the composition smoke leg` (refuses without `pnpm build`).

**Four of these are not on the dispatch's list** (`p6t3-mediation` ×5, `a4pr0a-fact-type-closed-set`,
`t12a-*` beyond the two named, `p6t6-actions`, and the merge-gate smoke leg). Same finding as
§7.5 FINDINGS §5.5: the handed-down base-debt list is a subset; the number reported is the one
re-derived here.

## 7. Instruments that lied during this measurement, and how each was caught

1. **`npx vitest run --reporter=basic`** — that reporter does not exist in vitest 4. All seven
   packages exited 1 having **registered nothing**; a naive reading is "the flip reddens
   everything". Caught because every output file was 6.8 KB of the same startup stack trace and
   no `Test Files` line existed. The retry dropped the flag.
2. **Running `packages/testkit` from `packages/testkit` reddened 13 fence-wrapper legs** at
   BASE. The fence refuses to run off the repository toplevel
   (`cwd … is not the repository toplevel … the fence gates on the WHOLE tree — run it from the
   toplevel`), so its own anti-false-clean guard fired. A base run therefore showed the fence's
   own gate red. Caught by running the file alone and reading the assertion; re-run from the
   toplevel, testkit is 368/369 at base (the one red is the composition-smoke leg, which refuses
   without `pnpm build`). **This instrument lied only to the harness that ran it wrongly, and it
   lied in the fail-closed direction on purpose.**
3. **`git worktree add` from inside a worktree put the baseline worktree inside my own tree**
   (`.worktrees/a4-73-flip/.worktrees/…`), one `git add -A` away from being committed. Caught by
   the follow-up `cd` failing, moved out and `git worktree repair`ed.
4. **`origin/master` moved to `22b36d28` mid-session** — the second time this phase has bitten a
   lane. Handled by pinning every measurement to `f61dc13f` and diffing the two to prove #168
   touches only the coordinator's two files.

## 8. Work list this branch must land, in order

1. **18 carrier files** (§2): migrate-by-hand to v3 with both envelopes chosen to preserve, or
   `invert-to-refusal` where the document version *is* the subject.
2. **`t12a-live-bridge.mjs`**: promote the live default document; re-home the wrapper's
   `packages/*/test` by-path control and the archetype leg in the same commit; drop its
   `DEFERRALS` row.
3. **`a3p4-pr4-production-entry-regression.test.ts`**: 4 v1 documents → v3, drop its `DEFERRALS`
   row, and re-pin the two wrapper legs that name its lines `[118, 491, 843, 1128]`.
4. **`p7t6-teammates-adapter.test.ts`** (11 NEW): the legacy `.md` format's own version axis —
   disposition and reason in `intentional-retired.md` row 3; stays dirty.
5. **The two kits**: stay dirty; write `intentional-retired.md` rows 1–2 with the measured
   refusal; name pr-e's S13 legs as owed.
6. **§7.5 bullet 2** — delete `leaderEnvelopeCoverage`, then re-derive the deletion's own
   population on the *migrated* tree (the 40-name list was measured against v1/v2 documents and
   6 of its 9 files are already in the flip's red set).
7. **The permanent instrument over `cordis.patch.yml`** — after step 2 of 3 there is no committed
   test that parses the shipped composition's blueprint at all.
8. Fence header citation, census-tool promotion, `SKILL.md` taught example — **already landed,
   measured in `BATTERY.md`**.
