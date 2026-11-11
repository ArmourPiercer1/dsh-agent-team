# Release Notes — v0.1.6 (joint Alpha.5 + Alpha.6 close-out)

**Package version:** `0.1.6` (no `v`; every manifest listed in the pull request body).
**Git tag:** `v0.1.6` (annotated; cut only by the release decision — these notes do not tag).
**Base:** `origin/integration/v0.1.6` @ `f5dcb9952`.
**Distribution:** annotated Git tag + GitHub Release + installable tarball produced by `pnpm pack`. **No npm publish.**
The root package remains `private: true`.

**Phase names are not product versions.** Alpha.5 and Alpha.6 are engineering phase names. Neither appears in
the package version, the tag, or a distribution name. The version line is `0.1.6`.

This release puts two engineering planes into **one artifact**: the governed team runtime measured as the
Alpha.5 Preview, and the approval-routing plane assembled as Alpha.6. The first is stable in the sense
defined in §2; the second is **opt-in experimental** and is off by default.

---

## 1. What ships

**One bundle, both planes.** `pnpm pack` produces one `dsh-agent-team` tarball. The same artifact carries:

- **The governed team runtime (Alpha.5).** An opt-in governed Member preset (`a5sf-governed-member`)
  with a compiled per-Member I/O realm: `read`, `write`, `edit`, `grep`, `glob`, `bash`, `skill`,
  `present`, `web_fetch`, `web_search`, plus `read_image` on a route that declares `image`. The
  realm decides at the admission layer and records a guard fact / typed deny per governed call.
  The same artifact carries the Goal tools (`create_goal`, `get_goal`, `update_goal`) and per-Member
  Stop (durable `pause` + `disarm`), and installs through the ordinary
  `dsh plugin --profile web add <tarball>` / `dsh web` path.
- **The approval-routing plane (Alpha.6).** Blueprint v5 `reviewRouting`, the Officer plane
  (assigned-Officer review), review-wake creation/merge/delivery into the native Inbox, and Sticky
  Stop (a durable human-Stop marker that machine relays cannot clear). This plane is activated only
  by explicit opt-in (§2, §3.3); with the opt-in absent or `false`, the object handed to the control
  service is byte-identical to the Alpha.5 wiring and no Alpha.6 parse, member read or port exists.

The two planes are not separate products and are not shipped as separate tarballs. Alpha.6 does not
become the default by being present in the artifact.

---

## 2. Stability split

**What "stable" means here:** covered by the frozen Alpha.5 Preview contract and the live evidence it
names; we will not change these semantics without a version boundary and an entry in the next release
notes. It is a support statement about this artifact, **not** a claim that the repository's per-tool
acceptance matrix moved: no `V@B` cell is changed by these notes and no `CANDIDATE-C2` claim is made.

### 2.1 Stable

| Surface | What is stable |
| --- | --- |
| **Governed I/O** | On the opt-in governed preset, the governed I/O tools (`read`, `write`, `edit`, `grep`, `glob`, `bash`, `skill`, `present`) are served through the Member's confined faces; out-of-lane access is refused at the admission layer with a typed denial and a guard fact, before a provider call or a process exists. |
| **Goals** | `create_goal` / `get_goal` / `update_goal` work on a governed Member and automatic rounds are driven by the host goal-round driver. Stop withdraws goal continuation (durable `paused`, no new round after the ACK). |
| **Per-Member Stop** | The Member-level Stop control exists and means: after the durable `pause` is ACKed, there is no continuation (no new round, no new model request). See the exact limitation in §4. |
| **Web face** | `web_fetch` and `web_search` are served by the Member's confined web face on the governed preset: allow calls enter the provider and record an allow fact; deny calls are refused on the face before any transport. |
| **`read_image` on an `image` route** | On a model route that declares `image`, `read_image` reads through the governed fs face. On a default `['text']` route it is refused **before** provider I/O (0 facts / 0 bytes), which is the measured stable behaviour. |
| **Ordinary install** | `pnpm pack` → `dsh plugin --profile web add <tarball>` → `dsh web` executes tools with a real model. The measured run covered `web_fetch`, fs write/read, a goal of two rounds and Stop; `n=1` is an existence proof, not a stability claim. The install path does not patch the host (`CORE PATCH BUDGET = 0`). |

### 2.2 Experimental (opt-in; not on the default path)

The whole Alpha.6 plane is **opt-in experimental**. It is not covered by the Alpha.5 Preview contract
and it may refuse to boot rather than degrade silently.

