# a5sf-archived-gate — the durable lifecycle binds every resurrection seam

**Date:** 2026-11-05 · **Lane:** `a5sf-archived-gate` (BL-16 Search row 6 follow-up) · **Grade:** ARCHIVED-GATE
(product contract fix, not tool acceptance). **No Host boot, no merge, no settle**; the search ledger's one
reserved start was not spent. Base = `origin/master` (`62d641610`, the row-1 lane-scoped rg fix; the branch was
created from `origin/master` as instructed — master had advanced one commit past the `735136294` named in the
brief). The diagnosis evidence commit `d75a03c38` is cherry-picked (evidence only, no rewrite).

**Artifacts** (this directory):

| file | what it is |
|---|---|
| `red-before-gate.log` | the diagnosis arm on the unpatched tree: **3 failed / 1 passed** |
| `green-gate.log` | the same arm after the gate: **4/4** |
| `row6-mutation-control.mjs` / `.log` / `.json` | two-seam mutation control (remove one seam at a time, require RED) |
| `row6-durable-read.test.mjs` | durable-read cost measurement (steady state / cold resume / boot) |
| `row6-rejudge.test.mjs` / `row6-rejudge.json` | row-6 re-judge over the archived samples with the fixed seam |
| `green-rejudge-cost.log` | both arms above, green |
| `full-suite.log`, `build.log` | the full suite from the repo root, and the dist rebuild |

**2026-11-05 RACE ROUND (this branch — read §4b first).** An independent adversarial review measured a
**BLOCKING** hole the round above did not cover: the product order is quiesce-then-commit, so a dispatch issued
in the `quiesce → commit` window cold-resumed the member and the live handle survived the commit. §4.2's replay had the
two effects reversed, which is why the first round's arms never saw it. This branch fixes it with three coupled
changes — (a) a post-commit residency re-drop in `archive.ts`/`dispose.ts`, (b) a post-resume durable re-read
immediately before `liveAgents.set` (SEAM 3), (c) the per-member admission close implemented for real (it was a
production no-op) and reopened on every procedure exit — and adds `archive-race-arms.test.mjs` +
`race-mutation-control.mjs`. New artifacts: `race-red-before.log`, `race-green-after.log`,
`race-mutation-control.{mjs,json}`, `a5sf-race-vitest.config.mjs`, `archive-race-arms.test.mjs`,
`race-full-runtime.log`, `race-build.log`. **Glue sha256 is now
`d3945eff6960ef8adc811a38f2a2f447a6a9a359122622e7f80ddfbad125287f`** (§5). The row-6 grade is unchanged
(`ENFORCE-PARTIAL` / `V@B=yes`): this is a mechanism repair, not new tool acceptance, and no live re-measurement
was performed.

---

## 1. The ruling, and its textual basis

The diagnosis (`../a5sf-search-live/row6-diagnosis.md`) proved, host-free, that after
`team_archive_member` returns `SETTLED → ARCHIVED` the Member's durable session is still cold-resumed into a
live, tool-bearing Agent: a post-boundary `glob` dispatch returned `200 {ok:true}` ≥100 ms after the archive
boundary, with two post-stop `allow` guard facts and two confined spawns. A second seam reads every member row
at boot and re-binds it unconditionally.

**Ruling (option A, not re-litigated here):** the durable lifecycle binds **every resurrection seam, for every
Member**, permission-governed or not. The frozen Architecture is the top of the document authority order:

- **§41.6 Archive / Restore** — the *only* edge out of `ARCHIVED` is `Restore`; `ARCHIVED → SETTLED (no Agent
  resume)`, and a cold resume follows a **new follow-up** in `SETTLED`, never a resume while `ARCHIVED`.
- **§30.2 Restore：最终冻结语义 3A** — Restore returns `ARCHIVED → SETTLED` and **must not** `create/resume
  live Agent residency merely for restore`.
- **§29.4 ARCHIVED** — the instance leaves the main active work set while **retaining** `instanceId`, team
  membership history, child Session/transcript, context history and **restore capability** (so archive is not
  disposal, and the retained session is not a licence to resume).
- **§29.5 DISPOSED** — terminal: cannot restore, cannot receive new Team work; the historical Session stays
  readable. Its refusal is therefore strictly stronger than ARCHIVED's.

Scope B ("only a permission-plane property") is rejected because it would make §41.6 **false** for ungoverned
Members: the frozen contract says archive/cold-resume, not archive/permission-gate.

