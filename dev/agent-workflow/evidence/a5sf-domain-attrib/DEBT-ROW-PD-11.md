# Debt-register row — PD-11 (D1), for owner insertion

`docs/plans/active/**` is an owner/main-Agent asset (`AGENTS.md` §目录约定: "用户/主 Agent
产物，禁 worker 改动"), so this row is **filed here in the register's exact style** and not
appended to
[PRODUCT-DEBT-REGISTER.md](../../../../../docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md)
by this task. To adopt it, append the two blocks below as `PD-11` (the next contiguous id;
the invariant checks in `tests/world-factory/a5sf-debt-register.test.mjs` then cover it).

Status of the finding: **not the cause of boot #5.** The boot #5 abort was a readiness-gate
race in the evidence driver (this task's verdict is `TEST-WORLD`). This row records the
*product* behaviour that the race exposed: the product reports somebody else's storage
teardown as a domain-closed error, and keeps writing into the dead domain.

## Summary-table line

| id | face | debt | consequence | decision |
|---|---|---|---|---|
| PD-11 (D1) | Boot | A shared-domain teardown is reported as `TeamDomain is closed` and the detached boot keeps writing into it | evidence-quality | semantics |

## Detail block

### PD-11 (D1) — a shared-domain teardown is reported as `TeamDomain is closed`

- **source**: `D1` in [a5sf-domain-attrib/README.md](README.md) §3 and §7
- **true today**: the production row's `apply()` returns before its tracked `ready` promise
  settles (`packages/runtime/src/plugin/host.ts:3159`), and the rejection handler only logs
  and swallows (`host.ts:3165-3166`). The TeamDomain is opened on the **shared** upstream
  `storageDomain` facility, which another fiber owns; when that facility is disposed inside
  the boot window (loader unwind, `Fiber._reload`, a world teardown) its disposer runs
  `closeAll()` and closes the Team domain under the still-pending bootstrap
  (`tests/deepseek-harness-test-use/packages/storage/storage-domain/src/index.ts:232`).
  The next repository touch then fails as
  `TeamDomainError('NOT_OPEN', "store '<store>' operation '<op>' was rejected: the TeamDomain is closed")`
  (`packages/storage/schema/errors.ts:162-169`), which is indistinguishable from a genuine
  domain-lifecycle failure of this row. Because the bootstrap is detached, the write is
  attempted **after** the row/tree was disposed; the row-stop disposer is the only closer
  that waits for `ready` (`host.ts:3276-3321`), so an independent facility disposal is
  invisible to it.
- **not true**: that `TeamDomain is closed` identifies who closed the domain or why; and that
  a boot-window teardown is a no-op for the detached bootstrap. Neither the store/op in the
  message nor the presence of the message implicates any row's composition.
- **security consequence**: **evidence-quality** — no Member gains anything; the cost is an
  operator-facing false lead. A teardown of the host's storage plane is reported as a
  Team-domain defect, which is how one wasted start (#5 of 5) and a wrong turn toward row
  composition were produced. It can also mask a real storage failure of the same shape.
- **current backstop**: the console line `[dsh-agent-team] bootstrap FAILED: <stack>`
  (`host.ts:3168`) and the row's own `/team-remote` mount log. Neither carries the
  disposal/teardown event, so the operator cannot tell "my domain broke" from "somebody
  closed the shared facility".
- **smallest honest fix**: (a) on `NOT_OPEN`, report a distinct code/detail such as
  `TEAM_DOMAIN_TORN_DOWN` carrying the row-scope disposal state (or attach the seam error's
  own detail), so the message says the domain was closed **under** an in-flight boot rather
  than by it; (b) stop the bootstrap at the first write attempt when the row scope is already
  disposed (a disposal fence checked between write-port calls) instead of writing into the
  dead domain. Both are local to `host.ts` + `root-binding/write-port.ts`; neither needs an
  upstream change.
- **proof**: [domain-attrib.mjs](domain-attrib.mjs) E0 (only seam code `closed` produces the
  message), E2/E2b/E3 (one teardown, three different stores/ops — the message is a timing
  artifact), E7 (the 404-then-teardown sequence reproduces the recorded artefacts), E7b (a
  bootstrap that really fails answers `200 {ok:false}`, not 404).
- **blocked by**: nothing for (a)/(b); the owner decides the code/name. A positive Host
  control (the same plan under a polling health gate) is *not* required to establish the
  mechanism and was deliberately not spent (`CORE_PATCH_BUDGET = 0`, 0 starts).
- **anchors**: `packages/runtime/src/plugin/host.ts#L3159`, `host.ts#L3165-L3168`,
  `host.ts#L3276-L3321`, `packages/storage/schema/errors.ts#L162-L169`,
  `packages/storage/repositories/base.ts#L76`, `packages/storage/repositories/session-bindings.ts#L56`, `packages/runtime/root-binding/write-port.ts#L47`,
  `packages/runtime/root-binding/fresh-root.ts#L190-L196`,
  `tests/deepseek-harness-test-use/packages/storage/storage-domain/src/domain.ts#L217-L242`,
  `tests/deepseek-harness-test-use/packages/storage/storage-domain/src/domain.ts#L263-L276`
