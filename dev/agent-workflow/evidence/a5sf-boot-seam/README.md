# a5sf-boot-seam — the boot resume loop binds the durable lifecycle too

**Date:** 2026-11-05 · **Lane:** `a5sf-boot-seam` (the one named residual from the archive-race fix
`#598` / `61554ae1d`) · **Grade:** mechanism repair (a resurrection seam), **not tool acceptance**.
**No Host boot, no merge, no settle**; host-free arms only (the t12a bridge), the REAL glue, the REAL
lifecycle service. `CORE PATCH BUDGET = 0` (no upstream change); `:3080` and its `DSH_HOME` untouched.
Branch `task/a5sf-boot-seam-20261105` off `origin/master` (`61554ae1d`), worktree
`.worktrees/a5sf-boot-seam`.

**Artifacts** (this directory):

| file | what it is |
|---|---|
| `boot-seam-arms.test.mjs` | the three arms (BS1 boot race, BS2 boot interleave, BS3 list budget) |
| `boot-seam-vitest.config.mjs` | the host-free arm runner (root = this directory, outside `packages/**`) |
| `red-before-seam.log` | the arms on the UNPATCHED glue: **3 failed / 3** |
| `green-gate.log` | the same arms after the seam: **3 passed / 3** |
| `mutation-control.mjs` / `.log` / `.json` | one piece removed at a time; each expected RED; sha256 restored |
| `build.log` | `pnpm run build` + `place-dist-glue` + `build-client-composition` |

---

## 1. The residual, stated as measured

`boot()` (resume phase) read the durable member rows **once** (`memberInstances.list(rootSid)`), refused
the already-`ARCHIVED`/`DISPOSED` rows through `memberResumeRefusal` (SEAM 2), and then, for every
remaining row, `await resumeTeamAgent(...)` → `liveAgents.set(child, handle)` → `ensureMaterialized`.
**No post-resume read at all.** So the durable `ARCHIVED` commit could land while a member's boot resume
was in flight, and the loop deposited a resident handle for a member that was by then ARCHIVED.
`ensureLiveAgent` returns a resident handle from `liveAgents` **before** consulting any gate, so the
handle is served forever after — the same shape as the row-6 resurrection, at a different seam (boot,
not tool dispatch).

**RED, verbatim (`red-before-seam.log`, unpatched glue):**

```
BS1 BOOT RACE:            residentAfterBoot: true, status: 200, toolExecutions: 1, fsOps: 0
BS2 BOOT INTERLEAVE:      residentWhileQuiesced: true, status: 422, toolExecutions: 0
BS3 LIST BUDGET:          two-member member-set enumerations: 0 (the named enumeration does not exist pre-fix)
Test Files  1 failed (1) / Tests  3 failed (3)
```

BS1 is the residual exactly as stated in the brief: the member is **resident**, a dispatch returns
**200**, and exactly **one** tool executed on the resurrected handle.

