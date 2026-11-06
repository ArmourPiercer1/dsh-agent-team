# Shell-PTY face — layer B (native-tool contract) acceptance, host-free

Task: **layer B acceptance of the Shell-PTY capability face** — the per-native-tool
contract that the shared face-level (layer A) arms cannot cover.
Branch `task/a5sf-pty-contract-20261107` (worktree `.worktrees/a5sf-pty-contract`),
based on `origin/master` = `dbe4d7b81` (`A5SF SUB-CONTRACT`, #614). Predecessor
shape: `dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` and
`dev/agent-workflow/evidence/a5sf-fs-face/README.md`; this document copies the
**shape** (proven / not-proven-with-boot-command / layer ownership / mutation
controls / host precondition), not their content.

Host starts spent this round: **0** (the three earmarked starts remain untouched).
`CORE PATCH BUDGET = 0`: no `packages/**` file is changed by this branch (the
source mutation controls edit two product files in-process, restore them
byte-for-byte, and re-assert the sha256 — §6). No upstream file was modified or
copied. No grade, no `V@B`, no candidate claim; the matrix gained evidence
pointers only (§8).

Voice note: every number below is copied from a run whose command is printed next
to it, on **this** host. §5 lists what is NOT proven and the exact boot command
that would be needed. §4 reports four findings that are **reported, not fixed**.

---

## 1. What this face is today — and why it is TWO surfaces, not one

The task brief assumed one file (`team-services/src/terminal.ts`) holding a
lifecycle state machine over an injected `PtyPort`. At this base the face is
**two** things, and the layer-B contract differs between them:

| surface | where | what it owns | what it does NOT have |
| --- | --- | --- | --- |
| **product registry** (P1-08) | `packages/runtime/team-sandbox/src/terminal.ts` | trusted-owner identity, policy-revision binding, reuse-without-restart, replace-on-tighten, revoke, kill accounting, pid/descendant audit | **no I/O channel**: `PtyHandle` (`terminal.ts:51-57`) is `pid`, `backend`, `descendants()`, `kill()`. No write, no read, no exit status. Not wired to any realm. |
| **pinned host PTY service** | `@deepseek-ai/dsh-terminal` → `packages/terminal/terminal/lib/index.js` at `639ed01539` | per-session id, exact-owner fencing, `spawn`/`startSend`/`read`/`signal`/`kill`/`close`, per-session status with **exitCode or signal** (`types.ts:39-43`) | it is the **legacy-generation** service no governed realm may use; it is what the composition refusal refuses. |
| **composition refusal** | `packages/runtime/team-services/src/mount.ts:1441-1456`, `:1630-1644` | refuses a native module declaring `inject: ['terminals']` on a governed realm with `TERMINALS_LEGACY_PTY_REFUSED` (`mount.ts:279`) | there is **no terminal face** in `RealmServiceFaces` (`install.ts:441-448`), so the refusal is unconditional and a confined terminal backend cannot be installed (`GAP-PTY-CONTRACT-1`). |

So "the Shell-PTY capability face" is **a policy-bound state machine with no I/O
channel, a composition-time refusal of the service that has the I/O channel, and a
missing face slot between them**. This document pins the contract of each and says
exactly which transitions are genuinely covered (§7).

| layer | question it answers | already owns (do not restate) |
| --- | --- | --- |
| **A** — capability face × permission axis | is the LANE around a call correct: ceiling ∩ restriction, ask/deny, member isolation, fact attribution | `a5sf-member-policy.test.ts`, `a5sf-product-assembly.test.mjs`, `a5sf-tool-axis.test.mjs`, `a5sf-bash.test.mjs` |
| **B** — per-native-tool contract | does the REAL face behave as its own contract says **inside** an admitted call: allocation identity, command-gate / descendant-audit ordering (product) and send/read fencing (pinned service), exit-status propagation, reap, refusal ordering, per-terminal identity | **this document** |
| **C** — frozen-candidate live | does the assembled Host + preset + provider actually do it | previous boot rounds; not re-run here |

Already covered by layer A **and deliberately not restated**: the admission's
existence, the write-only lane, out-of-lane `chmod`/create, the network refusal,
the BL-17 tripwire ("the inherited legacy service must not be consulted" —
`a5sf-bash.test.mjs`, `PTY-FACE` + the deferred-module arm), and
`spawnTerminal`'s typed `SUBPROCESS_TERMINAL_UNSUPPORTED` refusal on the confined
subprocess face. No arm here concludes "the lane refused"; where an allocation
counter appears it is the ORDERING witness a property of this layer owns (P4).

## 2. What is REAL in the world

`tests/world-factory/lib/a5sf-pty-contract-world.mjs` is the one world builder.

| piece | real artifact | why |
| --- | --- | --- |
| product lifecycle | **PRODUCT** `createTerminalDomainRegistry` (`team-sandbox/src/terminal.ts`), imported through `scripts/run-tests-hooks.mjs` as `.ts` | the registry is the module under test; its `PtyHandle` **is** the injected seam (`terminal.ts:47`), so the recorder is the seam, not a fake |
| product composition | **PRODUCT** `mountA5sfRealm(...).mountNativeToolModules` (`team-services/src/mount.ts:792`, `:1323`) with one Member ceiling | the refusal must fire on the call the product row makes, not on a helper |
| pinned host service | **PINNED** `TerminalSessionService` (`packages/terminal/terminal/lib/index.js` @ `639ed01539`) over its OWN injected port (`registerBackend`, `index.ts:113`) | the service (ids, ownership fencing, close-once, dispose) is real; only the PTY mechanics behind the port are recorded, because a real PTY is `NOT_REACHED` here |
| pinned owner registry | **PINNED** `AgentRegistry` (`packages/core/agent/lib/index.js`) + `Session` (`packages/core/session/lib/index.js`) | the service only publishes for a LIVE exact owner (`isLiveOwner`, `index.ts:381`); a hand-rolled owner object would not prove that |
| pinned native module | **PINNED** `@deepseek-ai/dsh-tool-bash-persistent` (`lib/index.js`, `inject = ['tools','terminals']`) | the shipped consumer of the legacy PTY path is what the composition must refuse |
| allocation counter | the pinned service with a recorded backend whose `spawn` counts | "zero allocations" is a count over a service that really could allocate, not an absence of a service |

**NO HOST BOOT**, no port, no DSH_HOME, no `tests/homes/**`, **no real PTY**.
`mkdtemp` fixtures only. The FS/subprocess faces' real-child precedent is *not*
extended to a real PTY (§5).

**HOST-REQUIRED, three states** (§9): the four pinned entries are `lib/` build
outputs of the gitignored `tests/deepseek-harness-test-use` checkout.

## 3. The arms (14, `tests/world-factory/a5sf-pty-contract.test.mjs`)

Every arm asserts an ORDER (what happened before what) or an IDENTITY (which
terminal a fact belongs to), never the mere presence of a refusal. Run:
`node --test tests/world-factory/a5sf-pty-contract.test.mjs` → **14 pass / 0 fail**
(`suite.log`).

### P1 — allocation lifecycle (`create → command gate → descendant audit → kill → reap`)

`PtyHandle` has no write or read channel; "write"/"read" in earlier revisions of this face meant the command gate and the descendant audit.

The registry has no command-request channel and no byte read. The only
per-command operation is `assertCurrent(domainId)` (`terminal.ts:232-247`) — the
gate that admits or refuses a **command request** against the current policy
revision — so P1's former "write" arm is pinned **on that gate**, and P1's former
"read" arm on the port's **descendant audit** (`descendants()`: what the recorded
handle reports about descendants). That substitution is stated, not hidden
(`GAP-PTY-CONTRACT-2`).

