# SCOPE — the Subprocess/PTY promise: `allow`/`deny`, never per-call `ask`

> ## STATUS: **APPROVED BY OWNER (2026-11-24)**
>
> The owner formally approved this scope statement in review `20261124-2120` ruling 1. The approved
> promise, verbatim, is:
>
> > **This generation promises `allow`/`deny` for Subprocess/PTY. Per-call `ask` for process execution is
> > NOT supported and remains fail-closed.**
>
> It is a **PRODUCT SCOPE** ruling, not a defect report, and it changes **no behaviour**: the product
> already refuses the process `ask` leg and keeps refusing it. Process Ask is **`UNSUPPORTED BY PRODUCT
> RULING`** — the same class as PTC (`ADR-ptc-unsupported.md`) — and no product byte, test assertion or
> upstream patch is part of this scope statement. A future generation that wants per-call process `ask`
> support needs **a new product contract and a process boundary design** (`OWNER-DECISIONS.md`,
> round 106).

- **Dated:** 2026-11-24 (real UTC) · branch `vnext/a1-cut` · PR **#822 DRAFT, unmerged**
- **Approved at:** HEAD `563feac139e87e7cc3269d3d4d799afc0b676568` (round 106; the documentation commit
  implementing the approval is its child). The refusal evidence this file cites was measured on both pinned
  hosts at round 102's HEAD `10d8a67aeb7e189011faf2c131a73aa33b76fac3`.
- **Decision owner:** owner. **Implementers must not read it as a licence to change code.** No product byte,
  no test assertion, no upstream patch is part of this scope statement.
- **Related, unchanged:** the receipt ADR (`ADR-approved-ask-receipt.md`), the acceptance report
  (`D-ACCEPTANCE-REPORT.md`, current table row 30), the capability matrix (`CAPABILITY-MATRIX-C.md`,
  C-subprocess / C-pty / the `ask` row), and the PR draft (`PR-BODY-draft.md`, scope section).

## 1. The declared promise, in one sentence

> **This generation promises `allow`/`deny` for Subprocess/PTY. Per-call `ask` for process execution is
> NOT supported and remains fail-closed.**

Two consequences follow directly, and both are already true in the code:

1. **`allow` is a live promise.** A compiled `bash` binding with `authorization: 'allow'` under a declared
   `executionBoundary: confined-subprocess` runs the command under the OS sandbox, and the same call twice
   reuses one persistent governed shell. This is measured, not asserted (§3).
2. **`deny` is a live promise.** A compiled `deny` refuses before any process exists — on the confined
   subprocess face and on the governed persistent PTY alike (`ADMISSION_EXECUTION_DENIED`;
   `SUBPROCESS_PROCESS_DENIED`; `PTY_PROCESS_DENIED`). Out-of-lane effects are refused by the OS profile,
   not filtered by the product (§3).
3. **`ask` is NOT a promise.** A process call whose compiled disposition is `ask` must not be described as
   "supported", "working", "pending a small fix", or "proven live". It is **not available this generation**.
   It fails closed: no process is created, no byte is produced, and the settlement is `FAILED` (§2, §4).

## 2. What is explicitly NOT promised: per-call `ask` for process execution

The process `ask` leg is **not supported** in this generation. The reasoning is a product-scope decision,
not a defect report:

- **The live chain cannot reach the verifier.** On both pinned hosts the worker's `bash` with
  `authorization: 'ask'` does raise a real durable Control request; the router qualifies it as an Alpha.6
  case; the Officer allows it through the real control path; the one-shot grant is consumed. Then the
  persistent-`bash` tool's own backend lookup fails — the realm that the v5 **per-tool** `bash` binding
  lands on carries **no PTY terminal spec**, so no backend is registered under the name the tool asks for.
  The failure is raised **before** the governed PTY face's `spawn`, and therefore **before** the process
  receipt verifier can run. The chain that DID run is real and must not be described otherwise: a real
  durable ask was raised, the real Officer allowed it through the real control path, and the one-shot
  grant **was consumed**; then the PTY spawn failed with the host's own `NO_BACKEND` error **before any
  process existed**.
- **The refusal is fail-closed, and that is the desired safe direction.** Zero bytes are written, no
  process is created, and the settlement is `FAILED`. Nothing is auto-approved, nothing is widened, and no
  lane is promoted. **The settlement is `FAILED`, not `REFUSED`/`not-started`:** this was not a call that
  never started — its ask→approval→grant consumption happened for real, and the body failed at the
  backend lookup. Claiming `REFUSED`/`not-started` would erase the evidence that the approval was spent.
- **This is not an rc.5 drift.** The identical error occurs on rc.2 and rc.5, at the same product
  composition point; it is an assembly gap in this candidate, not a regression introduced by the target
  host upgrade.
