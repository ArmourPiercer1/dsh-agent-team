# ALPHA.5 SANDBOX-FIRST — PRODUCT DEBT REGISTER

<!-- phase-identity: alpha5-sandbox-first -->

> **What this is.** The product defects and divergences that the four layer-B contract rounds
> (FS, Subprocess, Shell-PTY, Web) **reported and did not fix**, in one place, ranked by what a
> Member could do because of them. Each row is a decision for the owner: the finding, what is
> true today, what someone might wrongly infer, the consequence class, the backstop that keeps
> it from being exploitable, and the smallest honest fix.
>
> **What this is not.** No grade, no `V@B`, no gate and no `packages/**` change is implied here.
> The evidence READMEs stay the source of truth; this file is their digest. Work that is already
> tracked is **linked, never duplicated** — `BL-38`, `BL-39`, `BL-42` and the matrix rows keep
> their own text and status.
>
> **As measured by the four rounds, no row below lets a Member cross its compiled lane on a face
> that is wired today.** PD-1 was fixed on 2026-11-09 under an owner ruling (generation-scoped
> revocation, see §2); PD-2 remains a hole that becomes live the day the Shell-PTY face is wired
> (PD-3); everything else is a capability loss, a false record, or a weak citation.
>
> Date 2026-11-07 · base `origin/master` @ `f082a28c0` · 0 boots · `CORE_PATCH_BUDGET = 0`.

## 0.1 Owner ruling 2026-11-09 — PD-1 semantics deferred, deliberately

Asked directly whether revocation should bind **only the current generation** (add a `generation` input to `revoke`,
`:249`, keeping the existing "archived then re-created may acquire again" behaviour asserted by
`packages/runtime/test/a5sf-terminal-lifecycle.test.ts`), bind **all generations** via an owner-scoped tombstone
(which closes the hole and also removes that existing capability), or take the larger **tombstone + explicit
`restore`** shape, the owner ruled: **defer the decision and keep the defect latent.**

What that ruling means, stated so it cannot be read as an acceptance:

- **PD-1 stays a `governance hole`.** It is not downgraded, not reclassified, and not "accepted risk".
- **The Shell-PTY face stays unwired.** The ship-order rule in §1 ("fix PD-1/PD-2 before wiring the terminal face")
  now has a second, independent reason to hold: there is no ruling to implement, so BL-17's confined terminal face
  must not be built on top of a revocation path whose semantics the owner has not chosen.
- **The defect pin stays green on purpose.**
  `tests/world-factory/a5sf-pd1-revocation-escape.test.mjs` continues to assert that the escape currently succeeds and
  prints `PD1-ESCAPE-REPRODUCED`; it also reds if this row is deleted or downgraded, so the deferral cannot silently
  become a fix or a disappearance.
- **Nothing else is unblocked by the deferral.** The hole remains latent only because no governed realm installs a
  `terminals` face (`RealmServiceFaces` = fs/subprocess/web, PD-3); that is the whole backstop, and it is a
  composition-time absence, not an enforcement.
- **Release stays BLOCKED**, and the PTY row of the end-state table continues to read "no confined shell at all".

Recorded here rather than in a lane report because a deferred owner decision that lives only in a conversation is
indistinguishable, six weeks later, from a decision nobody ever made.

## 1. The register at a glance

| id | face | debt | consequence | decision |
|---|---|---|---|---|
| PD-1 (F3) | Shell-PTY | Revocation does not bind a Member that owns no shell yet **(FIXED)** | governance hole | semantics |
| PD-2 (F2) | Shell-PTY | The deferred PTY refusal fires after a legacy session is allocated | governance hole | semantics |
| PD-3 (GAP-PTY-CONTRACT-1) | Shell-PTY | There is no confined terminal face, so the refusal is total | behavioural divergence | semantics |
| PD-4 (P5) | Subprocess | The confined child drops upstream's proxy overlay | behavioural divergence | semantics |
| PD-5 (GAP-FS-CONTRACT-1) | FS | Routed `read_image` cannot resolve `fs` and is dead | behavioural divergence | semantics |
| PD-6 (GAP-SUB-CONTRACT-1) | Subprocess | The shipped transient shell cannot ride the confined face | behavioural divergence | semantics |
| PD-7 (F4) | Shell-PTY | A stale-but-live shell is reported `active` **(FIXED)** | evidence-quality | correctness |
| PD-8 (F1) | Shell-PTY | The shutdown receipt cannot tell an exit from a kill | evidence-quality | semantics |
| PD-9 (GAP-PTY-CONTRACT-2) | Shell-PTY | P1's "write" and "read" were a command gate and an audit **(FIXED)** | evidence-quality | correctness |
| PD-10 (GAP-WEB-CONTRACT-1) | Web | Every real `web_search` fact records a malformed marker | evidence-quality | semantics |