**Semantics found** (all from the code, not preference):

- one allocate per session: `acquire` returns the live domain with `reused: true`
  when `status === 'active' && policyRevision === current` (`terminal.ts:180-191`);
  the in-flight promise makes two concurrent acquires collapse to one spawn
  (`:132-138`, `:193-195`, `:226-227`);
- a different `toolBindingIdentity` is a different key (`keyOf`, `:130`) → a
  second terminal;
- kill is `SIGKILL` **always** (`:152`); `killDomain` sets `stale` → calls the
  port → `terminated` (`:149-158`), and the registry **deletes** the domain after
  a revoke (`:263`, `:277`) — the typed refusal after a kill comes from the
  domain being *gone*, not from the `status` flag;
- double-kill: a second `revoke` finds no domain → `[]`, no second signal; a
  second `shutdown` → `{domains: []}`;
- command after kill: typed `DOMAIN_REVOKED` (`:233-235`), never an idempotent ok.

**Assertion** `P1-ONE-ALLOCATE-PER-SESSION`: second acquire `reused: true`, same
`domainId`/`pid`/`backend`, `allocations() === 1`; a second binding allocates
once more with a different `domainId`; allocate order is `[bind-a, bind-b]`.

**Assertion** `P1-COMMAND-REQUEST-GATE-REFUSES-AFTER-KILL` (recorded as
`P1-NO-COMMAND-AFTER-KILL` before PD-9): `assertCurrent` ok before; after
`revoke` the port got exactly `['SIGKILL']`, `assertCurrent` is
`DOMAIN_REVOKED`, `allocations()` is still 1; a second `revoke` is `[]` and the
kill log is unchanged; a fresh `acquire` for the revoked member is
`DOMAIN_REVOKED` with no port call; `shutdown` is empty.

