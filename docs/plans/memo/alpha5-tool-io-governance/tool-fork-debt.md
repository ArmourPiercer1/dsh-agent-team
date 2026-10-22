# Alpha.5 Tool-Level Fork — Technical Debt and Exit Register
> **[2026-10-22 banner] historical / superseded-by `docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md`** — 本文档的阶段状态与采纳状态（含 PROPOSED 提案）为记录时点，当前执行以该入口为准。设计约束/需求正文**仍有效**（本 banner 不宣告设计失效）；正文未改动。

**Decision:** 2026-10-16, operator accepted a *public-seam-first, tool-level-fork fallback*.  
**Status:** CONDITIONAL / NOT YET INCURRED. No fork has been created or authorized for any specific package by a completed P0 proof.  
**Scope:** Alpha.5 Team-owned **independently registered tool adapters only**. This is a scoped exception to the repository's generic ban on vendoring modified upstream **tool** implementations, not an exception to `CORE PATCH BUDGET = 0`, upstream Core immutability, private imports, patch-package/postinstall patching, or forced weakening of I/O policy.

See [ADR](./ADR-alpha5-tool-io-governance.md) and [architecture](./architecture.md).

## A5-FORK-001 — Conditional upstream tool-fork debt

**Origin:** DSH tools such as `glob`/`grep` may call `ctx.subprocess.spawn` without the mandatory, per-Team IO confinement boundary Alpha.5 requires; `ctx.fs` currently has write-oriented sandbox controls and tool-specific read limitations. The tool must not be allowed to execute its original unconfined body as a fallback. This register does **not** assert public-seam impossibility without a P0 reproducer.

**Preferred permanent design:** register a Team-owned adapter using public, scope-safe DSH seams, with mandatory guarded dispatch and controlled FS / confined process / provider enforcement. Avoid copying upstream tool bodies wherever the public contract is sufficient.

**Automatic fallback threshold, in order:**

1. Pin the exact supported DSH baseline (currently `0.2.0-rc.2`) and demonstrate the required tool behavior + security guarantee.
2. Attempt a minimal independently registered Team Adapter over documented public tool/service interfaces; explicitly test name shadowing, original-body invocation, error/cancel, scope, PTC nested calls, and cleanup.
3. Produce a reproducible, source-linked `CORE_SEAM_BLOCKER` (required behavior, observed behavior, test, exact affected tool and upstream revision). Document why other public-composition alternatives do not close the gap. **Complexity or convenience alone is not a trigger.**
4. If and only if an **independently registered tool-level downstream fork** can close that **specific** gap *without changing upstream files/Core or importing private APIs*, use it as the pre-approved default fallback. No second architecture choice is necessary. Implement only the minimum changed tool code, in a Team-owned namespace.
5. If even a tool-level fork cannot ensure exclusive dispatch, provenance, required I/O enforcement, or supported public dependency seams, stop that feature with a precise blocker; do **not** turn the fallback into Core forking or a silent original-tool bypass.

**Mandatory debt recorded when actually incurred:** one `A5-FORK-<family>` row per fork. The row must contain:

- Public seam blocker and original minimal reproduction;
- Exact upstream package, release/SHA, provenance, license/NOTICE compliance, owner and directory;
- Full delta against upstream (preferably kept as a mechanically reviewable minimal patch against an explicitly identified upstream source), supported Host versions, and public dependency boundary;
- Scope-specific independent registration and proof the original body never executes;
- Functional parity evidence (schema, errors, streaming, cancellation, jobs, PTC and output contract where applicable) plus adversarial file/network tests;
- Upstream version-drift and security-update maintenance owner, review schedule and regressions;
- **Exit condition and cleanup owner**, migration PR/test evidence, and final removal of copied upstream tool implementation.

### Exit / repay rule

A corresponding **documented public upstream seam** must be checked at every certified DSH Host upgrade. Once a public, scope-safe seam supports an independent adapter with equivalent tool behavior and all required security guarantees, the fork is **migration-required**, not permanent architecture. Remove it in a dedicated reviewed PR, delete its copied implementation and compatibility paths, rerun P0 parity/adversarial gates, then mark the debt **REPAID** with upstream release/SHA and the removal commit. A new API alone is not proof until integration tests pass.

A blocked implementation must not be described as `REPAID`, and a merely proposed fork must not be reported as already active.

## Ledger

| Debt ID | Tool family | State | Blocker/evidence | Upstream version | Exit owner / trigger |
| --- | --- | --- | --- | --- | --- |
| A5-FORK-001 | Tool-level fork fallback policy | CONDITIONAL — no fork incurred | P0 not yet executed | DSH 0.2.0-rc.2 design baseline | Alpha.5 integrator / public-seam availability |
| *(add A5-FORK-<family> after a fork is actually used)* | — | — | — | — | — |

**Potential candidates, not incurred:** `glob`/`grep` (`dsh-tool-fs-search`), and any other individual tool for which the independent Adapter route is proven insufficient. This list is neither a blanket vendor allowance nor authorization to copy all native tools.

## Boundary and maintenance warnings

- **Team tool forks are not Core patches.** Never edit the DSH checkout or registered original tool package in place; never use package-resolution tricks to silently replace deployment-global DSH definitions. Independent Team registrations must be attributable to the intended Team scope.
- The normal ban on vendoring modified upstream remains for Core, services and unrelated packages. Only the user-ratified **tool-level** exception above exists.
- Do not let a fork silently restore older host permissions, read-all `bwrap --ro-bind / /` assumptions, or lose structured tool results.
- Do not merge this design memo as Alpha.5 implementation evidence. The fallback is a **future mechanism contingent on proof**, not a completed P0.
