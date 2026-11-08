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
>
> **2026-11-10 (LIVE-DEBT — this revision; every sentence above is unchanged).** Four live
> dev-live results are folded in. Two of them are **governance holes that were inferred before
> and are now measured**: PD-12 (`network: deny` does not govern the model-visible `bash`) and
> PD-13 (the terminal path has no read axis). PD-14 records the sandbox-root divergence. PD-11
> is **adopted** from the `TEST-WORLD` attribution lane, whose register-format row was filed
> under `dev/agent-workflow/evidence/a5sf-domain-attrib/`. PD-6 and PD-10 are **annotated, not
> duplicated**; the `chmod` gap gets **no row at all** because it is already disclosed in
> [BL-17](ALPHA5-SANDBOX-BACKLOG.md) — it is annotated `LIVE-REPRODUCED` there instead (§4).
> PD-12…PD-14 cite `DEV-LIVE` evidence carried on two unmerged branches (§6). That evidence is
> **live development evidence — not a candidate claim, not a matrix grade, and structurally
> incapable of `V@B=yes`** (the run-record finalizer refuses to grade a `DEV-LIVE` record as
> candidate evidence). **No `V@B` moves because of this revision, and this revision itself ran
> 0 boots.**

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
| PD-11 (D1) | Boot | A shared-domain teardown is reported as `TeamDomain is closed` and the detached boot keeps writing into it | evidence-quality | semantics |
| PD-12 (Q5) | Subprocess | `network: deny` never governs the model-visible `bash`; the child runs with no network namespace **(FIXED)** | governance hole | semantics |
| PD-13 (READ-AXIS) | Shell-PTY | The terminal path has no read axis: a Member's own shell read a write-only-lane secret and returned its bytes **(FIXED)** | governance hole | semantics |
| PD-14 (SANDBOX-ROOT) | Subprocess | A Member session's sandbox root is the pinned host checkout, not the World workspace **(FIXED)** | behavioural divergence | semantics |
| PD-15 (FACE-BOUND-PROOF) | Web | A network-enforcement proof is not bound to the face that consumes it **(FIXED)** | governance hole | semantics |
| PD-16 (SEARCH-FACE) | Subprocess | A governed Member's `grep`/`glob` ran on the inherited host `subprocess`, not the confined face **(FIXED)** | governance hole | semantics |
| PD-17 (FS-FACE) | FS | A governed Member's `read`/`write`/`edit`/`read_image` ran on the inherited base `fs-sandbox`, not the confined face **(FIXED)** | governance hole | semantics |
| PD-18 (WEB-PTC) | Web / External | `web_fetch`/`web_search`/`workflow` executed on host services with zero a5sf facts; closed by **fail-closed removal** — a capability regression, not an enforcement **(FIXED)** | governance hole | semantics |
| PD-19 (FACT-ATTR) | Cross-face | A guard fact did not name the tool call it was decided for (`tool`/`callId` never designed in) **(FIXED)** | evidence-quality | semantics |
| PD-20 (B1-LIFECYCLE-CLOSE) | Subprocess | `team_archive_member` promised "current work is interrupted"; a RUNNING Member kept obtaining NEW confined sessions inside the quiesce window **(FIXED, DEV-LIVE)** | governance hole | semantics |
| PD-21 (C3-CLOSED-SCHEMA) | Subprocess | An undeclared `run_in_background` was silently dropped: the command ran in the foreground with no job id **(FIXED, DEV-LIVE)** | behavioural divergence | semantics |
| PD-22 (SUBAGENT-CHILD-REALM) | Subagent | A governed Member's `subagent` child ran on the HOST's realm (29 out-of-lane bytes, secret in 5/14 model requests, zero guard facts) and carried `subagent` itself; closed by **fail-closed removal of the `delegation` group** — a capability regression, not an enforcement **(DRAFT)** | governance hole | semantics |
| PD-23 (CONTROL-SURFACE) | Mixed (control / skill) | A governed Member's remaining control-plane surface: `send_message`/`interrupt_agent`/`list_agents` could only refuse or lie (`accepted` with no effect — and they left with the PD-22 group), while the `skill` body read ran on the BASE `fs` — an out-of-lane body with **zero** guard facts, so **the opt-in governed preset now offers no skills at all**; closed by **fail-closed removal (capability regression)** **(DRAFT)** | governance hole | semantics |
| PD-24 (SURFACE-LEDGER) | FS (host service) | A governed Member's `present` stat'ed/read paths through the BASE `fs`: a real **out-of-lane** file was accepted and a missing one refused `file not found` — a cross-lane existence oracle with **zero** guard facts — while the other two never-measured rows turned out to be typed refusals and `ask_user_question` was found to **block** a delegated turn; `present` closed by **fail-closed removal (capability regression)**, the block disclosed **(DRAFT)** | governance hole | semantics |
| PD-25 (UNBOUNDED-TURN) | Goal / Ask (per-session execution) | The ceiling bounds one call, not the series (**PD-25**; renumbered from PD-24 when #673 took that id; member surface **34 → 30**, **29** on the merged tree): a delegated governed Member's `create_goal` is ACCEPTED, 5/5 observed automatic rounds ran in 0.90 s with the round budget (**256** default) writable by the Member (`update_goal edit max_goal_rounds=9007199254740991` → accepted), one turn executed **30/30** sequential `bash` calls with no cap, and `ask_user_question` **blocked the delegation indefinitely**; closed for the goal/ask tools by **fail-closed removal (capability regression)** **(DRAFT)** | governance hole | semantics |
| PD-26 (CONFINED-SKILL) | Mixed (skill / deliverables) | A governed Member could read **neither** skill bodies nor declare deliverables: PD-23 and PD-24 fail-closed both rows rather than let them read the BASE `fs` — the opt-in governed preset offered no skills and no delivery. PD-26 restores both **names** and serves every body read and every present `lstat`/`stat` from the Member's **confined** `fs`: in-lane reads return, out-of-lane reads are a typed `IO_READ_DENIED` with 0 bytes and exactly one deny fact **(FIXED, DEV-LIVE)** | governance hole | semantics |
| PD-28 (SERVICE-SEAM) | Mixed (skill / deliverables) | PD-26 restored `skill`/`present` by writing **two Team tool modules that copied the pinned host definitions** — a consumer fork, so the safety claim depended on our copy being correct and "a tool the Member can see" had become the default unit of work. The audit holds: `tool-skill` only calls `ctx.skills.list()/get()` and `tool-present` only calls `ctx.fs.*` + `ctx.on("tools/result")`; what was missing was the **service**, and the event seam. PD-28 deletes both forks, mounts a Team `skills` **provider** on the realm (bodies read through the confined `fs`) and re-mounts the **pinned host** `present` package DIRECTLY (no registration router, so its own `tools/result` listener fires): in-lane body/allow + 1 deny fact out-of-lane, in-lane present + **exactly 1** `deliverables/presented`, 0 bytes out-of-lane **(FIXED, DEV-LIVE)** | governance hole | semantics |

**`decision = semantics`** means the fix changes product-observable behaviour (a signature, an
environment, a recorded value, which provider a child reaches) and therefore needs the owner;
**`decision = correctness`** means the fix only makes the product report what it already does.

> **2026-11-08 状态更新（ALPHA5-CONSOLIDATE；只追加，不改任何行文）**：PD-7 与 PD-9 的 `status`
> 行写于两条 PR 还是 draft 的时候。`git log origin/master` 显示二者已 squash 合入：
> **PD-7 = `572a7625d`（#619）**、**PD-9 = `bab33c4c6`（#620）**。因此按“FIXED 只在合并 PR 说了
> 才算”的口径，这两行现在是 `FIXED`（有已合并 PR），其余 **8 行仍 `OPEN` 且仍待 owner 决策**。
> 状态汇总表在 `ALPHA5-END-STATE.md` §2；本文件 §2 的逐条详情、验收条件与 anchors 一字未动。

> **2026-11-10 状态更新（LIVE-DEBT；只追加，不改任何行文）**：本文件从 **10 行**变为 **14 行**，
> 但**只有 4 行是新的**：PD-11 是从 `evidence/a5sf-domain-attrib/` 认领的既有行（该 lane 已经写好
> 完整行文并明说“待插入 PD-11”），PD-12/PD-13/PD-14 是 dev-live 弧实测出来的新行。**没有**为
> `chmod` 缺口新建行（`BL-17` 已经披露，本次只在那边标注 `LIVE-REPRODUCED`），也**没有**为
> web locator 或拒绝记录不对称新建行（并入 PD-10 的 2026-11-10 标注）。PD-6 的后果类别句子在
> deny 车道上被实测推翻，**行文保留、追加标注**，新洞记在 PD-12。四条新行的证据现在**全部在本树**
> （PR #634/#635 已合并；PD-12 的修复证据在 `evidence/a5sf-pd12-fix/`，仍是 draft PR 的 DEV-LIVE 证据）。
> “行数 14、待裁决 **10**（PD-1/PD-7/PD-9/PD-12 已 FIXED）”这个数字随之更新；`V@B` 不因此变动。

> **2026-11-11 状态更新（PD-14；只追加，不改任何既有行文）**：**PD-14 现在 `FIXED`**。它是本册唯一
> 一条**夹具层**闭合的缺陷：修复面是 `tests/world-factory/lib/team-workspace.mjs` +
> `TestWorld.startHost` 的唯一行装配点，**没有**改 `packages/**`、**没有**改 upstream、**0 次启动**。
> 立的法是“World 的 Team 行没声明 workspace 时绑到本 World 自己的 `<home>/workspace`，并且**拒绝**
> 把 pinned checkout（或其子目录）或 home 之外任何路径声明成 Member 的可写根”。因此本行的
> behavioral divergence 对**真实用户**依然按产品契约成立（产品仍以 operator 的启动目录为默认），
> 这里关掉的是**我们的 World 测出来的那条**：Member 的 `bash` 子进程不再 `--bind` 可写地挂在
> 共享的 pinned checkout 上。已知残余（产品默认的风险、读边界未动、`config.workspaceRoot` 对 Team
> session 不再可达、十二个 assembly 未逐一起机）逐条写在该行 `status` 与
> `dev/agent-workflow/evidence/a5sf-pd14-fix/README.md` §9，**`V@B` 不因此变动**。

> **2026-11-11（PD15-FIX，docs-only 审计；只追加，不改任何既有行文）**：本册的 `status` 行与 at-a-glance 表此前不一致——PD-12/PD-13/PD-14 写 “draft PR, no merge”，但三者都已是 `origin/master` 的祖先（`550815c97`/#640、`c91c72bca`/#642、`47316541a`/#643），且表里 PD-13/PD-14 标 `(FIXED)` 而 PD-12 没标；用同一条 `git merge-base --is-ancestor` 核对其余 `FIXED` 行又发现 PD-1（draft #629 → `d7d6a8e00`/#629）、PD-7（分支 commit `e37f9520f…` 非祖先 → squash `572a7625d`/#619）、PD-9（分支 commit `7182b8f76…` 非祖先 → squash `bab33c4c6`/#620）的状态行同样过期。该不一致由一条 **docs-only lane** 发现（#645 review 同时点名），本 lane（`task/a5sf-pd15-face-bound-proof-20261111`）按逐行核对结果改正了 status 行与 at-a-glance 表；没有 `UNVERIFIED` 行，历史 dated 注记保留原文。

> **2026-11-14 状态更新（POSTFIX-DOCS；只追加，不改任何既有行文）**：本册从 **15 行**变为 **19 行**，
> 新增 **PD-16 / PD-17 / PD-18 / PD-19**，四行全部 `FIXED` 且都有已合并 PR：
> **PD-16 = #661 → `bd952e7d0`**（`grep`/`glob` 进 confined `subprocess` face）、
> **PD-17 = #664 → `03e2edf87`**（四个 FS 工具进 confined `fs` face）、
> **PD-18 = #668 → `36f3a12b8`**（web/PTC **fail-closed 移除**）、
> **PD-19 = #667 → `9a37321fb`**（fact 增加 optional `tool` + `callId`）。
> 四条编号连续，行文各自写明“修复的证据类别 = `DEV-LIVE` / host-free、no `V@B`、无等级移动”。
> **PD-18 特别标注：它是能力回退，不是“已受治”**——`web_fetch`/`web_search`/`workflow` 从受治 preset
> 移除后是 typed `UNKNOWN_TOOL`、0 执行，`standard` preset 仍声明它们。本册行数 19、`V@B` 不因此变动。
> 逐工具现状（受治 7 / 表面存在但不受治 33 / 完全不在面 13）= `TOOL-ACCEPTANCE-MATRIX.md` §1.7。
> **2026-11-15 状态更新（PD20-LIFECYCLE；只追加，不改任何既有行文）**：本册从 **19 行**变为 **21 行**，接在 POSTFIX-DOCS 的 PD-16…PD-19 之后取下一批连续编号（那四条已占用 16–19，本轮的同一个 `PD-1…PD-n` 连续法因此要求 20/21；轮次身份只写在 sourceId 里，不另立编号系列）。
> 两条新行来自 C 面 recon（`evidence/a5sf-recon-shell/` §B-1 与 §C-3/B-2）在**修复后**的重新实测：
> **PD-20 = B-1 生命周期关闭**（archive 请求后、durable commit 前，被 archive 的 Member 仍能拿到新的
> confined session；实测 8.56 s / 8.72 s）、**PD-21 = C-3/B-2 闭集参数静默丢弃**（`run_in_background`
> 不在 `bash` 的闭集 schema 里，参数被丢弃、命令以前台执行、没有 job id）。两条都取**下一批连续编号**
> （本册的自检法是 `PD-1…PD-n` 连续），轮次身份写在 sourceId 里：`B1-LIFECYCLE-CLOSE` / `C3-CLOSED-SCHEMA`。两者都已修，证据 = `evidence/pd20-lifecycle/`
> 的**两次 DEV-LIVE boot**（`recordClass=DEV-LIVE`、`eligible=false`，不是 candidate 证据），修复同轮的
> host-free 套件与 p4t6 booking 也在同一目录。`V@B` 与 matrix ⑧/⑨ 不因此变动。

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
- **status**: FIXED — branch `task/a5sf-pd1-fix-20261109`, base `fb9584da5733918113b1dbd01b08d6931cfb1ddb`, merged at **`d7d6a8e00`** as PR **#629** (first line `PD1-FIX`). Evidence: [a5sf-pd1-fix](../../../../dev/agent-workflow/evidence/a5sf-pd1-fix/README.md).

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
- **anchors**: `packages/runtime/team-services/src/mount.ts#L1817-L1817` contains `deferredTerminal` ; `packages/runtime/team-services/src/mount.ts#L294-L294` contains `A5SF_TERMINALS_LEGACY_PTY_REFUSED`

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
- **anchors**: `packages/runtime/team-services/src/install.ts#L593-L606` contains `const faces: RealmServiceFaces` ; `packages/runtime/team-services/src/mount.ts#L291-L291` contains `TERMINALS_LEGACY_PTY_REFUSED`
- **2026-11-11 annotation (PD-13 build)**: the structural half of this row is closed.
  `RealmServiceFaces` now carries a TOTAL `terminals` answer
  (`ConfinedTerminalSurface | null`), `installMemberIoProviders` installs a confined terminal face on
  the Member's isolated scope when a composition declares one, and `mountNativeToolModules` admits a
  `terminals`-consuming native module **iff** `faces.terminals !== null` (the refusal is unchanged and
  still fires for every realm that answers `null`, i.e. every realm today). What is NOT done here is
  the product decision: no shipped composition declares a terminal face yet, so matrix rows M-08 /
  M-13 stay `NOT_WIRED` until an owner wiring round declares it. The refusal remains the fail-closed
  answer, and the double-terminal fork is now refused explicitly
  (`TERMINALS_DOUBLE_TERMINAL_REFUSED`) instead of being left to composition order.

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
- **anchors**: `packages/runtime/team-services/src/subprocess.ts#L1153-L1165` contains `export function confinedChildEnvironment` ; `packages/runtime/team-services/src/subprocess.ts#L1543` contains `confinedChildEnvironment(spec.env)`

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
- **anchors**: `packages/runtime/team-services/src/mount.ts#L445-L445` contains `const ROUTED_SERVICE_NAMES = ['tools', 'systemPrompt'] as const` ; `packages/runtime/team-services/src/mount.ts#L445-L445` contains `ROUTED_SERVICE_NAMES`

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
- **anchors**: `packages/runtime/team-services/src/subprocess.ts#L1312-L1318` contains `if (!isAbsolute(program))` ; `packages/runtime/team-services/src/subprocess.ts#L1291-L1296` contains `a spill file is not produced by this provider`
- **2026-11-10 LIVED annotation (append-only; the fields above are not edited)**: this row's *fact*
  — the shipped transient shell cannot ride the confined face — **stays true and is now measured
  live** (a Member's `bash` is served by `SandboxBashExecutor` on the base subprocess service, with
  0 calls into the confined provider). Its *consequence sentence* — "fail-closed, nothing executes;
  a coverage gap, **not a hole**" — is **contradicted on the `network: deny` lane**: nothing
  fail-closes, the child runs, and it runs outside the deny. The class of the hole itself is
  recorded as its own row, **PD-12**, so this row is not re-graded and not duplicated; read PD-6 as
  "a coverage gap for an *allow* lane, and the mechanism that makes PD-12 reachable". Evidence:
  `Q5` in `a5sf-sub-devlive/README.md` (§6 of this file names its branch), boots 10/11.

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
- **status**: FIXED — branch `task/a5sf-pd7-20261107`, merged at squash commit **`572a7625d`** as PR **#619** (first line `PD-7-FIX`); the branch fix commit `e37f9520f…` is not an ancestor of master. Evidence: [PD-7-stale-active](../../../../dev/agent-workflow/evidence/a5sf-product-debt/PD-7-stale-active/README.md).

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
- **status**: FIXED — branch `task/a5sf-pd9-20261108`, merged at squash commit **`bab33c4c6`** as PR **#620** (first line `PD-9-FIX`); the branch fix commit `7182b8f76…` is not an ancestor of master. Correction note: [a5sf-pty-face/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-face/README.md) §3 (PD-9).

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
- **anchors**: `packages/runtime/team-services/src/web.ts#L313` contains `function declaredUrlOf` ; `packages/runtime/team-services/src/web.ts#L319` contains `queries:${String(queries.length)}` ; `packages/runtime/team-services/src/web.ts#L322` contains `<${kind}:malformed-request>`
- **2026-11-10 LIVE-EVIDENCE annotation (append-only; the fields above are not edited)** — two
  evidence-quality items, folded here rather than given rows of their own, because both say the
  same thing PD-10 says: *the record does not say what it appears to say*.
  1. **The locator defect is now live-measured, not inferred.** On a real Host the model's own
     `web_search` call produced exactly one guard fact (`decision: deny`,
     `decidedBy: NETWORK_UNCONFINED_REALM`, `method: web:search`, 0 provider entries on all five
     channels) whose locator is `<search:malformed-request>`; the fetch lane's locator is the
     real URL. Artefacts: `run-06/item-web-deny-search.json`, `run-06/guard-facts.json`,
     `run-07/…` (the agreeing pair) in `evidence/a5sf-web-devlive/`. The same session also shows
     `toolBindingIdentity: null` on both guard facts even though the offer row names `team/web` as
     the binding — the fact carries `realm: member` and the Member instance, not the binding id.
     That null is **cross-face**: the Shell-PTY lane's `guard-facts.json` carries it on both of its
     facts too, so it is a property of the guard-consult record, not of the web face.
  2. **Which refusals leave a record is not uniform — an auditability asymmetry, not a bug.**
     Measured on the Subprocess face: the three shell-shape refusals
     (`SUBPROCESS_SHELL_ARGV_UNSUPPORTED`) each write **exactly one** guard fact
     (`method: spawn`, `decidedBy: IO_READ_DENIED`, one consultation row per refusal), while the
     **two** most consequential refusals write **zero**: `NETWORK_UNCONFINED_REALM` and
     `SUBPROCESS_PROGRAM_NOT_ABSOLUTE` are thrown by the confined face *before* it consults the
     guard, so the sink is legitimately empty. A reviewer must not read "0 guard facts" as "nothing
     was refused", and must not read "1 guard fact" as "the lane decided it" — the typed code lives
     on the caller's refusal, and for shell-shape refusals the fact's `decidedBy` is the observed
     transport (`IO_READ_DENIED`), not the argv refusal. Artefacts:
     `runs/boot10/consultations.jsonl` (5 rows: 2 allow + 3 denials), `runs/boot10/probe-report.json`
     (`argvPredicate`, `denyBash`), `driver/guard-facts.json`. **No new row:** the asymmetry is not a
     capability change; it is a limit on how much an empty sink proves, and it belongs with PD-10's
     "the record is not the claim".

### PD-11 (D1) — a shared-domain teardown is reported as `TeamDomain is closed`

- **source**: `D1` in [DEBT-ROW-PD-11.md](../../../../dev/agent-workflow/evidence/a5sf-domain-attrib/DEBT-ROW-PD-11.md) — the register-format row the `TEST-WORLD` attribution lane filed for adoption; its evidence is [a5sf-domain-attrib/README.md](../../../../dev/agent-workflow/evidence/a5sf-domain-attrib/README.md) §3 and §7.
- **true today**: the production row's `apply()` returns before its tracked `ready` promise settles,
  and the rejection handler only logs and swallows it. The TeamDomain is opened on the **shared**
  upstream `storageDomain` facility, which another fiber owns; when that facility is disposed inside
  the boot window (loader unwind, `Fiber._reload`, a world teardown) its disposer closes the Team
  domain under the still-pending bootstrap. The next repository touch then fails as
  `TeamDomainError('NOT_OPEN', "store '<store>' operation '<op>' was rejected: the TeamDomain is
  closed")`, which is indistinguishable from a genuine domain-lifecycle failure of this row. Because
  the bootstrap is detached, the write is attempted **after** the row/tree was disposed; the row-stop
  disposer is the only closer that waits for `ready`, so an independent facility disposal is
  invisible to it.
- **not true**: that `TeamDomain is closed` identifies who closed the domain or why; and that a
  boot-window teardown is a no-op for the detached bootstrap. Neither the store/op in the message nor
  the presence of the message implicates any row's composition.
- **security consequence**: **evidence-quality** — no Member gains anything; the cost is an
  operator-facing false lead. A teardown of the host's storage plane is reported as a Team-domain
  defect, which is how one wasted start (#5 of 5) and a wrong turn toward row composition were
  produced. It can also mask a real storage failure of the same shape.
- **current backstop**: the console line `[dsh-agent-team] bootstrap FAILED: <stack>` and the row's
  own `/team-remote` mount log. Neither carries the disposal/teardown event, so the operator cannot
  tell "my domain broke" from "somebody closed the shared facility".
- **smallest honest fix**: (a) on `NOT_OPEN`, report a distinct code/detail such as
  `TEAM_DOMAIN_TORN_DOWN` carrying the row-scope disposal state (or attach the seam error's own
  detail), so the message says the domain was closed **under** an in-flight boot rather than by it;
  (b) stop the bootstrap at the first write attempt when the row scope is already disposed (a
  disposal fence checked between write-port calls) instead of writing into the dead domain. Both are
  local to `host.ts` + `root-binding/write-port.ts`; neither needs an upstream change.
- **proof**: [domain-attrib.mjs](../../../../dev/agent-workflow/evidence/a5sf-domain-attrib/domain-attrib.mjs) E0 (only seam code `closed` produces the message), E2/E2b/E3 (one teardown, three different stores/ops — the message is a timing artifact), E7 (the 404-then-teardown sequence reproduces the recorded artefacts), E7b (a bootstrap that really fails answers `200 {ok:false}`, not 404).
- **blocked by**: nothing for (a)/(b); the owner decides the code/name. A positive Host control (the
  same plan under a polling health gate) is not required to establish the mechanism and was
  deliberately not spent.
- **anchors**: `packages/runtime/src/plugin/host.ts#L3234` contains `const ready: Promise<TeamProductionRoot> = bootstrap()` ; `packages/runtime/src/plugin/host.ts#L3243` contains `void ready.catch(` ; (both anchors re-resolved +5 lines on 2026-11-12 by the a5sf local live-member lane: its `freshCreate` seam fix added five lines higher in the same file; the symbols are unchanged and the row's status is unchanged) ; `packages/storage/schema/errors.ts#L166` contains `the TeamDomain is closed` ; `packages/runtime/root-binding/write-port.ts#L47` contains `putSessionBinding(binding: SessionBindingDto)` ; `packages/runtime/root-binding/fresh-root.ts#L192` contains `ports.writes.putSessionBinding({`
- **status**: OPEN — adopted 2026-11-10 from the row filed at `dev/agent-workflow/evidence/a5sf-domain-attrib/DEBT-ROW-PD-11.md`; that lane was host-free (0 boots), and its verdict was `TEST-WORLD` (the boot #5 abort was a readiness-gate race in the evidence driver, not this defect).

### PD-12 (Q5) — `network: deny` does not govern the model-visible `bash`

- **source**: `Q5` in [a5sf-sub-devlive/README.md](../../../../dev/agent-workflow/evidence/a5sf-sub-devlive/README.md) §Q1/§Q5 (merged in PR #635; the file is on this tree). Fix evidence: [a5sf-pd12-fix/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd12-fix/README.md).

> **2026-11-10 FIXED — `PD12-FIX` (branch `task/a5sf-pd12-fix-20261110`, draft PR; not merged).**
> The block below is the **pre-fix measurement**, kept verbatim as the defect pin. The fix shadows
> `bash` inside the Member's own scope through the EXISTING route-C native-module seam: the realm row
> appends `packages/runtime/src/plugin/live/confined-bash-tool.mjs` when — and only when — the realm
> owns a confined `subprocess` face and the agent surface already exposes `bash` (no tool name is
> added or removed). The tool call is therefore served by the confined face and the compiled
> `network: deny` is consulted. On the pinned Host, three consecutive DEV-LIVE starts agree: the
> allow lane's model `bash` reaches the confined provider exactly once with
> `/bin/bash -c <body>` (base `shell-exec` 0, base spawns 0); the deny Member's identical call is
> refused with `NETWORK_UNCONFINED_REALM` naming `network-destination`, **0** provider calls, **0**
> base spawns, **0** `/proc` sightings of the marker. Host-free: `a5sf-pd12-bash-governance.test.mjs`
> (D1/A1/A2/S1) plus controls C1 (shadow removed => hole returns), C2 (no confined face => no shadow),
> C4 (no shell class => `SUBPROCESS_SHELL_NOT_DECLARED` first), and two source mutations
> (`MA`: shadow row removed; `MB`: network admission removed) that each red exactly the arms they
> protect. **Residuals — what this does NOT claim:** (1) the refusal is an **admission** refusal; the
> provider probe still reports `network-destination: unsupported`, so no OS-level network isolation
> is claimed (BL-42 remains open); (2) a shell body's **read** axis is still not statically
> attributable — the shadow only changes which face serves `bash`, whose read admission is lane-root
> based (PD-13 remains OPEN); (3) a composition that does not declare a `shellClass` now REFUSES the
> shadowed `bash` (`SUBPROCESS_SHELL_NOT_DECLARED`) where it previously executed; a Member whose
> preset mounts the **persistent** shell can still hold that PTY through other shell-consuming tools
> until PD-3/PD-13; (4) product assembly still cannot request a process face
> (`product-assembly.ts`), so a shipped preset without a governed realm gets no shadow and its
> `bash` is unchanged; (5) only realms that already install the confined face are affected.
- **true today**: on the pinned Host, the Member on template `worker-deny` declares `network.access: deny`, and
  the confined face does refuse **its own** calls (`NETWORK_UNCONFINED_REALM`, 0 processes, body
  never ran). The **same Member, same lane**, then called the model-visible `bash` tool: the tool
  result is `isError=false` and carries the marker; `shell-exec` records
  `executor: "SandboxBashExecutor"` on the inherited **base** subprocess service; the confined
  provider was called **0** times with that marker; one OS process carried the command; and the
  deployment sandbox argv is `bwrap … --unshare-pid … -- bash -c …` with **no `--unshare-net`**, so
  the child shares the host network namespace. The deny is a property of the **face**, not of the
  Member: it is consulted only when that face is called, and the `bash` tool never calls it.
- **not true**: that a `network: deny` Member cannot run a shell command; that the deny is
  "enforced for the Member" (it is enforced for one caller of one face); that the `bash` child is
  network-namespaced. It is also **not** claimed that the child reached the internet: no egress was
  attempted (the authority withholds real external network), so the measured fact is "not refused,
  and no network namespace requested".
- **security consequence**: **governance hole** — a Member gains a capability the compiled ceiling
  forbids. The ceiling was compiled and is enforced; it simply is not on the path the tool takes.
- **current backstop**: **none on the product path.** The face's deny lane refuses only because the
  host's capability probe reports `network-destination: unsupported`; that probe is never consulted
  on the `bash` path, so it is not a backstop for this row. `bash` is exposed at all only because a
  product preset surfaces it, and no product composition declares a shell class (BL-17) — which is
  why the *face's* own shell lane refuses while the member's tool runs.
- **smallest honest fix**: route the Member's `bash` through the confined face — a surface-neutral
  shadow of `bash` the way `read`/`write`/`grep`/`glob` are already shadowed — plus BL-17's
  shell-class wiring, so the deny lane is consulted before the command runs. Adding `--unshare-net`
  to the *host* executor's argv is **not** an honest fix here: it changes the pinned host composition
  (forbidden by `CORE_PATCH_BUDGET = 0`) and would still leave the decision outside the Member's
  compiled ceiling.
- **proof**: the `sub:network-deny-bash-lane` live arm flipped from "it runs" (boots 10/11 of the
  subprocess lane) to "the same command under `network: deny` is refused with the face's typed code
  and 0 processes" (boots 02/03 of `a5sf-pd12-fix`); `sub:product-bash-executor` flipped to
  "served by the confined provider, base executor 0"; `sub:network-deny`, `sub:face-admitted` and the
  `argvPredicate` vectors stayed green. Host-free pin + mutation controls:
  `tests/world-factory/a5sf-pd12-bash-governance.test.mjs` and
  `dev/agent-workflow/evidence/a5sf-pd12-fix/mutation-controls.mjs`.
- **blocked by**: [BL-17](ALPHA5-SANDBOX-BACKLOG.md) (shell-class wiring) and [BL-42](ALPHA5-SANDBOX-BACKLOG.md) (an `enforced` network backend), plus the owner's decision to expose `bash` through the face at all.
- **anchors**: `packages/runtime/team-services/src/subprocess.ts#L1495` contains `await probeNetworkDenial(provider)` ; `packages/runtime/team-services/src/types.ts#L243-L243` contains `readonly subprocess: ConfinedSubprocessSurface | null`
- **invariant (EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction)**: violated at the **ceiling term** —
  for that Member the compiled ceiling says `network: deny`, yet the effective I/O of the Member's
  model-visible tool set includes a network-capable child, because the ceiling is compiled per
  **face** while the ToolRestriction bound `bash` to an executor that never enters that face; the
  intersection was computed on a mechanism the call does not traverse.
- **status**: FIXED — 2026-11-10, branch `task/a5sf-pd12-fix-20261110`, merged at **`550815c97`** as PR **#640** (first line `PD12-FIX`), DEV-LIVE boots 02/03 of `a5sf-pd12-fix` (agreeing pair) plus boots 10/11 of the subprocess lane as the pre-fix pin; 0 candidate starts. Residuals (1)–(5) above; **PD-13 was not closed** by this fix.
- **2026-11-11 annotation**: PD-13 IS closed now — its confined terminal face puts a read axis on the
  Member's own shell (PD-13 row above). This row's fix and PD-13's fix compose: PD-12 routes the shell
  into a confined face for the network axis, PD-13 gives that face per-command read attribution. Both
  answers are certified separately.

### PD-13 (READ-AXIS) — the terminal path has no read axis

- **source**: `READ-AXIS` in [a5sf-pty-devlive/README.md](../../../../dev/agent-workflow/evidence/a5sf-pty-devlive/README.md) §3a/§3b and §6/§7.1 (merged in PR #634; the file is on this tree).
- **true today**: a Member's `bash` is the preset's inherited persistent shell
  (`@deepseek-ai/dsh-tool-bash-persistent` → the isolated `@deepseek-ai/dsh-terminal`
  `TerminalSessionService` → `@deepseek-ai/dsh-terminal-bash` → a real `/dev/pts/N`). One Member's
  several commands share **one** shell (`export`/`cd` state survives); a second Member gets its own
  (`pty-2`). For that command the confined face recorded **0** spawns and **0** guard facts. And
  the shell **read a secret the confined write-only lane declares unreadable and returned its
  bytes**, exit 0 — the artefact's own `locus` says the confined lane was *never consulted*. Asked
  the same question, the confined face refuses on the **read** axis with `IO_READ_DENIED`, 1 guard
  fact, **0** provider calls and **0** bytes. The machinery works; it is simply not on the terminal
  path.
- **not true**: that a Member's read axis is enforced on the product shell; that "0 guard facts"
  means nothing happened; that PD-9's "P1 read" was a byte channel that would have caught this (PD-9
  says exactly the opposite: the product registry has no write/read channel, which is why no arm in
  that suite could ever see this hole).
- **security consequence**: **governance hole** — a read the compiled ceiling forbids is delivered
  to the Member as bytes. Confirmed on two independent starts (08, 09) with the same locator class,
  and corroborated by the `chmod` reproduction on the same path (BL-17, annotated
  `LIVE-REPRODUCED`).
- **current backstop**: none. `RealmServiceFaces` has no `terminals` face, so no realm can install a
  confined terminal (PD-3), and the shell that a Member does get is the host preset's, outside the
  realm's reach. That absence is the whole reason the hole is not *also* a wiring bug.
- **smallest honest fix**: PD-3's confined terminal face **plus** routing the Member's `bash` to it,
  and stopping the preset's persistent-shell group from mounting `dsh-terminal` for Members — if both
  terminals exist, the Member holds one governed and one ungoverned shell and the answer forks. Not a
  patch; a face and a backend. **Built as specified** (2026-11-11): `RealmServiceFaces.terminals` +
  install path + a command-scoped confined terminal face whose per-command reads are admitted against
  the compiled read lane (below), the route-C `bash` shadow onto it, and a REFUSAL as the
  double-terminal answer (`TERMINALS_DOUBLE_TERMINAL_REFUSED`). It is **not** a PTY: a PTY cannot ride
  the Landlock profile, so each command is a fresh confined child — the capability cost is disclosed
  in residual (2).
- **proof**: `tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs` — P0 the defect pin (green
  on the pre-fix tree, RED on the fixed tree), D1 the same `cat` through the Member's own `bash` is
  `IO_READ_DENIED` with **0 bytes**, exactly **1** `shellRead` fact naming the locator and **0**
  provider calls; A1 the in-lane read is served once by the confined terminal face with one ALLOW
  fact; S1 surface-neutral (one `bash`, same name set); C1–C6 controls (shadow removed returns the
  bytes; no terminal face keeps the PD-12 shape; no subprocess face / no shell class / a legacy
  preset terminal are each typed refusals; C6 pins the DISCLOSED dynamic-read weakness). Mutation
  controls `dev/agent-workflow/evidence/a5sf-pd13-fix/mutation-controls.mjs`: **MA** removing the
  read axis reds exactly D1+A1 and leaves the write/allowed/control arms green; **MB** removing the
  shadow returns the ungoverned path (D1/D2/A1 red plus every arm that measures the confined route).
  Live: `dev/agent-workflow/evidence/a5sf-pd13-fix/README.md` (DEV-LIVE boots, agreeing pair).
- **blocked by**: nothing on the face itself; the PRODUCT path still needs an owner decision to
  declare a terminal face in a shipped composition (no product composition declares one yet, so the
  shipped product still has no confined shell — residual (4)). [BL-42](ALPHA5-SANDBOX-BACKLOG.md)'s
  network backend is unrelated to this row.
- **anchors**: `packages/runtime/team-services/src/terminal.ts#L530-L535` contains `for (const locator of shellReadIntentsOf(text, session.cwd))` ; `packages/runtime/src/plugin/live/a5sf-realm-row.mjs#L1054-L1066` contains `confinedTerminalSpecOf` (re-resolved +55 lines on 2026-11-12 by the a5sf window-hunt lane: it added the `freshCreateHintAdmits` gate + the governed-row undefined refusal higher in the same file; the symbol and the row's status are unchanged) ; `packages/runtime/team-services/src/types.ts#L264-L264` contains `readonly terminals: ConfinedTerminalSurface | null`
- **invariant (EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction)**: violated at the **ToolRestriction
  term** — route C shadows only the tools it re-registers (the FS/search pair); `bash` is not one of
  them, so the Member's `bash` is served by the preset's own tool row, carries the preset's legacy
  PTY, and no lane is consulted at all; the ceiling's read denial is not evaluated, so the
  intersection is not merely wrong, it is never taken on this path.
- **status**: FIXED — 2026-11-11, branch `task/a5sf-pd13-terminal-20261111`, merged at **`c91c72bca`** as PR **#642** (first line `PD13-FIX`). The
  face, the route-C `bash` shadow and the double-terminal refusal are proven host-free (pin flip +
  13 arms + two mutation controls) and on real Hosts (DEV-LIVE pair in
  `dev/agent-workflow/evidence/a5sf-pd13-fix/`). Residuals: (1) a DYNAMIC read (`$(…)`, backticks, a
  path assembled from variables) is not lexically attributable and is not refused at admission — the
  OS profile is its boundary (arm C6 pins this); (2) there is no persistent shell state (`cd`/`export`
  do not survive a command, no interactive stdin) because each command is a fresh confined child; the
  old persistent PTY's capability is deliberately given up; (3) redirection targets are writes, not
  read intents, so the read axis is the only axis the face adds — the write axis remains the confined
  process face's declared `shell.writes`; (4) NO SHIPPED COMPOSITION DECLARES A TERMINAL FACE yet, so
  the product's Member shell is still the preset's until an owner declares
  `terminal`/`a5sfRealm` for Members; the refusal (double terminal, missing subprocess face, undeclared
  shell class) is the fail-closed answer meanwhile; (5) a `terminals`-consuming module mounted on an
  ANCESTOR scope still resolves the inherited service — `faces` gates route-C mounts only.
  **2026-11-10 note (kept for the record):** PD-12's fix did not close this row; it routed `bash` into
  the confined subprocess face, whose read admission is lane-root based and does not make a shell
  body's reads attributable. That gap is what this build closes.

### PD-14 (SANDBOX-ROOT) — a Member session's sandbox root is the pinned host checkout

- **source**: `SANDBOX-ROOT` in [a5sf-sub-devlive/README.md](../../../../dev/agent-workflow/evidence/a5sf-sub-devlive/README.md) §5 (merged in PR #635; the file is on this tree).
- **true today**: the shipped executor's `sandboxPolicy` for a Member's `bash` child is
  `{mode: 'workspace-write', workspaceRoot: <the pinned host tree>}` — in the recorded artefact the
  resolved root is `<main checkout>/tests/deepseek-harness-test-use`, while the run's
  `expectedWorkspaceRoot` is the World's own `…/homes/<world>/workspace`. The child's `bwrap` argv
  `--bind <host tree> <host tree>` is **read-write on that tree**. The cause is the pinned
  resolver `resolveWorkspaceRoot(session?.header.cwd ?? this.workspaceRoot)`: a *session* cwd wins
  over configuration, and the World gives the Team a session cwd of the host tree; the World's own
  record says the same for member sessions ("for member sessions that is the factory's pristine
  hostTree … NOT the world home"). Measured twice: an override row without `name` disabled the plugin
  (boot 6), and with `name` it still lost to the session cwd (boot 7).
- **not true**: that a Member's shell is rooted in its World workspace; that the World home is the
  boundary of what a Member's `bash` can write (it is the boundary of what gets *deleted* at
  teardown); that a `sandbox-policy` config row can pin the root (it cannot — the session cwd wins).
- **security consequence**: **behavioural divergence** — no Member gains a permission relative to
  its compiled ceiling (the ceiling still bounds the confined faces), but the confinement the
  compiler names is applied to a different tree than the one the World claims, and the
  "disposable World" assumption is false for that child: its writes land in the **shared pinned
  checkout**, which is never removed and whose pristine-ness other legs assert. The hygiene
  consequence is a cross-lane contamination channel: any future lane whose command writes leaves
  residue in the tree that every other lane (and the candidate runtime) reads.
- **current backstop**: hygiene receipts, not enforcement — every run in the SUB lane recorded
  `git status --porcelain` empty before and after, and its commands were `printf`-only; the same
  lane's README says explicitly that "any future lane whose command writes must fix the session cwd
  first". Nothing at the OS level protects the tree: the child is genuinely read-write on it.
- **smallest honest fix**: set the Team session's `header.cwd` to the World workspace (a World/driver
  fix, not a product change), **or** state in the product documentation that a Member session is
  rooted at the host checkout and stop presenting the host tree's pristine-ness as a boundary. A
  `sandbox-policy` override row is measured **not** to be a fix.
- **proof**: a live arm recording `sandboxPolicy.workspaceRoot === <this World's workspace>` **and**
  a `pwd` from inside the child under that root; the porcelain-empty receipt stays green; boots 6–7
  and 10–11 stay as the historical measurement.
- **blocked by**: an owner decision on what a Member session's sandbox root should be; the World-side change is test infrastructure, not product, and touches no `packages/**`.
- **anchors**: `tests/world-factory/lib/u7-fsmut-assembly.mjs#L273-L278` contains `for member sessions that is the factory's` ; `tests/world-factory/lib/team-workspace.mjs#L135-L135` contains `export function bindTeamDefaultWorkspace` ; `tests/world-factory/lib/world-factory.mjs#L587-L587` contains `#teamWorkspaceRows(rows)` ; `tests/world-factory/a5sf-pd14-sandbox-root.test.mjs#L251-L251` contains `test('P0 PD-14 defect pin`
- **status**: FIXED — 2026-11-11, branch `task/a5sf-pd14-sandbox-root-20261111`, merged at **`47316541a`** as PR **#643** (first line `PD14-FIX`). **The fix is the FIXTURE layer and only the fixture layer**: `tests/world-factory/lib/team-workspace.mjs` binds every Team-shaped row that declares no workspace to the World's own `workspaceDir` (and REFUSES a declaration pointing into the pinned checkout or outside the World home), called from `TestWorld.startHost`'s one row-composition point. No `packages/**` file changed and no upstream byte was touched. **Why not the product:** for a real operator link 1 of the chain *is* their project directory, and the root `cordis.patch.yml` documents that launch-directory default together with the `defaultWorkspace` override that this fix uses; changing it would alter what real users get, justified by nothing PD-14 measured. **Why not a `sandbox-policy` row:** boots 6–7 already measured it — it needs `name` restated and still loses to the session cwd, because the pinned resolver prefers `session.header.cwd`. Proof: `tests/world-factory/a5sf-pd14-sandbox-root.test.mjs` — P0 is the defect pin (GREEN pre-fix, RED post-fix; `pin-before.log` / `pin-after.log`), D1 the provider's own resolved root, D2 the real child's `pwd` + its own `/proc/self/mountinfo` (one `rw` mount at the World workspace, ZERO mounts at/under the pinned checkout, and `--bind <world ws> <world ws>` in the pinned backend's argv), D3 the write boundary (in-root write succeeds, outside write refused `Read-only file system`), F1 the disclosure that the pinned checkout stays READABLE (`--ro-bind / /`), C1 the product-side negative control (an explicitly configured `workspaceRoot` still wins for a call without a session cwd), C2 the fixture-side one (a World that declares its own workspace keeps it), C3/C4 the two refusals, S1 surface neutrality, S2 locus, Z1 the pinned tree's porcelain empty after every arm. Evidence: `dev/agent-workflow/evidence/a5sf-pd14-fix/README.md` (0 boots — the fix touches no product path, so no `DEV-LIVE` run was manufactured). Residuals: (1) the shipped product still roots a Team at the operator's launch directory, so a real Host launched from a non-workspace directory still confines a Member there — a product question this row did not measure and does not close; (2) the read boundary is untouched (`--ro-bind / /`), the pinned checkout stays readable at its absolute path; (3) `config.workspaceRoot` is now unreachable for Team sessions (the pinned resolver prefers the session cwd, which every Team session now has), exercised only for cwd-less calls (C1); (4) the twelve affected assemblies were not booted — the change is one documented config field each, `u6-arc-d` already declared it, and `u7-fsmut`'s oracle that pinned the wrong root is ANNOTATED rather than weakened.


### PD-15 (FACE-BOUND-PROOF) — a network-enforcement proof is not bound to the face that consumes it

- **source**: [a5sf-pd15-face-bound-proof/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd15-face-bound-proof/README.md) (finding recorded there from #645's review of BL-42; the `FACE-BOUND-PROOF` id names this row).
- **true today**: **fixed, and the fix is the binding it names.** Before PD-15 the confined `web` face admitted a `network: deny` call on ANY backend whose capability row said `enforced` with a non-empty mechanism and an evidence reference. BL-42's proof already carried the realm and the trust root, but no face; a composition that handed the web transport the SUBPROCESS lane's realm-bound proof would therefore have admitted a deny `web_fetch` into ordinary host egress, while the netns the proof describes only ever covered a child the launcher started. `NetworkEnforcementProof` now carries a required `face` (`subprocess` | `web`), `evaluateNetworkRequirement` takes the consumer's face and refuses a proof minted for another one (or an unnamed proof, or a caller that cannot name its face) with the typed `NETWORK_PROOF_FACE_MISMATCH` discriminator, and the web guard requires a `networkProof()` whose face is `web`.
- **not true**: not true that a web-face proof is an OS-level statement — the web transport is in-process and no proof shape makes it OS-isolated; not true that "a `network: deny` web call cannot be admitted on another face's proof" implies "web egress is refused by the OS"; not true that fixing the replay closes BL-42's live web half or moves a grade / `V@B` / matrix ⑧⑨ cell.
- **security consequence**: **governance hole** — latent, not measured. No in-tree composition handed a cross-face proof to the web provider (the web path still reports `unsupported`), so the hole was never live; if it had been, a Member's deny `web_fetch` would have made an ordinary host connection under a claim whose evidence was measured on a different boundary. It was fixed while latent because a latent hole closes with a typed check and a pin, not with a live round.
- **current backstop**: the typed `NETWORK_PROOF_FACE_MISMATCH` refusal before any provider call (zero fetches, zero DNS, zero connects, zero proxy lookups, one guard fact), the face mismatch being checked in the ONE evaluator both faces share, and the composition-time absence of any web provider that mints a `web`-face proof. A `web`-face proof is a SERVICE-LEVEL statement only; BL-42's netns remains subprocess-only.
- **smallest honest fix**: name the face on the proof, pass the consumer's face into `evaluateNetworkRequirement`, and have the web guard demand a proof for its own face instead of accepting a level; done in `packages/runtime/sandbox-provider/network.ts` + `provider.ts` + `packages/runtime/team-services/src/web.ts` (+ the code in `types.ts`). No upstream patch; `CORE PATCH BUDGET = 0`.
- **proof**: `tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs` — `P0` is the defect pin (GREEN pre-fix, RED post-fix; `pin-before.log` / `pin-after.log` in the evidence dir), `D1` the typed mismatch refusal with zero egress, `D2` an `enforced` row alone refused as `NETWORK_UNCONFINED_REALM`, `A1` a web-face proof still admits on the web face, `A2` a subprocess-face proof still admits on the subprocess face and not the other way round, `A3` a subprocess proof with no measured namespace identity refused, `T1` face tampering / no face / unknown face / no consumer face all refused. BL-42's own end-to-end suite (`a5sf-bl42-netdeny.test.mjs`, real launcher, real netns, real child) stays green and is the negative control that the subprocess lane was not weakened.
- **blocked by**: nothing upstream; residuals are stated rather than blocking: (1) the web transport is IN-PROCESS, so a face-bound proof for the web face can only ever be a **service-level** statement — no proof shape makes the web face OS-isolated today, and a future web transport riding a confined child is the only path to an OS-level sentence; (2) the proof is self-described, so a composition that deliberately mints a false `face: 'web'` proof is caught by review/composition, not by the field — face binding stops replay, not perjury; (3) `network: restricted` is untouched (no mechanism, still refused at admission); (4) no live Host was booted and no composition supplies a web-face proof, so an admitted deny `web_fetch` would still be ordinary host egress.
- **anchors**: `packages/runtime/sandbox-provider/network.ts#L102` contains `NETWORK_PROOF_FACE_MISMATCH` ; `packages/runtime/sandbox-provider/network.ts#L147-L147` contains `export function evaluateNetworkRequirement` ; `packages/runtime/team-services/src/web.ts#L137-L137` contains `networkProof?` ; `packages/runtime/sandbox-provider/provider.ts#L377-L377` contains `face: 'subprocess'` ; `tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs#L120-L120` contains `P0 PD-15 defect pin`
- **status**: FIXED — 2026-11-11, branch `task/a5sf-pd15-face-bound-proof-20261111`, draft PR **#646** (first line `PD15-FIX`, no merge). Host-free only: **0 boots**, no `DEV-LIVE`, no candidate start. Evidence: [a5sf-pd15-face-bound-proof/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd15-face-bound-proof/README.md). Residuals (1)–(4) above; **no grade, `V@B`, or matrix ⑧/⑨ cell changed**.

### PD-16 (SEARCH-FACE) — a governed Member's `grep`/`glob` ran on the inherited host `subprocess`

- **source**: [a5sf-pd16-search/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd16-search/README.md) (live recon `a5sf-recon-search`, #655; the `SEARCH-FACE` id names this row).
- **true today**: **fixed.** On the shipped opt-in governed preset, `grep`/`glob` are served by the confined `subprocess` face: the realm row re-mounts `confined-search-tool.mjs` inside the Member's isolated scope, and that module delegates to the pinned host package's public per-tool faces (`applyGrepTool` / `applyGlobTool`). Out-of-lane roots are refused **before any process exists** (`spawns 0→0`, typed `IO_READ_DENIED` in the fact, zero bytes, exactly one deny fact); the in-lane search and `rg`'s exit 0/1/2 fidelity are preserved.
- **not true**: not true that the model sees a typed refusal word — the wire still carries the pinned host package's “ripgrep provider failure” text and the typed code lives only in the guard fact; not true that these facts are Member-bound (`toolBindingIdentity: null`, the v4 `toolBindings` family has no Member association); not true that fixing Search fixes Shell or FS.
- **security consequence**: **governance hole** — measured live. Before the change a one-workspace Member's `grep {path:'..'}` and `grep {path:<absolute out-of-lane>}` returned `secret-out-of-lane.txt` with zero guard facts; the same root cause let `glob` list sibling lanes. This is the “declared confinement not on the call path” class, not a probe-only inference.
- **current backstop**: the compiled read lane is consulted by the existing `createMemberSubprocessGuard` before `spawn`; `spawns=0→0`, no secret bytes, one deny fact; the base `subprocess` path is never reached (A6 pins the `.worktrees/` `.git` FILE case).
- **smallest honest fix**: add the two names to the same route-C native-module list the terminal uses (`packages/runtime/src/plugin/live/confined-search-tool.mjs` + mount wiring in `a5sf-realm-row.mjs`), plus a bounded correction to the BL-16 ancestor rule so an in-lane `.git` **file** does not end the containment walk. No upstream patch; `CORE PATCH BUDGET = 0`; surface-neutral (names and schemas byte-identical).
- **proof**: `tests/world-factory/a5sf-pd16-search-read-axis.test.mjs` — `P0` is the defect pin (GREEN pre-fix, RED post-fix; `pin-before.log` / `pin-after.log`), D1/D2/D3 the deny arms, A1/A3–A6 the allow and worktree cases, S1 surface identity, C1 shadow-removal control; three mutation controls in `mutation-controls.json`; one `DEV-LIVE` boot (`runs/boot01/`, `overall=FAIL` reported verbatim because its propositions describe the pre-fix world) with 10 facts (`allow 6 / deny 4`), zero host-direct `rg`, seven confined launchers.
- **blocked by**: nothing upstream. Residuals are stated, not blocking: refusal legibility (needs a pinned-package change, out of budget), `toolBindingIdentity: null`, and the boot's `overall=FAIL` is a pre-fix-world judgement, not a product failure.
- **anchors**: `packages/runtime/src/plugin/live/confined-search-tool.mjs#L91-L91` contains `A5SF_CONFINED_SEARCH_TOOLS` ; `packages/runtime/src/plugin/live/confined-search-tool.mjs#L155-L156` contains `applyGrepTool` ; `packages/runtime/src/plugin/live/a5sf-realm-row.mjs#L1071-L1071` contains `A5SF_CONFINED_SEARCH_TOOL` ; `packages/runtime/src/plugin/live/a5sf-realm-row.mjs#L1113-L1113` contains `confinedSearchSpecOf` ; `tests/world-factory/a5sf-pd16-search-read-axis.test.mjs#L442-L442` contains `P0 — THE DEFECT PIN`
- **status**: FIXED — 2026-11-13, merged **#661** (`bd952e7d0`), base `743955e4a`. `DEV-LIVE` + host-free; `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change**.

### PD-17 (FS-FACE) — a governed Member's `read`/`write`/`edit`/`read_image` ran on the inherited base `fs-sandbox`

- **source**: [a5sf-pd17-fs/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd17-fs/README.md) (live recon `a5sf-recon-fs`, #657; the `FS-FACE` id names this row).
- **true today**: **fixed.** The four FS names are unchanged on the surface, but the realm row re-mounts `confined-fs-tool.mjs` in the Member scope, so their provider calls land on the confined `fs` face: an out-of-lane read returns zero bytes with typed `IO_READ_DENIED` and one deny fact; out-of-lane `write`/`edit` change nothing; in-lane read/write/edit still work; `read_image` is readable in-lane and denied out-of-lane on that face. The provider also forwards the host `sandboxPolicy` **narrowed** (workspace root preserved, mode capped) so an admitted in-lane write is not refused by the host fence; the Member ceiling is still evaluated first.
- **not true**: not true that this makes the default `standard` path governed — the shipped default preset declares no `a5sfMemberPolicies`, so most Members still inherit the base provider; not true that `read_image`'s live behavior is measured (the configured model route does not declare image input, so the live call is refused at the tool's route gate: 0 bytes, 0 attachment saves, 0 fs allow facts); not true that write implies read (binding restriction constrains the read axis; the native read-before-write contract is the host tool's, not Team's).
- **security consequence**: **governance hole** — measured live. Before the change a Member's `read` crossed the sibling lane and `/etc/hostname` with zero facts, and `write`/`edit` could reach outside its ceiling; the live boot measured the sibling-lane byte leak. The fix moves the read **and** write axes onto the already-compiled lane, not a second policy source.
- **current backstop**: the confined provider refuses before `super.<method>` with the same `evaluateLocatorAccess` and the same fact transport; `providerReads = 0` on deny; the boot's two-Member cross-dispatch shows each Member's facts name its own identity, and a denied write leaves the file absent.
- **smallest honest fix**: register the four names through a route-C FS shadow that delegates to the pinned `@deepseek-ai/dsh-tool-fs`, plus the provider-policy narrowing in `team-services/src/fs.ts` (the regression the live boot found); no new compiler, no second lane, no upstream patch.
- **proof**: `tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs` (15 arms: P0 defect pin, D1–D5 deny, A1–A5 allow, C1 shadow removal) + `a5sf-pd17-fs-policy.test.ts` (5 arms) + mutation controls MA/MB; `DEV-LIVE` boot pair: `runs/boot00-prefix/` on clean `origin/master` (`overall=FAIL`, 8 of 12 red) vs `runs/boot02/` on the fix (**PASS 12/12**), with `runs/boot01-policy-bug/` kept on purpose as the boot that measured the host-fence regression.
- **blocked by**: nothing upstream. Residuals: `read_image` live `NOT_REACHED`; tool-binding identity still not Member-scoped (`toolBindingIdentity` absent on facts); the pre-fix boot's `overall=FAIL` is reported verbatim, not reinterpreted.
- **anchors**: `packages/runtime/src/plugin/live/confined-fs-tool.mjs#L99-L99` contains `A5SF_CONFINED_FS_TOOLS` ; `packages/runtime/src/plugin/live/confined-fs-tool.mjs#L215-L215` contains `export function apply` ; `packages/runtime/src/plugin/live/a5sf-realm-row.mjs#L1136-L1136` contains `A5SF_CONFINED_FS_TOOL` ; `packages/runtime/src/plugin/live/a5sf-realm-row.mjs#L1215-L1215` contains `confinedFsSpecOf` ; `packages/runtime/team-services/src/fs.ts#L120-L120` contains `createMemberFsGuard`
- **status**: FIXED — 2026-11-13, merged **#664** (`03e2edf87`), base `eec43b2e4`. `DEV-LIVE` + host-free; `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change**.

### PD-18 (WEB-PTC) — `web_fetch`/`web_search`/`workflow` executed on host services with zero a5sf facts; closed by fail-closed removal

- **source**: [a5sf-pd18-web-ptc/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd18-web-ptc/README.md) (live recon `a5sf-recon-web` #658 and `a5sf-recon-external` #656; the `WEB-PTC` id names this row).
- **true today**: **fixed by removal, and that is a capability regression.** The governed preset no longer declares `tool-web`, `workflow-ptc` or `tool-workflow`: a Member's `web_fetch`/`web_search`/`workflow` call is a typed `UNKNOWN_TOOL` refusal with zero executions, zero provider entries, zero bytes and `ptcRuntimeInMemberWindow = 0`. The confined web face itself still works (host-free allow to a loopback endpoint, deny with `NETWORK_UNCONFINED_REALM` before the provider), and the `standard` preset still declares the capability (a standard Leader turn returned workflow's deterministic `42`).
- **not true**: **not true that these three tools are governed** — absence is not enforcement; not true that the web face's service-level deny is OS network isolation; not true that `standard` lost the capability or that the default path changed; not true that `run_code`/`lsp`/MCP were “wired by this change” (they remain not on the surface).
- **security consequence**: **governance hole** — fixed by closing the surface. Before the change a governed Member's `web_fetch` ran on the inherited `ctx.web` provider with zero a5sf facts (only the base provider's SSRF policy refused some hosts), and `workflow` executed model-written JavaScript in a real PTC child under the host sandbox policy with zero facts. Leaving them in place would have kept a host-executed, zero-fact execution surface inside a preset labelled governed.
- **current backstop**: the host tool router answers typed `UNKNOWN_TOOL`; zero executions (a registered tripwire pins `effects = 0/0`) and zero bytes; the launcher/PTC counters stay flat; the confined web face's own deny is proven separately and is not reached by the shipped preset.
- **smallest honest fix**: remove the three declaration rows from the governed preset and pin the surface both ways (governed absent / standard present). The alternative — a composition-owned web transport or an interpreter-admitting confined subprocess lane — is new capability outside `CORE PATCH BUDGET = 0`; it is not attempted and not claimed.
- **proof**: `tests/world-factory/a5sf-pd18-web-ptc.test.mjs` (`PD18-SURFACE-CLOSED`, `PD18-SURFACE-POSITIVE-CONTROL`, `PD18-TYPED-REFUSAL`, `PD18-WEB-ALLOW`, `PD18-WEB-DENY`; the `A5SF_PD18_PIN` arm reads `git show d590d58a0:cordis.patch.yml`) + mutation controls M1/M2; two `DEV-LIVE` boots, 8/8 cases each, `agreeing pair=true`, standard-Leader control still executing `workflow`.
- **blocked by**: nothing upstream; this row closes by **losing capability**, so the owner-facing residual is a product decision: a future web/PTC governed path needs a composition-owned transport or an interpreter lane, both outside the current budget. **No `V@B`, no grade.**
- **anchors**: `cordis.patch.yml#L162-L162` contains `tool-web` ; `cordis.patch.yml#L256-L256` contains `preset-a5sf-governed-member` ; `tests/world-factory/a5sf-pd18-web-ptc.test.mjs#L121-L121` contains `PD18-SURFACE-CLOSED`
- **status**: FIXED (capability regression) — 2026-11-13, merged **#668** (`36f3a12b8`), base `d590d58a0`. `DEV-LIVE`; `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change**.

### PD-19 (FACT-ATTR) — a guard fact did not name the tool call it was decided for

- **source**: [a5sf-pd19-fact-attr/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd19-fact-attr/README.md) (the `FACT-ATTR` id names this row).
- **true today**: **fixed structurally.** The guard fact carries two **optional** attribution fields, `tool` and `callId`, populated by an attribution-only `AsyncLocalStorage` carrier from the registry's own `tools/execute` dispatch; a fact emitted outside any tool dispatch records `null` for both (honest absence, never a synthetic id). Old facts without the keys still parse; the default path with no fact observer is byte-identical.
- **not true**: not true that every fact is now attributable — pre-PD-19 evidence stays unattributable and may only be joined by timestamp/locator inference; not true that `callId` is 1:1 with facts (one `read` consults `stat` and `readText`; one `bash` consults `spawn` and `spawn:write`); not true that the live half is measured (0 boots; the host-free arms are the evidence).
- **security consequence**: **evidence-quality** — no Member could cross its lane because of this; the cost was that a refusal fact could not be joined to the specific tool call that caused it, so an audit had to infer the join. The fix adds labels without touching any decision.
- **current backstop**: the carrier is read by exactly one site (`observeGuard`) after the same `guard(...)` call; no guard, provider or policy module reads it (FA7); the wrapper is attached only when `onGuardConsult` is supplied, and a fact sink failure still refuses with `GUARD_OBSERVATION_FAILED`.
- **smallest honest fix**: add the two optional fields + the carrier + `attachGuardToolCallAttribution(ctx)` in `guard-observability.ts`, called from `install.ts` only when an observer exists. No new compiler, lane, denial code or authority; no upstream patch; the default path is unchanged.
- **proof**: `tests/world-factory/a5sf-pd19-fact-attribution.test.mjs` FA1–FA7 (allowed `read` with `tool`/`callId`; denied `read` with the same id and no bytes; concurrent dispatches keep their own ids; direct Provider read records `null`; old/`null`/invalid formats; narrower binding realm; structural no-reader pin). **0 boots**; the live half is explicitly not claimed.
- **blocked by**: nothing upstream. Residual: the live Member preset's dispatch reaching this listener is a `DEV-LIVE` question and was not measured here; only `read` has host-free attribution arms.
- **anchors**: `packages/runtime/team-services/src/guard-observability.ts#L109-L109` contains `readonly tool?` ; `packages/runtime/team-services/src/guard-observability.ts#L117-L117` contains `readonly callId?` ; `packages/runtime/team-services/src/guard-observability.ts#L203-L203` contains `attachGuardToolCallAttribution` ; `packages/runtime/team-services/src/install.ts#L640-L642` contains `attachGuardToolCallAttribution`
- **status**: FIXED — 2026-11-13, merged **#667** (`9a37321fb`), base `36f3a12b8`. Host-free only; `DEV-LIVE` rules unchanged; **no `V@B`, no grade, no Q7/Authority/CI change**.
### PD-20 (B1-LIFECYCLE-CLOSE) — `team_archive_member` promised "current work is interrupted"; a RUNNING Member kept obtaining new confined sessions inside the quiesce window

- **source**: [pd20-lifecycle/README.md](../../../../dev/agent-workflow/evidence/pd20-lifecycle/README.md) (§3 "BEFORE → AFTER"; the defect itself was measured by [a5sf-recon-shell/README.md](../../../../dev/agent-workflow/evidence/a5sf-recon-shell/README.md) §B-1, whose `B1-LIFECYCLE-CLOSE` finding this row carries).
- **true today**: **fixed, and the fix is the chokepoint that already existed.** Before it, `closeAdmission` had exactly one consumer — the Team tool-dispatch route (`ensureLiveAgent`/`executeTool`) — so a RUNNING Member's OWN turn never passed through it, and its `bash` kept asking the route-C shadow face for new confined sessions after the archive request. Now the QUIESCE PROCEDURE publishes a per-Member "admission closed" stamp (`lifecycle/admission-state.ts`) right after step 1 returns — keyed by both the instance id and the child session id — and `createMemberFsGuard` — the single admission boundary in front of every Member execution face (confined `fs`/`subprocess`/`terminals`/search/web) — consults it BEFORE any lane decision and throws the typed `LIFECYCLE_ADMISSION_CLOSED`. The procedure's exit (`reopenAdmission`, taken on every exit) clears the stamp, so an aborted or restored Member is operable again; after the durable commit the durable row is the authority, as before. The publishing point is the procedure on purpose: `packages/runtime/src/plugin/live/agent-bindings.mjs` is inside ARC-A's digest-locked protected center, and this fix needs no diff there (the first attempt edited it; `u6-arc-a-fitness` measured `digest-drift … agent-bindings.mjs` and the change was moved to the procedure rather than booked as an override).
- **not true**: (1) the in-flight turn is **not** cancelled — a tool call already running finishes, and the archive call returns once the turn has settled and quiescence holds; (2) the stamp is in-process state, so a Member whose process ended cannot be reached by it (there the durable row governs); (3) the docs' phrase "its current work is interrupted" was narrowed in the same commit to what is now measured — the next tool boundary is refused, the turn is not retroactively aborted.
- **security consequence**: **governance hole** — a revocation the Member can outrun is the one failure a governance system cannot absorb: for up to the quiesce window the archived instance could still execute commands, spawn children and reach the lanes, which is precisely what "archive" is supposed to stop. (Measured before the fix: a new confined session at 8.56 s / 8.72 s after the request, and the second `bash` finishing 290 / 427 ms before the durable commit.)
- **current backstop**: the durable row + `team_follow_up` refusal after the commit (`target-stale`), the tool-dispatch admission gate, and the lane guard's ordinary policy — none of which applies to a turn already running, which is why the hole is real rather than theoretical.
- **smallest honest fix**: one published state + one reader, in the lifecycle module and the lane guard that already fronts every execution face; no upstream patch, no second policy source, no new tool surface (`CORE PATCH BUDGET = 0` intact).
- **proof**: [pd20-lifecycle/README.md](../../../../dev/agent-workflow/evidence/pd20-lifecycle/README.md) — two DEV-LIVE boots of the shipped governed Member preset (`recordClass=DEV-LIVE`, `eligible=false`; the parent re-tests): the Leader archives Member B while B's first `sleep 8` command is running, B's second `bash` is issued inside the commit window (5.64 s / 5.65 s after the request, 190 ms / 207 ms before the commit was observed), and it is refused with the typed code while the first command finishes `exitCode=0` with its own bytes; B's guard facts show exactly ONE admitted command and no lane decision for the second call. Host-free: `packages/runtime/test/a5sf-pd20-admission-close.test.ts` (10/10: guard arms + the procedure publish/clear lifetime, incl. close-before-lane, reopen and the step-1 fault arm).
- **blocked by**: nothing — implemented. Residuals are the three "not true" items above, plus: only the shell faces were driven live (the guard is shared by all faces and is exercised host-free, but not each face end-to-end).
- **anchors**: `packages/runtime/team-services/src/fs.ts#L128-L129` contains `memberAdmissionCloseOf(policy.memberIdentity)` ; `packages/runtime/lifecycle/admission-state.ts#L60-L71` contains `class LifecycleAdmissionClosedError` ; `packages/runtime/lifecycle/quiesce.ts#L119-L123` contains `markMemberAdmissionClosed({` ; `packages/tools/src/tools.ts#L1199-L1199` contains `NEXT tool boundary is refused` ; `packages/runtime/lifecycle/quiesce.ts#L21-L25` contains `LIFECYCLE_ADMISSION_CLOSED` ; `packages/runtime/test/a5sf-pd20-admission-close.test.ts#L2-L2` contains `PD20-B1`
- **status**: FIXED — 2026-11-08, branch `task/pd20-lifecycle-20261114`, draft PR **#670** (first line `PD20-LIFECYCLE`, no merge). Evidence class **DEV-LIVE** (2 agreeing boots, slot-leased, 3180-family port, `DSH_HOME` under `tests/homes/`); the pinned host tree was read-only (`host-tree-porcelain.txt` = `empty`). **No upstream byte changed, no grade / `V@B` / matrix cell changed.**


### PD-21 (C3-CLOSED-SCHEMA) — an undeclared `run_in_background` was silently dropped: the command ran in the foreground with no job id

- **source**: [pd20-lifecycle/README.md](../../../../dev/agent-workflow/evidence/pd20-lifecycle/README.md) (§3 "C-3 / B-2"; the defect itself was measured by [a5sf-recon-shell/README.md](../../../../dev/agent-workflow/evidence/a5sf-recon-shell/README.md) §C-3, whose `C3-CLOSED-SCHEMA` finding this row carries).
- **true today**: **fixed by typed rejection, not by adding a capability.** The governed Member's `bash` is a closed schema (`additionalProperties: false`, properties `command, description, timeoutMs, workdir`) with no `run_in_background`; the host stripped the undeclared key before the shadow face ever saw it, so the model's intent vanished — no error, no job id, and the command ran in the foreground. Both route-C shell modules (`confined-terminal-tool.mjs`, `confined-bash-tool.mjs`) now call `assertClosedArguments(toolName, args, declared)` at the tool-call boundary: `run_in_background` is refused with `BACKGROUND_NOT_SUPPORTED` ("no managed-job producer … REFUSED instead of silently dropped … run it in the foreground"), any other undeclared key with `UNSUPPORTED_PARAMETER` plus the accepted list, and a non-object argument with `UNSUPPORTED_PARAMETER`. The helper rides the dist mirror (`scripts/dist-placements/180-a5sf-pd20-closed-arguments.json`), so the installed face loads it.
- **not true**: (1) there is still **no** managed-job producer on this preset — `run_in_background` is not *supported*, it is *refused*; (2) `job_list` / `job_output` / `job_kill` still come from the host `tool-jobs` row and still answer free text (`(no background jobs)`), not a typed code; (3) the refusal is per tool call, at the boundary — it does not prevent a model from retrying the same parameter.
- **security consequence**: **behavioural divergence** — the model asked for a background execution and silently got a foreground one, with no job id and no way for the transcript to show the divergence: the Member's observable behaviour differed from what it requested, and `job_list` "confirming" emptiness made the lie look like a fact.
- **current backstop**: the closed schema itself (the key never reaches the shadow face) plus the tool-call boundary refusal; nothing retries or queues the dropped intent.
- **smallest honest fix**: refuse at the boundary with a typed code that names the capability gap and the alternative — no new job producer, no new model-visible parameter, no surface accounting change.
- **proof**: [pd20-lifecycle/README.md](../../../../dev/agent-workflow/evidence/pd20-lifecycle/README.md) — in both DEV-LIVE boots the Member's `bash` carrying `{run_in_background: true}` returns `isError=true` / `BACKGROUND_NOT_SUPPORTED`, produces no `confined-terminal` record, executes nothing (the command's marker never appears in a tool result), mints no job id, and the follow-up `job_list` answers the free text `(no background jobs)`. Host-free: `packages/runtime/test/a5sf-pd20-closed-arguments.test.ts` (6/6, incl. zero-spawn evidence for both shell modules).
- **blocked by**: nothing for the measured defect. The deferred typed `job_*` hint needs a realm shadow of three host tools (a model-visible surface change plus surface-accounting risk) — deliberately NOT done here, recorded as residual (2) above.
- **anchors**: `packages/runtime/src/plugin/live/closed-tool-arguments.mjs#L80-L80` contains `BACKGROUND_NOT_SUPPORTED` ; `packages/runtime/src/plugin/live/confined-terminal-tool.mjs#L112-L112` contains `assertClosedArguments('bash'` ; `packages/runtime/src/plugin/live/confined-bash-tool.mjs#L125-L125` contains `assertClosedArguments('bash'` ; `packages/runtime/test/a5sf-pd20-closed-arguments.test.ts#L2-L2` contains `PD20-C3` ; `scripts/dist-placements/180-a5sf-pd20-closed-arguments.json#L3-L3` contains `a5sf-pd20-closed-arguments`
- **status**: FIXED — 2026-11-08, branch `task/pd20-lifecycle-20261114`, draft PR **#670** (first line `PD20-LIFECYCLE`, no merge). Evidence class **DEV-LIVE** (2 agreeing boots) + host-free suites; residuals (2) and (3) above remain, and the `job_*` free-text answer is quoted verbatim in the evidence README. **No upstream byte changed, no grade / `V@B` / matrix cell changed.**

### PD-22 (SUBAGENT-CHILD-REALM) — a governed Member's `subagent` child ran on the HOST's realm: 29 out-of-lane bytes, zero facts; closed by fail-closed removal of the `delegation` group

- **source**: [a5sf-pd21-subagent/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd21-subagent/README.md) (§1–§4; the `SUBAGENT-CHILD-REALM` finding id names this row, and the lane's on-disk name is `pd21`/`PD21-SUBAGENT-REALM`).
- **true today**: **fixed by removal, and that is a capability regression.** The governed preset no longer declares the `delegation` group (`subagent`, `subagent_fork`, `subagent-control`, `subagent-list-agents`, plus the shipped-disabled codex/claude-code rows) nor the shipped-disabled `tool-ralph` (`subagentProvider: spawn`): a governed Member's `subagent` call is the host router's typed `Error: unknown tool "subagent"` with **zero** children, zero child model requests and zero bytes. Measured post-fix on the real Host: an agreeing two-boot `DEV-LIVE` pair, 14/14 cases, Member surface 40 → 35 names.
- **not true**: (1) **not true that a governed child realm exists** — absence is not enforcement, and the child's own system reminder still says `workspace-write` with approvals disabled; (2) not true that this was ever "governed because the preset was inherited": the child's durable header did say `agentPreset: "a5sf-governed-member"` while its realm was the Host's, so the *label* was inherited and the *realm* was not; (3) not true that `standard` lost the capability — it still declares `tool-subagent`/`tool-subagent-fork` (host-free positive control); (4) not true that `team_*` creation needed a fence — both `team_create_member` calls were already refused at admission (see §1.2 of the evidence README).
- **security consequence**: **governance hole** — before the fix a governed Member's `subagent` produced a live child session whose model-visible realm was the HOST's: the child's `read` of an out-of-lane fixture returned its **29 bytes** with `isError=false` and **no** `IO_READ_DENIED`, its `bash` ran `cat` on the **base** subprocess, the secret reached **5 of 14** mock request bodies (and the Member's `subagent` tool result), and **zero** `a5sf-guard-consult` facts were recorded for any of it. The child also carried `subagent` itself, so the leak was recursively reachable.
- **current backstop**: the row is gone from the preset, so the host tool router answers a typed unknown-tool refusal before any session is created; `PD21-SURFACE-CLOSED` flattens the preset tree (groups included) and pins absence, the positive control pins that `standard` still declares it, and `PD21-TYPED-REFUSAL` drives the real tool runtime (registered-tripwire count 0). `confinedTurnLaunchers` stays at 1 (the Member's own command) and no base `bwrap` carries the fixtures in either arm.
- **smallest honest fix**: remove the declaration rows (this row) — the alternative is **not** smaller: a governed child needs the child context created **inside** the Member's isolate fork, and that assembly lives in the pinned upstream host (`packages/subagent/subagent/src/child-agent.ts`: `applyChildComposition` → `composeFrom(childCtx, parent.ctx)`, with the child's policy taken from `sandboxPolicy.overrideOf(parent.session)` and approvals `'never'`). Re-mounting preset **rows** into a sibling of `root.isolate('fs', label)` cannot resolve services below the fork. See `CORE_SEAM_BLOCKER` in §4.1 of the evidence README.
- **proof**: [a5sf-pd21-subagent/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd21-subagent/README.md) — pre-fix agreeing pair (`archive/pair-prefix/`: child realm/escape/attribution REFUTED, child surface 25, secret in 5/14 requests, 0 facts) vs post-fix agreeing pair (`runs/boot01`,`runs/boot02`: 14/14, 0 children, 0 requests, 0 bytes); host-free suite `tests/world-factory/a5sf-pd21-subagent.test.mjs` (4 arms: pre-fix pin over `git show 3df546de6:`, surface closed, standard positive control, typed refusal) + 2 mutation controls that each redden one named arm.
- **blocked by**: nothing for **this row** (the declaration removal is complete and measured). A *governed* child realm is blocked by a `CORE_SEAM_BLOCKER`: it needs either an upstream patch to `child-agent.ts` (forbidden by the red line) or a composition-owned subagent provider that builds the child on the Member's isolated ctx through a public seam (new capability, no budget in this phase). Residuals: the child's `bash` half also depends on the host sandbox policy (the `read` half has no fence at all, which is why the byte counter is the load-bearing witness); `subagent` on the **standard** preset remains ungoverned by design; the isolation taxonomy has no Subagent face, so no matrix cell is claimed.
- **anchors**: `cordis.patch.yml#L256-L256` contains `preset-a5sf-governed-member` ; `packages/runtime/team-services/src/install.ts#L403-L403` contains `root.isolate('fs', label)` ; `packages/runtime/team-services/src/install.ts#L411-L411` contains `isolate('subprocess'` ; `dev/agent-workflow/evidence/a5sf-pd21-subagent/README.md#L141-L141` contains `CORE_SEAM_BLOCKER` ; `tests/world-factory/a5sf-pd21-subagent.test.mjs#L129-L129` contains `PD21-SURFACE-CLOSED`
- **status**: **DRAFT — not merged.** 2026-11-14, branch `task/pd21-subagent-realm-20261114`, draft PR **#671** (first line `PD21-SUBAGENT-REALM`), base `3df546de6`. Evidence class **DEV-LIVE** (two agreeing pairs, slot-leased, 3180-family port, `DSH_HOME` under `tests/homes/`, pinned host tree read-only); `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change, `CORE PATCH BUDGET = 0`**.

### PD-23 (CONTROL-SURFACE) — a governed Member's remaining control plane could only refuse or lie, and its `skill` body read ran on the BASE `fs` (out-of-lane body, zero guard facts)

- **source**: [a5sf-pd23-control-surface/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd23-control-surface/README.md) (§1–§8; the lane is `PD23-CONTROL-SURFACE` — the row number carries the 2026-11-14 renumber recorded in the status note at the end of this file).
- **true today**: **fixed by removal, and that is a capability regression: the opt-in governed preset now offers NO SKILLS AT ALL.** The preset no longer declares `tool-skill` or `skill-filesystem`, so `skill` is the host router's typed `Error: unknown tool "skill"` and nothing executes; `tool-subagent-control` (`send_message`, `interrupt_agent`) and `tool-subagent-list-agents` (`list_agents`) — the other three names this lane measured — left the preset with PD-22's whole `delegation` group on 2026-11-14 (#671), so the merged head reaches the same end state by two disjoint removals. Measured post-fix on the real Host before that merge: an agreeing two-boot `DEV-LIVE` pair, 11/11 cases, Member surface **40 → 36** names, out-of-lane skill bytes in **7 → 0** model requests, zero guard facts for any of the four names. On the merged head the same arms measure **35 → 34**, and the delta attributable to this row is exactly the `skill` loader.
- **not true**: (1) **not true that these tools were "governed" before** — none of the four ever produced an `a5sf-guard-consult` fact, because none of them is served by a lane-confined face; (2) not true that `send_message` reached a sibling or the Leader — both were refused by the subagent lineage rule (`belongs to another parent session`) and the sibling's durable turn was never woken; (3) not true that `interrupt_agent` interrupted anything — its `interrupt requested for agent …` result was inert and the sibling's turn settled normally; (4) not true that `list_agents` enumerated the Team — it lists only the caller's OWN subagent children (none for a Team Member); (5) not true that the `skill` **name** argument was the hole — traversal and absolute names are refused (`invalid skill name`), the hole is the loader's **base `fs`**; (6) not true that jobs are a leak — `job_*` stayed on the surface and answered owner-scoped (`belongs to another session`, `unknown job <session-id>`, empty own list).
- **security consequence**: **governance hole** — the skill loader returned the body of a `$DSH_HOME/skills` bundle installed **outside** the Member's compiled read lane with `isError=false` and **zero** `a5sf-guard-consult` facts; that body then appeared in **7** subsequent model requests of the Member's turn. The direct file read of the out-of-lane fixture was separately measured and stayed confined (0 secret bytes), so the defect is specific to the loader, not to the `fs` face.
- **current backstop**: the four rows are gone from the preset, so the host tool router answers a typed unknown-tool refusal before any skill read or any cross-Member delivery is attempted; `PD23-SURFACE-CLOSED` flattens the preset tree (groups included) and pins absence, `PD23-SURFACE-SURGICAL` pins that the pinned `standard` preset still declares all four (this is a governed-row removal, not a product removal), and `PD23-TYPED-REFUSAL` drives the real tool runtime (registered-tripwire count 0).
- **smallest honest fix**: delete the skill rows from the governed preset and pin the surface both ways. **What would restore skills**: a `CORE_SEAM_BLOCKER` (§5.1 of the evidence README) — a skill body must be resolved through the realm's confined `fs`, but preset rows mount on the registry generation scope, so no ctx handed to `presets.mount()` can re-parent a body onto the sibling isolate scope. A real fix is one of two seams: (a) upstream lets an agent-preset row declare a service requirement the host resolves **per realm** at mounting time (so a preset-level provider can be bound to the isolate fork), or (b) a Team-owned skill provider that resolves `SKILL.md` and its `resources` through the Member's own confined `fs` face and records the same `a5sf-guard-consult` fact a native `read` does. (a) is an upstream source change — forbidden by the red line; (b) is legitimate Team code but is new capability with no budget in this phase. Neither is attempted and neither is claimed. The alternative for the control tools — a governed cross-member channel with its own authority model — is likewise new product capability with no budget.
- **proof**: [a5sf-pd23-control-surface/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd23-control-surface/README.md) — pre-fix agreeing pair (`archive/pair-prefix/`: skill/byte arms PROVEN-as-defect, surface 40, 7 requests carrying the out-of-lane body, 0 skill facts, 6 allow facts all `bash`) vs post-fix agreeing pair (`runs/`: 11/11 cases, surface 36, 0/0 bytes, same 6 `bash` facts, sibling and Leader untouched in both); host-free suite `tests/world-factory/a5sf-pd23-control-surface.test.mjs` (4 arms: `A5SF_PD23_PIN` pre-fix pin over `git show c5d619e53:`, surface closed, standard positive control, typed refusal) + `tests/world-factory/a5sf-pd23-mutation-controls.mjs` (7/7: CLEAN, M1 control tripwire, M2 skill tripwire, M3 re-inserted rows, PIN).
- **blocked by**: nothing for **this row**. A governed skill loader is blocked by the `CORE_SEAM_BLOCKER` above. Residuals: (1) `interrupt_agent`'s success-shaped no-op is a product weakness of the standard preset this lane measured but does not fix; (2) `create_goal`/`update_goal` are **accepted** inside a delegated Member turn (the work prompt arrives as a `user`-kind message), writing a goal in the Member's own session — session-local, no Team state, kept and disclosed — and a goal created without a `pause` starts a **self-continuation loop inside that Member's own session**: bounded by the session, but unbounded execution from the ceiling's point of view; (3) jobs stay with no producer.
- **anchors**: `cordis.patch.yml#L256` contains `preset-a5sf-governed-member` ; `tests/world-factory/a5sf-pd23-control-surface.test.mjs#L158-L158` contains `PD23-SURFACE-CLOSED` ; `dev/agent-workflow/evidence/a5sf-pd23-control-surface/README.md#L191-L191` contains `CORE_SEAM_BLOCKER` ; `packages/runtime/team-services/src/install.ts#L403-L403` contains `root.isolate('fs', label)`
- **status**: **DRAFT — not merged.** 2026-11-14, branch `task/pd23-control-surface-20261114`, draft PR **#672** (first line `PD23-CONTROL-SURFACE`), branched from `c5d619e53`, `origin/master` (`ac1d7958d`, #671) merged in for the renumber. Evidence class **DEV-LIVE** (two agreeing pairs, slot-leased, 3180-family ports, `DSH_HOME` under `tests/homes/`, pinned host tree read-only); `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change, `CORE PATCH BUDGET = 0`.**

### PD-24 (SURFACE-LEDGER) — a governed Member's `present` read paths through the BASE `fs` (out-of-lane existence oracle, zero guard facts)

- **source**: [a5sf-pd24-surface-ledger/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd24-surface-ledger/README.md) (§1–§8; the lane is `PD24-SURFACE-LEDGER`, the row number takes the next free id after PD-23).
- **true today**: **fixed by removal, and that is a capability regression: a governed Member can no longer declare deliverables.** The governed preset no longer declares `present`, so the host tool router answers the typed `Error: unknown tool "present"` and nothing executes; the post-fix `DEV-LIVE` pair measures the Member surface **34 → 33** names (the delta is exactly `present`), zero `deliverables/presented` events in any session, and zero guard facts for the name. Everything else the lane measured is **unchanged behaviour, now classified**: `bash`/`read`/`write`/`edit`/`grep`/`glob` are GOVERNED and ran live (9 allow facts), `read_image` is GOVERNED but its live branch is refused at the model-route gate (not reached), the nine session-local names write only the Member's own session (goal rounds 0 → 1 → 2 in that session, `job_*` owner-scoped, `exit_plan_mode` typed-refused while plan mode is inactive), the fifteen `team_*` names are a different authorization plane and were not touched, and eleven names now answer typed `unknown tool`.
- **not true**: (1) **not true that `present` was a "host service without a data plane"** (the §1.7 wording) — it resolved `fs` from the registry generation scope, i.e. the BASE `fs`, and `ctx.fs.stat` **accepted** a real out-of-lane path; (2) not true that the failure was a refusal — the in-lane *and* the out-of-lane existing calls both returned `Presented …` with `isError=false`; (3) not true that it was recorded — `guardFacts.byTool.present` was **0** for all three calls while `deliverables/presented` fired **twice** in the Member's own session; (4) not true that the `file not found` text is harmless — it is an existence oracle above the compiled read lane; (5) not true that `ask_user_question` "refuses a delegated caller" — it **blocks**: no result at 60 s and none at 300 s, no `turn/end`, no `user/questions` event, no Team state; (6) not true that the goal family needed a goal-semantics fix — the loop starts and stops inside the Member's own session (`roundsStarted` 0 → 1 → 2, `goalRoundsInOtherSessions = 0`) and was left alone.
- **security consequence**: **governance hole** — a governed Member could (a) obtain the existence of arbitrary host paths outside its compiled read lane, (b) have it answered as success, and (c) leave durable `deliverables/presented` events naming them, all with **zero** `a5sf-guard-consult` facts, i.e. no record of a boundary crossing. Same defect class as PD-23's `skill` loader.
- **current backstop**: `present` is gone from the governed preset, so the router's typed unknown-tool refusal fires before any `fs` resolution; `PD24-SURFACE-CLOSED` flattens the preset tree and pins absence by id **and** by package name, `PD24-SURFACE-POSITIVE-CONTROL` pins that the retained fourteen rows are untouched, `PD24-SURFACE-SURGICAL` pins that the pinned `standard` preset still declares `present` (a governed-row removal, not a product removal), `PD24-TYPED-REFUSAL` drives a governed-shaped tool registry over all eleven closed names (mutation arm registers a dispatchable `present` and must go red), and `PD24-LEDGER-IDENTITY` recomputes the bucket identity from the committed ledger so the dated numbers cannot rot.
- **smallest honest fix**: delete the `present` row from the governed preset and pin the surface both ways. **What would restore deliverables**: a `CORE_SEAM_BLOCKER` (§4.2 of the evidence README) — a preset row's `ctx` is the registry generation scope, the Member's confined provider is a fork in the Member's isolate, and no composition-level row can be handed that fork's `fs`; a real fix is a new route-C product row plus a realm-bound provider face (`confined-present-tool` on the `a5sf-realm-row` attach) with its own allow/deny contract tests — new capability, no budget in this phase, not attempted and not claimed. The alternative, an upstream preset-row "resolve this service per realm" seam, is an upstream source change and forbidden.
- **proof**: [a5sf-pd24-surface-ledger/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd24-surface-ledger/README.md) — pre-fix agreeing pair (`archive/pair-prefix/`: out-of-lane file `Presented`, missing file `file not found`, `present` facts 0, `deliverables/presented` ×2 in the Member session, surface 34) vs post-fix agreeing pair (`runs/`: 12/12 cases, surface 33, typed `unknown tool "present"`, 0 deliverables events, the same 9 facts for the six live governed faces); ASK arm pair (`runs-ask/`: call issued, no result in the 60 s window, `turn/end` 0); generated `ledger.json` / `ledger.txt` / `roster.json`; host-free suite `tests/world-factory/a5sf-pd24-surface-ledger.test.mjs` (5 arms incl. `A5SF_PD24_PIN` over `git show 6cfc67b76:` and the ledger identity) + `tests/world-factory/a5sf-pd24-mutation-controls.mjs` (M1 dispatchable `present` reddens REFUSAL only, M2 pre-fix composition reddens SURFACE only, PIN green).
- **blocked by**: nothing for **this row**. A confined `present` face is blocked by the `CORE_SEAM_BLOCKER` above. Residuals: (1) `read_image`'s live branch needs an image-capable route; (2) `exit_plan_mode`'s plan-mode-active branch needs a seam that can activate plan mode on a delegated Member session; (3) `ask_user_question`'s answered branch needs an answerer bound to a Member session, and the **blocking** behaviour itself is disclosed but deliberately not fixed (it crosses no boundary; see the status note); (4) `job_*` still has no producer, kept because it is owner-scoped and typed.
- **anchors**: `cordis.patch.yml#L256` contains `preset-a5sf-governed-member` ; `tests/world-factory/a5sf-pd24-surface-ledger.test.mjs#L167-L167` contains `PD24-SURFACE-CLOSED` ; `dev/agent-workflow/evidence/a5sf-pd24-surface-ledger/README.md#L208-L208` contains `CORE_SEAM_BLOCKER` ; `tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs#L4-L4` contains `PD-24`
- **status**: **DRAFT — not merged.** 2026-11-14, branch `task/pd24-surface-ledger-20261114`, draft PR (first line `PD24-SURFACE-LEDGER`), base `origin/master` = `6cfc67b76`. Evidence class **DEV-LIVE** (three agreeing pairs, slot-leased, 3180-family ports, `DSH_HOME` under `tests/homes/`, pinned host tree read-only); `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change, `CORE PATCH BUDGET = 0`**.

### PD-25 (UNBOUNDED-TURN) — the ceiling bounds one call, not the series: a Member's goal drove automatic rounds with a budget the Member itself writes, and its ask blocked the delegation

- **source**: [a5sf-pd25-unbounded-turn/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd25-unbounded-turn/README.md) (§1–§13; the lane/branch/PR are `pd25` / `task/pd25-unbounded-turn-20261114` / `PD25-UNBOUNDED-TURN`). **Renumbered 2026-11-14:** `PD-24` was free at this lane's base `6cfc67b76`, but #673 (`PD24-SURFACE-LEDGER`, merged `1e650c3e3`) claimed it while this lane was in review, so this row is **PD-25**; lane/branch/PR names stay `pd25` for traceability.
- **true today**: **fixed by removal, and that is a capability regression: the opt-in governed preset no longer offers goal tools or an ask tool at all.** `tool-goal` (`get_goal`/`create_goal`/`update_goal`) and `tool-ask-user` (`ask_user_question`) are no longer declared, so all four names are the host router's typed `Error: unknown tool "<name>"` and nothing executes; the Member surface goes **34 → 30** for this lane's two rows alone and is **29** on the merged tree (#673's PD-24 also removed `present`). Measured on the real Host **before** the removal: an agreeing two-boot `DEV-LIVE` pair in which `create_goal` on a delegated Member turn was **ACCEPTED** (`phase=active`, `roundsStarted=0`, `maxGoalRounds=256`, `activation=armed`), the goal-round driver then drove **5 consecutive automatic rounds** (the lane's own cap; first→last **0.899 s / 0.842 s**, rounds 1–3 executing a confined `bash`), the round budget was **raised by the Member** from 256 to **9007199254740991** through `update_goal edit` (accepted, revision 2) and then paused, while a goal created with `max_goal_rounds: 2` stopped at exactly **2** rounds with `code=round-limit` — proving the mechanism works and is caller-chosen. In the same pair one Member turn executed **30/30** sequential confined `bash` calls in **1899/1898 ms** with no refusal, and `ask_user_question` on an unattended Member **left the delegation with no result at 45 s** (Member `RUNNING`) instead of refusing.
- **not true**: (1) **not true that a Member turn holds no direct-human goal authority** — PD-23's docstring said the goal tools were "typed refusals" for that reason, and its own durable probe JSON already showed the acceptance; the work prompt is delivered as a `user`-kind message into a session that is a runtime **root**, so `requireDirectHuman` passes (§4 of the evidence README); (2) not true that `maxGoalRounds` is a bound on the Member — it is a goal parameter the Member sets and can raise; (3) not true that the 5 rounds were a mock artefact — the Member's durable session carries 5 goal-round user messages; (4) not true that the delegation "completed" before the rounds — 4 of the 5 rounds arrived **after** the Leader could see the delegation's tool_result (§7.1); (5) not true that the ask block is a timeout or a typed refusal — the question was queued for a client that does not exist and never settled (§7.2); (6) not true that a per-turn tool-call cap exists — 30/30 executed, and the host loop has no step/turn budget (§7.3).
- **security consequence**: **governance hole** — the ceiling's guarantee is per call, so a governed Member could keep executing after its delegated task was over, for at least 255 further rounds by default and, after one accepted `edit`, effectively without a round bound; the same root-ness made an unattended `ask_user_question` block a Member turn indefinitely, holding a delegation and a Host slot. No out-of-lane byte was produced by any of these paths (the executed calls were in-lane `bash`), so this is an unbounded-execution hole, not a lane-escape.
- **current backstop**: the two rows are gone from the preset, so the host tool router answers a typed unknown-tool refusal before any goal state or question is created; `PD25-SURFACE-CLOSED` flattens the preset tree (groups included, matched by id **and** package name) and pins absence, `PD25-SURFACE-SURGICAL` pins that the pinned `standard` preset still declares both capabilities (a governed-row removal, not a product removal), `PD25-TYPED-REFUSAL` drives the real tool runtime including a POSITIVE control (a retained tool must still dispatch, so a green refusal cannot come from a broken harness), and the mutation controls show one surviving goal tool (`get_goal` only) still reddens the arm.
- **smallest honest fix**: delete the goal and ask-user rows from the governed preset and pin the surface both ways (done here). **What would restore the capabilities**: a `CORE_SEAM_BLOCKER` (§5.1 of the evidence README) — a goal cap resolved from configuration the Member cannot write (today `update_goal edit` may change `maxGoalRounds`, so this is an upstream change to `tool-goal`/`goal`: forbidden by `CORE PATCH BUDGET = 0`), or a Team-seam per-delegation continuation budget (`maxTurns`-class) enforced by the runtime between rounds, which is new Team-side policy and a new policy source (not attempted, no budget); a governed ask channel additionally needs an unattended answerer policy. None is attempted and none is claimed.
- **proof**: [a5sf-pd25-unbounded-turn/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd25-unbounded-turn/README.md) — pre-fix agreeing pair (`archive/pair-prefix/`: 8/8 cases, surface 34, 5 rounds in 0.899/0.842 s, default 256, raised cap 9007199254740991, `cap2` `round-limit` at 2, 30/30 burst, ask blocked 45 s, 68 mock requests `{loop:43,cap2:4,raise:4,plan:2,ask:1}`) vs post-fix agreeing pair re-booted on the merged tree (`runs/`: surface **29**, the four names typed `unknown tool`, zero rounds, 30/30 burst unchanged, ask delegation returns in ~0.1 s; `bindings.teamSha` = the merge commit, a plain commit on the branch); host-free suite `tests/world-factory/a5sf-pd25-unbounded-turn.test.mjs` (5 arms: `A5SF_PD25_PIN` pre-fix pin over `git show 6cfc67b76:`, surface closed, retained-surface positive control, standard-preset surgical arm, typed refusal with a dispatchable positive control) + `tests/world-factory/a5sf-pd25-mutation-controls.mjs` (**9/9**: CLEAN, M1 goal trio, M2 ask, M3 `get_goal`-only, M4 re-inserted rows, PIN).
- **blocked by**: nothing for **this row**. Restoring goals/asking is blocked by the `CORE_SEAM_BLOCKER` above. Residuals owned elsewhere: (1) **orchestration semantics** — a synchronous `team_delegate` reports *completed* at the Member's turn boundary while its goal keeps driving rounds (4/5 rounds after the Leader saw the result, 0.8 s later; `delegation-return.json`), so the Leader cannot tell "finished" from "still looping" — Team-runtime owner, not fixed, no `team_*` behaviour changed; (2) **no per-turn tool-call cap** — 30/30 executed and the host agent loop has no step/turn budget; a total budget is a product-wide question and a new policy source if made per-Member — Host/product owner, stated not fixed; (3) `command-goal` is retained while `tool-goal` is removed (a client command surface, not a model path; a Member has no client) — disclosed so the removal is not read as "goals are gone from the product".
- **anchors**: `cordis.patch.yml#L256` contains `preset-a5sf-governed-member` ; `tests/world-factory/a5sf-pd25-unbounded-turn.test.mjs#L143-L143` contains `PD25-SURFACE-CLOSED` ; `dev/agent-workflow/evidence/a5sf-pd25-unbounded-turn/README.md#L7-L7` contains `limit the constrained party can raise` ; `packages/runtime/src/plugin/live/agent-bindings.mjs#L5441-L5442` contains `source: { kind: 'user' }`
- **status**: **DRAFT — not merged.** 2026-11-14, **draft PR #674** (`PD25-UNBOUNDED-TURN`), branch `task/pd25-unbounded-turn-20261114`, worktree `.worktrees/pd25-unbounded-turn`, branched from `6cfc67b76` (`origin/master`, #672). Evidence class **DEV-LIVE** (two agreeing pairs, slot-leased, 3180-family ports, `DSH_HOME` under `tests/homes/`, pinned host tree read-only); `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change, `CORE PATCH BUDGET = 0`.**

### PD-26 (CONFINED-SKILL) — a governed Member could read no skill body and declare no deliverable: PD-23/PD-24 fail-closed both rows instead of confining them

- **source**: [a5sf-pd26-confined-skill/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd26-confined-skill/README.md) (§1–§9; the lane is `PD26-CONFINED-SKILL`, the row number takes the next free id after PD-25, which is occupied by the in-flight `pd25-unbounded-turn` lane and is not in this branch — disclosed).
- **true today**: **restored, at the confined `fs` layer, and measured live.** The governed preset declares `tool-skill` and `tool-present` again, and the realm's route-C attach shadows both names INSIDE the Member's isolated scope, so the `fs` they resolve is the confined Provider guarded by `createMemberFsGuard` (PD-17's face), not the BASE `fs` PD-23/PD-24 measured. In one delegated Member turn, against the real Host and the shipped opt-in preset, an agreeing two-boot `DEV-LIVE` pair measures: **surface 29 → 31** names with `skill` and `present` on it (pre-fix arm: 29 on the merged tree, both absent — the merged head re-measured both arms after `PD25-UNBOUNDED-TURN` removed `tool-goal`/`tool-ask-user` from the same preset); in-lane `skill` returns the declared body with **1 allow fact** (`readText`, `tool=skill`, the call's own `callId`); out-of-lane `skill` is **`IO_READ_DENIED`, 0 body bytes, exactly 1 deny fact** (pre-fix: typed `unknown tool`, 0 facts); in-lane `present` succeeds and appends **exactly 1 `deliverables/presented`** event with 2 allow facts (`lstat`+`stat`); out-of-lane `present` — existing **and** missing — is **`IO_READ_DENIED` with exactly 1 deny fact at `lstat`, 0 events, and no `file not found` oracle** (pre-fix: 0 facts, 0 events); `bash`/`read`/`grep` still run on the lane and still write their allow facts (6 in the pre-fix arm, 9 in the post-fix arm — the extra 3 are the two confine-restored faces); out-of-lane bytes in any model request: **0** in both arms.
- **not true**: (1) **not true that the two rows were "governed" when the preset declared them** — PD-23 measured `skill-filesystem` returning an out-of-lane `SKILL.md` body with zero facts (that body then sat in seven later requests), PD-24 measured `present` accepting a real out-of-lane path and refusing a missing one `file not found` with zero facts; (2) not true that restoring the names reopens either hole — the pre-fix arm of the same driver boots the archived pre-fix composition and still measures the typed `unknown tool` with zero facts, and the post-fix arm measures the denial at the **read**, not at the declaration; (3) not true that the declaration authorizes anything — `a5sfSkillCatalog` is data (`{name,description,path}`), and the out-of-lane entry's `path` is refused by the compiled lane even though the file exists and is declared; (4) not true that the `deliverables/presented` event is free — the realm ctx does **not** receive an agent-scoped `tools/result` dispatch, so a straight delegation of the host package's `apply` appends **zero** events (measured in the first dev boot); the shadow registers that listener on the agent's own ctx, and the host-free suite pins the tool definition byte-equal to the host package's; (5) not true that `present`'s typed refusal is visible for free — the host package re-raises the provider error unchanged, so the shadow prefixes the code (`IO_READ_DENIED: …`) to keep it from being misread as an existence answer.
- **security consequence**: **governance hole** — the two capability regressions PD-23/PD-24 accepted are undone without moving the line: a governed Member can read a skill body and declare a deliverable **inside its compiled lane**, and every attempt outside it is refused with the typed code, zero bytes and a `a5sf-guard-consult/1` fact naming the tool and call.
- **current backstop**: `PD26-SURFACE-RESTORED` flattens the preset and pins both ids **and** package names plus the absence of `skill-filesystem`; `PD26-CONTRACT-SKILL` / `PD26-CONTRACT-PRESENT` pin the allow/deny contracts against a confined-fs double (out-of-lane = exactly one consult, zero bytes, zero events); `PD26-PARITY` pins both tool definitions to the pinned host packages' own; `PD26-PIN` (`A5SF_PD26_PIN=1`) reads `git show 1e650c3e3:cordis.patch.yml` and drives the real router to the typed `unknown tool`; `PD26-CATALOG-VALIDATION` refuses malformed declarations; `a5sf-pd26-mutation-controls.mjs` shows M1 (base-fs read) reddens CONTRACT-SKILL only and M2 (pre-fix composition) reddens SURFACE only, with PIN green.
- **smallest honest fix**: done as the route-C restoration PD-24's evidence specified — two Team modules mounted in the Member's isolated scope after the capability deny lane, both surface-neutral shadows (`attachA5sfNativeToolModules` refuses the Member setup when a name is not already visible). No second policy source: the lane stays the compiled Member policy the realm mounted.
- **proof**: [a5sf-pd26-confined-skill/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd26-confined-skill/README.md) — post-fix agreeing pair (`runs/`: 6/6 cases both boots, surface 31, skill 1 allow + 1 deny, present 2 allow + 2 deny, 1 deliverable event, 0 out-of-lane bytes) vs pre-fix agreeing pair (`archive/pair-prefix/`: surface 29, both names typed `unknown tool`, 0 skill/present facts, 0 events); `agreement-postfix.txt` / `agreement-prefix.txt`; host-free suite `tests/world-factory/a5sf-pd26-confined-skill.test.mjs` (5 arms + PIN) and `tests/world-factory/a5sf-pd26-mutation-controls.mjs`.
- **blocked by**: nothing for this row. The upstream seam PD-24 called a `CORE_SEAM_BLOCKER` was **not** needed: the route-C attach already gives a Team module the realm ctx, which is the seam. Residual (disclosed, unchanged): the host package's own `tools/result` scope means the delivery listener must live on the agent ctx — a Team-side arrangement, not an upstream change.
- **anchors**: `cordis.patch.yml#L256-L256` contains `preset-a5sf-governed-member` ; `tests/world-factory/a5sf-pd26-confined-skill.test.mjs#L174` contains `PD26-SURFACE-RESTORED` ; `packages/runtime/src/plugin/live/a5sf-realm-row.mjs#L236-L236` contains `A5SF_SKILL_CATALOG_KEY` ; `tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs#L4-L4` contains `PD-26`
- **status**: **DRAFT — not merged.** 2026-11-14, branch `task/pd26-confined-skill-20261114`, draft PR (first line `PD26-CONFINED-SKILL`), base `origin/master` = `06adbf850` (`PD25-UNBOUNDED-TURN`, merged in). Evidence class **DEV-LIVE** (two agreeing pairs, slot-leased, 3180-family ports, `DSH_HOME` under `tests/homes/`, pinned host tree read-only, core patch budget 0); `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change**.
- **superseded in part by PD-28 (2026-11-14, `PD28-SERVICE-SEAM`)**: the two `confined-*-tool.mjs` shadows this row added are **deleted**; the confinement the row measured is unchanged (the same confined `fs` face, the same `IO_READ_DENIED`, the same facts), but it is now reached by a Team `skills` **provider** plus the **pinned host** `present` package instead of a Team copy of the host definitions. The row's readings stay the historical record of what PD-26 measured; PD-28 reproduces them item-by-item with no Team tool module at all.

### PD-28 (SERVICE-SEAM) — PD-26 restored `skill`/`present` by forking the consumer tools; the audit is right and the missing piece was always the SERVICE

- **source**: [a5sf-pd28-service-seam/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd28-service-seam/README.md) (§1–§9; lane `PD28-SERVICE-SEAM`, branch `task/pd28-service-seam-20261114`, base `origin/master` = `24d2cf760`).
- **true today**: **the external audit of PD-26 holds, and the two seams are proven on the product face.** PD-26's two files were *consumers*: `skill` only calls `ctx.skills.list()/get()` and never touches the filesystem, `present` only calls `ctx.fs.lstat/resolve/stat` and subscribes to `ctx.on('tools/result')`. What PD-23/PD-24 had removed was therefore never the tools — it was (1) a `skills` **provider** whose body reads run on the Member's confined `fs` and (2) an **event delivery** path that lets the pinned `present` module's own listener see the Member's `tools/result` dispatch. PD-28 deletes both forks, keeps the pinned host rows untouched, and changes exactly two seams: a Team `skills` provider registered from the Member's realm (`inject = ['skills','fs']`; `list()` serves a declared catalog with zero filesystem access, `get()` resolves and `readText`s the body through the confined `fs`, and any refusal is re-thrown as a `HarnessError` so `error.info.code = IO_READ_DENIED` survives) and a **direct** mount of the pinned `@deepseek-ai/dsh-tool-present` module on the same realm scope, bypassing the registration router that had re-scoped its `tools` service (the router's isolate label is what filtered its `tools/result` listener out — measured, not inferred: the same native module mounted directly appends 1 event, mounted through the router 0). In one delegated Member turn against the real Host and the shipped opt-in preset, an agreeing two-boot `DEV-LIVE` pair measures: surface **31** names with `skill` and `present` on it; in-lane `skill` body returned with **1 allow fact**; out-of-lane `skill` **`IO_READ_DENIED`, 0 body bytes, exactly 1 deny fact**; in-lane `present` succeeds with **2 allow facts** (`lstat`+`stat`) and appends **exactly 1 `deliverables/presented`** event; out-of-lane `present` — existing **and** missing — refused with **exactly 1 deny fact at `lstat`**, **0 events**, no `file not found` oracle; `bash`/`read`/`grep` still run on the lane (6 of the 9 allow facts); out-of-lane bytes in any model request: **0**. Every number is **identical, item-by-item, to PD-26's own two-boot run** (`skillFacts {total:2, allow:1, deny:1}`, `presentFacts {total:4, allow:2, deny:2}`, `factTools {bash:3, read:2, grep:1, skill:2, present:4}`, `deliverablesEvents: 1`) — the same behaviour with **zero Team tool modules**.
- **not true**: (1) **not true that PD-26's safety claim was independent of tool wiring.** Its two files restated the pinned host definitions by hand; a third capability would have needed a third hand-written fork, which turns "write our own tool" from an exception into the default and makes the audit's fear — the safety claim depends on *our copy* being correct — the actual situation. PD-28 removes the fork: the `present` capability is the shipped host package, byte-identical to the pinned tree, and the only Team code is a provider, i.e. the service the tool was always consuming. (2) **not true that the event failure was "the realm ctx carries Member scope, so it never receives an agent-scoped dispatch"** (PD-26's stated reason): measured, `scopeOf(realmCtx)` is the **agent** in *both* mounts. The filter is the `tools` **service** isolation label the router assigns when it re-mounts the module; a listener registered on a ctx whose `tools` resolves to a different isolate is dropped by `Service.prototype[filter]`. (3) **not true that the skill catalog can be produced by the existing filesystem provider**: `skill-filesystem` discovers roots by listing them before `get()`, so a root outside the lane makes `list()` throw — it cannot *declare* an out-of-lane skill and then refuse only its body. The catalog is therefore authored declaration data (`a5sfSkillCatalog`, profile/preset config), not an authority: the authorization of every byte still happens at the confined `fs` guard. (4) **not true that the native `present` refusal carries the code token in its model text** — the host module renders the lane's message verbatim; the code lives in the guard **fact** (`decidedBy: IO_READ_DENIED`) and in the tool result's `error.info.code` (host-free pinned in `PD28-PRESENT`). PD-26's fork added the token itself; PD-28 does not restate host text.
- **security consequence**: governance hole — a Member could reach a capability with no service behind it (typed `unknown tool`) or, worse, deliver with no recorded event; the fork that hid it is deleted.
- **current backstop**: the confined `fs` guard (PD-17, `createMemberFsGuard`) authorizes **every byte** either capability consumes, and it is the only authorization in the path — the catalog decides *what exists*, never *what may be read*. What had **no** backstop was the capability itself: with no provider anywhere, `skill` was a typed `unknown tool` (PD-23/24 fail-closed), and with the router-mounted `present` a Member could present an in-lane file and **no** `deliverables/presented` event was recorded. Both failure modes are now pinned host-free (`PD28-PIN`).
- **smallest honest fix**: **two seams and no tool copies** — (1) a Team `skills` provider mounted from the Member realm (`a5sf-skill-provider.mjs`: catalog `list()` with no filesystem access, `get()` via `ctx.fs.resolve` → `ctx.fs.readText`, refusal re-thrown as a `HarnessError` so the code survives), and (2) a `direct: true` mode in the route-C attach that mounts the **pinned host** `tool-present` module on the same realm scope without the registration router, verified by definition identity and refused (typed) for binding identity, observation-only mounts, empty `expectedTools`, or any deferred descendant. `TeamIoDenial` became a `HarnessError` so `error.info.code` is not flattened. Both forks deleted.
- **proof**: [a5sf-pd28-service-seam/README.md](../../../../dev/agent-workflow/evidence/a5sf-pd28-service-seam/README.md) — §4 the two-boot agreeing `DEV-LIVE` pair (6/6 cases each, `agreeing=true differing=[]`, every counter identical to PD-26's own run), §5 the host-free before/after (`A5SF_PD28_PIN=1`) plus two mutation controls (`VERDICT PASS 8/8`), and the host-free suite (4 pass + 1 PIN) with the real pinned `dsh-tool-skill` / `dsh-tool-present` / `dsh-skill` packages and the real compiled guard.

- **shipped (opt-in governed preset only)**: the preset's `tool-skill` / `tool-present` rows still point at the pinned host packages; the realm row now carries `a5sfSkillProviderSpecOf` (provider spec, `allowEmpty` acknowledged) and `hostPresentSpecOf` (direct mount, `expectedTools: ['present']`, verified by definition identity, no deferred descendants). No `cordis.patch.yml` change was needed. `CORE PATCH BUDGET = 0`; no upstream file touched; no second policy source (the catalog is data, the guard is the only authorization).
- **capability changes**: none relative to PD-26 (surface 31 in both; the same two names restored). What changes is **who owns the safety argument**: the host's tool + our provider/`fs`, not our copy of the host's tool.
- **blocked by**: **nothing for this row**; no `CORE_SEAM_BLOCKER`. Residuals stated, not fixed: (1) the provider's catalog entry is the metadata authority (name/description/invocation), so a per-file `disable-model-invocation` frontmatter flag is not re-read at `list()` time — reading it would require listing the file, which is exactly the out-of-lane read the deny arm forbids; (2) the direct mount is deliberately narrow (no binding identity, no deferred descendants, non-empty `expectedTools`) and fails closed with typed codes, so a future host module that defers registration cannot use it without extending the seam; (3) the `present` code token stays out of the model-visible text (see *not true* (4)).
- **anchors**: `packages/runtime/src/plugin/live/a5sf-skill-provider.mjs#L158-L158` contains `class CatalogSkillProvider` ; `packages/runtime/team-services/src/mount.ts#L1575-L1575` contains `mountDirectNativeModule` ; `tests/world-factory/a5sf-pd28-service-seam.test.mjs#L481-L481` contains `PD28-PIN` ; `dev/agent-workflow/evidence/a5sf-pd28-service-seam/README.md#L9-L9` contains `the external audit of PD-26 is RIGHT` ; `packages/testkit/test/p4t6-bookings/pd28-service-seam.json#L3-L3` contains `PD28-SERVICE-SEAM`
- **status**: **DRAFT — not merged.** 2026-11-14, branch `task/pd28-service-seam-20261114`, draft PR (first line `PD28-SERVICE-SEAM`), base `origin/master` = `24d2cf760`. Evidence class **DEV-LIVE** (two agreeing boots, slot-leased, 3180-family ports, `DSH_HOME` under `tests/homes/`, pinned host tree read-only, core patch budget 0); the before/after is host-free (`A5SF_PD28_PIN=1` PIN arm + two mutation controls, 8/8) because a boot always runs the tree it is in; `eligible = false`; **no `V@B`, no grade, no Q7/Authority/CI change**.


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

> **2026-11-10 ranking correction (append-only; the rationale above is the 2026-11-07 reading).**
> The ordering above was written when the two "only these two pass the hole test" rows were the only
> holes **known**. Live measurement added two more that pass the hole test **today, on a wired
> path**, so the live ranking is: **PD-13 and PD-12 first** (a Member's own `bash` delivered a read
> its ceiling forbids and ran a command a `network: deny` ceiling forbids — no composition change
> needed, both measured), then **PD-2** (latent, needs the face), then **PD-3** (the structural cause
> of PD-13 and the ship-order gate), then PD-1's remaining risk (fixed), then PD-4/PD-5/PD-6/PD-14
> behaviour, then PD-7/PD-8/PD-9/PD-10/PD-11 records. The "if only one row is fixed" sentence is
> **superseded in practice**: fixing PD-1 (done) removed the withdrawal hole; what remains open at
> the top is the pair of live holes, and both are closed by the same build (a confined terminal face
> that the Member's `bash` is routed through) — which is also why PD-13 and PD-12 must be read
> together, exactly as PD-2 and PD-3 already were.

## 4. Not on this list, deliberately

- **An undeclared Member template gets the full Team tool catalog (legacy mode) — a documented
  compatibility default, not a defect (E1, 2026-11-13).** The recon finding "a template with no
  `capabilities` receives all fifteen `team_*` tools, including `team_delegate` and
  `team_grant_permission`" is the *contract*, not an accident: `staticCapabilitiesOf` returns
  `{ mode: 'legacy' }` and the runtime then takes `[...catalog]`
  (`packages/domain/policy/src/static-capability-source.ts`;
  `packages/runtime/src/plugin/live/agent-bindings.mjs:3024`), while the domain type says
  `capabilities` absent = "legacy mode, no restrictions"
  (`packages/domain/blueprint/src/types.ts`) and the authoring contract said "rc.1 behavior,
  everything inherited". **The gap was documentation, not semantics**, so the fix is disclosure:
  [team-blueprint-authoring §5](../../../../.agents/skills/team-blueprint-authoring/SKILL.md)
  now spells out the fifteen-tool surface, the explicit narrowing (`teamTools: {kind: deny}`), and
  the one sub-field that is *not* inherited (`mcp` = no initial grant). Executable evidence:
  `tests/world-factory/a5sf-capability-defaults.test.mjs` (host-free; prints
  `E1-UNDECLARED-CAPABILITIES mode=legacy teamTools=15` and the exact names). Changing the default
  to fail-closed would break the documented rc.1 compatibility of every legacy blueprint, so it
  stays an owner decision, not a recon fix. It is **not** a PD row because no product behaviour
  changes and nothing is blocked on it.

- **The undeclared `chmod` gap — `LIVE-REPRODUCED`, still not a row.** It was disclosed, not
  discovered: Landlock has no "change mode" right, so a same-uid inode that a shell can reach can be
  `chmod`-ed without any declaration; `chmod` targets are therefore a *declaration* on the write
  lane, and an undeclared `chmod` is outside this admission's reach
  ([a5sf-bash/README.md](../../../../dev/agent-workflow/evidence/a5sf-bash/README.md) §6.2, [BL-17](ALPHA5-SANDBOX-BACKLOG.md)).
  **2026-11-10:** reproduced live on the Shell-PTY lane — `chmod 600` on a file inside the read lane
  and outside the write lane changed the mode `644 → 600` with **no** `chmod` declaration, **0**
  guard facts and no typed code (`runs/run-08/item5-chmod-gap.json`; identical on runs 03, 04 and
  09). The row was **not** duplicated; BL-17 carries the dated `LIVE-REPRODUCED` annotation. It is
  listed here so that a reader scanning this register for the chmod gap finds the pointer rather
  than a hole in the list.

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
  elsewhere and this register was not updated) — for a row whose evidence is not yet on master, the
  row must instead be **declared** in §6 with the same id, path, branch and PR, and the declaration
  **reds once the file lands** so it cannot rot;
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

**2026-11-10 addendum.** The four new rows are scoped the same way: PD-11's mechanism is host-free
(0 boots, `TEST-WORLD` lane); PD-12, PD-13 and PD-14 are **`DEV-LIVE` live development evidence**,
which is a record class that cannot become a candidate claim or a `V@B` value, and every quoted
number is an artefact under the named lane. **All three evidence paths are now on this tree**
(PR #634 and PR #635 merged); the earlier §6 declarations were removed when the paths landed, as
the machine check requires. PD-12's fix evidence (`evidence/a5sf-pd12-fix/`) is still a draft-PR
lane — it is cited as `DEV-LIVE`, makes no candidate claim, and cannot move `V@B`. Nothing in this
revision was re-measured by the register itself: it ran 0 boots, and every claim cites an artefact
that was read.

## 6. Rows whose evidence is not yet on master

**Empty as of 2026-11-10.** The three rows that were declared here (PD-12/PD-13/PD-14) now cite
files on this tree, so the declarations were deleted rather than left to rot. The machine check
(`tests/world-factory/a5sf-debt-register.test.mjs`) still enforces the two things that mattered:
every cited evidence file exists in the tree and still mentions the finding id, and any future
§6 declaration reds the moment its path lands. A `DEV-LIVE` row is never aggregated into a matrix
cell: that record class carries no `V@B`, and the run-record finalizer refuses the conversion by
construction. PD-12 is `FIXED` with residuals (`550815c97`, #640); PD-13 (`c91c72bca`, #642) and PD-14
(`47316541a`, #643, fixture-only with 0 boots) are `FIXED` too — all three are ancestors of
`origin/master` and their `status` lines carry the merge commit.

Gates: `node --test tests/world-factory/a5sf-debt-register.test.mjs`,
`node scripts/doc-checks.mjs`, `git diff --check`.


> **2026-11-08 状态更新（PD21-SUBAGENT-REALM；只追加，不改任何既有行文）**：本册从 **21 行**变为
> **22 行**，取 #670 之后的下一号 **PD-22**（连续法 `PD-1…PD-22`）；轮次身份写在 sourceId
> `SUBAGENT-CHILD-REALM` 里，lane 的磁盘名仍是 `pd21`/`PD21-SUBAGENT-REALM`。该行状态是 **DRAFT**
> ——只在 PR 合并后才允许改成 `FIXED`（口径同 PD-7/PD-9 的 2026-11-08 注记）。依据 =
> `dev/agent-workflow/evidence/a5sf-pd21-subagent/README.md`（DEV-LIVE，两对 agreeing boots：pre-fix
> child/escape/attribution 三臂 REFUTED、post-fix 全 PROVEN）。同一 lane 的**正面**测量（不新开行）：
> `team_create_member` 从 Member 侧创建「自己的」与「更宽的」模板都被 admission 角色门拒绝
> （`TEAM_RUNTIME_CALLER_AUTHORITY_DENIED`，实例数 2 → 2），而 Member 的 `memberEnvelopes` 明确
> **allow** `create-member`，所以拒绝来自角色门而非 envelope —— 该面本次**未发现**逃逸，无需新债。
> 真正受治的 child realm 不是 follow-up 的“以后再说”，而是 **`CORE_SEAM_BLOCKER`**：装配点在
> pinned upstream `packages/subagent/subagent/src/child-agent.ts`（`applyChildComposition` →
> `composeFrom(childCtx, parent.ctx)`），改它 = upstream source patch（红线禁止）；自家实现需要新的
> provider seam 且无预算。详见该 README §4.1。

> **2026-11-14 状态更新（PD23-CONTROL-SURFACE；只追加，不改任何既有行文）**：本册从 **22 行**变为
> **23 行**，取 **PD-23**（连续法 `PD-1…PD-23`）。lane 的磁盘名/分支/PR 仍是 `pd23`/`PD23-CONTROL-SURFACE`
> （同 PD-21 先例：改名会让已 boot 的日志与 driver digest 失配）。**行号已顺延**：本 lane 最初按连续法
> 登记为 PD-22，2026-11-14 合并 **#671**（`ac1d7958d`，PD-22 = `SUBAGENT-CHILD-REALM`）后顺延为 **PD-23**；
> 早先那条「合并后顺延」的注记在此兑现并取代之（留着它会与现状相反）。依据 =
> `dev/agent-workflow/evidence/a5sf-pd23-control-surface/README.md`（DEV-LIVE，两对 agreeing boots：
> pre-fix 的 skill/byte 两臂按「缺陷成立」判 PROVEN、post-fix 全部 PROVEN；Member 面在 **base
> `c5d619e53`** 上 40 → 36，合并 #671 后的 head 上本 lane 可归属的增量是 `skill` 一项，35 → 34）。

> **2026-11-14 状态更新（PD24-SURFACE-LEDGER；只追加，不改任何既有行文）**：本册从 **23 行**变为
> **24 行**，取 **PD-24**（连续法 `PD-1…PD-24`）。lane 的磁盘名/分支/PR 仍是 `pd24`/`PD24-SURFACE-LEDGER`。
> 依据 = `dev/agent-workflow/evidence/a5sf-pd24-surface-ledger/README.md`（DEV-LIVE，**三对** agreeing boots：
> post-fix 12/12、pre-fix 12/12、ask 臂各 1 例；外加 0 boots 的 host-free 套件与 4 臂 mutation controls）。
> **口径修正（不是等级变更）**：§1.7 把 `present` 归入「表面存在但不受治 = 宿主服务、本阶段不另设数据面上限」，
> 并据此把 `ask_user_question` / `exit_plan_mode` / goal 族记作「无数据面 I/O」——三处都只是**未测量**，
> 不是 `none` 的结论。本 lane 实测后：`present` 是**越界且静默成功**（BASE `fs` 的 `stat` 接受了真实越界文件、
> 缺失文件回 `file not found` 形成存在性 oracle、0 条 a5sf fact、2 条 `deliverables/presented` 落在 Member 自己
> 的 session），已 fail-closed 移除并**披露为能力回退**（受治 Member 不能再申报 deliverable）；`exit_plan_mode`
> 在 plan mode 未激活时是 typed 拒绝（不产 `plan/mode`）；`ask_user_question` **不拒绝而是阻塞**（60 s 窗口内
> 无结果、无 `turn/end`、无 Team 状态写入；开发首 boot 上 `team.create` 被挂 300 s）——阻塞**不越界**，
> 按本 lane 的处置规则**不删**，作为独立缺陷披露待裁决；goal 族只测「能否启动自续轮」（`roundsStarted`
> 0 → 1 → 2，全部在 Member 自己的 session，`goalRoundsInOtherSessions = 0`），**goal 语义一字未改**（PD-25 的
> remit）。`team_*` 15 名属另一授权平面，**未测未改**。面上名册 34 → 33（−`present`），五个桶的恒等式见矩阵 §1.8.2。