| Surface | Status |
| --- | --- |
| **Approval routing** (`reviewRouting`) | Experimental. Requires a v5 blueprint and the opt-in; absent/false keeps the Alpha.5 path. |
| **Officer plane** (assigned-Officer review, transfer, escalation) | Experimental. Needs exactly one legal Officer template in the routing; zero or multiple live Officers is refused **per query** when a review is attempted (the Team itself boots — the boot only checks the template declaration). |
| **Review wake** (merge, single-flight latch, durable intent rows, Inbox delivery) | Experimental. Needs a Host live wake seam plus a native `reviewWakeInbox`; without them the Team refuses to boot. The accepted-but-unclaimed abandonment defect applies (§5). |
| **Sticky Stop** (human-Stop marker for **review wakes**; machine relays cannot clear it) | Experimental. It is armed only by the Alpha.6 opt-in and its listeners are not registered when the opt-in is absent. The marker is **latch-scoped, not session-scoped**: a human Stop protects the reviewer while a review latch exists for that session; a Stop issued between asks (or after a restart before the next ask) may not survive to the next wake — see §4.7. It stops the **review wake**, not every message (see §4.7). |
| **v5 blueprints** (`schemaVersion: 5`, `TeamBlueprintV5Core`) | Experimental. v5 extends v4 and one blueprint still carries the v4 I/O ceilings; v3/v4 documents remain supported and byte-identical. |

**Default-off proof, not a promise:** the Alpha.6 opt-in is the boolean
`config.alpha6ReviewRouting === true`. With it absent or `false`, the code does not invoke the Alpha.6
composition thunk at all. This is the regression boundary the Alpha.6 tests pin.

---

## 3. Deployment preconditions

These are preconditions, not tips. If one is missing, the behaviour is the typed refusal described
below, not a degraded version of the promised behaviour.

### 3.1 `web_search` needs an Exa-compatible endpoint and key

Without an Exa-compatible endpoint and key, every `web_search` call returns the typed
**`WEB_PROVIDER_UNAVAILABLE`** and **zero search requests leave the process** (measured:
`searchServer.connections = 0`, one deny fact). It is not "searched but found nothing" and it does
not silently fall back to the host's base web. The endpoint and key are the deployer's input; the
default install graph contains no Exa provider.

### 3.2 `read_image` needs a route that declares `image`

The model route must declare `image`. On the default `['text']` route the call is refused **before any
provider I/O** (0 facts / 0 bytes), not "read then failed". The stable claim covers both the declared
route path and this refusal; successful image reading on a declared route is not a promise that every
model can see images.

### 3.3 The Alpha.6 plane needs its opt-in wiring

Enabling Alpha.6 is one explicit act with several required parts. All of the following must hold; a
missing part is a boot-time refusal (`TEAM_PLUGIN_CONFIG_INVALID`), never a silent fallback to the
Leader path:

- `alpha6ReviewRouting: true` in the Team plugin config (absent/false = Alpha.5 behaviour);
- a **v5** bound blueprint whose `reviewRouting` is enabled and which declares **one legal Officer
  template** (a missing or Leader-equal `officerTemplateId` refuses at boot; zero or two live
  Officer *instances* are refused per query when a review is attempted — see §4.7);
- an **absolute, non-empty durable** `alpha6WakeIntentPath` (one wake-intent row per latch, so two
  reviewers cannot overwrite each other);
- a Host that exposes both the live review-wake delivery seam and `live.reviewWakeInbox`;
- optionally `alpha6WaitTimeoutMs` (finite positive; defaults to 600000 ms); a timeout stops the
  wait, it never decides or consumes.

No `reviewRouting` snapshot or second approval ledger is created by this release.

---

## 4. Known limits carried forward

These are unchanged by 0.1.6. Each one is a limit of the claim, not a to-do that the release silently
closes.

1. **The network axis is one boolean.** It is an admission-layer refusal, **not** OS isolation and
   **not** a per-host policy. A deny means our admission layer refused the call; it does not mean the
   operating system was asked to refuse a connection.
2. **There is no trustworthy global round budget.** `maxGoalRounds` is editable by the Member itself.
   There is no Team-side round budget that overrides it.
3. **Shell command bodies are not attributed by the service axis (BL-17).** The governed service axis
   attributes the invocation; it does not attribute the text inside a shell command body. The command
   body is visible to other processes on the same machine (`/proc/<pid>/cmdline`), as measured.