## 2. The chain, and the gate

**Measured chain (before):** `team_archive_member` → `packages/runtime/lifecycle/quiesce.ts:143`
`ports.residency.dropResidency(child)` → `residency.dropResidency` (`agent-bindings.mjs:6005`) →
`liveAgents.delete` → a later `/__p6t6/tool` dispatch → `executeTool`
(`agent-bindings.mjs:6047`) → `ensureLiveAgent` → `ensureLiveAgentOnce` → `resumeTeamAgent`
(`agent-bindings.mjs:1345`) → cold resume → the member realm mounts → the realm guard is IO-only and allows.
The boot seam is the resume loop: `memberInstances.list(root)` → for every row → `resumeTeamAgent`.

**The fix** — one shared durable-read gate in `packages/runtime/src/plugin/live/agent-bindings.mjs`:

| piece | line | behaviour |
|---|---|---|
| `memberResumeRefusal(sessionId, teamRoot, memberRows?)` | **1237** | reads the durable `MemberInstance` row; returns a typed refusal for `ARCHIVED`/`DISPOSED`, `null` otherwise; leader/team-root (`teamRoot === sessionId`) is untouched; `memberRows` lets the boot loop reuse its list |
| **SEAM 1** in `ensureLiveAgentOnce`, after `teamRootOfSession` resolves | **4443–4450** (call at **4449**) | throws **before** the resume closure is built → no cold resume, no realm mount, no tool |
| **SEAM 2** in the boot resume loop, after `seen.add(child)` | **5026–5041** (call at **5032**) | `continue` before `resumingSessions.add`/`resumeTeamAgent`/`ensureMaterialized`; records an observation naming the code |

**Typed codes** (the existing product vocabulary, `packages/runtime/permission-lifecycle/types.ts:87-92`):

- `ARCHIVED` → `PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED`
- `DISPOSED` → `PERMISSION_LIFECYCLE_EXECUTION_TERMINAL`

`CREATED` / `RUNNING` / `SETTLED` remain resumable. The leader/root path is untouched (a root owns itself and
has no `MemberInstance` row). `team_archive_member`, and `restore → SETTLED → follow-up → cold resume`, keep
working: restore commits `SETTLED`, so the same gate allows the next cold resume.

`executeTool` re-labels an ensure-live failure as `NO_LIVE_AGENT` (the harness route maps it to **422**, exactly
the refusal shape row 6 accepts); the in-process code stays typed and the message names the lifecycle and cites
the frozen sections. The wire reply is deliberately not re-plumbed: changing the route's status contract is a
separate product decision, and row 6's `everyDispatchExplained` already accepts 422.

**Dangling `ADR §8` corrected.** Alpha.4 ADR §8 is "Live containment and frozen matcher identity" — it says
nothing about lifecycle execution, so every `(ADR §8)` citation in `packages/runtime/permission-lifecycle/` was
wrong. The execution semantics now cite the frozen Architecture: the code vocabulary
(`types.ts:86-93`), the pure gate and its refusal reasons (`decision-lane.ts`), the restore rule and the restore
argument (`types.ts`), the mutation lane's DISPOSED/ARCHIVED rules (`mutation-lane.ts`) and the module summaries.
The new gate's own doc comment cites §41.6/§30.2/§29.4. A wrong citation in security code is a defect in its own
right, so the whole lane's `ADR §8` references were re-cited, not just the one on the touched line.

**Durable-read cost (measured, `row6-durable-read.test.mjs`):**

- steady-state: **0** `memberInstances.list` calls across 100 `ensureLiveAgent` calls on a resident Member —
  `ensureLiveAgent` returns from `liveAgents` before `ensureLiveAgentOnce` runs, so the gate is never reached;
- cold resume: the gate adds **exactly 1** in-memory `list` (total 4 for that path: ownership resolver + gate +
  two pre-existing consumption/instance reads);