**`decision = semantics`** means the fix changes product-observable behaviour (a signature, an
environment, a recorded value, which provider a child reaches) and therefore needs the owner;
**`decision = correctness`** means the fix only makes the product report what it already does.

> **2026-11-08 状态更新（ALPHA5-CONSOLIDATE；只追加，不改任何行文）**：PD-7 与 PD-9 的 `status`
> 行写于两条 PR 还是 draft 的时候。`git log origin/master` 显示二者已 squash 合入：
> **PD-7 = `572a7625d`（#619）**、**PD-9 = `bab33c4c6`（#620）**。因此按“FIXED 只在合并 PR 说了
> 才算”的口径，这两行现在是 `FIXED`（有已合并 PR），其余 **8 行仍 `OPEN` 且仍待 owner 决策**。
> 状态汇总表在 `ALPHA5-END-STATE.md` §2；本文件 §2 的逐条详情、验收条件与 anchors 一字未动。

## 2. The rows

### PD-1 (F3) — revocation does not bind a Member that owns no shell yet

> **2026-11-09 owner ruling (this supersedes the earlier deferral in this row, which is kept below
> and annotated, not deleted).** Chosen semantics: **keep generation-scoped isolation.** `revoke`
> must receive a trusted member identity including `teamId`, `memberInstanceId` and
> `instanceGeneration`, so it can record the revocation key even when the member owns no live
> domain. A permanent `memberInstanceId`-wide tombstone is **rejected**: it would block a
> legitimately re-created generation, contradicting the lifecycle arm that requires re-creation to
> be able to acquire. The ruling also requires the in-flight `spawn()` race to be closed: a revoke
> that lands during an awaited spawn must reap the late creation before it can be published.

- **source**: `F3` in [a5sf-pty-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-face/README.md) §4
- **true today**: **fixed.** Before this fix `revoke(memberInstanceId)` recorded a revoked generation
  key only for members that already owned a live domain, so a member with no shell at the moment of
  the revoke was never recorded and `acquire` afterwards succeeded with one real port allocation.
  `revoke` now takes the trusted identity (generation included), records the generation
  unconditionally before its first await, and re-checks that key after `spawn()` resolves but before
  the domain is published.
- **not true**: that a revoked generation can still open a shell by owning none at revoke time, that
  `revoke` is "the domains I could see", or that the fix is a member-wide tombstone — a new
  generation of the same member still acquires.
- **security consequence**: **governance hole** — historical class, closed by this fix. Revocation is
  the act by which the authority withdraws; before the fix a Member could obtain the very thing that
  was withdrawn. No other row lets a Member gain a capability the authority refused.
- **current backstop**: none was possible inside the debt's own path; the whole face is still
  unreachable from a governed realm today (`RealmServiceFaces` has no `terminals`, PD-3), so the
  fix's arms are host-free and no product composition reaches `revoke`/`acquire` yet.
- **smallest honest fix**: **landed.** `packages/runtime/team-sandbox/src/terminal.ts` — `revoke`
  takes `TrustedMemberIdentity`, records `memberKey(identity)` unconditionally (throwing
  `TerminalRevokeRefusalError` / `REVOKE_IDENTITY_UNTRUSTED` for an incomplete identity instead of
  guessing), and re-checks the key after the awaited `spawn()` before `domains.set`, reaping the
  spawned shell and returning `DOMAIN_REVOKED` if the generation was revoked meanwhile. The
  `packages/**` caller (`packages/runtime/test/a5sf-terminal-lifecycle.test.ts`) passes `IDENTITY`
  (generation 1, its existing constant).
