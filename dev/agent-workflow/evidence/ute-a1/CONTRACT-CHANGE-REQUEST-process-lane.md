# CONTRACT_CHANGE_REQUEST — RESOLVED (superseded): the process lane was never needed

**Status:** **RESOLVED / SUPERSEDED** by the owner ruling `docs/reviews/20261122-1536.txt` §1 and
Round 75. **No schema change was made, and none is needed.**

**Type of the original request:** `CONTRACT_CHANGE_REQUEST` (never a `CORE_SEAM_BLOCKER`: the v4
grammar already carried the declaration; the defect was that the projection DROPPED it).

**Affected C rows:** `C-subprocess` (`bash`), `C-pty`, `C-ptc` (`run_code`), and B's rung-6 positive
control.

## The owner ruling (what replaced this request)

> "may this Member start this class of process/executor" is an **EXECUTION authorization**, distinct
> from "what may the process read/write/reach", which is the existing three lanes plus the OS
> sandbox. Do **not** add `process` as a fourth PATH lane; do not add `io.process`; a shell's cwd
> never stands in for a lane; `grep` must not require bash execution authority.

## Step 0 — CONTRACT FITNESS CHECK (verdict: **SUFFICIENT**, no schema change)

The v4 declarations **already express process execution authorization**. The fitness check walked
the whole chain from authored document to the admission decision:

| Link | Where | Carries execution authority? |
| --- | --- | --- |
| v4 grammar | `packages/domain/blueprint/src/blueprint-v4.ts:193-204` (`V4ToolBindingAuthoring`), `:100` (closed field set `owner/name/authorization/io/execution`), `:103` (`authorization = allow\|ask\|deny`), `:123` (`execution = implementationOrigin/executionBoundary`) | **YES** — authored, closed, validated (`:421-446`, `:358-385`) |
| v4 → restriction projection | `packages/domain/vnext-field-mapping/src/v4-authoring-map.ts:146-210` (`projectV4ToolBindingAuthoring`) | **YES** — returns `authorization` + `execution` + `io` |
| restriction type | `packages/runtime/member-io-policy/src/types.ts` (`ToolIoRestriction`) | **NO (before Round 75)** — the type had no `authorization`/`execution` |
| restriction projection | `packages/runtime/member-io-policy/src/compile.ts:237-283` (`projectToolIoRestriction`) | **NO (before Round 75)** — silently DROPPED both fields |
| product binding | `packages/runtime/team-services/src/product-assembly.ts` (`projectedRestrictionOf`) → `mount.ts` (`A5sfRealmBinding`) | **NO (before Round 75)** — not forwarded into the realm binding |
| centre binding | `packages/runtime/src/plugin/vnext/centre-install.mjs:64` (`bindingFromCompiledMember`) | **NO (before Round 75)** — mapped only `effective` lanes into `perTool` |
| decision | `packages/runtime/src/plugin/vnext/admission.ts:409-452` | judged a `process` lane that did not exist |

**Verdict:** the v4 surface is fit for purpose. The failure was **carriage, not declaration**: two
projections in the middle of the chain discarded `authorization`/`execution`, so the centre had
nothing to read and the old code invented a `Binding.process` lane instead. Adding a fourth lane
would have been a second declaration source for a decision the grammar already made.

**Refuted alternative (recorded so it is not re-proposed):** `executionBoundary` tells you WHO
executes, not WHAT may be touched; deriving path authority from it was — and remains — inventing
policy. Likewise `shellClass` is an install-spec fact about the composition, not a Member ceiling.

## What Round 75 implemented instead

1. `projectToolIoRestriction` now carries `authorization` (allow/ask/deny) and `execution`
   (`implementationOrigin`, closed `executionBoundary`) into the frozen restriction
   (`member-io-policy/src/compile.ts:265-283`).
