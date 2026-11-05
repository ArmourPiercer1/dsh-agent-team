# BOOT-PUBLISH — the boot publish window (same resurrection class, one layer below BOOT-SEAM)

Branch `task/a5sf-boot-publish-20261105`, worktree `.worktrees/a5sf-boot-publish`, base `origin/master`
`cad891ddb` (= the merged BOOT-SEAM fix #599). **Host-free only: no Host boot, no merge, no settle**; the
stable development instance (`:3080`) was not touched; `CORE PATCH BUDGET = 0`.

The BOOT-SEAM round (#599) closed the two windows it could see — the resume resolving *inside* the
archive's quiesce→commit interval (SEAM 5, in-memory admission close) and the member still resident *after*
the loop (SEAM 4, one post-loop durable sweep). A second independent adversarial review found the same
resurrection class in the interval **between** them, and it is right: BS1/BS2 were green for the wrong
reason, because both dispatch only *after* `boot()` resolves.

## 1. The hole, reproduced here (BS4)

`liveAgents.set` (`agent-bindings.mjs`, the boot loop) happens after SEAM 5's **in-memory** check. When the
archive has **already returned**, its `finally` has reopened admission → SEAM 5 passes; the durable row is
`ARCHIVED`; the post-commit residency re-drop had no handle to remove (the resume was still in flight). SEAM 4
only sweeps after the whole loop. Between publish and sweep the handle is resident, admission is open, and:

* `ensureLiveAgent` returns it at the fast path **before** SEAM 1 (no durable read at all), and
* `executeTool`'s last-moment check consults **only** the admission map, never the durable row.

My own reproduction of the reviewer's recipe (two members; archive A to completion while A's resume is
suspended; release A; hold B so `boot()` is still pending; dispatch A) — `red-before-fix.log`, arms file
`../a5sf-boot-seam/boot-seam-arms.test.mjs` (`BS4`):

```
BS4 PUBLISH WINDOW  ×  {published: true, lifecycle: 'ARCHIVED', bootPending: true, status: 200, toolExecutions: 1}
Tests  1 failed | 4 passed (5)
```

The dispatch is `422`/0 only *after* `boot()` (i.e. after the sweep), which is exactly why BS1/BS2 could not
see this. Reachable in-process: a Leader turn during member boot → `submitAttributedInput` /
`workDelivery.deliver` → `ensureLiveAgent` → fast path. **Not** reachable through the HTTP route mid-boot
(the boot owns that turn), which is why the arm drives the binding directly instead of pretending a route
exists.

## 2. The fix (protected glue only; the boot's list budget is preserved)

**(a) `terminalAtReopen` marker — SEAM 6.** `reopenAdmission` already enumerates the durable row to find the
child; it now also reads that row's `lifecycle` and records the terminal state (`ARCHIVED`/`DISPOSED`) in
`terminalAtReopen`. A non-terminal observation (an aborted procedure, or a restore that re-admitted the
member) **clears** the marker. Zero extra durable reads — the enumeration was already happening.

**(b) SEAM 6 confirmation at the publish.** In the boot loop, if the admission map is open but the marker is
set, do **exactly one** `memberResumeRefusal(child, rootSid)` durable read: still terminal → dispose the
just-resumed handle and skip the member (SEAM 2's observation posture, never a boot failure); no longer
terminal → clear the marker and publish (a restore won). No `await` between the check and `liveAgents.set`.

Cost: **zero** extra lists on a normal boot; **one** for a member whose archive/dispose completed in this
process before its publish. SEAM 4's post-loop sweep is kept as the backstop.

**(c) SEAM 4 batch atomicity + `undefined` guard.** The sweep now takes its whole eviction set and evicts
**all** of it before the first `dispose()` await (`doomed` array), so a dispatch cannot be served a
snapshot-approved handle between two disposals; and a handle already taken by a concurrent post-commit
re-drop (`liveAgents.get` → `undefined`) is skipped instead of reaching `.dispose()` and being logged as a
dispose failure. *No dedicated arm*: reproducing the between-disposals interleaving needs a dispose double
that holds a barrier, and the arms' doubles resolve immediately — stated as measured-by-inspection, not
claimed as an arm.

**(d) BS3's attribution is no longer a name sniff (LOW from the review).** `recordListCalls` now classifies
through a probe on the world's `resume` wrapper (a member-set enumeration is a `list()` issued while no
resume is in flight), so renaming or inlining `listMemberRows` cannot turn BS3 red for the wrong reason. The
absolute totals (5 / 8) are unchanged.

## 3. Arms

| arm | what it pins | pre-fix | post-fix |
|---|---|---|---|
| BS1 | ARCHIVED commit lands while the resume is in flight, dispatch after `boot()` | green | green |
| BS2 | resume resolves inside quiesce→commit | green | green |
| **BS4** | resume resolves after the procedure **returned**; dispatch **mid-boot** | **RED** `{published:true, status:200, toolExecutions:1}` | **GREEN** `{published:false, status:422, toolExecutions:0}`, and `422` after boot too |
| **BS5** | the PRE-#598 wiring (no admission port): sweep-only backstop | green (documents it) | green |
| BS3 | 2 member-set enumerations for 1 and 2 members; totals `{one:5,two:8}` | green | green |

BS5 **characterises** the configuration where the lifecycle wires `closeNewWork` as a no-op and has no
`reopenNewWork` (the pre-#598 `root.ts:2164` shape): there the glue gets no in-process signal at all, so the
mid-boot dispatch **is** `200`/1 execution — stated plainly, not described as harmless — and only the
post-loop sweep bounds it (after `boot()`: not resident, `422`). The production root wires both ports since
#598; BS5 exists because M1 needs a configuration where the sweep is the only line, i.e. to make the
"backstop" claim measurable instead of asserted.

`green-gate.log`: `Tests 5 passed (5)`.

## 4. Mutation control (`ALL-MUTANTS-RED-AS-REQUIRED`, sha256-restored)

| mutant | edit | required RED | observed |
|---|---|---|---|
| **M1** post-loop sweep removed | `sweptRefusal := null` | **BS5** | `BS5 failed`; BS1/BS2/BS3/BS4 passed |
| **M2** admission check removed | `midProcedureRefusal := null` | **BS2** | `BS2 failed`; BS1/BS3/BS4/BS5 passed |
| **M3** terminal confirmation removed (this round's mutant) | `lateTerminal := null` (marker kept) | **BS4** | `BS4 failed`; BS1/BS2/BS3/BS5 passed |

**A finding the control produced, not a detail to skip:** on the first run M1 did **not** turn BS1 red. SEAM 6
now subsumes the sweep on the wired path — `reopenAdmission` has already left the marker before the resume
resolves, so the publish is refused and the sweep never has anything to evict. The sweep is still load-bearing
for the unwired configuration, which is why its mutant is pinned by BS5 (an arm created for that reason) rather
than by an arm that only looked like it needed it. Restored glue sha256
`fd7770c56692f7f372918c834ad8719ec1bdcfa432921e399145222c32c6f3d7` (`mutation-control.json`, `.log`).

## 5. The claims that were false, and what they say now

1. `../a5sf-boot-seam/README.md` §7 said **"Every other ordering is closed, in this process"**. False: the
   publish→sweep interval was open and a mid-boot dispatch executed. Now: the section carries a dated
   `CORRECTION` block quoting the false sentence, and the bullets are re-stated with SEAM 6 in them —
   "closed **as of BOOT-PUBLISH** … provided the lifecycle wires `AdmissionClosePort`".
2. The same section said the residual's "only reachable effect … is a caller observing the handle … — not a
   tool execution (**the dispatch path re-checks the durable gate** and the admission close at the last
   moment)." False: `executeTool`'s late check is admission-only. Now it says so explicitly, and the
   non-executability of that interval rests on the admission map being **closed** for its whole duration
   (`quiesce.ts` reopens only after the post-commit re-drop), not on any durable re-read.
3. `../a5sf-archived-gate/README.md` §4 said the boot loop is "**not reachable from a tool dispatch (it is row
   start)**" and its §7 risk 2(a) still called the boot loop an unclosed residual. Both are corrected in place:
   the publish **is** reachable from a Leader turn during boot, the measured numbers are quoted, and risk 2(a)
   now reads "covered, twice; this entry is no longer an open residual" with the two follow-up rounds named.
   The two READMEs no longer contradict each other at the same tip.

## 6. Gates (verbatim)

| gate | result |
|---|---|
| boot arms RED → GREEN | `1 failed \| 4 passed (5)` → `5 passed (5)` |
| `node --test tests/world-factory/a5sf-*.test.mjs` | `tests 219 / pass 219 / fail 0` |
| runtime a5sf + lifecycle + glue (39 files) + `packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts` | `40 files / 522 passed (522)` |
| p7t3 | `5 files / 31 passed (31)` |
| row-6 race arms RO1–RO4 (re-run, no regression) | `4 passed (4)` |
| row-6 gate arms (`row6-rejudge`, `row6-durable-read`) | `4 passed (4)` |
| `tsc -p packages/runtime/tsconfig.json --noEmit` | rc 0 |
| `pnpm -r run typecheck` | rc 0 (9 projects) |
| eslint on the touched paths | `0 errors` (2 ignored-file warnings: both evidence scripts are outside the repo lint scope) |
| ARC-A gates (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`) | `25 passed (25)` |
| `pnpm run build` + `place-dist-glue` | rc 0; 101 placements; glue emitted **byte-identical** to `src` (sha below) |
| `check-artifacts-committed` | `verdict=ok compared=1960 glue=101` |
| `check-artifacts-at-head` | `verdict=ok compared=1960 drift=0` |
| `git diff --check origin/master...HEAD` | rc 0 |

Environment note (same as the three prior rounds): this worktree needed the gitignored test wiring
(`node_modules`, `packages/*/node_modules`, `tests/deepseek-harness-test-use` symlinked to the pinned
baseline) and `DSH_ARTIFACT_CHECK_STORE_DIR=$PWD/.scratch/pnpm-store` for `check-artifacts-at-head`.

## 7. The remaining window, stated the same way as last time

**After this fix, can a resident handle for a member ARCHIVED at that moment be *served* in this process?**
Yes, in exactly one interval, and it **cannot execute a tool**:

* **interval** — the archive procedure's own `commit → post-commit residency re-drop` gap. A handle published
  *before* the commit is still in `liveAgents` after `commitDurable` resolves and before
  `dropResidencyAfterCommit` runs.
* **reachability** — in-process only through a caller that observes residency in that window (a boot that
  resolves there, or a UI/status read of the residency overlay); the HTTP tool route cannot reach an
  execution because for the *whole* interval admission is still CLOSED (`quiesce.ts` reopens it only after the
  drop), so `ensureLiveAgent` refuses at entry and `executeTool` refuses at its late check; once admission is
  open the handle is gone.
* **can it execute?** No — provided the lifecycle wires `AdmissionClosePort`. **Without that wiring the answer
  is yes** (BS5: `200`/1 execution mid-boot), which is why the wiring is named as a precondition of the claim
  and not as an implementation detail.
* **cross-process** (archived-gate risk 1) is the one window that **can still execute**: a stale durable
  snapshot means SEAM 6's confirmation reads `SETTLED` and the publish proceeds. The single-writer-per-domain
  discipline is what makes it unreachable in a product deployment; no check in this seam closes it.

## 8. Protected glue

`agent-bindings.mjs`: `bf081ae2…` was the booked center digest (first booking); this branch's file is
**`fd7770c56692f7f372918c834ad8719ec1bdcfa432921e399145222c32c6f3d7`** (was `9cdb5513…` at the BOOT-SEAM tip),
booked as a **NAMED center-interface override** in `dev/agent-workflow/ledgers/arc-a-protected-center.json`
(§5 of this round's diff, +6 lines, every earlier byte preserved). `packages/runtime/dist/.../agent-bindings.mjs`
is rebuilt in the same commit and is byte-identical (same sha256). No `control/**`, tool-dispatch/admission,
governance-center or pa-mount-registry move; no archive/dispose/quiesce semantics change; no permission-plane
or lifecycle-service-contract change.

---

*Host-free only. No Host boot, no merge, no settle; `:3080` and its `DSH_HOME` were not touched.*