**Assertion** `P1-REVOKE-WITHOUT-DOMAIN-IS-NOT-STICKY` (**FINDING**, §4): after
`revoke('member-with-no-shell')` → `[]`, that member can still acquire a shell
(one real port allocation = 1).

**Assertion** `P1-HOST-SESSION-LIFECYCLE` (pinned service): `spawn` → one backend
spawn; `startSend` delivers the exact text to **that** session and `readOutput`
returns its delta; `read` returns that session's scrollback; `kill` → `true`,
one backend `close`; a **sequential** double-kill is typed `NO_SESSION` (not
idempotent-false) while an **overlapping** double-kill is `[false, true]` with
one close — the two answers differ because of `record.closing` (`index.ts:285-300`),
which the arm pins rather than smoothing over; send/read after kill are
`NO_SESSION`.

**RED→GREEN**: arm written, run; §8's `red-first-run.log` leg 1 removes
`terminal.ts` (7 registry arms red) and leg 2 removes both refusal sites
(2 P4 arms red). Each arm's own discriminator is its control in §6.

### P2 — exit-status propagation

**Semantics found**: the registry's only downstream record is
`TerminalShutdownReceipt` (`terminal.ts:268-288`): `domainId`,
`memberInstanceId`, `policyRevision`, `pid`, `descendants`, `killed`. There is
**no exit code, no signal, no status, no error**. `killed` is set from
`domain.status === 'terminated'` **after** `killDomain` swallowed the port's
error (`:153-156`, `:284`), so a process that had already exited and one we
killed are reported identically. The only outcome the registry distinguishes is a
*spawn* failure (`SPAWN_FAILED`, `:222-226`).

The pinned host service **does** distinguish: `TerminalSessionStatus` is
`{kind:'running'} | {kind:'exited', exitCode, signal}` (`types.ts:39-43`), and a
backend transport failure rejects the send operation instead.

**Assertion** `P2-REGISTRY-COLLAPSES-EXIT-OUTCOMES`: three ports whose `kill`
resolves / rejects `TERMINAL_EXITED` / rejects `ESRCH` → the receipt rows have
exactly the six fields above, `killed: true` for all three, the same
`{killed, memberInstanceId, policyRevision}` triple, and the pre-kill descendant
snapshot is the only per-domain outcome data. Every port was signalled once.

**Assertion** `P2-HOST-DISTINGUISHES-OUTCOMES`: three sessions report
`{exited, 7, null}`, `{exited, null, 'SIGTERM'}`, `{running}` — the send results
carry `exitCode 7`, `signal 'SIGTERM'`, and a rejected `EIO` respectively;
`kill` on an already-exited session still returns `true`, i.e. the **status
observation** (not kill) is where the fates separate.

