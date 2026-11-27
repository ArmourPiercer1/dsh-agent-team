# ADR — the ApprovedAskReceipt (R3 of owner ruling 20261124-0151 §2)

- **Status:** ACCEPTED and EXTENDED twice — round 96 (every FS mutation, method by method) and
  round 99 (the PROCESS face: `bash` over the confined subprocess face and the governed persistent
  PTY). R2 (`guarded` coupling) is REJECTED. R4 stays the fail-closed default for every operation not
  named here. **The round-99 process extension is an in-process MECHANISM only and is NOT a declared
  support promise — see the scope boundary at the end of §"The PROCESS face" and
  `SCOPE-subprocess-ask.md` (**APPROVED BY OWNER, 2026-11-24**; Process Ask is
  `UNSUPPORTED BY PRODUCT RULING`).**
- **Date:** 2026-11-24 (round 94, branch `vnext/a1-cut`) · extension 2026-11-24 (round 96) ·
  extension 2026-11-24 (round 99, process face).
- **Scope:** the FIVE native FS mutations — `write`→`writeText`, `edit`→`editText`,
  `patch_text`→`patchText`, `delete_file`→`deleteFile`, `move_file`→`moveFile` — plus ONE process
  kind, `process-exec`, for the `bash` tool the product compiles a process disposition for. Each has
  its own operation kind and its own scope binding (§"Per-method scope binding" and §"The PROCESS
  face"). Every other tool keeps `IO_ASK_REQUIRES_APPROVAL`.

## Context

The owner ruling rejected R2 (a second approval-consumption path through `guarded`) and approved
R3's *direction* only with a small ADR and an executable PoC first. The measured defect (BL-30):
a Member can `ask`, the Control plane can `allow`, the one-shot grant is consumed at the host tool
guard — and the confined Provider still refuses the granted call, because the Provider reads only
its compiled lane, where the disposition is still `ask`. What must NOT be built is "the Provider
reads *some* approval that was once allowed": that is ambient, cross-execution authority.

## Decision

Introduce ONE immutable record, the **ApprovedAskReceipt**, minted by the centre at the exact
moment the one-shot grant is consumed, bound to the physical execution, and available only inside
that execution's own tool body. The Provider's `ask` branch may be satisfied by a receipt that
proves **this** effect belongs to **this** approved execution; everything else still refuses.

### Interface

`packages/runtime/member-io-policy/src/approved-ask-receipt.ts`

- `prepareApprovedFsOperation({toolName, arguments, resolver})` — pre-wait preparation of the
  approved effect for one of the five declared FS tool shapes. It returns
  `{ok:false, code:'IO_ASK_RECEIPT_TOOL_UNSUPPORTED'}` for a name outside the table (the centre mints
  nothing, so the Provider keeps R4) and `{ok:false, code:'IO_ASK_RECEIPT_UNPREPARABLE'}` for a
  recognised but malformed call (the centre denies at admission — fail-closed, nothing executes).
  `prepareApprovedWriteOperation` remains as the `write`-typed shorthand.
- `mintApprovedAskReceipt(input)` — the only constructor; refuses unless every binding field is
  present and `grant.consumed === true`.
- `registerPendingApprovedAskReceipt(executionObject, receipt)` /
  `takePendingApprovedAskReceipt(executionObject)` — execution-object-keyed staging.
- `runWithApprovedAskExecutionScope(receipt, run)` / `currentApprovedAskExecutionScope()` — the
  authorization carrier (a dedicated `AsyncLocalStorage`, **not** the attribution store).
- `authorizeAskWithReceipt(input)` — the FS Provider-side verifier; returns a typed refusal code
  from `APPROVED_ASK_RECEIPT_REFUSAL_CODES` or `{ok:true, resolved}`.
- `prepareApprovedProcessOperation({toolName, arguments, execution, processClass})` — round 99's
  process-face preparation (the only process tool shape is `bash`); `authorizeProcessAskWithReceipt`
  is the SPAWN-POINT verifier. Both are described in §"The PROCESS face".

### Binding fields (all frozen)

Schema `a5sf-approved-ask-receipt/2` (round 96 widened `/1` to a discriminated operation).

`receiptId`, `executionId` (the settlement `ExecutionId`), `callId`, `member` (`teamId`,
`memberInstanceId`, `templateId`, `instanceGeneration`), `toolName`, `toolBindingIdentity` (the
compiled ToolDefinition identity), `operation` (a discriminated union, see the table below),
`policyGeneration`, `approval` (`requestId`,
`decisionId`, `caseId|null`, `legOrdinal|null`), `grant` (`consumed:true`, `memberEpoch`,
`binderEpoch`), `bounds` (frozen `read`/`write` lane snapshot the approval was granted under).

### Per-method scope binding

The operation KIND is part of the receipt's identity: the verifier first requires an exact match
between the Provider method being asked and the receipt's kind
(`RECEIPT_OPERATION_MISMATCH`), so a receipt minted for one method can never satisfy another. Within
a kind, the scope is:

| tool → Provider method | receipt kind | corridor | what the fingerprint is a `sha256` OF | what it therefore CANNOT say |
| --- | --- | --- | --- | --- |
| `write` → `writeText(target, content)` | `fs-write` | target path | the exact `content` string the Provider is handed | nothing about the file's prior content or whether the write overwrites |
| `edit` → `editText(target, {oldString,newString,replaceAll})` | `fs-edit` | target path | the exact requested literal transformation (`oldString`, `newString`, `replaceAll`), plus a digest of that triple for a stable id | NOT the file's prior bytes and NOT the resulting bytes: whether the literal matches is decided by the Provider's own match/version guard, after the receipt is accepted |
| `patch_text` → `patchText(target, hunks)` | `fs-patch` | target path | the exact `PatchHunk[]` payload (canonical JSON) | not the prior content, not the resulting bytes, not that the hunks apply cleanly |
| `delete_file` → `deleteFile(target)` | `fs-delete` | target path | nothing but the path; `bytesReadBack:false` is recorded so no reader can believe content was verified | nothing about what the file contained — no bytes are read back by design |
| `move_file` → `moveFile(source, destination)` | `fs-move` | BOTH paths | the authored source + destination locators and both Provider canonical paths | (a→b) can never authorize (a→c): the destination is part of the operation, not a parameter |

The verifier checks each path of the operation independently: authored locator **and** canonical
path must match, the path must resolve, and it must lie inside the frozen `bounds` snapshot — one
path for the single-target methods, two for `move_file` (a missing `destinationPath` is
`IO_ASK_RECEIPT_REFUSED`, never a one-path match). `deny` is still decided before any receipt
consult on every path, including both move paths.

**Declared shapes, not shipped tools.** `delete_file`, `move_file` and `patch_text` have no shipped
native tool in this product's preset; they are the argument shapes of the rc.5 Provider methods, and
the no-shipped-tool disclosure is repeated in §"What this ADR does NOT prove". Adding them to the
centre's closed `TOOL_AXES`/`LOCATOR_KEYS` only means such a name, if ever mounted, is judged on the
existing `fs.write` axis (the same duty as `write`/`edit`) instead of being refused as unbound. It
creates no tool and admits nothing by default.

### Who mints, who reads

- **Mint:** the centre, in `installAdmissionPoint`'s `spend()` **after** `grants.binder.consume`
  returned ok (`admission-port.mjs:941`), then registers the receipt against the host EXECUTION
  OBJECT (`:964`). There is no code path that mints for an unconsumed grant.
- **Deliver:** the centre's own `tools/execute` listener takes the receipt by object identity and
  runs the body inside `runWithApprovedAskExecutionScope` (`admission-port.mjs:1023`).
- **Read:** the confined Provider's `createMemberFsGuard` ask branch only (`team-services/src/fs.ts`),
  for the five methods above, with the method's own evidence (`content` for `writeText`,
  `{oldString,newString,replaceAll}` for `editText`, `hunks` for `patchText`, the destination for
  `moveFile`, nothing for `deleteFile`). The refusal code is `IO_ASK_RECEIPT_REFUSED`
  (`team-services/src/types.ts:61`).