- **owner ruling (2026-11-09)**: Revocation is generation-scoped: `revoke` takes the trusted member identity (teamId, memberInstanceId, instanceGeneration) and records that generation's revocation key unconditionally, even when the member owns no live domain; a new generation of the same member may acquire, and a spawn that completes after the revoke is reaped before publication.
- **proof**: `PD-1 REFUSAL` (post-revoke `acquire` → `DOMAIN_REVOKED`, 0 port allocations);
  `PD-1 CONTRAST (live domain)` (a visible shell is killed and refused — the control that says
  revocation is not inert); `PD-1 IN-FLIGHT` (a revoke during an awaited `spawn()` reaps the late
  creation: 0 usable domains, SIGKILL observed, `DOMAIN_REVOKED`); `PD-1 CONTRAST (new generation)`
  (the acceptance property: a re-created generation may acquire); `PD-1 REGISTER` (this row stays
  FIXED and names the arms). `packages/runtime/test/a5sf-terminal-lifecycle.test.ts` — including its
  "a member re-created at a NEW generation may acquire again after revocation" arm — stays green.
- **blocked by**: ~~an owner API ruling (where the generation comes from)~~ **superseded 2026-11-09** —
  the owner ruled generation-scoped isolation; not the boot budget.
- **acceptance criterion**: [`tests/world-factory/a5sf-pd1-revocation-escape.test.mjs`](../../../../tests/world-factory/a5sf-pd1-revocation-escape.test.mjs) — arms `PD-1 REFUSAL`, `PD-1 CONTRAST (live domain)`, `PD-1 IN-FLIGHT`, `PD-1 CONTRAST (new generation)`, `PD-1 REGISTER`; negative control and race-window transcript in the evidence README.
- **anchors**: `packages/runtime/team-sandbox/src/terminal.ts#L285` contains `async revoke(identity: TrustedMemberIdentity` ; `packages/runtime/team-sandbox/src/terminal.ts#L298` contains `revokedMembers.add(revokedKey)` ; `packages/runtime/team-sandbox/src/terminal.ts#L239` contains `revokedMembers.has(memberKey(identity))`
- **status**: FIXED — branch `task/a5sf-pd1-fix-20261109`, base `fb9584da5733918113b1dbd01b08d6931cfb1ddb`, draft PR **#629** (first line `PD1-FIX`; merge placeholder until it lands). Evidence: [a5sf-pd1-fix](../../../../dev/agent-workflow/evidence/a5sf-pd1-fix/README.md).

### PD-2 (F2) — the deferred PTY refusal fires after a legacy session is allocated

- **source**: `F2` in [a5sf-pty-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-face/README.md) §4
- **true today**: for a module that declares no `terminals` inject but calls
  `ctx.inject(['terminals'], …)` inside `apply`, the refusal is evaluated only after the settle
  window — in the arm the module's `apply` ran, resolved the inherited legacy service, allocated
  one backend session, and that session is still live when `TERMINALS_LEGACY_PTY_REFUSED` is
  thrown.
- **not true**: that the refusal is "before any allocation" for every shape (it is, for the
  declared shape only), and that a governed realm cannot hold a legacy PTY object.
- **security consequence**: **governance hole** — the object governance forbids exists inside the
  governed realm, created after the check that was supposed to prevent it. Scope: reachable from
  module `apply`, not from a model-facing tool (the module is still rejected, so no tool is
  exposed).
- **current backstop**: the typed refusal still fires and no tool definition is registered, so the
  model has no handle; `P4-CONTROL-INERT-MODULE-MOUNTS` shows the refusal is not blanket. The
  session itself is measured at a recorded port (a real PTY is `NOT_REACHED`).
- **smallest honest fix**: no local patch — the honest fix is PD-3 (a confined `terminals` face
  the deferred child would resolve instead of the inherited service); a composition-level pre-scan
  of deferred injects is not exposed by Cordis. Same size and owner decision as PD-3.
- **proof**: `P4-DEFERRED-REFUSAL-IS-POST-ALLOCATION` is replaced by an arm asserting 0
  allocations for the deferred shape; `P4-REFUSED-BEFORE-ALLOCATION` and
  `P4-CONTROL-INERT-MODULE-MOUNTS` stay green.
- **blocked by**: PD-3, plus a ruling on the Cordis seam (is a pre-scan available at all).
- **anchors**: `packages/runtime/team-services/src/mount.ts#L1630-L1641` contains `deferredTerminal` ; `packages/runtime/team-services/src/mount.ts#L1442-L1449` contains `A5SF_TERMINALS_LEGACY_PTY_REFUSED`

### PD-3 (GAP-PTY-CONTRACT-1) — there is no confined terminal face

- **source**: `GAP-PTY-CONTRACT-1` in [a5sf-pty-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-face/README.md) §4
- **true today**: `RealmServiceFaces` carries `fs`, `subprocess` and `web` and no `terminals`, so
  every native module that consumes `ctx.terminals` is refused at composition with
  `TERMINALS_LEGACY_PTY_REFUSED`, and there is nowhere to install a confined PTY backend.