**RED→GREEN**: the collapse is what the code does, so the arm was green on first
run; its control M3 (propagate the swallowed kill error) reds it, and I2 (the
port collapses exit status) reds the host arm.

### P3 — orphan / reap

**Semantics found**: `shutdown` reads `descendants()` **before** the kill and
reports that snapshot (`terminal.ts:275-283`), kills each domain once, deletes it
from the map (`:277`), and a second shutdown has nothing to reap. The pinned
service closes through `closeRecords`, which reuses an in-flight `closing` promise
so one session is closed once (`index.ts:462-476`), and `disposeAll` closes every
live session and then sets `disposing` (`index.ts:435-458`).

**Assertion** `P3-REGISTRY-REAP`: two domains → each port signalled exactly once,
`record.alive === false`, the port's `descendants()` after kill is `[]`, the
registry's `list()` is empty, `assertCurrent` on both is `DOMAIN_REVOKED`, a
second `shutdown` re-kills nothing.

**Assertion** `P3-HOST-REAP`: killing one session closes that backend once and
leaves the sibling's port untouched (`closesFor === 0`); after `dispose()` every
live session is closed exactly once, the already-closed one is **not** re-closed,
and a new `spawn` is typed `SERVICE_DISPOSING`.

**What is `NOT_REACHED`**: an **OS-level** descriptor/handle count. The port has
no fd (`'fd' in handle === false` is asserted), and a recorded backend creates no
descriptor, so a `/proc/self/fd` delta here would measure the test runner, not the
face. Stated plainly rather than dressed up as a measurement; §5 gives the
command that would measure it.

**RED→GREEN**: M4 (shutdown retains the domain → second kill) reds the registry
arm; I1 (the port reports two closes) reds the host arm.

### P4 — the refusal path, and WHEN it fires

**Semantics found**: the refusal has **two sites and two different orderings**.

- pre-mount (`mount.ts:1441-1456`): a module whose declared `inject` contains
  `terminals` is refused **before** the module is mounted — before any fiber, any
  tool definition, and therefore before any allocation. The check reads the
  module's DECLARED metadata only (`declaredInjectionsOf`, `:310-316`); it does
  not resolve the service and does not consult a face (there is no `terminals`
  face, §1).
- deferred (`mount.ts:1630-1644`): a module that declares only `tools` and calls
  `ctx.inject(['terminals'], …)` inside `apply` is detected **after** the
  settle window — i.e. **after its `apply` already ran**. The arm measures that
  window: the module's apply ran, the inherited legacy service was resolved, and
  a real backend allocation happened (`pty-1`, still live) before the same typed
  refusal was thrown.

**Assertion** `P4-REFUSED-BEFORE-ALLOCATION`: the shipped
`tool-bash-persistent` module (declared `['tools','terminals']`, wrapped only to
record that `apply` was reached) → `TERMINALS_LEGACY_PTY_REFUSED`, detail
matches `/refusing at composition time/`, `applied === []`, backend `spawned === 0`,
`terminals.list(owner)` empty. The arm also pins the precondition that makes the
refusal necessary: `'terminals' in member.faces === false` while the member
scope still **resolves** an inherited `terminals` service.

**Assertion** `P4-DEFERRED-REFUSAL-IS-POST-ALLOCATION` (**FINDING**, §4): same
code, but `applied === ['apply']`, `spawned === 1`, one live legacy session.

**Assertion** `P4-CONTROL-INERT-MODULE-MOUNTS`: a module with `inject: ['tools']`
that consumes no PTY service mounts (≥1 fiber), its `apply` ran, zero
allocations. This is the control against a blanket refusal.

**RED→GREEN**: leg 2 of `red-first-run.log` removes both sites (2 arms red); M5
disables the **pre-mount** site only (declared arm reds alone, the deferred arm
stays green because its own later site still fires), and M5b disables the
**deferred** site only.

### P5 — concurrency and identity

