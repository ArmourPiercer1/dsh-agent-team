# Row 6 diagnosis — the ARCHIVED Search Member is callable

**Date:** 2026-11-05 · **Lane:** `a5sf-search-live` (BL-16 / P2-03 native `grep`) · **Scope:** diagnosis only.
No Host boot, no product patch committed, no merge/settle, `:3080` untouched. Everything below is
reproducible from this directory without a Host.

**Artifacts** (all in `dev/agent-workflow/evidence/a5sf-search-live/`):

| file | what it is |
|---|---|
| `row6-samples/<stamp>/` | verbatim archived evidence of the two failing runs (+ `SOURCE.json` with sha256/origin) |
| `row6-replay.mjs` / `row6-replay.log` | host-free re-judgement of the archived samples with the **shipped** `judgeRow6` |
| `row6-red-arm.test.mjs` / `row6-vitest.config.mjs` | RED-before-GREEN arm against the real `agent-bindings.mjs` source |
| `row6-red-arm.red.log` / `row6-red-arm.green-sketch.log` | the arm today (3 failed / 1 passed) and with a 35-line sketch (4/4) |
| `row6-diagnosis.json` | machine-readable summary of the same facts |
| `bl16-replacement.json` | the exact BL-16 replacement string (the backlog file itself is **not** edited) |

---

## 0. Verdict

**(a) Product contract gap.** Not (b) a check encoding the wrong contract; not (c) a driver artefact.

> After `team_archive_member` commits `ARCHIVED`, the Member's durable session is still cold-resumed into
> a live, tool-bearing Agent — on demand through `ensureLiveAgent`, and unconditionally by the boot resume
> loop — because neither seam reads the durable `MemberInstance.lifecycle`. Archive only drops
> **process-local residency**; the durable row is not consulted at the resurrection seam.

The check is not over-strict: its clauses are satisfied by the product's own typed refusal codes
(`PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED` / `_TERMINAL`), and its `everyDispatchExplained` /
`noCallableShadow` predicates accept `422`, `500`, and `200 {ok:false}` — exactly what a refusal at the
`ensureLiveAgent` seam would produce today (`executeTool` maps any ensure-live failure to `NO_LIVE_AGENT` → 422).

---

## 1. What failed, and the cheapest honest reproduction

Two consecutive runs reproduce the identical row-6 failure (and nothing about row 6 depends on the
row-4/partial-run changes in the producing branch):

| run | runId | stopInstant (archive committed) | row-6 verdict |
|---|---|---|---|
| `row6-samples/2026-11-04T20-10-19Z/` | `a5sf-search-2026-11-04T20-10-19-766Z` | `2026-11-04T20:15:29.800Z` | `FAIL / ROW6_CLAUSE_FAILED` |
| `row6-samples/2026-11-04T20-17-23Z/` | `a5sf-search-2026-11-04T20-17-23-486Z` | `2026-11-04T20:22:33.292Z` | `FAIL / ROW6_CLAUSE_FAILED` |

Both fail the same five clauses:

```text
everyDispatchExplained, noSuccessAfterStop, noCallableShadow, probeFactsAreRefusals, noProcessAfterStop
```

**Reproduction (no Host):**

```bash
node dev/agent-workflow/evidence/a5sf-search-live/row6-replay.mjs
```

It reconstructs the row-6 sample from the archived bytes and calls the shipped judge
(`tests/world-factory/lib/a5sf-search-live.mjs`, `judgeRow6`). It prints — for both runs — the archived
verdict, the replayed verdict, and the serving dispatch. Replayed verdicts are **`REFUTED / ROW6_CLAUSE_FAILED`**
with the identical clause set, i.e. the failure is a property of the measured run, not of a live re-run.

**Reconstruction is faithful.** `oracle-samples.json` stores a *display* copy of the sample: `membersAfter`
and `observations` are reduced to **counts**, so judging that copy directly would falsify `archivedLifecycle`
(the check needs the array). The replay takes `membersAfter`/`observations` from `teardown.json`, the stop
instant from `run-record.json`, and `confinedSpawnsAfterStop`/`baseSpawnsAfterStop` as counts (the judge
consumes only `.length`; the counter rows for the probes lived in the World home, which teardown deletes).
Everything else comes from the archived oracle sample verbatim. The replay prints its inputs, so the
substitution is auditable, not silent.

**Exact clause and dispatch.**