- **not true**: that the Shell-PTY face is "wired but refused by policy" — there is no face, so
  the refusal is total and matrix rows [M-08](TOOL-ACCEPTANCE-MATRIX.md) /
  [M-13](TOOL-ACCEPTANCE-MATRIX.md) are `NOT_WIRED` for a structural reason.
- **security consequence**: **behavioural divergence** — a capability the phase names does not
  exist in the composed product. It grants a Member nothing, so it is not a hole.
- **current backstop**: the refusal itself is the fail-closed answer, and it is the only reason
  PD-1 and PD-2 are latent rather than exploitable.
- **smallest honest fix**: add `terminals` to `RealmServiceFaces` plus an install path plus a
  confined backend. This is [BL-17](ALPHA5-SANDBOX-BACKLOG.md)'s build, not a patch; size = a
  face and a backend. Owner decision.
- **proof**: a new arm mounting a confined terminal provider, with a declared-inject module served
  by it; the four faces' existing arms stay green; `TERMINALS_LEGACY_PTY_REFUSED` still refuses
  the *legacy* service only.
- **blocked by**: [BL-17](ALPHA5-SANDBOX-BACKLOG.md) (wiring) and [BL-42](ALPHA5-SANDBOX-BACKLOG.md) (a real
  network-deny backend, before "offline but functional" can be claimed); the boot budget for any live claim.
- **anchors**: `packages/runtime/team-services/src/install.ts#L441-L448` contains `const faces: RealmServiceFaces` ; `packages/runtime/team-services/src/mount.ts#L1442-L1449` contains `TERMINALS_LEGACY_PTY_REFUSED`

### PD-4 (P5) — the confined child drops upstream's proxy overlay

- **source**: `P5` in [a5sf-subprocess-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-subprocess-face/README.md) §3.5/§4
- **true today**: `confinedChildEnvironment` scrubs credential-shaped and `DSH_*` names and then
  applies the spec's overrides, with no proxy overlay; measured with real children and a published
  proxy, the unconfined child has `NODE_USE_ENV_PROXY=1` and the confined child has it absent, so
  a Node child on the confined lane connects directly while its unconfined sibling proxies.
- **not true**: that a confined child inherits "the same routing as its parent" — upstream's
  `scrubbedParentEnv` adds that flag and restores the proxy names; the Team helper does not.
- **security consequence**: **behavioural divergence** — the confined lane silently loses a
  host-level egress control the unconfined lane honours. It is not a confinement hole: the allow
  lane is ordinary egress either way and no Member permission changes; the deny lane never spawns.
- **current backstop**: the `network: deny` lane refuses to spawn, so there is no child to
  mismatch; credential scrubbing still applies on both lanes.
- **smallest honest fix**: either depend on the pinned `@deepseek-ai/dsh-subprocess` helper (adds
  a dependency to `team-services` and touches `pnpm-lock.yaml`) or re-implement the overlay
  (~10–15 lines in `subprocess.ts`). Changes the child environment → owner decision.
- **proof**: `P5-PROXY-DIVERGENCE` becomes an equality assertion (confined == unconfined for the
  flag and the proxy names under a published proxy); `P5-ENV-SCRUB` stays green.
- **blocked by**: an owner dependency/lockfile decision; not the boot budget.
- **anchors**: `packages/runtime/team-services/src/subprocess.ts#L1071-L1082` contains `export function confinedChildEnvironment` ; `packages/runtime/team-services/src/subprocess.ts#L1461` contains `confinedChildEnvironment(spec.env)`

### PD-5 (GAP-FS-CONTRACT-1) — routed `read_image` cannot resolve `fs`

- **source**: `GAP-FS-CONTRACT-1` in [a5sf-fs-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-fs-face/README.md) §6/§8
- **true today**: `ROUTED_SERVICE_NAMES` is `['tools', 'systemPrompt']`, so a routed deferred child
  is not given `fs`; the pinned `tool-fs` registers `read_image` from a deferred
  `ctx.inject(['attachments'])` child that resolves `ctx.fs`, so under route C the call throws
  `cannot get property "fs" without inject` before any provider call — and the routed definition
  shadows a preset definition that would have served.
- **not true**: that the lane refused the call (there is no guard fact), and that the shadowed
  preset definition still serves (the shadow is what makes the call fail).