**Semantics found**: the registry key is
`teamId/memberInstanceId/toolBindingIdentity` (`:130`) and revocation is the
member, not the domain (`:249-271`). There is **no per-domain kill**: single-
terminal death happens only through the replace-on-tighten path, and bulk death is
member-scoped `revoke` or `shutdown`. A stale-but-live domain keeps
`status: 'active'` in `list()` even though `assertCurrent` refuses it with
`REVISION_STALE` (the `status` flag is only written by `killDomain`).

**Assertion** `P5-TWO-BINDINGS-IDENTITY`: two bindings of one member →
2 allocations, distinct `domainId`/`pid`, backends `pty` vs `pipe`; each
`list()` row pairs its own `toolBindingIdentity`/`pid`/`backend`; the shutdown
receipt's pids are distinct and each row's pid/descendants belong to its own
domain (the fixture makes a zip/swapped attribution **detectable**).

**Assertion** `P5-KILL-ONE-NOT-THE-OTHER`: tightening the revision and
re-acquiring binding A kills A once and leaves B's port untouched; B's commands
are refused `REVISION_STALE`, B is still `list()`-visible **as `active`**
(FINDING), B's PTY is still open; `registry.kill` does not exist, and
`revoke(member)` then kills B **and** A (member-scoped bulk kill).

**Assertion** `P5-HOST-TWO-SESSIONS-FENCED` (pinned service): writes land on the
addressed session only (`sendsFor` per session, distinct scrollback per session);
killing A leaves B operable with B's own name/pid in `list()`; A's operations are
`NO_SESSION`; a foreign owner gets `FOREIGN_SESSION` for read **and** signal; B's
backend is never closed.

**RED→GREEN**: M1 reds both P1's reuse arm and this property's kill-one arm
(shared existing-domain lookup), M6 (receipt pid from the first domain) reds the
identity arm, I3 (port crosses writes) reds the host arm.

> **Correction note (PD-9, 2026-11-08).** The P1 property label was
> `create → write → read → kill → reap` and the gate arm was
> `P1-NO-COMMAND-AFTER-KILL` when this face was recorded. The label now reads
> `create → command gate → descendant audit → kill → reap` and the arm is
> `P1-COMMAND-REQUEST-GATE-REFUSES-AFTER-KILL`; assertions are unchanged.
> `suite.log`, `red-first-run.log`, `mutations.log` and the run outputs preserved
> in `a5sf-product-debt/**` keep the recorded pre-rename title — they are
> historical output, not corrected in place. The retired words meant the
> command gate and the descendant audit, never bytes.

## 4. Findings (reported, not fixed)

**F1 — the registry cannot distinguish an exit from a kill** (`terminal.ts:149-158`,
`:279-286`). `PtyHandle` has no status surface, `killDomain` swallows the port's
error, and `killed: true` is derived from the registry's own bookkeeping. Downstream
(nothing else consumes the receipt today) every process fate is one value.
A minimal PR would add an optional `status?()` to `PtyHandle` and an
`outcome` field to the receipt row; it is **behaviour-changing** (a new public port
member) and therefore an owner decision, not a test-only change.

**F2 — the deferred refusal is post-allocation** (`mount.ts:1630-1644`). For the
declared shape the refusal is genuinely before any allocation; for the deferred
shape the module's own `apply` runs first and can — and in the arm does — open a
real legacy PTY through the inherited service, which is still live when the typed
refusal is thrown. The refusal still prevents the **tool** from being exposed, so
this is a fail-open **window**, not a leak of the tool. A minimal PR would be
difficult without a composition-level pre-scan of deferred injects (Cordis does not
expose one) or a confined terminal face (`GAP-PTY-CONTRACT-1`); the honest fix is
the face, not a patch here.

**F3 — revocation is not durable when the member owns no live shell**
(`terminal.ts:249-259`). `revoke(memberInstanceId)` records a revoked **generation
key** only for members that currently have a live domain, and its signature
carries no generation, so it cannot record the key otherwise. A shell opened after
the revoke survives the revocation — the exact outcome the function's own comment
says it exists to prevent. Minimal PR: no — the fix needs either a generation-
carrying `revoke` signature or an owner-scoped revocation record; both are API
decisions.