- **An FS approval is never a process permission.** The R3 `ApprovedAskReceipt` is **not** extended to the
  process face **as a declared support promise**. A receipt minted for a file operation must never be read
  as permission to bypass the OS sandbox: the kernel profile is compiled from the lanes, and an approval
  may narrow a call, never widen a kernel bit. The round-99 process-face receipt work exists only as an
  in-process **MECHANISM** with its own spawn-point verifier; it is **not** product-proven and is **not**
  the promise this generation makes. The only process promise is `allow`/`deny`.

## 3. What IS proven for the process face (the promise that stands)

All live rows are `DEV-LIVE` (two agreeing boots) or in-process `MECHANISM`; **none is PRODUCT-PROVEN**,
because no bound executable gate exercises it (`V@B=yes` is reserved for such a gate). Sources:
`D-ACCEPTANCE-REPORT.md` rows 8/10/29/31, `CAPABILITY-MATRIX-C.md` C-subprocess / C-pty rows, and the
`d2`/`d3`/`d4` driver evidence.

| promise | what is measured | evidence |
| --- | --- | --- |
| **Live persistent `bash` under the OS sandbox** | A governed Member's first `bash` call is admitted on `process.exec`, writes durable shell state, and a **second turn reuses the SAME shell** and reads the state back — on **both** hosts, two agreeing boots. The governed preset mounts the host's own `dsh-tool-bash-persistent` (`backendType: a5sf-governed-shell`) beside the one-shot baseline. | `d3:persistent-subprocess` (`D-ACCEPTANCE-REPORT.md` row 10; matrix C-subprocess / C-pty, round 76) |
| **Out-of-lane refusal by the OS profile** | The same live boot attempts a write outside the compiled lane: the OS answers `Read-only file system`, **0 bytes on disk**, while the in-lane file is written. The dangerous effect is refused wholesale, not filtered. | `d3:persistent-subprocess` (row 10); `SLICE-39` for the search-path shape (`PATH_NESTED_DENY_UNEXPRESSIBLE`) |
| **PTY confinement** | The PTY face refuses an unregistered owner (`OWNER_NOT_LIVE`), refuses a compiled `deny` before `raw.spawn` (`PTY_PROCESS_DENIED`), and refuses a spawn not covered by a process receipt (`PTY_PROCESS_RECEIPT_REFUSED`). The kernel profile is compiled from the three lanes and `narrowSandboxPolicy` never widens it (`danger-full-access` still clamps to at most `workspace-write`; a pure-`ask` lane stays `read-only`). | `SLICE-33`; `ADM-177`; matrix C-pty (rounds 76/99) |
| **Stop** | A Member turn parked at a durable `admission-ask` is STOPPED through the product's public `session/cancel`: the centre's own `ADMISSION_STOPPED` appears in the tool result and the invocation-authority fact, with a `REFUSED` / `not-started` settlement, no execution fact, never a completion and never `UNKNOWN`. A Stop while a process `ask` is pending leaves zero bytes. **The OS-child-kill half of Stop is not claimed here**; and `d4:ask-stopped` is a live negative on the process row, not a positive process execution. | `d2:stop` (`D-ACCEPTANCE-REPORT.md` row 8); `d4:ask-stopped` (row 29); `ADM-57`/`ADM-58` |

Boundaries that limit the table above, stated so the promise is not over-read:

- The persistent shell is **the host PTY's**; the product governs its spawn and its OS profile, not every
  command typed into the already-created session.
- The governed PTY cannot compare a per-command digest (the shell exists before the command text); only the
  confined child face, which spawns `argv[program, '-c', command]`, can bind `commandSha256`.
- The model on every live row is the scripted mock; no real-model interleaving of a process call is measured.
- `P0-2` (pre-dispatch Stop observation) is **CLOSED by owner ruling (round 106)** — see §6.

## 4. The exact current refusal evidence (both hosts)

Source of truth: `D-ACCEPTANCE-REPORT.md` row 30 and its ROUND 102 section; `PROBE` output under
`dev/agent-workflow/evidence/ute-a1/round102/d4-rc2/` and `.../d4-rc5/`. The judge is
`d4:ask-execute-process`; the probe is `probe-d4-routed-wake.mjs --boots 2`.

| field | rc.2 (control) | rc.5 (target) |
| --- | --- | --- |
| selector | `TEAM_TEST_HOST` unset (host `legacy`) | `TEAM_TEST_HOST=next` (host `next`) |
| pin | `639ed015397290b3745d163aafe02ffee4aa3f84` (`0.2.0-rc.2`) | `9c2670d3bce5275e0d1610272958121af87787bb` (`dsh-v0.2.2-rc.5`) |
| ask chain | real durable ask → real Leader/Officer allow → one-shot grant consumed | identical |
| failure | `Error: no PTY backend registered for "a5sf-governed-shell"` (`packages/terminal/terminal/src/index.ts:159`, `TerminalError` code `NO_BACKEND`) | **same error** (`…/terminal/terminal/src/index.ts:140`, same code) |
| process created | **none** — thrown by the tool's backend lookup before the governed PTY `spawn` | **none** — same |
| bytes | **0** | **0** |
| receipt verifier | **never reached** | **never reached** |
| settlement | **`FAILED`** | **`FAILED`** |
| verdict | **REFUTED** (fail-closed) | **REFUTED** (fail-closed) |