4. **Stop means "no continuation after the durable `pause` is ACKed", not "no execution after the
   click".** There is a millisecond-scale window between the click and the pause ACK in which a tool
   call may already have started. The number is measured and disclosed, not hidden.
5. **Stopping the Leader's turn does not stop delegated asynchronous work.** Once `team_delegate` is
   accepted, the Member's turn advances in its own session. Stopping the Leader ends the Leader's
   current turn; it does not cascade to the Member. Stop is also not Archive.
6. **This is not a security boundary against a malicious Member.** It is governance with
   attribution, not isolation with non-escape. A malicious Member is the subject of a later phase,
   not a property this release claims.
7. **The Alpha.6 Sticky Stop is latch-scoped, not session-scoped, and it governs review wakes (PD-40).** A human Stop writes its
   durable marker only when a wake coordinator already exists for that reviewer session (a wake was
   dispatched, or boot recovery adopted an intent/stopped row). A Stop issued **between asks**, or
   **after a restart before the next ask**, finds no coordinator, writes nothing and returns
   `false`; the next review wake can then activate the "stopped" reviewer. This is why §2.2 states
   the condition instead of promising an unconditional durable marker. Falsifier (the reviewer's):
   call the stop hook on a session with no latch and observe a `stopped-*` marker; or show a
   production path that creates a coordinator for every live reviewer at boot. Making the marker
   session-scoped is a design change with crash semantics and is tracked as PD-40, not attempted here.
   **Measured 2026-11-11 (WP1, `dev/agent-workflow/evidence/wp1-sticky-stop/`), two arms twice:** with a
   real latch the marker is written at `<DSH_HOME>/alpha6-wake-intents/stopped-<hash>.json`, is
   **byte-identical after SIGKILL + cold boot**, and is consulted (the same reviewer gains new ledger legs
   but zero new wake turns). Without a latch, no marker and no "protected" claim appears anywhere, and one
   ordinary human turn later the next review wake activates the reviewer — the disclosed limit, observed.
   Two scope corrections, both measured: (a) **a Stop stops review wakes, not all traffic** — a machine
   `member.send` / `member.followup` is still delivered and the work unit still admitted; only the review
   wake is withdrawn. (b) `ownerRootSessionId` in the marker is the **mount/boot root that wrote it**, not
   necessarily the Team root that created the reviewer. The supported path is a proven, latch-scoped
   protection; the unsupported path is not durable protection at all.
8. **With Alpha.6 ON, a relay-started turn cannot authorize `create_goal`.** A machine
   `team_send_message` / Leader relay carries the producer kind `plugin:dsh-agent-team`, so upstream
   `hasDirectHumanInput` refuses `create_goal` on that turn. Work delivery, root work and a human
   `member.send` still carry `source.kind: 'user'` and keep the authority. With Alpha.6 **off** the
   relay attribution is the base `{kind:'user'}` (and no Sticky Stop listener exists), so the
   Alpha.5 Goals row in §2.1 is unchanged.

---

## 5. Known defect A6-GAPS-26 — read before relying on review wake

> **Id scope.** `A6-26` is reused by two different evidence sets: in
> `dev/agent-workflow/evidence/a56-semantics/05-a6-kit-run.log` it is "relay/work delivery does not
> clear the Sticky Stop" (**PASS**); in `a6-gaps-g2-unclaimed-r11/run.log` it is the abandonment below
> (**FAIL**). This section cites the second by path and text (`FAIL A6-26 … verdict=abandoned-terminal`)
> and does not rely on the bare id. Renaming the A6-GAPS ids (e.g. `A6G-26`) is tracked separately.

**A6-GAPS-26 (open; affects the experimental Alpha.6 review-wake plane).** An Inbox wake that was
**accepted but not yet claimed** can be **terminally abandoned** across a crash. The measured
consequence is:

- **no duplicate execution** and **no side effect** — the accepted window ends at-most-once;
- the durable control request is marked `control-request-abandoned` with reason
  `invocation-abandoned`;
- the request is **not decidable afterwards**: `team_resolve_control` is refused with the typed
  `CONTROL_REQUEST_ABANDONED` ("can never become an allow");
- the Inbox wake is not redelivered.

The measured run is `dev/agent-workflow/evidence/a6-gaps-g2-unclaimed-r11/run.log` (the line
`FAIL A6-26 … verdict=abandoned-terminal`; any `A6-26 PASS` you find in `a56-semantics/` is a
different assertion). A crash **at claim time** recovers: a claimed wake is replaced by
exactly one new wake and its durable request is preserved or decided
(`dev/agent-workflow/evidence/a6-gaps-g2-claimed-r10/`, `A6-25` PASS). The gap is specific to the
**accepted-but-unclaimed** window.

**Recovery is re-issue, not resolve.** Do not retry `team_resolve_control` on the abandoned request.
Re-issuing means a new ask / a new request id, after checking whether the original call could already
have had side effects. The operator procedure, including when re-issuing is **not** safe, is
[RUNBOOK-CONTROL-ABANDONED.md](./RUNBOOK-CONTROL-ABANDONED.md).

This defect is why the release-notes promise for review wake is narrow: an accepted wake may end in a
durable, discoverable **in the team ledger page**, side-effect-free abandonment; it is not a promise
that every accepted wake is eventually delivered or decidable on this base.
**"Discoverable" does not mean it shows up where an operator looks first**: the abandoned request is
readable by id on the ledger page, but it does **not** appear in `team_list_pending_control`
(`pendingControlCount` reads 0) and `team_resolve_control` refuses it with
`CONTROL_REQUEST_ABANDONED`. An operator who checks only the pending list will see it vanish.

---

## 6. Version-line note — the `0.1.1-alpha.2` → `0.1.6` jump

The previous package version was **`0.1.1-alpha.2`**. This release sets **`0.1.6`**.

This is a deliberate version-line jump, not a sequence of five releases:

- **`v0.1.2`, `v0.1.3`, `v0.1.4` and `v0.1.5` were never released, never tagged, and never existed as
  product versions.** Nothing in this repository should be read as implying that they did.
- The jump aligns the package/tag line with the integration line (`integration/v0.1.6`) that carries
  the joint close-out. `0.1.1-alpha.2` remains the name of the earlier Alpha.2 artifact recorded in
  historical documents; it is not this artifact's version.
- Forward policy: release candidates are `v0.1.6-rc.N`; later fixes are `v0.1.7`; larger evolution is
  `v0.2.0`. Alpha.5 / Alpha.6 remain phase names only.

---

## What these notes do not claim

- They do not publish, tag or merge anything. Distribution is the Git tag + GitHub Release +
  installable tarball; **npm is not used**.
- They do not move the repository's acceptance matrix, grant a `V@B`, or create a `CANDIDATE-C2`
  claim. The formal release gate remains where the repository records it.
- They do not upgrade the experimental Alpha.6 plane to stable, and they do not make the Alpha.6
  plane the default.
- They do not promise that an accepted review wake is always delivered or decidable: see A6-26 in §5.

## Evidence pointers

- Preview contract and stability boundary:
  `docs/plans/active/alpha5-sandbox-first/PREVIEW-CONTRACT-2026-11-16.md`
- Preview readiness / live measurements:
  `docs/plans/active/alpha5-sandbox-first/PREVIEW-READINESS-2026-11-15.md`
- Ordinary install and real-model run:
  `dev/agent-workflow/evidence/a5sf-pd37-installed-tools/`
- Alpha.6 close-out measurements:
  `dev/agent-workflow/evidence/a6-gaps-final/`,
  `dev/agent-workflow/evidence/a6-gaps-g2-unclaimed-r11/`,
  `dev/agent-workflow/evidence/a6-gaps-g2-claimed-r10/`
- Alpha.5 Goal authority × Alpha.6 message identity:
  `dev/agent-workflow/evidence/a56-semantics/`

---

## 7. 验收范围与类型化例外（2026-11-09 裁决，只追加）

**G3–G5 的适用范围是 opt-in 的受治路径（governed preset），不是默认 `standard` 路径。**
**默认 `standard` 路径保留其原有的权限与执行行为，不宣称受到 Alpha.5 confined I/O 上界治理，也不纳入本次逐工具验收矩阵。**
它并非"没有任何权限检查"——Alpha.4 的既有 envelope 与宿主原生授权仍在——但它**没有**进入
`MemberCeiling ∩ ToolRestriction` 的受治机制：confined realm 只在显式选择 `a5sf-governed-member`
且启用 `a5sfGovernedRealm` 时装配（`cordis.patch.yml`）。

> **2026-11-09 勘误（Owner 裁决，安全语义级）**：本节初稿写过"默认路径 I/O 上界照常生效"，**那是错的**。
> 默认路径没有 Alpha.5 的 I/O 硬上界；把两者混为一谈会让读者以为不受治的路径受治。原文保留于此行之上不删，
> 错误以本块显式撤回。

**`network: restricted` 是类型化例外，不是"没配好"。** 能力表只承诺 `allow` / `deny` 两态；
`restricted` 会**显式**判为 `UNSUPPORTED`（netns 后端仍是未合并草稿），不会静默降级成 deny 或 allow。
如果你在蓝图里写了 `restricted` 并以为它比 `deny` 更严，读这一行：它不会按你的预期生效。

**候选验收（`CANDIDATE-C2`）的独立裁决由一个未参与产品实现的独立评审执行**：它自己跑 ≥2 次一致 boot、
自己产出 per-case verdict 并签进候选清单。它的独立性依据是"未写产品代码"，**不是**外部机构签署；
如果审计要求外部人类签名，这一点不满足，会明写。

**未验收项（不会被写成"通过"）**：性能阈值（BL-34）、`network: restricted` 的 enforcement、
A6 审批面在候选级（`CANDIDATE-C2`）的验收——Alpha.6 仍只由独立 kit 的 DEV-LIVE 覆盖。

---

## 8. 2026-11-09 — Stop before the durable consumption (A6-STOP-FENCE, owner ruling A; append-only)

> **Appended correction, 2026-11-11 (review finding on PR #710).** The first version of this section
> made universal claims that the evidence did not support. It said the guard "now receives the SAME
> invocation cancellation signal" without naming the lanes, it said "observed BEFORE that final
> consumption check" (which is not what the probe does), and it quoted a narrow measurement band as
> if it were stable. This paragraph and the substituted sentences below are the correction; the
> earlier wording is not silently rewritten elsewhere — the history lives in the PR review.

This section is appended, not a rewrite of §4.4 or §5. It states the Stop guarantee this build
provides for the **approval-consumption boundary** and the residual it does not close.

**The guarantee (exactly this, no more).** The last-mile guard can now receive the SAME invocation
cancellation signal the approval wait already consumes (an optional second argument; never a scope
field, never durable identity). That signal is read once, synchronously, **by** the final consumption
check — inside the per-team lock, after the authority / external-policy / PA-manifest checks, with
the ledger sequence already prepared. Earlier checkpoints in the same guard (team liveness, target
lifecycle, scope candidacy, external policy, corruption) return an ordinary block or an
undetermined/deny verdict and write **no** abandonment; within this guard path, and with this
reason, the terminal `control-request-abandoned` is written only by the fence trip itself. (The fact
type is also written by other abandonment paths — the inline `abandonControlRequest` and the
A6-26 crash abandon — which carry different reasons; see the note below.)

**Which lanes are wired — verified per lane, not asserted globally.** The fence exists in
`guardOperation`; whether a caller benefits depends on that caller handing it a signal. As of this
append:

| lane | call site | wired? | verification |
| --- | --- | --- | --- |
| A4/A5 parameter-permission ask | `packages/runtime/operation-permission/pre-execute-adapter.ts` (`guardOperation(scope, { signal })`, the same `exec.signal` passed to `awaitControlDecision`) | **wired** | host-free `a6-stop-fence.test.ts` arm S9 (barrier on the post-decision authority-facts await; verified RED against the unwired call) |
| PA control leg | `packages/runtime/operation-permission/pa-control-bridge.ts` (`waitSignal` = wiring signal ⊕ `input.signal` ⊕ bounded-wait controller) | **wired** | real-Host A6 boots (`dev/agent-workflow/evidence/a6-stop-fence/`, `-c2/`) plus the host-free guard suite |
| `team_*` guarded tools | `packages/tools/src/tools.ts#executeGuarded` → `packages/tools/src/guard.ts#consultGuard` (`ctx.signal` = the host's `exec.signal`) | **wired** | host-free `packages/tools/test/a6-stop-fence-wiring.test.ts` W1 (verified RED against the unwired call) |
| callers with no invocation signal | any `guardOperation(scope)` with no second argument | not wired **by design** | `a6-stop-fence.test.ts` S8 and the wiring test W2 pin the historical allow/deny behaviour |

A caller that passes no signal gets the historical behaviour byte-for-byte: no probe, no
abandonment.

- **cancellation observed BY that final consumption check** ⇒ nothing is consumed
  (zero `control-allow-consumed`), the tool body does not execute, the durable `allow` decision is
  left exactly as the approver wrote it, and the request is closed with exactly one terminal
  `control-request-abandoned` fact carrying the lifecycle reason
  `invocation-cancelled-before-consumption`. The prepared ledger sequence is deliberately burned (a
  gap), so the terminal row cannot occupy a sequence a consumption was already bound to. A later
  replay cannot re-consume (the terminal mark refuses it as `request-abandoned`) — **only while the
  abandonment row is durable** (see the fault path below).
- **cancellation arriving AFTER that check may race the durable write.** The window that remains is
  the single consumption write await (`await putEntry(...)` → `repositories.ledger.put`). If the
  write commits, the consumption fact is KEPT and is never rewritten as un-consumed. The host
  execution edge does check `signal.aborted` before the body, but **this PR does not exercise the
  post-consumption body**: the host-free arm S7 proves only that a cancel landing inside the write
  still commits and is kept. In-process on the author/review hosts the natural write await measured
  **sub-millisecond** (author ≈0.23–0.43 ms, reviewer 0.348–0.585 ms — a factor of ≈2.5 across hosts,
  not a stable band), and the window was deliberately held open (≈1–2 ms on both hosts) only to prove
  that a cancel landing inside it still commits. **No atomic Stop is claimed.** These are in-process
  numbers from the host-free suite, not production latency.
- **fault path (durability of the trip).** `commitAbandonmentFact` is not best-effort: if the
  abandonment write fails durably, the guard **throws** instead of returning a verdict. The allow is
  then unspent and still spendable — so "a replay cannot re-consume" holds only once the terminal
  abandonment is durable. A failed trip is a failed fence, not a silent one. The A4/A5 parameter
  lane and the PA bridge catch the throw and map it to a deny/block; the `team_*` guarded-tool lane
  does not catch it, so the failure propagates as a thrown tool error. In all three the body never
  runs.

**Not claimed / not attempted.** No durable per-invocation Stop state and no cross-process atomic
fence is introduced; that remains the design change PD-40 declined (see §4.7). The Alpha.6 Sticky
Stop and the **A6-26 accepted-but-unclaimed review-wake abandonment (§5)** are separate disclosures
and are not changed by this section — a Stop-abandon and a crash-abandon carry different reasons and
must not be read as each other.

**Team-tools branch.** The `team_*` guarded tools used to consult the same guard with no
cancellation signal at all (only the runtime action received it). That branch now forwards its
invocation signal to the same probe, so it is fenced at the same point; callers that pass no signal
behave exactly as before.

**Boot evidence (correction, 2026-11-11; superseded by the re-boot below).** The *first* kept boot
artifacts under `dev/agent-workflow/evidence/a6-stop-fence/` (`main-boot-r1`, `main-boot-r2`) and
`.../a6-stop-fence-c2/` were produced by a kit that recorded `git -C process.cwd() rev-parse HEAD`,
i.e. the tree the kit process ran in, not the tree `--worktree` booted. Their
`run-manifest.json#productSha` therefore names the base/main tree (`1964cb71c…`) and does **not**
bind the PR head, and `a6-stop.json` did not persist the abandonment rows. They are marked
**instrument-defective** in `a6-stop-fence/README.md` and `BOOT-2026-11-11.md`; their "Stop admitted,
no consumption, no execution" observation stands, their reason/sequence claim does not.

**Binding re-boot (2026-11-11, `re-boot` on the review-fixed head).** The kit now records the
`--worktree` HEAD and `final.abandonments`. Two main-agent boots on the review-fixed head
(`920981375…`, recorded as `productSha`/`productTree` in their manifests, evidence-only commits
after it) are the binding artifacts:

| run | A6-12 | what it shows |
| --- | --- | --- |
| `main-boot3-r1` | PASS | **the fence trip itself**: ledger `seq 16 control-request-abandoned`, reason `invocation-cancelled-before-consumption`, late re-allow refused `CONTROL_REQUEST_ABANDONED`, zero consumption, `file=""` |
| `main-boot3-r2` | PASS | **a different arm**: the Stop cancelled the invocation *before* the guard's final check — zero consumption, zero execution, **no** abandonment row and late re-allow refused `CONTROL_REQUEST_DECIDED` |

So the trip is now a captured artifact, not an inference, and the terminal-fact sentence above holds
for r1. r2 is recorded as the arm it is, not merged into the trip. Two clean boots still do **not**
prove the 4/6 rate measured on the unfenced candidate is zero; the rate claim belongs to the next
candidate's re-measurement (§7).
