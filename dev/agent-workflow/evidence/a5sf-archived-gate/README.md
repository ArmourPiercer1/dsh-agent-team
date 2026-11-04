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
| `runtime-full.log`, `build.log` | the full runtime suite and the dist rebuild |

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
   host-free world (the REAL glue through the t12a bridge): go live while `SETTLED`, commit the durable
   `ARCHIVED` row, drop residency (the quiesce step), then dispatch the archived `grep` and `glob` probes
   through `live.executeTool` (the same public seam `/__p6t6/tool` calls). Both replies are the route's exact
   **422** mapping; the in-process code is `PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED`; measured deltas after the
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

## 5. Protected glue digest and identity

`packages/runtime/src/plugin/live/agent-bindings.mjs` **is** the protected glue, and this fix genuinely edits it
(that is where both seams are). The sha256 changes:

- before (origin/master): `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b`
- after: `6d256096d98c8afdd1935e68c57f7571c647ae63362a652d7198e5f91ddb94e8`

This is legitimate and minimal: the delta is the shared helper (~30 lines), the two call-site blocks, and
comments — no unrelated refactor, no control/**, tool-dispatch/admission, governance-center or
pa-mount-registry file moves. It is required because the frozen Architecture (§41.6/§30.2/§29.4) forbids the
current behaviour. The ARC-A L1 digest ledger
(`dev/agent-workflow/ledgers/arc-a-protected-center.json`) books the new digest as a **named
center-interface** override with the PR/branch and the reason (a family addition may not add one; this is a
product contract change to the protected row assembly, reviewed as such). `dist` was rebuilt in this commit:
`pnpm run build`, `place-dist-glue`, `build-client-composition`; the emitted
`packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs` is byte-identical to the source
(same sha256), and both artifact gates are run on the committed tree.

## 6. Residual risks

1. **A Member archived in a different process than the resumer.** The gate reads the open `TeamDomain`'s
   durable rows, and those tables are an **in-memory snapshot** of the medium (`seam.ts:65`). If a *different*
   process commits `ARCHIVED` to the same medium, this process's view stays `SETTLED` until the domain is
   reopened/reloaded, and the gate would allow the cold resume. Symmetrically, a restore committed elsewhere can
   look `ARCHIVED` here and produce a temporary false refusal. The single-writer-per-domain discipline is what
   makes this safe today; a multi-writer deployment needs a transition notification or a revisioned reload.
2. **The child factory is the one remaining in-process resume seam.** `childFactory.createChildSession`
   (`agent-bindings.mjs:~4879`) still cold-resumes a durable child session when one exists, without the
   lifecycle read. It is reachable only if a create flow asks for the **same instance id** as an archived
   member (the public `team_create_member` allocates a fresh instance id, so it is not reachable through the
   current tools). This is the answer to "the one thing that could still resurrect an archived Member after
   this change" **inside this process**; the cross-process stale-view case is the environmental one. A
   defence-in-depth follow-up can route the factory through the same helper once an instance-id-reuse flow
   exists.
3. **A queued follow-up that targets an archived Member.** Delivery goes through
   `sessionInput.submitAttributedInput → ensureLiveAgent`, so the gate refuses it (422 / typed refusal). That is
   the frozen semantics — `ARCHIVED` cannot receive new Team work (§29.5/§41.6) — but the coordinator's intent
   then stays pending for recovery until an explicit restore. A restore makes the same follow-up deliverable;
   no work is silently lost, but there is no automatic "deliver after restore" leg here.
4. **Cost.** Two in-memory `list` scans per cold resume (ownership + gate) and zero new reads at boot or in
   steady state; a cold resume already pays the session load, so this is not on the tool hot path. If a future
   seam calls the gate on a per-call path, it must cache per `(sessionId, lifecycle revision)` **with** a
   cross-process invalidation channel (see risk 1), not a bare memo.
5. **Wire status contract.** The route still maps every ensure-live failure to `NO_LIVE_AGENT`/422. The typed
   code survives in-process and in the message, but a remote caller cannot distinguish "no live agent" from
   "archived". Preserving the code on the wire is a separate, user-visible contract change and was left alone.

---

*Host-free only. No Host boot, no merge, no settle; `:3080` and the stable development instance were not
touched. The reserved search-ledger start remains unspent for a live row-6 re-measurement.*