**F4 — a stale-but-live domain reports `active`** (`terminal.ts:209`; only
`killDomain` writes `status`). `list()` shows `active` for a shell whose every
command is refused `REVISION_STALE`. Minimal PR: yes — one line in `list()` (or a
`stale` transition on the revision read) would report the state the gate already
enforces. Left unfixed here because the branch may not touch `packages/**`.

**GAP-PTY-CONTRACT-1** — `RealmServiceFaces` (`install.ts:441-448`) has `fs`,
`subprocess`, `web` and **no terminal face**, so the refusal is unconditional and
there is nowhere for a confined terminal provider to be installed. This is a
design gap, not a bug: the refusal is the current total answer.

**GAP-PTY-CONTRACT-2** — the P1 property used to be written "create → **write**
→ **read** → kill → reap", but the product face has neither. What the arms pin is
a **command gate** (`assertCurrent` admits or refuses a *command request* against
the current policy revision) and a **descendant audit** (the recorded handle's
report about descendants). Anything about actual bytes through a PTY
(flow control, EOF, `SIGHUP` on close, scrollback) is not representable in this
face at all. The retired labels were **renamed, not replaced by a channel**:
PD-9 in the product-debt register records the correction, and the arms'
assertions are unchanged.

## 5. What is NOT proven (and the exact one-shot command a boot would run)

**None of the following is claimed by any arm here.**

| not proven | why it needs a Host / a real PTY | one-shot command a boot would run |
| --- | --- | --- |
| a real PTY allocation, a real `/dev/pts/N`, a session leader, `SIGKILL` delivered to the process **group** | the arms' PTY is an injected port; the real backend (`@deepseek-ai/dsh-terminal-bash` + `node-pty`) is a Host/native concern. Creating one would prove *node-pty*, not the governed face. | `node dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs` with a preset whose native modules include `@deepseek-ai/dsh-tool-bash-persistent`; then on the recorded pid: `ps -o pid,ppid,pgid,sess,tty,stat,cmd -p <pid>` (expect `pid == sess == pgid` if it is a session leader, `tty == pts/N`), `ls -l /proc/<pid>/fd/0` (expect `/dev/pts/N`), `ls /proc/<pid>/fd | wc -l`. |
| an **OS-level** reap / fd-count guarantee | the port creates no descriptor, so `P3`'s "no handle remains open" is a port-level statement. | same boot run; after `terminal_close`/`kill`: `test ! -e /proc/<pid>` and `test "$(awk '{print $3}' /proc/<pid>/stat 2>/dev/null)" != Z` (a `Z` would mean an unreaped zombie), plus `ls /proc/self/fd | wc -l` before and after the session (equal). |
| the deferred-refusal window on a **live** preset | needs the preset/registry glue that assembles `a5sfNativeToolModules` in a boot | same boot runner; the allocation list plus a `terminals` session in the live log would show F2 in the product row. |
| OS-level PTY sandboxing / session leadership as a **policy** | not implemented by this face at all; Landlock/seccomp do not cover TTY semantics | no command exists — this would be new product work, not a measurement. |
| a live Member/preset reaching this face | the governed realm refuses it by design today | same boot runner; the `M-08`/`M-13` live rows. |

`NOT_REACHED` in this document means exactly the rows above.

## 6. Mutation controls

`dev/agent-workflow/evidence/a5sf-pty-face/mutations.mjs` — **9 controls, all
passing** (`mutations.log`). Two kinds, and the distinction is load-bearing:

- **source controls** (M1–M6) edit the real product source
  (`team-sandbox/src/terminal.ts`, `team-services/src/mount.ts`), run the SAME
  suite, restore in a `finally`, and re-assert the sha256. `git diff --
  packages/` is empty afterwards.
