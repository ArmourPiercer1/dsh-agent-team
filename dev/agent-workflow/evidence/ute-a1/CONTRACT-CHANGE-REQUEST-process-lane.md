# CONTRACT_CHANGE_REQUEST — the subprocess lane has no declaration source

**Type:** `CONTRACT_CHANGE_REQUEST` (not `CORE_SEAM_BLOCKER`: no upstream patch is needed; the host
already offers everything the family needs).

**Affected C rows:** `C-subprocess` (`bash`), `C-pty`, `C-ptc` (`run_code`), and B's rung-6 positive
control. All three are family admissions the centre cannot make today.

## What the centre requires

`ADMISSION` judges `process.exec` on a compiled PROCESS lane. Without one it refuses
`ADMISSION_AXIS_UNSUPPORTED` — deliberately: admitting a shell with nothing to judge it against
would claim an enforcement that does not exist (`ADM-18`, `ADM-24`).

## What the product can declare today

- The v4 Blueprint member ceiling is `{ read, write, network }`
  (`packages/domain/blueprint/src/blueprint-v4.ts:187-197`) — **no process lane**. It is a frozen
  closed field set.
- The product realm declaration (`a5sfMemberPolicies[].members[].ceiling`) reuses that same frozen
  shape, and its `execution.executionBoundary` (`trusted-host | confined-subprocess |
  delegated-remote`) says WHO executes, never WHAT the shell may touch.
- `shellClass` (BL-17) exists only as an install-spec field the COMPOSITION passes
  (`team-services/src/install.ts`), not as a blueprint/product declaration.

So there is no single-source declaration from which the centre could compile a process lane.

## Why the alternatives are refused

1. **Judge `process.exec` on the write lane.** Rejected: it is exactly the axis confusion the
   contract forbids (`三轴不混淆`). A shell's cwd is not a write permission, and the read/write lanes
   already have owners (the confined face's guard).
2. **Declare the process lane in the product realm declaration only.** Rejected: two declaration
   sources for one realm is the fork the mount already refuses (`REALM_DECLARATION_INVALID`).
3. **Derive the lane from `executionBoundary: confined-subprocess`.** Rejected: the boundary is a
   statement about the executor, not about path authority; deriving one from the other is inventing
   policy.

## The request

Extend ONE frozen surface so a process lane has a single legitimate source, with a schema-version
consequence the owner must rule on:

- **Option A (preferred):** add `process` to the v4 Blueprint member ceiling (`memberIoCeilings[].io.process`)
  with the same `{ mode, allow, ask, deny }` lane grammar, compiled by the same compiler. Single
  source, same law, and the realm install then forwards `compiled.process` exactly as it forwards
  `subprocess`/`web`.
- **Option B:** a new Blueprint schema version (v5) carrying the lane, with v4 worlds refusing a row
  that declares one.
- **Option C:** explicitly declare the subprocess/PTY/PTC families NOT SUPPORTED in this product
  generation. Then C's rows for those families are `UNAVAILABLE BY RULING`, not "pending", and B's
  rung 6 stays an in-process-only mechanism proof.

## Current state while the ruling is pending

The families stay **explicitly refused** (`ADMISSION_AXIS_UNSUPPORTED`), the PTY face still mounts
and still refuses an unregistered owner, and no product row can silently run a shell: the refusal is
the safe state, not a workaround.
