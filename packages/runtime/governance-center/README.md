# `packages/runtime/governance-center/` — the U6 center-assembly lane

**State (U6 PR4, 2026-10-26): ENFORCING for kernel-owned names; SHADOW for the
rest.** Kernel-owned names are now the governed `read` name (PR2) AND the jobs
management trio `job_output / job_list / job_kill` (PR4, ARC-C): the trio is
the FIRST family admitted through the schema's `named-bridge` backing —
`src/plugin/live/jobs-family-bridge.mjs` carries the bridge body VERBATIM
(byte-identity digest `71705d6e…` against the sup-b PoC-3 master extract) and
contributes its center face (row defs + the `dsh.jobs-family` contribution)
through the SAME closed schema and Registry as every other family; the plane's
former direct trio injection is REMOVED (no dual ledger: one kernel table,
one consume port, one guard — pinned by
`packages/runtime/test/u6-pr4-jobs-bridge.test.ts` groups A–F, 24/24). The
jobs-gateway assembly and `pa-mount-registry.mjs` are imported UNMODIFIED
(CI-08; E1 pins both files by sha). The governed `read` name remains
KERNEL-OWNED: `src/plugin/live/team-tool-plane.mjs`
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

**FIX-K (2026-10-26, external-audit remediation)** closed five kernel-safety
findings (K1–K5) while keeping the lane inert and enforcement OFF-by-default.
See the *Kernel safety contract (FIX-K)* section below for the state model,
approval keying, consume semantics and the fail-closed list; RED-first test
evidence per finding lives in
`dev/agent-workflow/evidence/u6-fixk-20261026/logs/`.

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
| `kernel.ts` | `GovernanceKernel` | §5 state machine PREPARING→ACTIVE→DRAINING→TOMBSTONED→RELEASED/FAILED; center-owned approval table (condition 1) keyed by (scopeKey, nativeName) AND bound to its owning candidate (FIX-K K1/K4); one-shot consume THROUGH the injected `consumeForExecution` port with a synchronous in-flight reservation (FIX-K K2) — the existing tool-admission face is composed, never re-implemented; CI-08 release at a SELF-COUNTED zero, absent port ⇒ `LIFECYCLE_PORT_MISSING`/`UNCOUNTED` (FIX-K K3) |
| `host-adapter.ts` | `HostSurfaceAdapter` | public Host seams only (scoped `tools.get`, `tools.schemas`, event `on`); observations, never verdicts; identity mint is injected |
| `index.ts` | composition | `createCenterAssembly()` over injected ports (passes the kernel `mode` through; default `'shadow'`) |

Live-glue counterpart: `src/plugin/live/center-shadow-row.mjs` (the shadow
row; dist-mirrored via `scripts/place-dist-glue.mjs`; K5 makes its ledger
bounded and released on dispose).

## Kernel safety contract (FIX-K, 2026-10-26)

External-audit remediation; each law is RED-first test-pinned by
`test/u6-fixk-kernel-safety.test.ts` / `test/u6-fixk-shadow-ledger.test.ts`.
Enforcement stays OFF everywhere: the kernel factory defaults to
`mode: 'shadow'`, the glue default stays `centerAssembly: 'off'`, and the
shadow row still ALWAYS takes `next()`.

* **State model (K3).** Same §5 matrix, plus: `release()` checks transition
  legality first, then the lifecycle port — an ABSENT port refuses
  `LIFECYCLE_PORT_MISSING` and its detail records `UNCOUNTED` (a kernel never
  reports a clean in-flight zero it did not count, in ANY mode); a counted
  non-zero refuses `LEASE_OPEN` (CI-08); a counted zero releases. The FACTORY
  is stricter: `mode: 'enforcing'` without an injected
  `DispatcherLifecyclePort` THROWS at construction (fail-fast at the trusted
  assembly point). `mode()` reports what the factory built.