- **instrument controls** (I1–I3) run the suite with
  `A5SF_PTY_CONTRACT_CONTROL`, which makes the INJECTED port misreport. No control
  writes to `tests/deepseek-harness-test-use`: CORE PATCH BUDGET = 0 means the
  pinned tree is never modified or copied, so an upstream regression cannot be
  simulated by editing it — the only legal place to break the port's report is
  the port. These controls therefore prove the pinned-service arms read the port
  boundary (where a real backend's exit status and write routing arrive) rather
  than the fixture's own summary.

| control | property | breaks | red arms (declared, measured) |
| --- | --- | --- | --- |
| M1 existing-domain lookup dropped | P1 | reuse path never finds the live domain | `P1-ONE-ALLOCATE-PER-SESSION`, `P5-KILL-ONE-NOT-THE-OTHER` |
| M2 killed-domain command admitted | P1 | the "domain does not exist" refusal | `P1-COMMAND-REQUEST-GATE-REFUSES-AFTER-KILL`, `P3-REGISTRY-REAP` |
| M3 kill error propagated | P2 | the swallowed kill error | `P2-REGISTRY-COLLAPSES-EXIT-OUTCOMES` |
| M4 shutdown retains the dead domain | P3 | map deletion after kill | `P3-REGISTRY-REAP` |
| M5 pre-mount refusal dropped | P4 | declared-inject refusal site | `P4-REFUSED-BEFORE-ALLOCATION` |
| M5b deferred refusal dropped | P4 | deferred-injection refusal site | `P4-DEFERRED-REFUSAL-IS-POST-ALLOCATION` |
| M6 receipt pid from the first domain | P5 | per-row identity | `P5-TWO-BINDINGS-IDENTITY` |
| I1 port closes twice | P1/P3 | close-once accounting | `P1-HOST-SESSION-LIFECYCLE`, `P3-HOST-REAP` |
| I2 port collapses exit status | P2 | exitCode vs signal propagation | `P2-HOST-DISTINGUISHES-OUTCOMES` |
| I3 port crosses writes | P5 | per-session write routing | `P5-HOST-TWO-SESSIONS-FENCED` |

Declared multi-arm controls (one shared mechanism): **M1** (reuse and
replace-on-tighten both read the existing domain), **M2** (after a revoke the
registry *deletes* the domain, so "the terminal is gone" is the single mechanism
behind both the post-kill command gate and the reap assertion), **I1** (both host
arms assert "exactly one close per session"). `P1-REVOKE-WITHOUT-DOMAIN-IS-NOT-
STICKY` is a **finding arm with no control**: the only way to redden it is the fix
itself (record the revoked generation without a live domain), which needs an API
change — so it is declared uncontrolled rather than given a fake switch.

## 7. Genuinely covered vs merely representable

This is the honest boundary. A state machine can be traversed in a test while the
real PTY would behave differently; naming the gap is the point of layer B.

| transition / property | genuinely covered | how |
| --- | --- | --- |
| reuse within a generation, one allocate | **yes** | product code, port counter, allocate order |
| replace on tightened revision, per-binding | **yes** | product code, one kill, sibling untouched |
| revoke (member-scoped) and shutdown accounting | **yes** | product code, kill log, second-shutdown no-op |
| command gate after kill / stale revision | **yes** (gate only) | product code, typed codes |
| refusal ordering for the **declared** shape | **yes** | product mount, real pinned module, real service, zero backend allocations |
| refusal ordering for the **deferred** shape | **covered as a defect** | product mount, real allocation observed before the throw |
| per-terminal identity in facts | **yes** | distinct domains/pids/backends, receipt pairing |
| kill-once / close-once at the service | **yes** | pinned service, port close counter |
| exit code vs signal vs transport error | **yes for the pinned service** (port reports it); **no for the product registry** (no channel) | port report + service propagation |
| the bytes of a write and a read | **not represented in the product face at all** | only the pinned service's `startSend`/`read` with a recorded port |
| a real `SIGKILL` reaching a real process group | **merely representable** | the port records the signal name; nothing proves OS delivery |
| `descendants()` emptiness | **merely representable** | the port's post-kill report; no process-table observation |
| no fd/handle left open | **merely representable** | asserted on the port shape; an OS count is `NOT_REACHED` |
| session leadership / PTY sandboxing | **not claimed** | — |

## 8. Gates measured

| gate | command | result |
| --- | --- | --- |
| suite | `node --test tests/world-factory/a5sf-pty-contract.test.mjs` | 14 pass / 0 fail (`suite.log`) |
| all a5sf suites | `node --test tests/world-factory/a5sf-*.test.mjs` | **389 pass / 0 fail** (was 375 before this branch; +14) (`a5sf-suites.log`) |
| mutation controls | `node dev/agent-workflow/evidence/a5sf-pty-face/mutations.mjs` | `MUTATION-CONTROLS-PASS` (9/9, `mutations.log`) |
| RED baseline | two legs, §3 (`red-first-run.log`) | leg 1: 7 red / 7 green; leg 2: 2 red / 12 green |
| host refusal | `A5SF_PTY_CONTRACT_HOST_ROOT=…` (`host-refusal-simulation.log`) | absent → 14 skipped, `pass 0`, `verdict=NOT_RUN`; partial → hard `A5SF-PTY-CONTRACT-HOST-INCOMPLETE` |
| targeted vitest | `pnpm exec vitest run packages/runtime/test/a5sf-terminal-lifecycle.test.ts packages/runtime/test/a5sf-service-install.test.ts packages/runtime/test/p8t2-terminal.test.ts packages/runtime/test/a5sf-confined-subprocess.test.ts` | 4 files, 64 tests pass (`vitest.log`) |
| typecheck | `pnpm -r typecheck` | exit 0, 0 `error TS` (`typecheck.log`) |
| whitespace | `git diff --check` | rc 0 |

The pre-existing `a5sf-terminal-lifecycle.test.ts` (7 vitest tests) remains the
P1-08 unit surface; this branch **does not restate** it — the arms above are the
layer-B increments (ordering, identity, refusal position, host-service contract).

## 9. Host precondition (the three states)

`tests/world-factory/lib/a5sf-pty-contract-world.mjs` consumes four `lib/` build
outputs of the pinned checkout (`639ed01539` / `0.2.0-rc.2`):
`packages/terminal/terminal/lib/index.js`, `packages/core/agent/lib/index.js`,
`packages/core/session/lib/index.js`,
`packages/shell/tool-bash-persistent/lib/index.js`.

1. **absent** → one `A5SF-PTY-CONTRACT-HOST-REFUSED schema=a5sf-host-refusal/1
   refused=1 skipped=14 cases=14 verdict=NOT_RUN …` line, every case registered
   as SKIPPED, `pass 0`;
2. **present but partial** → hard failure `A5SF-PTY-CONTRACT-HOST-INCOMPLETE` (a
   pin violation, not an absence);
3. **present and complete** → every arm runs.

`A5SF_REQUIRE_PINNED_HOST=1` turns state 1 into a failure (used by the mutation
runner so a missing host cannot look like a pass). `A5SF_PTY_CONTRACT_HOST_ROOT`
exists only to *simulate* states 1/2; no product code reads it.

## 10. Matrix pointers

The matrix (`docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md`)
gained **evidence pointers only** on `M-08` and `M-13` and one §1.1 paragraph.
No grade, no `V@B`, no candidate claim: `M-08` stays `NOT_WIRED`, `M-13` stays
`NOT_WIRED`, and these arms are not live/level evidence for either row.

## 11. Census / boundaries of this branch

- **`.mjs` only.** Added two `.mjs` files under `tests/world-factory/` plus the
  evidence `.mjs`; no scannable `.ts` was added, so no
  `packages/testkit/test/p4t6-bookings/` booking is required.
- **No new production consumer** of the confined-provider lane was added, so no
  `a5p4` named-mount ledger entry is required.
- **No `packages/**` change** on this branch. The mutation runner edits two
  product files in-process and restores them byte-for-byte (sha256 re-asserted;
  `git diff` is empty for `packages/**`).
- **0 Host boots**, 3 earmarked starts untouched. No real PTY, no Live Host, no
  port, no `DSH_HOME`, no `tests/homes/**`.