- boot: the gate adds **0** reads (the loop's `members` list is passed in), regardless of member count.

No cache was added because there is no hot-path read to cache: the only new read is per cold resume, and
`StorageKvTable.get` reads the open domain **from memory** (`packages/storage/schema/seam.ts:65`), so the gate
adds no durable I/O. Caching per `(sessionId, lifecycle revision)` would also need an invalidation channel for
cross-process transitions — the very case §7 names as residual — so it would buy nothing and hide staleness.

## 3. RED → GREEN, and the two-seam mutation control

- **RED** (`red-before-gate.log`): `3 failed | 1 passed` — the `ARCHIVED` and `DISPOSED` legs cold-resume
  (`resumes` non-empty, no typed error) and the boot resume phase re-binds the archived member; the `SETTLED`
  control passes.
- **GREEN** (`green-gate.log`): `4 passed (4)` — both refusals typed before any resume, `resumes === []`, boot
  skips the archived row, `SETTLED` still resumes.

The second seam was found by **reading**, not by a red arm, so the green arm alone cannot prove it is
load-bearing. `row6-mutation-control.mjs` therefore edits the real source to remove the gate at **exactly one
seam at a time** and requires the expected RED (a control that produces no RED fails):

| mutant | edit | observed legs | verdict |
|---|---|---|---|
| **M1** seam 1 only | `if (false && refusal !== null) throw refusal` in `ensureLiveAgentOnce` | `ARCHIVED: failed, DISPOSED: failed, SETTLED: passed, RESTART: passed` | **RED-AS-REQUIRED** |
| **M2** seam 2 only | `if (false && refusal !== null) {` in the boot loop | `ARCHIVED: passed, DISPOSED: passed, SETTLED: passed, RESTART: failed` | **RED-AS-REQUIRED** |

The original bytes are restored in `finally` and the sha256 is compared before/after each run. So each seam is
independently necessary, and neither mutant moves the other's legs.

## 4. Row 6: the judge flips for the right reason, and the row is renamed

`row6-rejudge.test.mjs` runs the **shipped, unmodified** `judgeRow6` over both archived runs
(`row6-samples/2026-11-04T20-10-19Z`, `…20-17-23Z`):

1. **Archived bytes are history:** re-judging the archived sample is still `REFUTED / ROW6_CLAUSE_FAILED` with
   the same five clauses (`everyDispatchExplained`, `noSuccessAfterStop`, `noCallableShadow`,
   `probeFactsAreRefusals`, `noProcessAfterStop`). Nothing was rewritten.
2. **The same stimulus against the fixed product is the refusal:** the archived member row is replayed in a
   host-free world (the REAL glue through the t12a bridge): go live while `SETTLED`, run the **quiesce step-5
   residency release FIRST**, then **commit the durable `ARCHIVED` row** — the product order
   (`quiesce.ts:143` → `archive.ts:141-151`), corrected 2026-11-05; the earlier draft had the two effects
   reversed (safe-but-not-product, see §4b) — then dispatch the archived `grep` and `glob` probes through
   `live.executeTool` (the same public seam `/__p6t6/tool` calls). Both replies are the route's exact **422**
   mapping; the in-process code is `PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED`; measured deltas after the
   boundary: `resumes 0`, `creates 0`, `toolExecutions 0`.
3. **The judge flips:** keeping every archived field verbatim (member, archive reply, `membersAfter`,
   `stopInstant`, the seven pre-boundary facts, observations, teardown process seam) and replacing only the
   three post-boundary measurements (probe replies, probe facts = none, spawns = none), `judgeRow6` returns
   **`PROVEN / NO_USABLE_CALLABLE_SHADOW_AFTER_STOP`** for both runs. The five clauses flip because the serving
   dispatch is now a typed refusal, not because the environment stopped producing facts — the same arm measured
   zero tool executions, so no guard consult and no subprocess was possible.

`row6-rejudge.json` records both runs, the substitutions, and the refusal text. This is a **post-fix** sample
built on the archived stimulus, not a live re-measurement: a live row-6 PASS still needs a Host boot, and the
reserved start was deliberately not spent here.

**Rename (wording, no clause change).** `stopInstant` is the **archive commit boundary** while the Host is still
alive; `world.teardown()` is separate and is measured by `hostDead`/`portReleased`/`homeDeleted`. The row name
said "teardown", which mislabelled the temporal bound. `SEARCH_CASE_IDS.row6` is now
`live:search-row6-archive-boundary-no-callable-shadow` (key `row6` unchanged, `judgeRow6` unchanged, no clause
weakened); the naming assertion in `tests/world-factory/a5sf-search-live.test.mjs` was renamed with it, and
`row6-replay.mjs` keeps the legacy id as an alias so the archived bytes stay readable. Recorded here as
required.

## 4b. The archive RACE, and the three fixes that close it (2026-11-05, BLOCKING review finding)

**The defect.** §4.2's replay is SEQUENTIAL: it drops residency and *then* commits, so the refusal it measures is
the durable gate's. The product order is the same two effects, but they are two separate awaits
(`quiesce.ts:143` inside `quiesceMember`, then `archive.ts:141-151`), and between them the durable row still
reads `SETTLED` while no live handle exists. A dispatch in that interval is therefore *legal* for every check
the first fix installed: SEAM 1 reads `SETTLED`, the resume succeeds, the handle joins `liveAgents`, and
`ensureLiveAgent` returns a resident handle from `liveAgents` BEFORE the durable gate is ever consulted
(`agent-bindings.mjs:4461-4477`) — so the handle outlives the commit, for the rest of the process. The earlier
re-judge certified only the narrower (sequential, post-commit) claim, and its README + `row6-rejudge` modelled
the reversed order, which is exactly why the hole was invisible: no arm ever dispatched inside the window.

**Measured before the fix** (`archive-race-arms.test.mjs`, host-free, real glue + real
`createLifecycleService`): `RO1` sequential arm **PASSED** (the claim that already held), `RO2` dispatch inside
the `quiesce → commit` window **200 OK**, `RO3` resume resolving after the commit **200 OK + resident**, `RO4` handle
survives the commit **`resident true`** — `3 failed | 1 passed` (`race-red-before.log`). After the fix
`4 passed (4)` (`race-green-after.log`): all four arms refuse with **422**, zero tool executions,
`resident=false`.

**The three fixes (each one alone leaves a hole, per the mutation control below):**

- **(a) post-commit residency re-drop** — `archive.ts` / `dispose.ts` re-run the idempotent
  `residency.dropResidency(childSessionId)` AFTER the durable commit, so a handle that cold-resumed inside the
  window is dropped before the procedure returns. A port fault there is swallowed on purpose: the transition is
  already committed and reporting a failed archive for a committed one would be a lie; the durable gate refuses
  the member either way.
- **(b) post-resume durable re-read (SEAM 3)** — in `ensureLiveAgentOnce`, after `resume()` resolves and
  immediately before `liveAgents.set`, the durable lifecycle is read again; `ARCHIVED`/`DISPOSED` disposes the
  just-resumed handle and throws the same typed refusal
  (`PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED`/`_TERMINAL`). No `await` separates that read from the `set`, so a
  commit cannot land between them; a commit landing after the set is (a)'s job. Cost: **one extra in-memory
  `list()` per cold resume** (SEAM 1 + SEAM 3 = 2 gate reads; `row6-durable-read.test.mjs` measures `2` gate /
  `5` total).
- **(c) the per-member admission close, implemented for real** — the production `admission.closeNewWork` was a
  no-op (`root.ts:2164`), so nothing closed the window in-process. The glue now keeps a process-local
  `newWorkClosed` map keyed by child session id: `ensureLiveAgent` consults it at entry (before the `liveAgents`
  fast path) and `executeTool` consults it once more immediately before `tools.execute` (a dispatch admitted
  before the close must not execute a tool after it). The lifecycle procedure reopens it on EVERY exit
  (`quiesce.ts reopenAdmission`, via `try/finally` in `archive.ts`/`dispose.ts`; optional `reopenNewWork` on
  `AdmissionClosePort`), so (i) an aborted archive does not brick a still-`SETTLED` member and (ii) after a
  committed archive the durable gate is the authority — no double refusal, and Restore needs no admission
  contact. Why (a)+(b) alone are NOT enough: a dispatch that enters the window and finishes its resume before
  the commit is legitimately executable at that instant (the durable row still says `SETTLED`), so it would run
  a tool — the row-6 requirement is `422` / zero executions, which only an admission close can deliver.

**Mutation control** (`race-mutation-control.mjs`: literal single-occurrence edits, sha256 compared before/after
restore of every touched file, and "no RED" is a control failure):

| mutant | edit | expected RED | observed |
|---|---|---|---|
| **R-M1** (a) removed | the post-commit re-drop in both files | `RO4` | `RO4 failed`; RO1/RO2/RO3 passed |
| **R-M2** (b) removed | `lateRefusal` := `null` | `RO3` | `RO3 failed`; RO1/RO2/RO4 passed |
| **R-M3** (c) removed | both admission consults := `null` | `RO2` (and RO4's racing dispatch is no longer refused) | `RO2, RO4 failed`; RO1/RO3 passed |

**What is still true after this fix** — the honest answer to *"can a dispatch concurrent with an archive still
produce a live, tool-bearing handle on this process?"*: **not through the two doors this round closed**, i.e.
not for a dispatch that enters `ensureLiveAgent` **while the procedure is open**. Both variants ("resume inside
the window", "resume after the commit") end `422` with zero executions. The paths that remain uncovered are the
ones that write `liveAgents` WITHOUT those two doors: the **boot resume loop** and the **child-factory create**
path (§7 risk 2).

**Correction (2026-11-05, second adversarial review; the follow-up round's evidence is
`../a5sf-boot-publish/`).** The sentences above originally continued: *"A boot that races an archive in the same
process can still land a resident handle … The boot loop is not reachable from a tool dispatch (it is row start),
so the row-6 tool claim holds."* **The second half was false and the first half understated the hole.** A boot
publish IS reachable from a tool dispatch: a Leader turn during member boot calls `ensureLiveAgent` →
`submitAttributedInput`/`workDelivery.deliver`, and `ensureLiveAgent` returns a resident handle from its fast path
**before any gate**. With the archive already returned (its `finally` reopened admission, the durable row
`ARCHIVED`, the post-commit drop having found no handle), the resume that was in flight then publishes — and a
dispatch during boot executed a tool: `BS4 {published: true, status: 200, toolExecutions: 1}` (it is `422`/0 only
after `boot()`, i.e. after the post-loop sweep). That is now fixed at the publish seam (SEAM 6, BOOT-PUBLISH):
`reopenAdmission` records the terminal lifecycle it already enumerated, and the boot publish refuses after one
durable confirmation. The residual that remains is §7 risk 2(a) — rewritten there — plus risk 1, which is the
only window in this seam family that can still execute a tool.

## 5. Protected glue digest and identity

`packages/runtime/src/plugin/live/agent-bindings.mjs` **is** the protected glue, and this fix genuinely edits it
(that is where the durable gate, the post-resume re-read and the admission close live). The sha256 changes:

- before the row-6 gate change (pre-#594 tree, `44babbfcf`): `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b`
- after the first (row-6 gate) change (that change is #594; at `origin/master` `b17cb939b`): `6d256096d98c8afdd1935e68c57f7571c647ae63362a652d7198e5f91ddb94e8`
- after the 2026-11-05 race fix: `d3945eff6960ef8adc811a38f2a2f447a6a9a359122622e7f80ddfbad125287f`

**Correction (2026-11-05, matrix audit).** The first bullet above originally read *"before (origin/master
`b17cb939b`): `df9b46af…`"*. That attribution was wrong: `b17cb939b` already contains the row-6 gate change
(#594) and its glue is `6d256096…` — the value the second bullet already gives; `df9b46af…` is the pre-#594
`44babbfcf` tree. The digests and every measured result in this file are unchanged.

This is legitimate and minimal: the delta is (1) the shared `memberResumeRefusal` helper, (2) its two call sites
(SEAM 1 in `ensureLiveAgentOnce`, SEAM 2 in the boot loop), (3) the race fix — the `newWorkClosed` state,
`closeAdmission`/`reopenAdmission` (exposed on the binding surface), the `admissionCloseRefusal` helper, the
entry consult in `ensureLiveAgent`, the last-moment consult in `executeTool`, and SEAM 3 right before
`liveAgents.set` — plus comments. No unrelated refactor, no control/**, tool-dispatch/admission,
governance-center or pa-mount-registry file moves. It is required because the frozen Architecture
(§41.6/§30.2/§29.4) forbids the current behaviour. The ARC-A L1 digest ledger
(`dev/agent-workflow/ledgers/arc-a-protected-center.json`) books the new digest as a **named
center-interface** override with the PR/branch and the reason (a family addition may not add one; this is a
product contract change to the protected row assembly, reviewed as such). `dist` was rebuilt in this commit:
`pnpm run build`, `place-dist-glue`, `build-client-composition`; the emitted
`packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs` is byte-identical to the source
(same sha256), and both artifact gates are run on the committed tree.

## 6. Gates (verbatim)

The **2026-11-05 race round** (this branch) first; the archived-gate round's original numbers follow, unchanged
where they still hold.

| gate (race round) | result |
|---|---|
| race arms, RED before the fix (`a5sf-race-vitest.config.mjs`) | `3 failed | 1 passed` — `race-red-before.log` |
| race arms, GREEN after the fix | `4 passed (4)` — `race-green-after.log` |
| `race-mutation-control.mjs` (removes (a), (b), (c) one at a time) | `M1: RO4 failed` / `M2: RO3 failed` / `M3: RO2,RO4 failed`, every other leg green → `mutation control PASS`; sha256 restored per file (`race-mutation-control.json`) |
| row-6 gate config (`a5sf-gate-vitest.config.mjs`) | `4 passed (4)` (rejudge + durable-read; cold-resume gate reads now `2`, total `5`) |
| deny-fact (A) RED → GREEN (`a5sf-confined-subprocess.test.ts`) | RED `1 failed | 35 passed` (exact received annotations in `a5sf-rg-ancestors/deny-annotation-red.log`) → GREEN `36 passed (36)` + `a5sf-bl16-grep-realm` `10 passed (10)` (`deny-annotation-green.log`) |
| runtime a5sf + lifecycle + glue suites (39 files: `a5sf-*`, `p5t6-*`, `a3p4-*`, `t12a-*`, `p8s5*`, `p8s7r2-*`, `a5ptc-*`) | `501 passed (501)` |
| `node --test tests/world-factory/a5sf-*.test.mjs` | `tests 219 / pass 219 / fail 0` |
| `tsc -p packages/runtime/tsconfig.json --noEmit` | rc 0 |
| `pnpm -r run typecheck` | rc 0 (9 workspace projects) |
| eslint on the touched paths | `0 errors` |
| `pnpm run build` + `place-dist-glue` + `build-client-composition` | rc 0; 101 placements; glue emitted byte-identical (same sha256) |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=1960 glue=101` |
| `node scripts/check-artifacts-at-head.mjs` (committed tree, scratch build) | `verdict=ok compared=1960 drift=0` |
| full runtime suite (`vitest run packages/runtime/test`) | `6001 passed | 1 failed` — the one failure is `a5g6-install-face-render` hitting its 5 s timeout under 482-file parallel load; it passes alone `5 passed (5)` in 785 ms, and `a5mcp-native-trust-filter` / `alpha5-glob-backend` (5 s timeouts in a heavier earlier run) both passed in this run |
| `git diff --check origin/master...HEAD` | rc 0 |

| gate (archived-gate round, 2026-11-04) | result |
|---|---|
| runtime a5sf suites (13 files) | `195 passed (195)` |
| `packages/testkit/test/a4p7-merge-gate.test.ts` (35 static+driven legs) | `35 passed (35)` with a writable `DSH_ARTIFACT_CHECK_STORE_DIR` |
| full suite from the repo root | `8820/8821`; the one failure is `a5g6-install-face-render` hitting its 5 s timeout under 668-file parallel load — it passes alone in 750 ms (5/5) |

Three environment notes, so a later reader does not mistake them for product failures: (a) `check-artifacts-at-head`
needs a **writable** pnpm store; this worktree's `node_modules/.modules.yaml` still names a deleted lane scratch,
so the gate is run with `DSH_ARTIFACT_CHECK_STORE_DIR=$PWD/.scratch/pnpm-store` (a store the gate itself warms);
(b) the evidence vitest configs live outside `packages/**` and are deliberately not in the product suite;
(c) this worktree needed the repo's gitignored test wiring before any suite would run — `packages/*/node_modules`
and `tests/deepseek-harness-test-use` are symlinks to the main checkout (same precedent as
`.worktrees/a5sf-archived-gate`), otherwise 4 files fail to resolve `@deepseek-ai/cordis` and
`a5sf-tool-axis` cannot find the pinned baseline checkout. Those are wiring, not code changes, and they are
gitignored.

## 7. Residual risks

1. **A Member archived in a different process than the resumer.** The gate reads the open `TeamDomain`'s
   durable rows, and those tables are an **in-memory snapshot** of the medium (`seam.ts:65`). If a *different*
   process commits `ARCHIVED` to the same medium, this process's view stays `SETTLED` until the domain is
   reopened/reloaded, and the gate would allow the cold resume. Symmetrically, a restore committed elsewhere can
   look `ARCHIVED` here and produce a temporary false refusal. The single-writer-per-domain discipline is what
   makes this safe today; a multi-writer deployment needs a transition notification or a revisioned reload.
   SEAM 3 does **not** narrow this case (it re-reads the same in-memory snapshot, which is what makes it able to
   see a *local* commit at all), and the admission close (§4b (c)) is process-local by construction.
2. **Two in-process resume seams write `liveAgents` outside the two doors this round guarded.** One of them
   turned out to be reachable from a tool dispatch after all (correction above: the boot publish can be served to
   a Leader turn *during* boot, and the dispatch executed) and is now covered by the BOOT-PUBLISH round; the
   other is a row-start path with no dispatch route:
   (a) **the boot resume loop** — **now covered, twice; this entry is no longer an open residual.** Two
   follow-up rounds closed it without breaking the boot's list budget: BOOT-SEAM added the post-resume in-memory
   admission check plus ONE post-loop durable sweep (2 member-set enumerations, independent of member count),
   and BOOT-PUBLISH found that those two still left the interval between `liveAgents.set` and the sweep open
   for a procedure that had already RETURNED (a mid-boot dispatch executed: `200`/1 execution), and closed it
   with a terminal-at-`reopenAdmission` marker plus ONE durable confirmation at the publish seam (normal boots:
   zero extra reads; the raced member: one). `../a5sf-boot-seam/README.md` (BS1/BS2/BS3) and
   `../a5sf-boot-publish/README.md` (BS4/BS5, M1–M3) carry the arms. The **remaining** boot window is a
   residency-observation interval (the archive's own `commit → post-commit residency re-drop`), during which new-work
   admission is still closed, so it cannot execute a tool — and the configuration where the lifecycle wires no
   `AdmissionClosePort` at all (the pre-#598 `root.ts:2164` shape) still has an EXECUTABLE mid-boot publish
   window, which BS5 pins as a characterised gap rather than a guarantee.
   (b) **the child factory** (`childFactory.createChildSession`, `agent-bindings.mjs:~4879`): it cold-resumes a
   durable child session without the lifecycle read. Reachable only if a create flow asks for the **same
   instance id** as an archived member (the public `team_create_member` allocates a fresh instance id, so not
   reachable through the current tools). A defence-in-depth follow-up can route the factory through the same
   helper once an instance-id-reuse flow exists.
3. **A queued follow-up that targets an archived Member.** Delivery goes through
   `sessionInput.submitAttributedInput → ensureLiveAgent`, so the gate refuses it (422 / typed refusal). That is
   the frozen semantics — `ARCHIVED` cannot receive new Team work (§29.5/§41.6) — but the coordinator's intent
   then stays pending for recovery until an explicit restore. A restore makes the same follow-up deliverable;
   no work is silently lost, but there is no automatic "deliver after restore" leg here.
4. **Cost.** THREE in-memory `list` scans per cold resume as of the race fix: ownership, SEAM 1 (gate before the
   resume), SEAM 3 (gate after it) — `row6-durable-read.test.mjs` measures `2` gate / `5` total `list()` calls,
   up from `1` / `4`. Steady state adds **zero** reads (a resident handle returns before the gate). **Boot, after
   the two follow-up rounds: 2 member-set enumerations, independent of member count** (the loop's one read + the
   one post-loop sweep), plus **one** durable confirmation for a member whose archive/dispose completed in this
   process before the publish (SEAM 6's marker; normal boots pay zero) — measured by BS3 as `{one: 5, two: 8}`
   total `list()` calls with `enumerations: 2` in both worlds. A cold resume already pays the session load, so
   this is not on the tool hot path; but if a future seam calls the gate on a per-call path it must cache per
   `(sessionId, lifecycle revision)` **with** a cross-process invalidation channel (see risk 1), not a bare memo.
5. **Wire status contract.** The route still maps every ensure-live failure to `NO_LIVE_AGENT`/422. The typed
   codes survive in-process and in the message (`PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED`/`_TERMINAL`, and the
   race fix's glue-level `LIFECYCLE_ADMISSION_CLOSED`, deliberately NOT added to the frozen
   `PERMISSION_LIFECYCLE_ERROR_CODES` vocabulary — that vocabulary describes durable-state refusals, and this
   one is a transient in-process procedure), but a remote caller cannot distinguish "no live agent" from
   "archived" or "quiescing". Preserving the code on the wire is a separate, user-visible contract change and
   was left alone.

---

*Host-free only. No Host boot, no merge, no settle; `:3080` and the stable development instance were not
touched. The reserved search-ledger start remains unspent for a live row-6 re-measurement. The 2026-11-05 race
round likewise ran host-free (real glue + real `createLifecycleService`, no Host); what it changes is the
mechanism, not the row's acceptance grade.*