### Lifecycle

`UTE completes approval + pre-execution recheck → Tool Guard consumes the Grant exactly once →
centre mints the receipt → tools/execute opens the scope → Provider re-canonicalizes the real
access path and verifies the receipt covers THAT effect → body returns / Stop / lifecycle close →
receipt CLOSED, never reopened`. A second Provider effect in the same body is `RECEIPT_REUSED`; a
receipt after the body is `RECEIPT_CLOSED`; a different execution sees no scope at all.

### Why the model cannot forge it

The receipt is a module-private WeakSet brand + WeakMap state, frozen, never returned to the model,
never placed in tool arguments or the durable log. A structural copy is `RECEIPT_UNKNOWN`. The only
writers of the scope are the centre's own port and the mint function; the Provider cannot mint,
register or reopen. The record also carries no authority by itself — the grant consumption and the
durable Control decision remain the authority.

### Why it cannot leak across Members, calls or async tasks

- **Members:** the scope names the receipt's Member, and the verifier checks it against the
  Provider's own `memberIdentity` (`RECEIPT_MEMBER_MISMATCH`); a second Member's Provider inside
  the same async body is still refused (ADM-161).
- **Calls/executions:** staging is a `WeakMap` keyed by the host execution OBJECT, never a global
  `callId` map. A second execution carrying the same `callId` finds nothing (replay is refused by
  the centre's ledger before the body, ADM-155).
- **Async tasks:** a dedicated ALS scope, one `run()` per `tools/execute`, closed in `finally`;
  outside the body `currentApprovedAskExecutionScope()` is `undefined` (ADM-158). The
  attribution-only `guard-observability` store is NOT reused for authorization.
- **Revocation:** the receipt records the binder/member epochs at consumption; `revoke()` or
  `bumpEpoch()` after the grant still refuses (`RECEIPT_REVOKED`, ADM-157).
- **Policy drift:** `policyGeneration` must equal the live Provider revision
  (`RECEIPT_POLICY_GENERATION_MISMATCH`); the operation must lie inside the frozen `bounds`
  (`RECEIPT_BOUNDS_VIOLATION`).
- **Deny:** the live lane's `deny` is decided before any receipt consult; a stale receipt cannot
  override it (ADM-159).

### Failure modes

Every absence is a refusal with a stable code, never a fallback allow: no scope, structural copy,
closed/used receipt, member/tool/policy mismatch, missing binder authority (fail-closed), content
unavailable/mismatch, unresolvable path, deny, bounds violation, or a different canonical path. The
codes deliberately do NOT start with `ADMISSION_`, so a refusal raised after body entry settles as
`FAILED` at the real phase — never `REFUSED / not-started` (ADM-160).

## The PROCESS face (round 99)

A persistent shell is the widest effect a Member has, and it is NOT a path operation: the authority
is the compiled `toolBindings[].authorization` (`allow|ask|deny`) plus
`execution.executionBoundary`, never a cwd and never a path lane (`admission.ts`, axis
`process.exec`). Extending the receipt to it is therefore a separate operation kind, not a fifth
column in the FS table.

### The operation the receipt binds

`process-exec`, for tool `bash` only (`APPROVED_ASK_PROCESS_TOOL_SHAPES`, a closed table like the FS
one). The fingerprint is a `sha256` over:

| field | meaning | why |
| --- | --- | --- |
| `toolName` | `bash` | the declared tool this approval is for |
| `executionBoundary` | the COMPILED boundary (`confined-subprocess`) | a receipt for one executor can never spawn under another (ADM-175) |
| `implementationOrigin` | the compiled origin (`dsh-native`) | same reason: the declared implementation is part of the operation |
| `processClass.program` / `.programs` | the composition's FIXED shell class (`/bin/bash`, `[bash]`) | a receipt for one shell class can never spawn another program (ADM-174/175) |
| `commandSha256` | digest of the exact `command` string, or `null` when the call carried none | the approved command text, when the spawn point can see it |
| `cwd` | the AUTHORED `workdir` (empty when absent) | **context only** — a shell's cwd bounds nothing, and the verifier never treats it as a grant |

### Where it is verified, and what that means

The verifier runs at the **governed spawn point, before any process exists**:

- confined subprocess face — `packages/runtime/team-services/src/subprocess.ts`,
  `createConfinedSubprocessClass`'s `spawn` admission (the `shellInvocation !== undefined` branch,
  before `provider.spawnStreaming`). `deny` throws first; `ask` calls
  `authorizeProcessAskWithReceipt` and throws `SUBPROCESS_PROCESS_DENIED` /
  `SUBPROCESS_PROCESS_RECEIPT_REFUSED` before the provider is called — the process count provably
  stays 0 (ADM-178).