Product-side cause: the governed PTY face is created only when a PTY terminal spec is passed
(`packages/runtime/team-services/src/install.ts:609-619`), and the realm that a v5 **per-tool** `bash`
binding lands on carries none. Measured and ruled out as the cause: an empty `a5sfNativeToolModules` (it
breaks Member activation) and the ceiling shape (an `ask` nested inside an `allow` is not expressible).
The v4 D3 world mounts the same face successfully with a `bash` binding whose disposition is `allow`, so
the difference is in the composition/activation path, not in the receipt (`ADR-approved-ask-receipt.md`
§"LIVE status of the process face", lines 198-223).

## 5. What a future generation would need (and nothing less)

Per-call process `ask` becomes a supportable promise only when **both** of these exist; either one alone
is insufficient, and neither may be faked by widening a lane:

1. **A governed PTY backend on the binding realm.** The v5 per-tool `bash` binding must land on a realm
   that actually carries the PTY terminal spec (the `ptyTerminalSpec` path that creates the governed face,
   `install.ts:609-619`), so the persistent-`bash` tool's backend lookup resolves
   `a5sf-governed-shell` **before** the receipt verifier runs. Without this, no verifier can ever be
   reached, and every `ask` is a `NO_BACKEND` failure no matter how correct the receipt is.
2. **A process-scoped receipt that cannot widen the kernel profile.** The receipt must bind the tool
   (`bash` only), the compiled `executionBoundary`, the `implementationOrigin`, the composition's fixed
   shell class, and — where a command exists — the exact `commandSha256`; it must be verified at the
   governed spawn point **before any process exists**. It must prove **this** execution's consumption
   only, must never satisfy a call from another execution, member, face or boundary, and must never add a
   writable, executable or kernel bit: the kernel profile stays the lane-compiled one, and
   `narrowSandboxPolicy` remains the only narrowing operation. The PTY's inability to compare a
   per-command digest (it has no command at spawn time) must be stated as a boundary of the promise, not
   papered over.

Two further facts any future promise must carry: the **PTY and confined child are different spawn points**
with different verifier capabilities, and a receipt covers **the spawn, not subsequent commands** typed
into an existing governed session.

## 6. P0-2 is CLOSED by the owner's ruling (round 106)

`P0-2` was independent of the process `ask` decision. It is **no longer open**: the owner ruled the
lawful "no settlement" boundary (review `20261124-2120` ruling 2, recorded verbatim in
`OWNER-DECISIONS.md`), which is alternative (b) below, so no upstream seam is needed:

- **The owner's law, verbatim:**
  `No Admission + No Body Start => No UTE Settlement (lawful)`; `Admission Exists => Terminal Settlement
  Required`; `Body started + unconfirmable => UNKNOWN (existing rule)`.
- **What the product does, tested:** the host's `ABORTED_BEFORE_DISPATCH` return is read, never replaced
  (no fabricated `tools/result`); `LEDGER_EXECUTION_UNBOUND` still refuses an execution fact without an
  admission; `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` is a **diagnostic report only**, never a settlement;
  a pre-admission cancel leaves no body, no provider call, no grant consumption and no centre state row
  (`SLICE-40`); and an admitted-then-stopped call must record its Stop and reach the terminal `CANCELLED`
  settlement (`SLICE-41`), with a source-level pin that no code path can write an execution fact without
  an admission (`SLICE-42`).
- **Residual:** the observer is still not wired into a booted host's own agent loop. That is a **coverage
  limit, not an acceptance blocker**: the ruling defines what the product owes a reader when the host owes
  it no event, and the tests above implement exactly that. `RC5-MIGRATION.md` §7 keeps the wiring gap on
  the record.

## 7. What changes, and what does not

- **Behaviour: nothing.** The process `ask` leg is refused today and keeps being refused. This document
  writes the promise down; it does not move a byte of product code, a test assertion, or a capability
  level.
- **Declared promise: APPROVED, and this is the change.** The owner approved the wording in review
  `20261124-2120` ruling 1. The promise table in `PR-BODY-draft.md`, the C-subprocess/C-pty/`ask` rows in
  `CAPABILITY-MATRIX-C.md`, the single acceptance status table in `D-ACCEPTANCE-REPORT.md`, and the
  process-face paragraph in `ADR-approved-ask-receipt.md` all point here, and none of them may claim
  more. Process Ask carries the same machine-visible class as PTC: **`UNSUPPORTED BY PRODUCT RULING`**.
- **No upgrade path is promised.** §5 lists the two preconditions; it does not schedule them, size them,
  or claim they are close. A future generation that lands only one of them still has no process `ask`
  promise.