**On "zero guard facts".** This world is host-free and mounts no a5sf realm, so the product's guard-fact
producer (the mount's `onGuardConsult` sink) does not exist in it — a guard fact cannot be fabricated here.
The arm therefore asserts the *precondition* that makes zero guard facts structural and measures it: **zero
tool executions and zero fake-fs operations** on every handle the boot ever published (BS1's
`{toolExecutions: 0, fsOps: 0}`). A guard consultation is only reachable past `tools.execute`; with zero
executions and no agent published at all (post-fix `residentAfterBoot: false`), no guard fact is producible
on either path. The guard-fact plane itself is measured by the realm arms
(`a5sf-service-install.test.ts`, `a5sf-bl16-grep-realm.test.ts`), not by this seam. BS2's dispatch is already `422` pre-fix because `executeTool`'s
late admission check refuses while the quiesce is open — the defect BS2 measures is the **resident
handle** (`residentWhileQuiesced: true`), a resurrected Agent for a member whose quiesce already released
residency, held by boot while the durable row still reads `SETTLED`.

## 2. The design: one sweep + one free in-memory check

**Chosen shape** (two pieces, both on `agent-bindings.mjs`):

1. **SEAM 5 — the post-resume IN-MEMORY admission check.** Immediately after `resumeTeamAgent` resolves
   and before `liveAgents.set` (no `await` between the check and the set), consult
   `admissionCloseRefusal(child)` — the already-implemented per-member admission close of the row-6 race
   fix. If a lifecycle quiesce is in progress **in this process**, dispose the just-resumed handle and
   skip the member. Cost: **zero durable reads**; it cannot be stale within the process because it IS the
   process-local half of the boundary, and it is reopened only after the archive's own post-commit
   residency re-drop has already run.
2. **SEAM 4 — ONE post-loop durable sweep.** After the loop completes, re-enumerate the member set
   **once** via the named helper `listMemberRows(rootSid)`, take **all** eviction decisions from that
   snapshot synchronously (no `await` between the snapshot and the decisions), then
   `liveAgents.delete(...)` **before** the dispose `await` and dispose every handle whose member is now
   `ARCHIVED`/`DISPOSED`, through the same typed refusal path as SEAM 3 (SEAM 3's `memberResumeRefusal`
   + dispose + typed code).

**The alternative I rejected, and why.** Per-member re-reads (a fresh `list()` per member or a re-read
right after each resume) would close the same window, but they break the boot contract's stated property
— **one durable `list()` for the whole member set per boot** — and they scale with member count: `N`
resumes would cost `N` extra enumerations on every cold boot, in a path that also pre-pays three
per-resume consumption reads. That is the expensive way to buy a property one extra read buys.

**The interleaving question, answered explicitly.** An in-memory admission check *cannot* replace the
sweep, and that is the reason both exist. The archive procedure is `close admission → … → release
residency → commit → post-commit re-drop → (finally) reopen admission`. A boot resume that resolves
**after** the commit AND after that `finally` sees an **open** admission flag (it is cleared) and a
**durable ARCHIVED** row — only a durable read can refuse it. Symmetrically, a boot resume that resolves
**inside** the window (after `close`, before the commit) sees a closed admission flag but a durable
`SETTLED` row — only the in-memory flag can refuse it. Each piece covers the half the other cannot see;
neither is a substitute. (BS2 is RED with the admission check removed *and* the sweep in place, which is
the measurement of that claim.)

**Failed-path behaviour is unchanged.** If `resumeTeamAgent` throws, `boot()` still rejects exactly as
before; the new checks only *skip* a member (with an `observations` row naming the code), the same
posture SEAM 2 already has for an `ARCHIVED` row. So a concurrent archive never turns a boot into a
failure.

## 3. The preserved property, re-priced and measured

The evidence's deliberate property — **one durable member-set enumeration per boot** — is preserved as
"one enumeration + at most one sweep". The sweep's budget is **2 member-set enumerations per boot,
independent of member count**, and the test asserts that number rather than describing it:

| boot | member-set enumerations (the named helper) | all `list()` calls |
|---|---|---|
| 1 resolvable member | **2** | 5 |
| 2 resolvable members | **2** | 8 |

`BS3` asserts `two.enumerations === 2`, `one.enumerations === 2`, and the absolute totals `{one: 5,
two: 8}`; the delta of 3 is the **pre-existing** per-resume consumption read
(`instanceIdForSession` / `locateTemplate` / `installPersonaForSetup` — three reads per cold resume,
none of them a member-set enumeration, all in-memory domain snapshots). A future change that re-reads
per member grows the 2-member enumeration count and breaks BS3 instead of silently rotting the property.

**Disclosure of what is re-priced:** the previous lane's `row6-durable-read.test.mjs` reports "boot: 1
list for any number of members" and its gate comment still says so. That statement is now 2 (one
enumeration + one sweep) for the `boot()` path; that archived evidence file is left byte-unchanged (it is
that round's historical measurement and its own assertion — `gateCalls === 0` — still passes). The
current number is the one measured and asserted here.

## 4. RED → GREEN, and the mutation control

- **RED** (`red-before-seam.log`): `3 failed (3)` — numbers in §1.
- **GREEN** (`green-gate.log`): `3 passed (3)`.
- **Mutation control** (`mutation-control.mjs`, `mutation-control.log`,
  `mutation-control.json`): each new piece is removed **alone** from the REAL source, one literal
  single-occurrence edit, original bytes restored in `finally` with a sha256 compare before/after.

| mutant | edit | observed legs | verdict |
|---|---|---|---|
| **M1** post-loop durable sweep removed | `const sweptRefusal = memberResumeRefusal(...)` → `null` | `BS1 failed, BS2 passed, BS3 passed` | **RED-AS-REQUIRED** |
| **M2** post-resume admission check removed | `const midProcedureRefusal = admissionCloseRefusal(...)` → `null` | `BS2 failed, BS1 passed, BS3 passed` | **RED-AS-REQUIRED** |

Neither mutant moves the other's leg: each seam is independently load-bearing, and neither RED is "a
different reason" (M1 reproduces BS1's exact `residentAfterBoot: true / status: 200 / 1 execution`;
M2 reproduces BS2's `residentWhileQuiesced: true`). Restored sha256 =
`9cdb5513826d0d41a67dc08c404aa718fb3dac5a512003a2a4310e9e250645a6`; `verdict: ALL-MUTANTS-RED-AS-REQUIRED`.

## 5. Protected glue digest and identity

`packages/runtime/src/plugin/live/agent-bindings.mjs` **is** the protected glue and this fix edits it:

- before (`origin/master` `61554ae1d`): `d3945eff6960ef8adc811a38f2a2f447a6a9a359122622e7f80ddfbad125287f`
- after: `9cdb5513826d0d41a67dc08c404aa718fb3dac5a512003a2a4310e9e250645a6`

The delta is: one named enumeration helper (`listMemberRows`, ~14 comment+code lines), one call-site
swap in the loop, the SEAM 5 block, and the SEAM 4 sweep — **82 insertions, 1 deletion**, no unrelated
refactor, no `control/**`, tool-dispatch/admission, governance-center or pa-mount-registry file moves.
`dev/agent-workflow/ledgers/arc-a-protected-center.json` books the new digest as a **named
center-interface** override (path + sha256 + PR/branch + reason); the ARC-A L1 gate
(`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`) is green with it (25 passed). `dist` was rebuilt in the
same commit: `pnpm run build` → `place-dist-glue` (101 placements) → `build-client-composition`, and the
emitted `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs` is **byte-identical**
to the source (same sha256).

## 6. Gates (verbatim)

| gate | result |
|---|---|
| boot-seam arms, RED before the fix | `3 failed (3)` — `red-before-seam.log` |
| boot-seam arms, GREEN after the fix | `3 passed (3)` — `green-gate.log` |
| `mutation-control.mjs` (sweep alone / admission check alone) | `M1: BS1 failed, BS2/BS3 passed`; `M2: BS2 failed, BS1/BS3 passed`; sha256 restored → `ALL-MUTANTS-RED-AS-REQUIRED` |
| `node --test tests/world-factory/a5sf-*.test.mjs` | `tests 219 / pass 219 / fail 0` |
| runtime a5sf + lifecycle + glue suites (`a5sf-`, `p5t6-`, `a3p4-`, `t12a-`, `p8s5`, `p8s7r2-`, `a5ptc-`) | `40 files / 522 passed (522)` — the prior lane's 39-file figure reproduces exactly (`501 passed`) with the filter restricted to `packages/runtime/test`; the same `a5sf-` filter also matches `packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts` (21 legs, all green) |
| p7t3 (lifecycle) | `5 files / 31 passed (31)` |
| `tsc -p packages/runtime/tsconfig.json --noEmit` | rc 0 |
| `pnpm -r run typecheck` | rc 0 (9 workspace projects) |
| eslint on the touched paths | `0 errors` (1 warning: the evidence `mutation-control.mjs` is intentionally ignored by the repo config, exactly as in the two prior rounds) |
| ARC-A protected-center gates (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`) | `25 passed (25)` |
| `pnpm run build` + `place-dist-glue` + `build-client-composition` | rc 0 (0/0/0); 101 placements; glue emitted byte-identical (same sha256) |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=1960 glue=101` (on the committed tree) |
| `node scripts/check-artifacts-at-head.mjs` (committed tree, scratch build) | `verdict=ok compared=1960 drift=0` — "HEAD carries its own build" (`artifacts-at-head.log`; run with a writable `DSH_ARTIFACT_CHECK_STORE_DIR=$PWD/.scratch/pnpm-store`, the same environment note as the two prior rounds) |
| `git diff --check origin/master...HEAD` | rc 0 |

Environment note (same as the two prior rounds): this worktree needed the repo's **gitignored** test
wiring before any suite would resolve — `node_modules` and `packages/*/node_modules` symlinked to the
main checkout, `tests/deepseek-harness-test-use` symlinked to the pinned baseline checkout. That is
wiring, not code, and it is gitignored.

## 7. The question that decides whether this work is done

**After this change, can a boot resume still deposit a resident handle for a member that is ARCHIVED by
the time `boot()` returns?** **Yes — in exactly one window, and it is not this seam's to close.**

The window is the archive procedure's own **commit → post-commit residency re-drop** interval, and it is
reachable only through *ordering*, not through staleness:

1. the sweep's enumeration lands while the member is still `SETTLED` (so the sweep correctly keeps it);
2. the archive commits `ARCHIVED` (`commitDurable` resolves);
3. **`boot()`'s promise resolves in that interval** (the caller observes the ARCHIVED member resident);
4. the archive's `dropResidencyAfterCommit(...)` runs and removes the handle.

Every other ordering is closed, in this process:

- commit **before** the sweep's enumeration → the sweep disposes and evicts it (BS1);
- resume resolving **inside** the quiesce→commit window → the in-memory admission check never publishes
  the handle (BS2);
- commit **after** `boot()` returns → the handle was published before the commit, and the archive's
  post-commit re-drop removes it (the race fix's fix (a), already in place);
- a *different* process committing → out of scope here too (the durable tables are an in-memory snapshot
  of the medium — the archived-gate round's residual risk 1, unchanged).

**Why closing that last interval is a different decision.** It is not a read this seam can add and not a
stale-view problem: it requires making **residency-release atomic with the durable commit** — either the
archive procedure awaits an acknowledgment that every in-process publisher has observed the commit
(a boot↔lifecycle handshake / publication barrier), or the residency drop moves *inside* the commit's
continuation so no observer can run between them. Either one changes the lifecycle service's contract
(the archive procedure's completion boundary) or the residency port's contract, and the brief's scope
discipline stops at exactly that line ("if a fix at this seam turns out to require touching the
permission plane or the lifecycle service contract, stop and report"). It is also the same class as the
race fix's own residual: the interval is bounded by one synchronous statement after an `await`, and its
only reachable effect in this process is a caller observing the handle *before* the drop that is already
scheduled — not a tool execution (the dispatch path re-checks the durable gate and the admission close
at the last moment). Recording it here, unclosed, is the honest price of not widening the contract.

---

*Host-free only. No Host boot, no merge, no settle; the stable development instance (`:3080`) was not
touched.*
