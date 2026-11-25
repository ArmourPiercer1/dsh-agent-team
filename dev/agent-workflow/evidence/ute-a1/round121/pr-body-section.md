## ROUND 121 — the rc.5 dispatch seam: the 11 red tests in 3 suites are GREEN on both hosts (no row moves, nothing PRODUCT-PROVEN)

Commit `969f4b57a` on `240352716`. Branch `vnext/a1-cut`, PR **#822 stays DRAFT** — no merge, no ready flip, no force-push,
no upstream patch (**CORE PATCH BUDGET = 0**), `:3080` untouched.

**Reproduced first, then fixed.** On rc.5 `9c2670d3bc` the round-118 reds reproduced test for test (BL-16 9/10, BL-17 2/4, issue2
suite-level), every run printing `HOST-VERSION-GUARD ok host=next resolved=0.2.2-rc.5`. After the fix: BL-16 **13/13**, BL-17
**4/4**, issue2 **13/13** on rc.5 AND rc.2.

**Two defects, not one — and the round-118 attribution is corrected.** (1) rc.5 deleted built-in dispatch: `tools.execute`
delegates to `selectExecutor(scope)`, which throws `ToolExecutorUnavailableError` when the composition selected none. (2) The
empty managed-tool forward was **not** the executor: rc.5 tool modules statically inject `workingDirectory`, and Cordis silently
DEFERS a plugin whose static inject is unmet — no error, no fiber, nothing registered. The test-side half is the labelled
`provideWorkingDirectoryDouble` under `if (HOST_MODE === 'next')` the other rc.5-adapted suites already use.

**The mechanism — public capability, no version sniffing.** `packages/runtime/src/plugin/vnext/tool-executor-mount.mjs` decides
the host shape off the LIVE tools service: `tools.setExecutor` → rc.5 executor mount (the HOST's own exported plugin object
`{name, inject, apply}` mounted on the Member's agent scope; skip when a selection already exists — one executor per scope is the
host's rule); `tools.modeFor`/`defaultMode` → rc.2 registry dispatch, mount nothing; neither → record the absence and refuse the
first governed CALL with `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`. No removed API is emulated, no `package.json`/semver read, no
`try { rc5 } catch { rc2 }`. Typed refusals: `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING` and `A5SF_TOOL_EXECUTOR_UNAVAILABLE`.

**Admission is untouched.** `installMemberCentre` → `admission-port.mjs` installs `tools/pre-execute` listeners and
`tools.guard()` denials on the SAME scope, and the host's own pipeline dispatches them before the body (rc.5
`pipeline.js:386,402`; rc.2 `index.js:3225`). Measured ordering: the centre's pre-execute denies first, so a denied lane never
reaches the executor (0 spawns).

**The four controls** (in `a5sf-bl16-grep-realm.test.ts`): C1a positive — a governed member `grep` reaches the mounted executor
(record `{shape:'executor-mount', mounted:true, name:'native-tool-executor'}`, host `selectExecutor(agent)` is a
`NativeToolExecutor`, exactly one centre `decision:'allow'` fact, spawns +1); C2 negative — the row's own `dispose()` removes the
mount and the call is REFUSED with `A5SF_TOOL_EXECUTOR_UNAVAILABLE` (0 spawns, 0 facts); C3 negative — a DENIED lane is still
denied WITH the executor mounted (`isError`, secret absent, 0 spawns, centre `decision:'deny'`); C4 — the rc.2 arm, 13/13, with
the `registry-dispatch` record and no disposer.

**Population, both hosts, 44 files:** rc.2 **42/44 files, 532/535**; rc.5 **42/44, 532/535** (was 39/44, 505/519). The three
remaining reds are the pre-existing host-independent client failures on BOTH hosts.

**A measurement defect found and fixed in the same round.** Under `resolve.preserveSymlinks: true` Vite resolved host-internal
`@deepseek-ai/*` imports by symlink path while the adapter named realpaths — one file, two module instances (measured: two
`dsh-scope` copies, so `Symbol("dsh.scope")` mismatched and a scoped `systemPrompt.section()` landed in the GLOBAL layer). The
Vite adapter now unifies that ONE case (inside the importer's own pinned tree); the resolver's decline contract is unchanged and
`host-resolution-consistency.test.mjs` pins the new arm (12/12).

**Gates at `969f4b57a`:** `ute-vnext-a1` 8 suites exit 0; `test-catalog` 788/736/14/38 digest unchanged; `ute-cut-closure
cut(0/148)`; `ute-p0-assets cut(148/148)`; `docs-sync docs=193 findings=0`; `place-dist-glue 36` byte-identical; `eb3-ci-required
workflows=11`; bound vitest `ci-integration` **15 suites / 238 passed / 0 failed**; **UTE G1 argv 89/89**; `EB3-RUN-MANIFEST 662`;
**`ci-pr-gate --full --census-captures 2` PASS 10/10**; `check:artifacts:head drift=0`. The p4t6 scannable-file ledger is booked
`1320 → 1323` (three new files, exact law, no tolerance).

**Open and named:** `agent-bindings.mjs#executeTool` still emits the rc.2 single-call shape (`:4058`, not on any measured red
path); the 3 pre-existing client reds; no PRODUCT-PROVEN row (the candidate gate is a VERSION gate and no version is frozen);
worlds outside the measured population that assemble a bare rc.5 tools service refuse typed on their first governed call unless
they pass `hostToolExecutorSpecifier` — visible, not silent. Trail: `dev/agent-workflow/evidence/ute-a1/round121/`,
`RC5-TEST-MATRIX.md` §11.6, `D-ACCEPTANCE-REPORT.md` ROUND 121, `CANDIDATE-REPORT.md` §8.