- governed persistent PTY — `packages/runtime/team-services/src/terminal-pty.ts`,
  `createGovernedPtyTerminalFace`'s `spawn`, before `raw.spawn` creates any process. Same order:
  `deny` wins (`PTY_PROCESS_DENIED`), then the receipt (`PTY_PROCESS_RECEIPT_REFUSED`).

### What the receipt DOES NOT grant

- **No capability.** The verifier returns no policy. The OS profile is compiled before it runs, from
  the Member's own three lanes, exactly as before: `compileExecutionProfile(effective)` on the
  confined face and `narrowSandboxPolicy(base, effective)` on the PTY. `narrowSandboxPolicy` still
  clamps `danger-full-access` to at most `workspace-write` and keeps `read-only` read-only. An
  approval can therefore never add a writable, executable or kernel bit (ADM-176/177).
- **No lane promotion.** It does not turn `ask` into `allow` anywhere, does not touch `bounds`, and
  does not widen `allowPaths` — the arm compares the request's `allowPaths` with the lane-compiled
  profile plus the pre-round program-dir allowance, byte for byte.
- **No second authority.** The authority remains the durable Control decision + the consumed
  one-shot grant; the receipt is a proof that THIS execution's consumption happened.
- **No execution of its own.** It authorizes exactly one spawn for the execution that staged it.