- **security consequence**: **behavioural divergence** — fail-closed but unusable: zero provider
  reads, zero attachment bytes, zero guard facts. `read_image` is dead for route-C Members.
- **current backstop**: the throw is the backstop — nothing is read, nothing is materialised, so
  there is no unconfined read to fall back to.
- **smallest honest fix**: one product line (`ROUTED_SERVICE_NAMES` gains `'fs'`), the comment
  above it, and one test expectation (TA12's inject enumeration). Changes which `fs` a deferred
  child can reach — the confined realm's, not the inherited host's — but widens no lane; owner
  decision because it edits the routing seam.
- **proof**: `FSB-IMG-1` is replaced by the route-C variant of `FSB-IMG-2/3` (allowed ⇒ one
  `{image/png, 70 B, 1×1}` attachment through the confined provider; refused ⇒ 1 `stat` deny,
  0 `readBytes`); `FSB-IMG-4b`, `FSB-BIND-IMAGE` and TA12 stay green.
- **blocked by**: owner approval of the one-line diff; no BL item tracks it; not the boot budget.
- **anchors**: `packages/runtime/team-services/src/mount.ts#L430` contains `const ROUTED_SERVICE_NAMES = ['tools', 'systemPrompt'] as const` ; `packages/runtime/team-services/src/mount.ts#L560` contains `ROUTED_SERVICE_NAMES`

### PD-6 (GAP-SUB-CONTRACT-1) — the shipped transient shell cannot ride the confined face

- **source**: `GAP-SUB-CONTRACT-1` in [a5sf-subprocess-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-subprocess-face/README.md) §3.6/§4
- **true today**: the pinned `bash-local` builds `['bash', '-c', spec.command]` (a bare PATH name)
  and passes a spill collect mode; the confined face refuses a non-absolute `argv[0]` with
  `SUBPROCESS_PROGRAM_NOT_ABSOLUTE` and refuses a spill mode with `SUBPROCESS_STDIO_UNSUPPORTED`,
  so the shipped executor executes only unconfined.
- **not true**: that bash is refused because a lane denied it, and that the admitted P1/P2 vectors
  are module-shaped — they are face-shaped (they drive the face's declared argv, not the shipped
  executor).
- **security consequence**: **behavioural divergence** — fail-closed, nothing executes; a coverage
  gap, not a hole.
- **current backstop**: the face's absolute-program and stdio rules (0 provider calls, 0 spawns).
- **smallest honest fix**: a mediated executor wrapper that supplies an absolute program and drops
  the spill disposition (~30–60 lines plus arms); an upstream change is forbidden by
  `CORE_PATCH_BUDGET = 0`. Changes the mediated executor shape → owner decision.
- **proof**: `GEN-NATIVE-MODULE-BOUNDARY` flips from "refused at `argv[0]`" to "runs, with the
  read/write lane still enforced"; `P1-ARGV-*` and `P2-*` stay green.
- **blocked by**: [BL-17](ALPHA5-SANDBOX-BACKLOG.md) (shell-class wiring) and the owner's decision to expose
  `bash` at all; [BL-42](ALPHA5-SANDBOX-BACKLOG.md) before any "offline but functional" claim.
- **anchors**: `packages/runtime/team-services/src/subprocess.ts#L1230-L1236` contains `if (!isAbsolute(program))` ; `packages/runtime/team-services/src/subprocess.ts#L1210-L1214` contains `a spill file is not produced by this provider`

### PD-7 (F4) — a stale-but-live shell is reported `active`

- **source**: `F4` in [a5sf-pty-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-face/README.md) §4
- **true today**: **fixed.** Before this fix, after the policy revision moved, a shell that was
  not re-acquired stayed in `list()` as `status: 'active'` while `assertCurrent` refused every
  command with `REVISION_STALE`; only `killDomain` wrote `status`, and the registry has no
  per-domain kill. The cause was that `status` is creation-time bookkeeping
  (`terminal.ts#L209`) and `list()` returned the stored domains verbatim, never asking the
  command gate.
- **not true**: that `active` in `list()` means the shell may run commands, and that the status
  surface reports the state the command gate enforces.
- **security consequence**: **evidence-quality** — the product's own state report is false for a
  live object, and an operator or auditor acting on `list()` is misled. No Member capability
  changes: commands are refused and the product face has no write channel (PD-9).
- **current backstop**: `assertCurrent` refuses commands on a stale domain with a typed code; the
  PTY is still open, but nothing can be commanded through the registry.
- **smallest honest fix**: **landed.** `assertCurrent` is now one closure function that both the
  command gate and `list()` call, and a refused domain is projected as `stale`; the stored
  `status` is not mutated by a read and no authority changed. Correctness only: `'stale'` was
  already in the status set.
- **proof**: `P5-STALE-DOMAIN-REPORTS-STALE` is the guarding arm (a stale-but-live domain; the
  reported status must equal the gate's answer, with a current-revision control);
  `P5-KILL-ONE-NOT-THE-OTHER` changes its asserted status for the non-re-acquired binding from
  `active` to `stale`; `P1-ONE-ALLOCATE-PER-SESSION` and `P3-REGISTRY-REAP` stay green.
- **blocked by**: nothing; a host-free arm carries it; not the boot budget.
- **anchors**: `packages/runtime/team-sandbox/src/terminal.ts#L272` contains `function assertCurrent(domainId: string)` ; `packages/runtime/team-sandbox/src/terminal.ts#L312` contains `list(): readonly TerminalDomain[]`
- **status**: FIXED — branch `task/a5sf-pd7-20261107`, fix commit `e37f9520f984e466a75f027823f4acb5b4f3d3ec` (draft PR #619, first line `PD-7-FIX`). Evidence: [PD-7-stale-active](../../../../dev/agent-workflow/evidence/a5sf-product-debt/PD-7-stale-active/README.md).

### PD-8 (F1) — the shutdown receipt cannot tell an exit from a kill

- **source**: `F1` in [a5sf-pty-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-face/README.md) §4
- **true today**: `PtyHandle` exposes pid, backend, `descendants()` and `kill()` and no status;
  `killDomain` swallows the port's error and derives `killed: true` from the registry's own
  bookkeeping, so a process that had already exited and one the registry SIGKILLed produce the
  same receipt row.
- **not true**: that `killed: true` means the registry terminated the process, and that the receipt
  records the process's fate.
- **security consequence**: **evidence-quality** — the product's only termination record is
  bookkeeping, not an observation. No permission changes; nothing consumes the receipt today.
- **current backstop**: none needed for confinement; the field is truthful once read as
  bookkeeping, which the README says explicitly.
- **smallest honest fix**: an optional `status?()` on `PtyHandle` plus an `outcome` field on the
  receipt row (~20–40 lines including types). A new public port member → owner decision.
- **proof**: `P2-REGISTRY-COLLAPSES-EXIT-OUTCOMES` asserts three distinct outcomes;
  `P2-HOST-DISTINGUISHES-OUTCOMES` (pinned service) stays green.
- **blocked by**: an owner API ruling; not the boot budget.
- **anchors**: `packages/runtime/team-sandbox/src/terminal.ts#L51-L57` contains `export interface PtyHandle` ; `packages/runtime/team-sandbox/src/terminal.ts#L327` contains `killed: domain.status === 'terminated'`

### PD-9 (GAP-PTY-CONTRACT-2) — P1's "write" and "read" are a command gate and an audit

- **source**: `GAP-PTY-CONTRACT-2` in [a5sf-pty-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-face/README.md) §4
- **true today**: **fixed.** Before this fix the P1 contract property was written
  `create → write → read → kill → reap` and the gate arm was named
  `P1-NO-COMMAND-AFTER-KILL`, so a reader could take both for a byte channel. The product
  face still has no I/O channel (`PtyHandle` is pid, backend, `descendants()`, `kill()`):
  the per-command operation is the **command gate** (`assertCurrent` admits or refuses a
  *command request* against the current policy revision) and the only "read" is the
  **descendant audit** (what the recorded handle reports about descendants). Nothing about
  bytes through a PTY (flow control, EOF, `SIGHUP`, scrollback) is representable.
- **not true**: that the layer-B arms prove the PTY write/read path — they prove the command
  gate and the port's report. The README now states this once explicitly, the property label
  names the gate and the audit, and the gate arm is
  `P1-COMMAND-REQUEST-GATE-REFUSES-AFTER-KILL`.
- **security consequence**: **evidence-quality** — the arm names claimed more than the
  assertion, so a later reader could cite P1 as byte-path evidence it never was. No Member
  capability changes; nothing about enforcement moved.
- **current backstop**: not applicable — no product path exposes bytes; the pinned service's own
  arms (`P1-HOST-SESSION-LIFECYCLE`, `P2-HOST-*`) cover its channel.
- **smallest honest fix**: **landed.** Rename/re-describe only: the P1 gate arm, the P1
  property label and its prose in the test header and README §3/§4; every assertion is
  unchanged. A targeted guard in `a5sf-debt-register.test.mjs` fails if a product-registry
  arm title names WRITE/READ while `PtyHandle` has no such channel, or if the README sentence
  disappears.
- **proof**: `P1-COMMAND-REQUEST-GATE-REFUSES-AFTER-KILL` (same assertions as the old
  `P1-NO-COMMAND-AFTER-KILL`); `P1-ONE-ALLOCATE-PER-SESSION` and `P3-REGISTRY-REAP` stay
  green; PTY suite 15/15; all `a5sf-*` 410/410 before and 411/411 after (the
  extra case is this guard).
- **blocked by**: nothing for the rename; the channel itself is PD-3's build.
- **anchors**: `packages/runtime/team-sandbox/src/terminal.ts#L51-L57` contains `descendants(): readonly number[]` ; `tests/world-factory/a5sf-pty-contract.test.mjs#L98` contains `P1-ONE-ALLOCATE-PER-SESSION`
- **status**: FIXED — branch `task/a5sf-pd9-20261108`, fix commit `7182b8f7678123eaeccfbe603533c990d0706586` (draft PR #620, first line `PD-9-FIX`). Correction note: [a5sf-pty-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-face/README.md) §3 (PD-9).

### PD-10 (GAP-WEB-CONTRACT-1) — every real `web_search` fact records a malformed marker

- **source**: `GAP-WEB-CONTRACT-1` in [a5sf-web-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-web-face/README.md) §3.4/§4
- **true today**: `declaredUrlOf` reads `{url}` or a `{queries: [...]}` array; the pinned
  `tool-web` sends `{query, maxResults}`, so a product `web_search` fact records
  `<search:malformed-request>` and the `queries:N` branch is unreachable for the product path.
- **not true**: that the marker means the tool sent a malformed request (it means the face does
  not read the tool's shape), and that the fact names what was consulted.
- **security consequence**: **evidence-quality** — the decision (method, decision, lane) is still
  recorded and enforcement is unchanged: one guard evaluation per query.
- **current backstop**: not applicable — nothing is enforced differently, and the query text is
  deliberately not leaked.
- **smallest honest fix**: one branch in `web.ts` (`typeof request.query === 'string'` →
  `queries:1`), ~4 lines plus the arm's expected locator. Changes a recorded value → owner
  decision, though small.
- **proof**: the web-search arm asserts `queries:1`, one fact per query, and that the query text is
  still absent; `P4-SHARED-GUARD-BOTH-PATHS` and `P1-GUARD-BEFORE-PROVIDER` stay green.
- **blocked by**: owner approval; not the boot budget.
- **anchors**: `packages/runtime/team-services/src/web.ts#L240` contains `function declaredUrlOf` ; `packages/runtime/team-services/src/web.ts#L246` contains `queries:${String(queries.length)}` ; `packages/runtime/team-services/src/web.ts#L249` contains `<${kind}:malformed-request>`

## 3. Ranking rationale

Ranked by **what a Member could do**, not by fix size:

1. **PD-1 before PD-2.** Only these two pass the hole test. PD-1 first because revocation is the
   act by which the authority withdraws: a withdrawal a Member can outrun is the one failure a
   governance system cannot absorb. **(PD-1 was fixed 2026-11-09 — this ranking is the historical
   rationale, not an open instruction.)** PD-2 second because the forbidden object (a live legacy PTY)
   does exist inside a governed realm, but no model-facing handle reaches it — the hole is at the
   composition boundary, not in a tool.
2. **PD-3 third although it grants nothing.** It is the only backstop keeping PD-1/PD-2 latent
   and the only honest fix for PD-2. **Ship-order constraint: wiring the terminal face (PD-3)
   without fixing PD-1 and PD-2 turns two latent holes into live ones.**
3. **PD-4 to PD-6 are behaviour on faces that are wired today**: a real child's egress routing
   (PD-4), a dead tool (PD-5), a shell that cannot run (PD-6). They change what a call *does*, not
   what a Member is *allowed* to do. PD-4 leads the three because it alters the egress routing of a
   call that otherwise works; PD-5 and PD-6 lose a capability, which is visible to the operator only
   when a Member reports it.
4. **PD-7 and PD-8 are the product's own records of a live object being wrong** (status, receipt).
   They rank below the behaviour rows because the object can still be asked, and above the
   citations because a record is what a review or an incident report quotes.
5. **PD-9 and PD-10 are citation defects**: the code is right (PD-10) or the shell is honest
   (PD-9); what is wrong is what a reader would conclude. No row is classed `none` — an item with
   no consequence would not be a debt.

**If only one row is fixed, fix PD-1.** A governance system whose revocation does not bind has no
Member axis to speak of; the other nine are consequences, records or citations. None of the ten
needs a boot to decide, fix, or verify: every fix lands with a host-free arm and every proof names
the arm that must change and the arms that must stay green.

## 4. Not on this list, deliberately

- **"`allow fetch / deny search` is not expressible."** A product statement, not a bug: one
  compiled `network.access` field and one guard serve both call paths
  ([a5sf-web-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-web-face/README.md) §3.4;
  [TOOL-ACCEPTANCE-MATRIX.md](TOOL-ACCEPTANCE-MATRIX.md) §1.1.1).
  Listing it would ask the owner to "fix" a design.
- **"Refusing to spawn is not network isolation."** A truth about evidence, not a defect: the
  refusal is our own admission code and the OS was never asked ([a5sf-subprocess-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-subprocess-face/README.md) §7,
  [a5sf-web-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-web-face/README.md) §7). The missing
  thing is a backend — [BL-42](ALPHA5-SANDBOX-BACKLOG.md).
- **The kernel read allowance includes `/etc` and `/proc`.** A disclosed allowance tracked as
  [BL-39](ALPHA5-SANDBOX-BACKLOG.md) (read-exception hardening), with its own scope and
  acceptance; not duplicated here.
- **A create outside the read lane succeeds while an overwrite is refused.** The write⇒read
  asymmetry is product semantics owned by [BL-38](ALPHA5-SANDBOX-BACKLOG.md) (`DEFERRED`, owner-owned), not a defect of the arms that
  measured it ([a5sf-fs-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-fs-face/README.md)
  §2.5.a).
- **The arms pin `LocalFileSystem`, not the live `SandboxedFileSystem` subclass.** An evidence
  boundary (layer C), not a product defect ([a5sf-fs-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-fs-face/README.md) §5.2). *Note: the brief for
  this register called this "the proxy note"; the FS README contains no proxy text — verified
  2026-11-07 — so no row was manufactured from it.*
- **The hosted runner has no pinned host, so the layer-B cases register as SKIPPED and the CI
  layer job is green at `pass 0`.** An evidence-provisioning gap, reported with two provisioning
  proposals in §10 of the [FS](../../../../dev/agent-workflow/evidence/a5sf-fs-face/README.md),
  [Subprocess](../../../../dev/agent-workflow/evidence/a5sf-subprocess-face/README.md) and
  [Web](../../../../dev/agent-workflow/evidence/a5sf-web-face/README.md) READMEs. It changes no Member × Tool behaviour,
  so it is not a product debt; if the owner wants it ranked it belongs to a different class
  (evidence infrastructure) and would sit with PD-9/PD-10.

## 5. How this file is kept honest

`tests/world-factory/a5sf-debt-register.test.mjs` parses this file and reds when:

- a row's source finding no longer appears in the evidence file that originated it (a fix landed
  elsewhere and this register was not updated);
- an anchor line (`path#Lstart-Lend`) no longer contains the substring the row claims;
- ids are not unique and contiguous `PD-1…PD-n` in document order;
- a row loses any required field, or the summary table and the detail block disagree on a row's
  consequence class.

Anchors are **tracked files only**. The pinned host tree (`tests/deepseek-harness-test-use`) is
gitignored and is cited in prose (e.g. `bash-local/src/index.ts:188`,
`subprocess/src/index.ts:66`, `tool-web/src/search.ts:238`) but never asserted, because a cold
clone cannot open it.

No row is marked `UNVERIFIED`: every "true today" sentence traces to the named evidence section,
or to an anchor line verified on 2026-11-07. Two facts are deliberately scoped — PD-2's liveness
is a session-level fact measured at a recorded port (an OS-level PTY observation would need the
boot in the PTY README §5), and PD-4's proxy table is an evidence measurement, not a re-run here.

Gates: `node --test tests/world-factory/a5sf-debt-register.test.mjs`,
`node scripts/doc-checks.mjs`, `git diff --check`.
