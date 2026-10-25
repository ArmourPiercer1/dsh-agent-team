# `packages/runtime/governance-center/` — the U6 center-assembly lane

**State (U6 PR2, 2026-10-25): ENFORCING for kernel-owned names; SHADOW for the
rest.** The governed `read` name is now KERNEL-OWNED: `src/plugin/live/team-tool-plane.mjs`
mounts the center assembly for the read family (approval table = the pb §6
feed for `read`; one-shot consume routed through `kernel.consumeOnce` bound to
the existing tool-admission face; the Guard's `kernelGuard` port carries the
post-success-drift fail-closed veto), and the old center-built read row is
REMOVED (U6-SLICE-PLAN PR2; the golden-vector gate
`packages/runtime/test/u6-pr2-read-golden-vectors.test.ts` pins the
fingerprint corpus byte-identical across the move). Every other name keeps
the config-gated SHADOW posture of PR1 — the kernel computes per-call
verdicts into an audit-only ledger and ALWAYS takes `next()` (zero authority,
sup-a §5 conditions 1/3/7/10, shadow form); that mount stays opt-in config
`teamToolPlane.centerAssembly: 'shadow'`, unset = no shadow.

**Owner: Center Integrator** (five-stage plan §S4: the Kernel/Registry/Host
Adapter are modified ONLY by the independent center-refactor owner; Family
owners collaborate through the Contribution contract only).

## What this lane is

The three target components of
`docs/plans/memo/alpha5-reset-20261025/center-assembly-architecture.md` §3,
as an inert skeleton over injected ports:

| file | component | law it carries |
| --- | --- | --- |
| `contribution-schema.ts` | Family Contribution schema | §4 six boundaries as a CLOSED world; §10.3 failure law (unknown field / bad digest / duplicate / unknown capability / unsupported version fail closed); CI-06 self-approval is unexpressable |
| `registry.ts` | `GovernedFamilyRegistry` | sup-b `g1fb-registry.mjs` law: closed schema + collision (foreign claim refused, owner kept) + generation checks; READ-ONLY candidate view; NON-AUTHORIZING (surface is exactly `register/revoke/view/candidateFor/generation`) |
| `kernel.ts` | `GovernanceKernel` | §5 state machine PREPARING→ACTIVE→DRAINING→TOMBSTONED→RELEASED/FAILED; center-owned approval table (condition 1); one-shot consume THROUGH the injected `consumeForExecution` port — the existing tool-admission face is composed, never re-implemented; CI-08 release at self-counted zero |
| `host-adapter.ts` | `HostSurfaceAdapter` | public Host seams only (scoped `tools.get`, `tools.schemas`, event `on`); observations, never verdicts; identity mint is injected |
| `index.ts` | composition | `createCenterAssembly()` over injected ports |

Live-glue counterpart: `src/plugin/live/center-shadow-row.mjs` (the shadow
row; dist-mirrored via `scripts/place-dist-glue.mjs`).

## Layer law

* NO imports from the center files this lane will later replace
  (`src/plugin/live/*` except as the reverse edge described above,
  `tool-dispatch/`, `tool-admission/`, `operation-permission/`, `control/`,
  `pa-mount-registry.mjs`) and NO imports of Host internals or upstream
  packages. Every external force arrives as an injected port at the trusted
  assembly point (which IS an allow-listed consumer in
  `scripts/audit-a5-tool-governance-imports.mjs`). PR1 deliberately registers
  this lane as **zero** new tool-governance import edges: the binding of the
  kernel's ports to the concrete `tool-admission` / `tool-dispatch` faces is
  a PR2 reviewed consumer registration, not an accident here. PR2 LANDED
  that binding at the trusted assembly point (`team-tool-plane.mjs` mounts
  the read family's kernel: consume port = the tool-admission one-shot face,
  approval table = the pb §6 feed; `agent-bindings.mjs` forwards the
  `kernelGuard` port into the ALREADY-LISTED `installScopedToolGuard` seam —
  no new production consumer file beyond the fs-family lane's single booked
  effect-grammar edge).
* CORE PATCH BUDGET: 0 — public seams of the pinned Host only
  (`tests/paths.mjs`).

## Protected center-file set (PR5 will machine-enforce; PR1 declares)

`packages/runtime/tool-dispatch/**`, `packages/runtime/tool-admission/**`,
`packages/runtime/operation-permission/**`, `packages/runtime/control/**`,
`packages/runtime/src/plugin/live/pa-mount-registry.mjs`, and this lane's
`kernel.ts` / `registry.ts` / `host-adapter.ts` /
`contribution-schema.ts` — Family PRs must not modify them; center-interface
changes ride separate reviewed PRs (five-stage §S4 / fitness §10.5).

## Tests

`packages/runtime/test/u6-pr1-*.test.ts` (C1): schema negative matrix
(each plant RED-first with a heal/sensitivity leg), registry collision +
generation + non-authorizing surface, kernel state machine + approval-table
ownership + one-shot consume, and the shadow row's inertness (always-next,
untouched exec/result, audit-only ledger, planted-bad-guard sensitivity).
C2 parity (`tests/world-factory/u5-canary-runner.mjs --suite u6-shadow`)
runs shadow ON vs OFF on the pinned Host and compares the native result
ledger and oracle effects.