### LIVE status of the process face (round 99, measured)

**The mechanism is proven; the LIVE positive is NOT.** Stated as measured, not inferred:

- **Proven in-process over the REAL parts** (real confined provider over the landlock launcher, real
  binder, real durable `ControlService`, real settlement store): the whole chain
  `ask → inline allow → grant consumed → receipt minted → spawn-point verify → spawn → real command →
  COMPLETED`, plus every negative (`ADM-174`…`ADM-179`).
- **LIVE (D4, booted rc.2): the ask chain completes and the SHELL never appears.** The worker's `bash`
  (`authorization: 'ask'`) raises a real durable Control request, the router qualifies it as an
  Alpha.6 case and the Officer allows it through the real control path, the grant is consumed — and
  the tool then fails with `no PTY backend registered for "a5sf-governed-shell"`. That error is raised
  by the persistent-`bash` tool's own backend lookup on the scope it resolves `terminals` from, BEFORE
  the governed PTY face's `spawn` runs, so on this boot the receipt verifier was never reached. Zero
  bytes, no process, settlement `FAILED` — fail-closed, not widened.
- **Ruled out by measurement:** an empty `a5sfNativeToolModules` (it breaks Member activation: the
  Officer never comes up), and the ceiling shape (an ask nested inside an allow is not expressible and
  the Member does not activate). `dsh.subprocess` (D3's proven owner) does not change the outcome.
- **Not determined:** whether the v5 per-tool `bash` binding is the specific trigger for the missing
  face. The v4 D3 world mounts the SAME face successfully with a bash binding whose disposition is
  `allow`, so the difference is in the composition/activation path, not in the receipt.

The consequence for this ADR is narrow and explicit: **no live claim is made for the process face.**
The spawn-point verification is a proven MECHANISM (with the FS face's live precedent), and the live
`ask` leg for a process tool is BLOCKED by an assembly gap named above, which is a product decision,
not a receipt defect.

> **Scope boundary (2026-11-24, APPROVED BY OWNER in review `20261124-2120` ruling 1).** The
> process-face extension above is a MECHANISM, not a support promise, and the owner has now ratified the
> declared scope as a product ruling. This generation promises **`allow`/`deny` only** for
> Subprocess/PTY; **per-call `ask` for process execution is NOT supported and remains fail-closed**
> (`UNSUPPORTED BY PRODUCT RULING`, the same class as PTC). The R3 receipt is **not** extended to the process face as a live promise: a
> receipt minted for a file operation must never be read as permission to bypass the OS sandbox, and no
> approval may widen the kernel profile. Declared wording, the process behaviours that *are* proven, and
> the two preconditions a future generation would need (a governed PTY backend on the binding realm + a
> process-scoped receipt that cannot widen the kernel profile): `SCOPE-subprocess-ask.md`.

### Limits, stated exactly

1. **The PTY cannot compare the command digest.** The persistent PTY creates its shell before any
   command text exists, so its spawn point has no `command` to digest and therefore cannot compare
   `commandSha256`; it verifies everything else (execution, member, policy generation, binding
   identity, epochs, declared boundary, shell class). The confined subprocess face, which spawns
   `argv[program,'-c',command]`, DOES compare it (`RECEIPT_COMMAND_MISMATCH`, ADM-179). This is the
   same seam that makes a persistent shell persistent, not an omission.
2. **A receipt covers the SPAWN, not every command typed into an existing session.** Once the
   governed PTY session exists, later commands are sent into that already-confined shell and are not
   re-verified against a receipt (there is no per-command process to gate). The session's OS profile
   is unchanged, so the confinement still holds; the per-command approval does not.
3. **`cwd` is not authority.** It is bound as context so two approvals cannot be confused, and the
   verifier intentionally does not consult it.
4. **One process tool.** `bash` is the only shipped process tool whose execution authorization this
   product compiles; a process ask on any other name prepares nothing and keeps R4.

## Rejected alternatives

1. **`guarded` coupling / a second approval consumption path (R2).** Two authorities over one
   decision; a Stop stops abandoning the pending ask. Rejected by the owner ruling.
2. **Global `callId` → allow map.** Explicitly forbidden: a string key is not an execution
   identity, and any caller could look up "some allow". Staging is object-keyed.
3. **Reusing `guard-observability`'s attribution ALS as-is.** Its contract is attribution-only;
   reusing it for authorization would silently widen it and has no proof against cross-Member
   leakage. A NEW carrier with its own brand and `run()` was required.
4. **Provider reading `decision:allow / laneDecision:ask` from the durable fact.** Ambient and
   replayable, and it makes the OS plane a reader of a mutable store rather than a verifier.
5. **`approvedOnce:false` as the culprit.** The compiler never reads it; the G11 collapse was a
   lane-algebra defect (see below), not an approval bug.
6. **Widening a lane / promoting `ask` to `allow`.** Forbidden. The receipt satisfies an `ask`
   within its existing bounds; it never adds an allow.

## G11 verdict (round 93's second blocker)

**DEFECT, fixed here.** `intersectPathRuleSets`' ask-survival required coverage by the *intersection*
of the two allow sets, so a legal pure-ask lane (`{allow:[], ask:[p]}`, which `validateLane` permits)
collapsed to an empty (deny) lane whenever it met any tool restriction. Correct rule: an `ask`
survives iff neither side's disposition for that locator is `deny`; it stays `ask`, never promoted.
The fix is in `path-rules.ts` (with a G11 rationale comment), pinned by two new arms in
`a5sf-member-policy.test.ts`. No lane is widened; the deny lane still wins.

## Production wiring (round 95)

The round-94 PoC left the last gap open: the real mount constructed `createMemberFsGuard(policy)`
with no authority, so a booted product turn could never verify a receipt. Round 95 wires the REAL
binder into the production mount for `write`/`writeText` ONLY:

- `agent-bindings.mjs:1771-1790` — when (and only when) the row's Control service is wired
  (`grants !== undefined`), the member realm mount is given
  `approvedAskAuthority: { binder: grantBinder }`. `grantBinder` is the SAME binder instance the
  centre's `grants` consumes through; it is not a new authority and mints nothing.
- `a5sf-realm-row.mjs:835,968` → `mount.ts:796,896,965` → `install.ts:104,513,880` — the authority
  is forwarded unchanged to `createMemberFsGuard(spec.effective, undefined, authority)` on the
  MEMBER face and on the BINDING-REALM face (a declared `write` tool binding routes `writeText`
  through the binding realm; its receipt bounds come from the same compiled answer). The terminal
  faces are untouched and keep R4.
- `guard-observability.ts:280-305` — the `observeGuard` wrapper now forwards the optional
  `FsGuardOperation` VERBATIM. It is a pass-through, not a decision point; without this, a governed
  realm (which always supplies an evidence sink) dropped the `writeText` content and refused a
  valid receipt with `RECEIPT_CONTENT_UNAVAILABLE`. Nothing about the decision changes.

The no-authority branch is byte-identical to before (guarded by the new `RECEIPT_AUTHORITY_UNAVAILABLE`
arms in `a5sf-service-install.test.ts`). No `guarded` coupling, no global callId map, no
attribution-ALS reuse, no second authority, no admission-duty expansion, no upstream patch.

## What this ADR does NOT prove

- **Scope.** The five FS mutations are covered live; the `bash` process face is covered at MECHANISM
  level only, and its live leg is blocked (see §"LIVE status of the process face"). Every other tool
  keeps R4. The process proof is a SPAWN-POINT proof (§"Limits"), not a per-command proof for an
  already-running persistent session. rc.5's real multi-file `apply_patch` tool is deliberately NOT
  wired: it expands into several per-file Provider effects, and a receipt can bind ONE operation, so
  admitting it would either duplicate upstream's parser or let one approval authorize N effects. It
  stays unbound (R4).
- **Declared shapes.** `delete_file`/`move_file`/`patch_text` are argument shapes for rc.5 Provider
  methods with no shipped native tool this round: the arms drive them through the real admission
  port with the declared shape, and the confined Provider, binder, Control and settlement are real,
  but no preset mounts them, so no model can reach them live.
- **Product status.** The D4 live evidence is `DEV-LIVE` (a booted rc.2 host, not a gate); no row is
  PRODUCT-PROVEN. `d4:routed-wake` remains REFUTED — the receipt closes the post-grant refusal, not
  Alpha.6 routing.
- **Content binding.** Per method, see the table: bytes for `writeText`, the requested
  transformation for `editText`, the hunk payload for `patchText`, path only for `deleteFile`, both
  paths for `moveFile`. A tool that mutates the payload between the centre's prepare and the
  Provider call is refused (`RECEIPT_CONTENT_MISMATCH`), never adapted. The fingerprint is NOT a
  statement about the file's prior or resulting bytes for edit/patch (the Provider's own guard
  decides those), and NOT a byte check for delete.
- **`caseId`.** An inline admission request mints `caseId:null`; it binds the durable
  request/decision identity it actually has, not an Alpha.6 case it never had.
