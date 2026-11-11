# NATIVE-BASH-PRESERVATION — lane evidence

Branch `task/native-bash-preservation-20261111`, worktree
`.worktrees/native-bash`, base `master` (`b29e10582`, after PD-42 #720 landed).
Pinned host `0.2.0-rc.2 @ 639ed01539`. `CORE PATCH BUDGET = 0` — the pinned tree
is imported, never modified.

## The problem this lane fixes

Alpha.5's invariant (ADR D2 / A5-NATIVE-01/02, A5-BOUNDARY-01) is: **replace a
native tool's execution backend, never the tool itself**. The governed Preview
shipped three Team-authored `bash` ToolDefinitions instead:

| # | file | name the model saw | mechanism |
|---|---|---|---|
| 1 | `packages/runtime/src/plugin/live/confined-bash-tool.mjs` (PD-12) | `bash` | confined `subprocess`, `bash -c <body>` |
| 2 | `packages/runtime/src/plugin/live/confined-terminal-tool.mjs` (PD-13) | `bash` | PD-13's confined terminal face (per-command child, **not a PTY**) |
| 3 | Team tool plane `process-family` / `a5p5-tools` | `team_bash` | argv `['/bin/sh','-c',command]` |

The third is what the Alpha.6 junction executed: the realm sink held **0** guard
facts while the call "succeeded".

## What replaced them

The model-visible `bash` is now the **pinned** `@deepseek-ai/dsh-tool-bash-persistent`
definition, registered through route C on the Member's isolated scope, over a
**governed persistent PTY**:

```
model → bash (pinned definition, unchanged)
      → execute (wrapped: Team admission in front, Alpha.4 lane + Alpha.6 grant)
      → ctx.terminals.spawn(owner, …)            ← team-services/terminal-pty.ts
      → pinned dsh-terminal-bash backend
      → sandboxPolicy.resolve({session})          ← NARROWED to the Member ceiling
      → sandbox.confine(argv, policy)             ← the deployment's OS profile
      → subprocess.spawnTerminal(…)               ← a real /dev/pts/N
```

New files:

* `packages/runtime/team-services/src/terminal-pty.ts` — `createGovernedPtyTerminalFace`
  (the governed `terminals` surface) and `narrowSandboxPolicy` (the ceiling law).
  It registers **no tool** and re-implements **no PTY mechanics**: it mounts the
  pinned `terminal-bash` backend through that module's own `apply` over a ctx
  facade, and wraps the pinned `TerminalSessionService` on a nested isolate.
* `packages/runtime/src/plugin/live/native-bash-tool.mjs` — the route-C module:
  imports the pinned package and calls its `apply`, intercepting only
  `tools.register` to wrap `execute`.
* `packages/runtime/src/plugin/live/native-tool-admission.mjs` — the publication
  slot for the plane's admission edge (no policy, no decision of its own).

Wiring: `a5sf-governed-realm.mjs` gains `nativeBashPty` (the **shipped**
composition in `host.ts` sets it, so the product path is the PTY path);
`install.ts` gains the `mode: 'pty'` terminal spec and mounts the PTY face;
`a5sf-realm-row.mjs` gains `nativeBashPtySpecOf`, which wins the selection when
the realm's terminal face carries the `governedPty` marker; `team-tool-plane.mjs`
does not place its own shell row when `plane.nativeBashAdopted` is set (so no
second Team shell competes with the native name), and exposes `admitNative` /
`settleNative`, which `agent-bindings.mjs` publishes per runtime Agent.

## Measured — host-free contract suite (13/13 PASS)

`node --test tests/world-factory/a5sf-native-bash-preservation.test.mjs`
→ [`host-free-contract-run.log`](host-free-contract-run.log). These are real
PTYs (`@deepseek-ai/dsh-terminal` + `dsh-terminal-bash` + `subprocess-local`),
not doubles; the enforcement provider is a recorder, so what is measured here is
the **policy contract**, not kernel enforcement.

| arm | criterion | result |
|---|---|---|
| P1 | registered `bash` is the pinned definition: same `name`, `description`, deep-equal `parameters`, same `presentCall`/`output.render`; only `execute` differs | **PASS** |
| P2 | two calls in one Member share ONE PTY: `cd kept` + `export …` survive the call boundary | **PASS** |
| P3 | a foreign session (and a *prefix* of the bound id) → typed `PTY_OWNER_MISMATCH`, **0** enforcement calls (no PTY) | **PASS** |
| P3b | face with no bound Member session → typed `PTY_OWNER_UNBOUND`, 0 PTYs | **PASS** |
| P3c | two Members → two PTY **processes** (distinct pids), second Member sees `SHARED=UNSET` | **PASS** |
| P4 | policy handed to `sandbox.confine` is `workspace-write` at the Member root + the exact session id; host `danger-full-access` is **clamped**; `read-only` never lifted; a cwd outside every root degrades to `read-only` (no guessed root) | **PASS** |
| P4b | a confiner that refuses → the call fails with `ENFORCEMENT_REFUSED` and **no PTY exists** (never an unconfined shell) | **PASS** |
| P5 | a retained PTY whose revision is no longer current → typed `PTY_POLICY_STALE`/`PTY_CEILING_STALE`, the session is killed, 0 sessions remain | **PASS** |
| P5b | a face installed under a superseded revision refuses at the boundary (`PTY_CEILING_STALE`), 0 enforcement calls | **PASS** |
| P6 | allow ⇒ admission once, native body once, settle `succeeded` | **PASS** |
| P6b | deny ⇒ **0** native executions, **0** PTYs, no file side effect | **PASS** |
| P6c | no published edge ⇒ typed `A5_NATIVE_ADMISSION_UNAVAILABLE`, 0 execution | **PASS** |
| P7 | route C selects the native module only for a face carrying `governedPty`; the selector refuses any face without it | **PASS** |

Regression suites re-run green in this worktree: `a5sf-native-route-c` (8),
`a5sf-governed-preset` (14), `a5sf-pd12-bash-governance` + `a5sf-pd13-terminal-read-axis`
+ `a5sf-dual-plane` (74 total, 0 fail), `a5sf-assembly`/`a5sf-p2-wiring`/`a5sf-pd14`/
`a5sf-pd15`/`a5sf-pd19` (70 total, 0 fail). `check-install-manifest` reports the
**baseline** 14 pre-existing issues with the lock leg PASS (master carries the same 14).

## NOT MET on a real Host — stated as measured, not re-labelled

The acceptance requires **two real-Host runs** with a fresh `DSH_HOME` proving
PTY persistence, exact Member binding, real OS ceiling refusal and Alpha.6
approval of the **native** call. **This lane did not obtain them.** Measured
cause, not a judgement:

* the only live harness that drives the **governed realm** (`a5sfGovernedRealm: true`)
  is `dev/agent-workflow/evidence/a5sf-pty-devlive/` — its nine runs measured the
  **ungoverned** product PTY (no ceiling) through a probe tool;
* the only live harness that drives **Alpha.6 approval + the plane takeover** is
  `tests/kits/c1-leader-approval-smoke/`, and its team row config declares **no**
  `a5sfGovernedRealm` (`teamRowConfig()` → no such key), so it never mounts the
  governed PTY face and therefore never exercises `nativeBashPtySpecOf`;
* one run of either needs a fresh `DSH_HOME`, a mock-model deployment, a
  blueprint carrying `memberIoCeilings`, and a driver that asserts on the tool
  result — the two harnesses would have to be merged, which was outside this
  round's remaining budget.

Consequently these criteria are **NOT MET**, with the cause above: real-OS write
refusal attributable to PTY/Member/call, the `danger-full-access` clamp measured
against a live `sandbox` provider, live Alpha.6 allow-once / deny-zero on the
**native** call, and the cancellation/timeout/background contract under a live
Host. The host-free suite measures the same properties at the policy layer and
must not be reported as their substitute.

### The next step that would close it

Point the `a5sf-pty-devlive` driver at a row whose config carries
`a5sfGovernedRealm: true` (the shipped product row already does) plus a v5
blueprint with `memberIoCeilings`, and keep the C1 kit's Alpha.6 arms for the
approval leg: the probe Member's `bash` then resolves the pinned definition over
the PTY face, and every arm the suite already checks host-free becomes a live
measurement.

## Known limits, disclosed (not claimed away)

* **No read axis on this path.** The OS profile is the boundary; a PTY cannot
  ride the lexical read admission PD-13's face performed. A `cat` of a file the
  compiled read lane denies is the OS profile's problem here (the PD-13 suite
  keeps pinning that face's own read axis).
* **`SandboxExecutionPolicy` carries one `workspaceRoot`.** A Member lane with
  several write roots is narrowed to the deepest root containing the session
  cwd; a lane with none degrades to `read-only`. Never widened, never guessed.
* **`pwsh`** stays the plane's row: no native owner exists for that name.
* **`backgroundJobs`** still requires `names.bash === 'bash'`; the adopted native
  shell does not enable it.

## Retired, not deleted

`confined-bash-tool.mjs` (PD-12), `confined-terminal-tool.mjs` (PD-13),
`team-services/terminal.ts` (PD-13's face) and the plane's shell row carry a
`RETIRED FROM THE PRODUCT PATH` banner. Their files, their specs and their own
suites remain; the product path simply no longer selects them.

## Docs-lane paragraph (for `RELEASE-NOTES-0.1.6.md` — not edited by this lane)

> **Native bash preservation.** A governed Member's `bash` is now the host's own
> persistent-shell tool with the Team ceiling on its execution backend, not a
> Team re-implementation. State (`cd`, exports) survives across calls in a real
> PTY bound to exactly one Member session; a call from any other identity is
> refused before a shell exists. The shell runs under the deployment's sandbox
> profile with the Member's write root, and a `danger-full-access` default is
> clamped. A change of the Member's policy generation terminates the old shell
> instead of letting it keep its old permissions. Team approval still wraps the
> call: an allowed call runs once, a denied call runs zero times. Known limit:
> this path enforces what the OS profile enforces — it does not add a read
> allowlist.
