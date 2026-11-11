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

## Measured — host-free contract suite (15/15 PASS)

`node --test tests/world-factory/a5sf-native-bash-preservation.test.mjs`
→ [`host-free-contract-run.log`](host-free-contract-run.log) (15/15). These are real
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
| P8 | the module mounts through the **Cordis loader** (`ctx.plugin(module, {})`): config resolution passes, one `bash` registered; the module exports **no** `Config` (the loader's configless branch). Negative control: reinstating `Config = Object.freeze({})` reproduces the live `reading 'validate'` failure | **PASS** |
| P8b | every route-C-mountable `live/*.mjs` either omits `Config` or exports a real `~standard` schema (the scan asserts it includes the native bash module) | **PASS** |

Regression suites re-run green in this worktree: `a5sf-native-route-c` (8),
`a5sf-governed-preset` (14), `a5sf-pd12-bash-governance` + `a5sf-pd13-terminal-read-axis`
+ `a5sf-dual-plane` (74 total, 0 fail), `a5sf-assembly`/`a5sf-p2-wiring`/`a5sf-pd14`/
`a5sf-pd15`/`a5sf-pd19` (70 total, 0 fail). `check-install-manifest` reports the
**baseline** 14 pre-existing issues with the lock leg PASS (master carries the same 14).

## Real-Host acceptance: the driver exists; the blocker was OURS

When this lane first reported, it stated the live arms NOT MET because *no
harness drove the governed realm*. That cause is now **superseded**: the
joint-acceptance lane (PR #731, `tests/kits/joint-acceptance-20261111/`) built
the missing instrument — one Team, one v5 blueprint carrying both families and
the governed realm, A6 approval, plane takeover, `boot-preflight`-gated, two
agreeing runs — and drove **this lane's** mount path live. Two findings:

1. **The mount failed at activation for both Members, both runs**:

   ```
   team_create_member → TEAM_RUNTIME_DURABLE_WRITE_FAILED
     → SERVICE_MOUNT_FAILED: native tool module re-mount failed:
       Cannot read properties of undefined (reading 'validate')
   ```

   Cause: this module exported `Config = Object.freeze({})`. The Cordis loader
   resolves config as `if (!runtime.Config) return config` else
   `runtime.Config['~standard'].validate(config)` (`vendor/cordis/lib/index.js`
   `resolveConfig`), so a non-schema object thrown into that slot fails at
   activation and takes the Member's durable write with it. The host-free suite
   missed it because it called `apply()` directly instead of mounting through the
   loader. **Fixed** by exporting **no** `Config` at all (the loader's own
   configless branch; `mount.ts` requires only `name` + `apply`), and **pinned**
   by P8 (a real `ctx.plugin(module, {})` mount through the Cordis loader, which
   reproduced the exact live error when `Config` was reinstated) and P8b (every
   route-C-mountable `live/*.mjs` either omits `Config` or exports a real
   `~standard` schema).
2. **`parameter-permission` currently routes to the Leader**, so the Alpha.6 half
   of the junction is being corrected in its own lane. **This lane's native bash
   must not assume the Officer arc is correct**: its admission seam takes
   whatever decision the plane's `decide` returns and consumes/settles it; it
   invents no approval semantics of its own.

Also recorded from the joint run, because it strengthens this lane's result:

* with the **fs-only** diagnostic preset, the PD-42 ceiling repair is confirmed
  **live**: a write inside the Member root produces an ALLOW fact, a write
  outside produces `IO_WRITE_DENIED` with zero bytes. The **realm side works**;
  the remaining red is on the mount/native-bash side, not the ceiling side.

**NOT MET, now for one concrete reason (not a missing instrument):** the two
real-Host runs of the **joined** acceptance. This lane's fix (no `Config`,
loader-path tests) must be re-driven by `tests/kits/joint-acceptance-20261111/`
after the approval-lane fix lens `J05`/`J06` lands. Until that re-run, these
remain NOT MET:

| criterion | why it is still open |
|---|---|
| PTY persistence + exact Member binding measured **live** | mount now passes validation host-free; live re-run pending |
| real-OS write refusal attributable to PTY/Member/call | realm side proven live **without** the PTY face (fs-only preset); the PTY leg needs the joined re-run |
| the `danger-full-access` clamp against a live `sandbox` provider | same |
| Alpha.6 allow-once / deny-zero on the **native** call | blocked on the `parameter-permission` routing fix (`J05`/`J06`), not on this lane |
| cancellation / timeout / background under a live Host | not yet exercised |

## Known limits, disclosed (not claimed away)

* **No read axis on this path.** The OS profile is the boundary; a PTY cannot
  ride the lexical read admission PD-13's face performed. A `cat` of a file the
  compiled read lane denies is the OS profile's problem here (the PD-13 suite
  keeps pinning that face's own read axis).
* **`SandboxExecutionPolicy` carries one `workspaceRoot`.** A Member lane with
  several write roots is narrowed to the deepest root containing the session
  cwd; a lane with none degrades to `read-only`. Never widened, never guessed.
* **The build-time host-type trap.** `team-services` originally `import type`d
  `@deepseek-ai/dsh-sandbox` / `dsh-sandbox-policy`. That resolves in a developer
  worktree that has the host linked and fails in a clean CI install
  (`TS2307`), so the face now carries **structural mirrors** (`PtySandboxMode`,
  `PtySandboxExecutionPolicy`, `PtySandboxPolicyRequest`) — the same convention
  as `PtyBaseSubprocessSurface` and `install.ts`'s `as never`. A policy VALUE
  crosses the boundary; no host type does.
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