- Clause: `everyDispatchExplained` (and the three derivative clauses) at
  `tests/world-factory/lib/a5sf-search-live.mjs:513-530`.
  `unexplained` counts a reply as explained iff `status === 422`, or `status === 500`, or
  `status === 200 && body.ok === false`. `postStopDispatches` = `[grep, glob]`; the grep reply is
  `200 {ok:false, code:"SEARCH_FAILED"}` (explained), the **glob reply is `200 {ok:true, value:{...}}`**
  (unexplained → the clause is false).
- Dispatch: `postStopDispatches[1]` — `glob` as `session-team-child-47be99afeb8b0aac5c2a00478d3f8141`:
  HTTP 200, `{ok:true, value:{root:"…/workspace/lane/inside/glob", paths:["…/lane/inside/glob/needle.txt"]}}`,
  dispatched at `20:15:29.9xxZ`, i.e. **after** the archive returned (`stopInstant 20:15:29.800Z`).
  The guard facts prove the tool really ran in the Member realm: two `a5sf-guard-consult/1` facts,
  `decision:"allow"`, `decidedBy:"ALLOW"`, `realm:"member"`, `memberIdentity:"inst-14xcgx11i3lu"`,
  `policyRevision:"a5sf-search:inst-14xcgx11i3lu:g1"`, locators `…/lane/inside` and `…/lane/inside/glob`,
  `observedAt 20:15:29.847Z` / `20:15:29.896Z`. Two confined spawns follow
  (`confinedSpawnsAfterStop: 2`), which is why `noProcessAfterStop` is false in the same event.
- Archive was **real and accepted**: `{"ok":true, …, "effect":{"kind":"lifecycle-changed",
  "instanceId":"inst-14xcgx11i3lu","from":"SETTLED","to":"ARCHIVED","sequence":8}}`; `membersAfterArchive`
  shows the worker `ARCHIVED`. `archivedLifecycle` and `noActiveMemberLeft` are **true** — the row does not
  fail because the archive failed.

**Boundary — the grep reply is not a lifecycle refusal.** The grep probe's `SEARCH_FAILED` is
`rg: …/.worktrees/a5sf-search-live2/.git: Permission denied (os error 13)`: the confined Landlock read lane
excludes the worktree `.git`, and ripgrep's git-root discovery reads it (the `glob` probe's governed argv
carries `--no-ignore`, so its walker does no git-root discovery — `packages/tools/search-family/src/glob-backend.mjs:1345-1347`).
This is the same defect that fails row 1 in both runs. It means the *only*
"explained" dispatch is explained by an unrelated environment artefact, not by the lifecycle; if that
artefact were fixed, both probes would be successes. It does not soften row 6 — the serving glob dispatch
is independent of it.

---

## 2. Mechanism — static proof

The archive procedure and the resurrection seam are both deterministic; the live evidence matches this
chain exactly:

| # | step | source |
|---|---|---|
| 1 | `team_archive_member` → lifecycle service → `quiesceMember` → commit | `packages/runtime/lifecycle/index.ts:150-153`; `quiesce.ts:79-153` |
| 2 | quiesce step 5 (unconditional) calls `ports.residency.dropResidency(childSessionId)` | `packages/runtime/lifecycle/quiesce.ts:143` |
| 3 | the residency port **synchronously** deletes `liveAgents[child]` and fire-and-forgets `handle.dispose()` | `packages/runtime/src/plugin/live/agent-bindings.mjs:5844-5862` (delete at `5852`) |
| 4 | the driver's post-stop probe hits `/__p6t6/tool` | `dev/agent-workflow/evidence/a5sf-search-live/run-boot.mjs:1407-1419` |
| 5 | the route calls `teamRoot.live.executeTool(as, …)` | `packages/tools/harness/plugin.mjs:377` |
| 6 | `executeTool` calls `ensureLiveAgent(sessionId)` (and maps **any** failure to `NO_LIVE_AGENT` → 422) | `agent-bindings.mjs:5973-5981` |
| 7 | `ensureLiveAgentOnce`: `closing` check, `durableSessionExists(sid)` **true**, `teamRootOfSession(sid)` → root, then `resumeTeamAgent` | `agent-bindings.mjs:4386-4418` |
| 8 | no step reads the durable member row's `lifecycle`; the cold resume re-mounts the member realm and its tool surface | `agent-bindings.mjs:4390-4399`; realm mount via `agentSetup(…, 'cold-member', teamRoot)` |
| 9 | the realm mount / policy compile is IO-confinement only — it has no lifecycle input, so the guard returns `allow` for the archived Member | `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (no lifecycle read); guard facts in §1 |
| 10 | the boot resume phase re-binds **every** member in `memberInstances.list(rootSid)` with no lifecycle filter | `agent-bindings.mjs:4945-4980` (resume at `4968`) |

Step 5 is unconditional: `quiesceMember` runs all five steps (there is no early return for a SETTLED
member), so a successful archive (`ok:true`, sequence 8) implies `dropResidency` ran. Step 3 makes the
subsequent cold resume certain: even if `handle.dispose()` is still in flight, the map entry is already
gone, so `ensureLiveAgent` cannot find a live handle and takes the resume path.

The permission plane's own lifecycle gate is **not installed for this Member**: the pre-execute adapter is
installed only when `boundTemplate.capabilities?.permissions !== undefined`
(`agent-bindings.mjs:2276`, `3495-3503`), and the search worker template deliberately declares **no
capabilities block** (`run-boot.mjs:299-310`: "the search Member: NO capabilities block (the population
shape) — its ONLY confinement is the compiled member realm + the confined subprocess face"). The existing
typed refusal is therefore never reached — not because it is wrong, but because the population shape has
no permission policy to hang it on.

**A second, production-only seam with the same defect:** the boot resume loop (step 10). The RED arm's
restart leg proves it host-free: a `bootPhase:'resume'` world whose member row is `ARCHIVED` re-binds the
child session unconditionally. No test route participates. After a restart, the archived Member is live
again with its tools mounted.

---

## 3. Why this is not (b) — the check is not encoding the wrong contract

1. **Every predicate is satisfiable by a correct product.** `everyDispatchExplained`: 422 / 500 /
   200-`ok:false`. `noSuccessAfterStop`: no 200-`ok:true`. `noCallableShadow`: additionally all replies
   non-null (a thrown refusal at the route is a 422 body, non-null). `probeFactsAreRefusals`:
   `probes.length === 0 || all deny` — a refusal at the dispatch/cold-resume seam consults no guard, so the
   zero-fact arm passes. `noProcessAfterStop`: zero confined/base spawns. A `PERMISSION_LIFECYCLE_EXECUTION_
   ARCHIVED` throw from `ensureLiveAgentOnce` yields exactly this: 422 (via `NO_LIVE_AGENT`), no facts, no
   spawns. The check would pass without editing a line.
2. **The contract the check encodes is the architecture's state graph.** `§41.6` gives the only edge out of
   ARCHIVED: `ARCHIVED ↓ Restore → SETTLED (no Agent resume) ↓ new follow-up → cold resume Agent if needed`.
   A cold resume performed *while the row is still ARCHIVED* skips a required transition. `§30.2` adds that
   Restore itself must not resume; `§30.1` requires quiesce → release residency → **then** commit. The row is
   asking whether the product enforces the graph, not inventing a stricter rule.
3. **One wording defect, not a contract defect.** The row is named "teardown-no-callable-shadow" and its
   `stopInstant` is the **archive boundary**, not `world.teardown()`. The probes deliberately run *before*
   `world.teardown()` (`run-boot.mjs:1407-1425`, teardown at `1426`): after teardown the Host is dead, so a
   probe would be vacuous and could only re-measure `hostDead` (already a clause). The sample name is
   therefore misleading; the check itself is right. Recommend renaming the row/sample field (e.g.
   `archive-boundary-no-callable-shadow`) or recording both instants, **not** weakening the clauses.

So: the check is not the thing to change. If the owner chooses reading B in §5 (the law binds only
permission-governed Members), then the row must be *re-scoped* as a deliberate product decision — but that
is a contract decision, not a defect in the check's logic.

---

## 4. Why this is not (c) — not a driver artefact

- **The stimulus is harness-only; the seam is not.** `/__p6t6/tool` is registered by the harness plugin
  (`packages/tools/harness/plugin.mjs`), but it calls the product's public `live.executeTool` and
  `live.ensureLiveAgent` (declared on the bindings public type, `packages/runtime/src/plugin/types.ts:1216`;
  the same seam the vertical harness uses at `plugin.mjs:1047`, and the S6 remote handler is documented as a
  future consumer at `packages/remote/src/handlers/team.ts:793`). The HTTP wrapper is test-only; the
  resurrection is product.
- **The boot leg needs no route at all.** `agent-bindings.mjs:4945-4980` re-binds archived members on a
  normal restart. RED arm leg 4 reproduces it host-free. That is a production path, so even a ruling that
  "no production caller may address a child session directly" would not dispose of the defect.
- **No state was forged.** The archive was the real team tool (200, sequence 8), the Member row was the real
  row (SETTLED → ARCHIVED), and the glob executed in the confined realm and returned a real path list — not a
  synthetic reply built by the driver. The driver only *observes* and records.
- **Consequence of the defect is real, not cosmetic:** the archived Member's tools are mounted; a cold resume
  also re-materializes the session. What is *not* proven here is that a production *input* path can then drive
  the archived agent (the team-work paths are gated by admission `TEAM_RUNTIME_WORK_STATE_REJECTED`; direct
  session input is outside this row). The row measures the callable shadow, and the shadow is real.

---

## 5. Contract statement, and the owner decision

### 5.1 What should be true of a Member after `team_archive_member`

1. The durable row is `ARCHIVED` only after quiesce; the quiesce releases residency (`§30.1`). — **observed**.
2. The Member is out of the active work set and accepts no new Team work until restore. — **enforced** at
   admission (`TEAM_RUNTIME_WORK_STATE_REJECTED`, "an ARCHIVED target needs an explicit restore first,
   invariant 53": `packages/runtime/admission/gate.ts:132-147`, `admission/errors.ts:100`), and stated in the
   tool description ("The archived member no longer accepts new Team work until it is explicitly restored",
   `packages/tools/src/tools.ts:1199`).
3. **No execution as that Member.** Any attempt to resurrect the agent — on demand or at boot — must be
   refused **before** the agent is resumed, with a typed error, and without consulting tool guards or
   spawning anything. Product vocabulary: `PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED` (ARCHIVED) /
   `PERMISSION_LIFECYCLE_EXECUTION_TERMINAL` (DISPOSED), `packages/runtime/permission-lifecycle/types.ts:87-92`.
   — **not enforced** for an ungoverned Member (this diagnosis).
4. Restore is the only way back: `ARCHIVED → SETTLED` with no Agent resume (`§30.2`), and a later follow-up
   may cold-resume. — **implemented**; a restore-then-resume would pass the proposed gate.

### 5.2 After `world.teardown()`

Host dead, port released, home deleted, no orphan process. **Observed true in both runs**
(`processSeam`: `portStillListening:false`, `homeExistsAfterTeardown:false`, `orphanPids:[]`,
`worldTeardown.host.killed:true`). Once the Host is dead there is no dispatch target, so "callable after
teardown" is not what the evidence shows; the discriminating measurement is at the **archive boundary**,
while the Host is still alive. The row's name overstates it (§3.3).

### 5.3 The text that exists — and the text that does not

Exists (normative, architecture, frozen 20260829):
- `§29.4 ARCHIVED`: exits the active work set, retains `child Session/transcript`, `restore capability`.
- `§30.1 Archive`: `close new admission → cancel → drain → wait → release resident Agent handle → commit
  ARCHIVED`; forbidden: "write ARCHIVED, then try to stop Agent".
- `§30.2 Restore`: `ARCHIVED → SETTLED`; Restore **must not** "create/resume live Agent residency merely
  for restore".
- `§41.6`: the only edge out of ARCHIVED is Restore; the cold resume follows a *new follow-up* in SETTLED.

**Absent:** no plan/ADR sentence states the enforcement rule at the dispatch/residency seam ("while the
durable row is ARCHIVED, no seam may cold-resume it"), and none states the **scope** — whether the law binds
every Member or only permission-governed ones. The permission-lifecycle code comments cite "ADR §8";
no ADR in the repo has an §8 that says this (Alpha.4 ADR §8 = "Live containment and frozen matcher
identity"; Alpha.5 tool-IO ADR §8 = "Superseding Alpha.5 V2 decisions", item 7 = grant vs lifetime; the
Alpha.5 sandbox-first ADR's §8 is `D8 — 接入与验收`). The citation is dangling. The law is therefore
*derivable* from `§41.6`/`§30.2`, but never written as a checkable enforcement clause.

### 5.4 Owner decision (the only genuinely open question)

- **Option A — lifecycle is a dispatch/residency law (recommended).** The durable lifecycle is the authority
  at every resurrection seam, for every Member, governed or not. Archive makes an instance inert; restore is
  the door. This matches `§41.6`, the existing typed codes, and the PTC escalation precedent that already
  reads the durable row (`isAdmissible`) instead of trusting residency
  (`agent-bindings.mjs:3221` comment: "the archive quiesce drops it, ANY later cold resume … flips it back").
- **Option B — the law is permission-plane-only.** "Never executes" is a property of permission governance;
  an ungoverned population-shape Member has no execution governance, so the row must be re-scoped (drive the
  gated work path and assert `TEAM_RUNTIME_WORK_STATE_REJECTED`) or the worker template must declare
  `capabilities.permissions` so the existing ADR §8 gate installs. Consequence: an archived ungoverned Member
  remains resumable and callable through any direct seam, and a restart re-binds it; "archived" means "out of
  the work set", not "inert".

Recommendation: **A.** B is coherent only if the product is willing to state that an ungoverned Member has
no execution lifecycle at all — which would contradict `§29.4`'s "exits the active work set" reading and leave
the restart path permanently open. A is the smaller, more defensible law, and it makes the check pass without
touching the check.

---

## 6. Recommendation — the smallest change that makes check and product agree

**One shared gate, two call sites, in `packages/runtime/src/plugin/live/agent-bindings.mjs` (~35 lines incl.
comments). No Host, no upstream, no new dependency, no other package.**

```js
// near teamRootOfSession()
function memberResumeRefusal(sessionId, teamRoot) {
  if (teamRoot === undefined || teamRoot === null || String(teamRoot) === String(sessionId)) return null
  const row = domain.repositories.memberInstances
    .list(teamRoot)
    .find((member) => String(member?.childSessionId) === String(sessionId))
  const state = String(row?.lifecycle ?? '')
  if (state !== 'ARCHIVED' && state !== 'DISPOSED') return null
  const refusal = new Error(
    `agent-bindings: session '${sessionId}' belongs to a ${state} MemberInstance — an explicit restore is required before any cold resume (the durable lifecycle is the authority; residency is volatile)`,
  )
  refusal.code = state === 'ARCHIVED'
    ? 'PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED'
    : 'PERMISSION_LIFECYCLE_EXECUTION_TERMINAL'
  return refusal
}
```

- **Call site 1 — on-demand cold resume:** in `ensureLiveAgentOnce`, immediately after the
  `teamRootOfSession(sid)` / `teamRoot === undefined` block (`agent-bindings.mjs:4386-4389`), before the
  `resume` closure: `const refusal = memberResumeRefusal(sid, teamRoot); if (refusal !== null) throw refusal`.
- **Call site 2 — boot resume:** in the resume phase loop, after `seen.add(child)` (`agent-bindings.mjs:4964`),
  before `resumeTeamAgent`: `if (memberResumeRefusal(child, rootSid) !== null) { observations.push(...);
  continue }`. Skipping must not call `ensureMaterialized` for that child.

**Effect on row 6:** `executeTool` catches the throw and re-labels it `NO_LIVE_AGENT` → the route returns
**422**; no guard consult, no spawn, no success. All five failing clauses flip, **without editing the check**.
The typed code is preserved for in-process callers of `ensureLiveAgent`; the route currently collapses it to
`NO_LIVE_AGENT` (message retained). Optional polish (3 lines, not required for row 6): rethrow the two
lifecycle codes unchanged in `executeTool` and map them to 422 in `plugin.mjs` so the wire keeps the code.

**What stays unchanged:** `CREATED` / `RUNNING` / `SETTLED` members resume (SETTLED is the post-restore state);
the boot root / leader path (`teamRoot === sid`) is untouched; `team_archive_member` itself is untouched
(it never calls `ensureLiveAgent`); restore → SETTLED → follow-up → cold resume works.

**Tests to promote** (the implementing lane; not added here — a `packages/**` `.ts` test would need a p4t6
census booking): `row6-red-arm.test.mjs` as a product vitest test (4 legs), plus the existing runtime suite
(`packages/runtime/test/team-session-durability.test.ts`, `t12a-live-bridge.mjs`) and the a5sf-search-live
row 6 re-run.

**Risk / blast radius:** a legitimate cold resume of an `ARCHIVED`/`DISPOSED` member (there should be none;
restore is the door) and the boot behavior for archived members (desired: skip). Watch
`p6t6`/vertical harness flows that resume member sessions after archiving — none should.

---

## 7. RED-before-GREEN arm (measured)

```bash
pnpm exec vitest run --config dev/agent-workflow/evidence/a5sf-search-live/row6-vitest.config.mjs
```

The arm drives the **real** `agent-bindings.mjs` source through `createLiveWorld` (t12a bridge), seeds a
durable member row, and asserts the contract at both seams. Today (`row6-red-arm.red.log`):

```text
× ARCHIVED  ensureLiveAgent(child) refuses typed and resumes NOTHING
            → "the archived Member was cold-resumed instead of refused;
               resumes=[{sessionId:'session-child-row6-red', setupProvided:true}]"
× DISPOSED  same seam, terminal code            (same: resumed instead of refused)
✓ SETTLED   control: the same member DOES resume
× RESTART   the boot resume phase must not re-bind an ARCHIVED member
            → resumes=[root, child]  (the archived child was re-bound)
Tests  3 failed | 1 passed (4)
```

With the §6 sketch applied to both seams (`row6-red-arm.green-sketch.log`): **4 passed**. The sketch was then
reverted (`git checkout -- packages/runtime/src/plugin/live/agent-bindings.mjs`); no product file is modified
on this branch. The SETTLED control passing today and after the sketch is the guard against an over-broad gate.

---

## 8. Boundaries / not diagnosed here

- **Row 1** (`grep` in-lane) fails for a different reason: `rg` resolves the git root by reading
  `.worktrees/a5sf-search-live2/.git`, which the Landlock read lane excludes → `exit 2`.
  `glob` passes because its argv carries `--no-ignore`. Environment/driver-side, separate from row 6.
- **Row 4** failed in the first run, passed in the second (the producing branch moved the interrupt inside
  `team.create`); not re-diagnosed.
- The archived `search-counter.jsonl` copy is a **pre-archive** snapshot (the driver copies it before the
  probes); post-stop counter rows survive only as `confinedSpawnsAfterStop`/`baseSpawnsAfterStop` counts.
  The replay uses those counts and says so.
- The oracle sample's `membersAfter`/`observations` are counts, not arrays (§1); faithful replay must join
  `teardown.json`, as the script does.
- The run directory name `runs/2026-11-04T20-17-23-485Z/` is the **archive stamp of the previous run**
  (the driver archives into `runs/<new-run-stamp>` at start); the runId inside is the 20:10 run. The
  `row6-samples/` directory names use the **runId** instead, and `SOURCE.json` records the origin.

---

## 9. BL-16 residual line — exact replacement (file not edited)

`docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md`, BL-16 row, last cell. Replace the final
substring:

**OLD**

```text
证据 `evidence/a5sf-search-live/README.md` |
```

**NEW**

```text
证据 `evidence/a5sf-search-live/README.md`。**2026-11-05 row-6 复查（判 a，产品契约缺口）**：`team_archive_member` 提交 ARCHIVED 后，`ensureLiveAgent` 冷恢复与 boot resume 循环均不读 durable `MemberInstance.lifecycle`，archived Member 的 Session 被重新拉起并执行 `glob`（200 `ok:true`，post-stop allow fact ×2，confined spawn +2）；host-free 复判、静态链、4 腿 RED 臂（现 3 failed/1 passed；35 行门草图下 4/4）与契约/裁决框架见 `evidence/a5sf-search-live/row6-diagnosis.md`。本轮 live 其余：row 2/3/5/4 过；row 1 因 rg 读 `.git` 被 Landlock 拒（环境/driver 侧，另处理）。row 6 判定保持 FAIL，待产品门修复后复测。 |
```

Exact JSON form (old/new) is in `bl16-replacement.json`.

---

## 10. One sentence for the owner

Row 6 is a real product gap, not a bad check or a driver trick: an archived Member's durable session is
still cold-resumed into a live tool-bearing Agent by both the on-demand seam and the boot path, so please
rule whether the durable lifecycle binds every Member at every resurrection seam (recommended: yes — a
~35-line gate at the two `resumeTeamAgent` call sites, typed `PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED` /
`_TERMINAL`, no check change), or whether "archived never executes" is only a permission-plane property, in
which case row 6 must be deliberately re-scoped instead.