2. The product assembly forwards them into the realm binding and refuses a `confined-subprocess`
   declaration only when the realm installs **no** confined subprocess face
   (`product-assembly.ts`, `projectedRestrictionOf` — the refusal's PREMISE is a composition fact,
   not a rule change). The governed realm declares `availableFaces: { process: true }` because it
   mounts the confined subprocess face and the governed PTY face
   (`src/plugin/live/a5sf-governed-realm.mjs`), and `derivedMembersOf` attaches the Team-scoped
   `toolBindings[]` to each derived Member.
3. `bindingFromCompiledMember` carries `authorization`/`execution` into `perTool[tool]` and accepts
   the composition's `executors` readiness facts; `executorReadinessOf(answer)` derives them from
   the compiled answer's own faces (`confined-subprocess` ready iff a `spawnStreaming` provider
   exists; `trusted-host` ready by construction; `delegated-remote` unavailable — no remote
   executor is mounted).
4. `admit()` on `process.exec` now decides `ToolAuthorized ∧ MemberValid ∧ SandboxReady ∧
   BindingValid` (`admission.ts:409-452`): absent declaration →
   `ADMISSION_EXECUTION_UNAUTHORIZED`; `deny` → `ADMISSION_EXECUTION_DENIED`; boundary outside the
   closed vocabulary → `ADMISSION_EXECUTION_UNAUTHORIZED`; declared boundary whose executor is not
   `ready` → `ADMISSION_EXECUTOR_UNAVAILABLE`; `ask` → the existing Control approval path; `allow`
   → allow. The cwd is RECORDED as context and is never consulted.
5. `Binding.process` was deleted. There is no `io.process`, no `Binding.process`, and no path
   matching for shells.
6. `grep` was never on the process axis in the decision (its `TOOL_AXES` entry is `fs.read`); the
   Round-75 arms pin that a binding whose `bash` is DENIED still admits an in-lane `grep`.
7. PTC (`run_code`) stays refused **for its own reason**: the missing proof is its WORKER process,
   its NESTED tool calls, its escalation path and its Stop all passing this same centre — not a
   missing lane. It keeps `ADMISSION_PTC_UNAVAILABLE` and the refusal text names all four.

## Current state (no longer "while the ruling is pending")

- `C-subprocess`: **ADMITTED on a compiled execution authorization**; the disposition of a given
  deployment is a fact about that deployment's `toolBindings[]` + ready executors. A world that
  declares nothing is refused `ADMISSION_EXECUTION_UNAUTHORIZED` (measured live in D3 boot2).
- `C-pty`: same authority; the governed PTY face additionally refuses an owner the host registry
  does not hold (`OWNER_NOT_LIVE`), which is proven in `SLICE-33`.
- `C-ptc`: still **UNAVAILABLE**, now for ONE measured part (round 85): nested calls, Control escalation
  and Stop hold; the WORKER's OS profile is the HOST session policy, not the member's compiled lanes
  (`CORE_SEAM_BLOCKER`, per-execution policy seam — `PTC-FOUR-PART-FINDING.md`).
- No product row can silently run a shell: absence is a typed refusal, the body never starts, and
  the settlement is `REFUSED/not-started`.

## What is still NOT proven

- **The live persistent-shell arm is REFUTED**, deterministically across two boots. See
  `CAPABILITY-MATRIX-C.md` (`C-subprocess` row) and `D-ACCEPTANCE-REPORT.md` for the exact failing
  clauses and why the preset still mounts the one-shot `tool-bash` (which injects the host's base
  `ctx.shell` rather than the realm's confined face — authorizing it would run an UNCONFINED shell,
  so the D3 world deliberately declares no `toolBindings[]` for `bash`).
- The in-process arms prove the DECISION and the OS PROFILE the executor applies; they do not run
  a child under Landlock. Kernel enforcement is measured by the OS arms and the boot, not here.
- `delegated-remote` has no executor in this product; a declaration naming it is refused
  `ADMISSION_EXECUTOR_UNAVAILABLE` rather than silently run locally.