* **Approval keying + source binding (K1 + K4).** Key =
  `(scopeKey, nativeName)` — never the name alone. `CallFacts` carries the
  `scopeKey` of the HostSurfaceAdapter's scoped resolution; absent ⇒
  `SCOPE_UNVERIFIED` (refuse) both in `decide` and on the owner-write
  surface. `addApprovalEntry` binds to a LIVE registry candidate
  (`{scopeKey, nativeName, definitionIdentity, familyId}`; no live claiming
  candidate ⇒ `NO_CANDIDATE`) and snapshots
  `familyId + boundGeneration + boundSourceDigest`. `decide()` re-validates
  the binding against the live registry on EVERY call: tombstoned/missing
  owner (or the claim held by a different family) ⇒ `CANDIDATE_REVOKED`;
  re-registration at a new generation / re-digest ⇒ `STALE_GENERATION`;
  dynamic not-revalidated source ⇒ `NOT_VERIFIED_SOURCE` (condition 9).
  `dropApprovalsForFamily(familyId)` is the owner-surface drop the assembly
  point runs alongside `registry.revoke`; a re-registration NEVER resurrects
  dropped entries (a new generation earns approval only through a fresh
  `addApprovalEntry` or a generation-checked `replaceApprovalEntry`, which
  re-binds to the current live candidate). There is deliberately no
  registry→kernel event edge (PR1's zero-new-edge property is kept); the
  per-decide re-validation is the fail-closed backstop even if a caller
  forgets the drop.
* **Consume semantics (K2).** `free → in flight → burned`: the grant id is
  reserved SYNCHRONOUSLY before any `await`, so a second concurrent call
  refuses `GRANT_IN_FLIGHT` without touching the port (exactly one
  presentation can reach it — proven under `Promise.all` with a deferred
  port). The burn is OUTCOME-INDEPENDENT: once presented, the id stays
  burned — a port refusal (`GRANT_REPLAY` afterwards, never a
  re-presentation) and even a port throw (error propagates, id stays burned)
  do not re-arm it. JUSTIFICATION: the port owns the grant ledger and its
  state is not observable from the kernel; a "failed" presentation may
  already have committed there (or may commit after a timeout), so
  re-presenting risks exactly the double-consume the one-shot law prevents.
  This RETIRES the PR1 leg "a FAILED port consume does not burn the id".
* **Bounded shadow ledger (K5).** `center-shadow-row.mjs`'s per-install JSONL
  writer carries a row budget (`maxLedgerRows`, default 5000) and a byte
  budget (`maxLedgerBytes`, default 1 MiB); at the first write that does not
  fit it appends ONE terminal marker row (`leg: 'shadow-ledger-capped'`,
  budgets + written counts) and stops appending to the file —
  stop-with-marker, no rotation. The `observe` sink keeps every row (its
  bound belongs to the caller) and the waterfall still takes `next()` once,
  value untouched (capping is an audit-channel event, never a flow event).
  `dispose()` CLOSES the writer; counters live in the install closure, so
  nothing module-wide grows.
* **Fail-closed refusal list.** `KERNEL_NOT_ACTIVE`, `SCOPE_UNVERIFIED`,
  `NOT_VERIFIED_SOURCE`, `CANDIDATE_REVOKED`, `STALE_GENERATION`,
  `NO_CANDIDATE`, `IDENTITY_UNVERIFIED`, `IDENTITY_MISMATCH`,
  `DUP_APPROVAL_ENTRY`, `NO_APPROVAL_ENTRY`, `GRANT_REPLAY`,
  `GRANT_IN_FLIGHT`, `NO_CONSUME_PORT`, `LIFECYCLE_PORT_MISSING`
  (`UNCOUNTED`), `LEASE_OPEN`, `ILLEGAL_TRANSITION` — every one a typed
  refusal that changes nothing; `decide` verdicts never mutate state.

## Layer law

* NO imports from the center files this lane will later replace
  (`src/plugin/live/*` except as the reverse edge described above,
  `tool-dispatch/`, `tool-admission/`, `operation-permission/`, `control/`,
  `pa-mount-registry.mjs`) and NO imports of Host internals or upstream
  packages. Every external force arrives as an injected port at the trusted
  assembly point (which IS an allow-listed consumer in
  `scripts/audit-a5-tool-governance-imports.mjs`). PR1 deliberately registers
  this lane as **zero** new tool-governance import edges and FIX-K KEEPS
  that property: the kernel gained no new imports, the revoke-invalidation
  path is a kernel-OWNER surface (no registry→kernel event edge). PR2 LANDED
  the binding of the kernel's ports to the concrete `tool-admission` /
  `tool-dispatch` faces at the trusted assembly point (`team-tool-plane.mjs`
  mounts the read family's kernel: consume port = the tool-admission one-shot
  face, approval table = the pb §6 feed — scope-keyed per FIX-K K4, every
  call carrying the scoped-resolution scopeKey); `agent-bindings.mjs`
  forwards the `kernelGuard` port into the ALREADY-LISTED
  `installScopedToolGuard` seam — no new production consumer file beyond the
  fs-family lane's single booked effect-grammar edge.
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
The kernel suite rides the FIX-K contract (scoped+bound entries, counted
release, outcome-independent burn).
`packages/runtime/test/u6-fixk-*.test.ts` (C1, FIX-K): RED-first legs for
K1–K4 (revoke binding, consume reservation race under real concurrency,
required lifecycle port, scope+source keying) and K5 (row/byte caps,
stop-with-marker, release-on-dispose). RED/GREEN logs:
`dev/agent-workflow/evidence/u6-fixk-20261026/logs/`.
C2 parity (`tests/world-factory/u5-canary-runner.mjs --suite u6-shadow`)
runs shadow ON vs OFF on the pinned Host and compares the native result
ledger and oracle effects.
`packages/runtime/test/u6-pr4-jobs-bridge.test.ts` (C1, PR4/ARC-C): the move
law (body sha `71705d6e…`, old home = re-export edge only, bridge module
imports nothing but `node:crypto` + the contracts barrel), the closed-schema
law (named-bridge registers; provider-backed-without-bridge and
family-body-backed refuse via `schemaCode`), kernel family/owns/revoke
binding, the SAME-admission law over the real gateway assembly (approval
entries fed from the kernel table; owner trio runs with the approval lane
untouched; owner-mismatch fence measured at zero service reach), and the
frozen-file + mount-generation law with the E3 plant (identity-less disposer
destroys the current mount; the registry's identity law keeps it alive).
R1 (review) added the CI-05 fail-closed MOUNT face
(`ci05GovernedGatewayRow`, center face — gateway and bridge body stay
byte-frozen): a governed mount refuses any un-attributed job id typed
(`unattributed-job`, static detail) with ZERO host-service reach before
`checked()` can pass it, and the governed list hides un-attributed rows
through the same face; the native lane never builds the bridge (CI-03),
and the production creation-lane attribution producer does not exist at
this pin — carried as the named item, the pass-through NOT kept around
it (C1-F1..F5 measure both directions).
C2 (`--suite u6-jobs`, seven boots; authorized budget 8, spent 7): the
MEASURED live legs — `jobs:mounted` (the family places its trio rows on
a real Team mount through the closed schema, zero refusals) and
`jobs:leak-check` PASS on every mount-reached boot;
`jobs:no-second-ledger` PASSed with real governed trio traffic (7 trio
calls, Control rows 0). The EFFECT legs (real background job born,
ring-managed, honest cancel, owner fence, untreated native root trio)
stand FAIL-DISCLOSED: each boot's receipt named one harness cause
(substrate rows, sandbox disk law, transcript contamination, wrong bash
variant + ask envelope, provider duplication, required `description` —
VERIFIED fixed live at boot 7 — then Team-lane stall + ctl ring-read
race, the boot-7 causes, both named items for the next boot round).
Final status G4-CORE-PASS / BRIDGE-BLOCKED (§10.6). Full receipts:
`dev/agent-workflow/evidence/u6-pr4-20261026/`.
