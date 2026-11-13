# Release Notes — v0.1.6 (joint Alpha.5 + Alpha.6 close-out)

**Package version:** `0.1.6` (no `v`; every manifest listed in the pull request body).
**Git tag:** `v0.1.6` (annotated; cut only by the release decision — these notes do not tag).
**Base:** `origin/integration/v0.1.6` @ `f5dcb9952`.
**Distribution:** annotated Git tag + GitHub Release + installable tarball produced by `pnpm pack`. **No npm publish.**
The root package remains `private: true`.

**Revision note (2026-11-12, CLOSEOUT-DOCS rebase).** This branch was rebased onto `origin/master` after
#729/#733/#734/#736/#720 merged. The 2026-11-11 appended blocks below are corrected **in place** where those
merges made them false (each correction is dated and says what was wrong), and the earlier merged sentences
they narrow are kept, marked **superseded**, with a dated erratum next to them. No tag, no RC, no candidate
claim is added.

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
  Stop (a human-Stop marker written **only while a review wake latch exists** for that reviewer
  session; a Stop issued with no live wake writes nothing and is not persisted — §2.2/§4.7). This
  plane is activated only by explicit opt-in (§2, §3.3); with the opt-in absent or `false`, the object handed to the control service is byte-identical to the Alpha.5 wiring and no Alpha.6 parse, member read or port exists.

The two planes are not separate products and are not shipped as separate tarballs. Alpha.6 does not
become the default by being present in the artifact.

**Composition limit, stated here because the sentence above is easy to read too far (appended
2026-11-11, F-1 / PD-42).** One bundle carries both planes, and a single Team can now declare both
families: the gate accepts a v5 blueprint carrying the `memberIoCeilings` family and reads it from
the same bound, content-hashed document. It is **not** true that the planes are disjoint modes. What
is **not** yet true is that the ceiling is *enforced* on an approved Alpha.6 execution inside that
exact composition: the approval plane's execute leg dispatches the Team tool plane, which owns
`bash` and displaces the realm's confined terminal (`read`/`write` come back
`TOOL_BINDING_UNVERIFIED` with **zero** Alpha.5 guard facts). Closing that pre-#734 shape took two product
changes — **#734** (an adopted native name is not the tool plane's to own, so the dispatch door binds the
native admission edge instead of refusing every call) and **#736** (a cold boot owns the
`parameter-permission` lane's settlement). On the merged tree the joint acceptance is **11/11, twice,
field-by-field identical** (`dev/agent-workflow/evidence/joint-acceptance/`), and the gate fix itself is
**#720, merged as `b29e10582`**. What is still **not** measured is the ceiling on an approved Alpha.6
`bash` call: the arm that passes (`J04`) proves the model-visible definition is the pinned native one and
that the body ran, not that the call was bounded by the Member's compiled ceiling — its
`realmTerminalFacts=0` is disclosed in every run. That arm is **A1**, and it stays **OPEN** pending the
dedicated real-Host bash-governance negative-control acceptance. Read this as a disclosed composition
limit, **not** as proof of the conjunction. *(Corrected 2026-11-12: the 2026-11-11 text said #720 was open
and that P0-1 was "still being fixed"; both statements were true on 2026-11-11 and are false now.)*

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

> **Appended clarification, 2026-11-11 (F-2, packaged acceptance `#713`).** The **Goals** row above is
> about a Member that owns the Goal tools; it must not be read as "one Member can do everything". A
> Member that declares the `bash` ask lane (`capabilities.permissions`) cannot also own
> `create_goal`/`get_goal`/`update_goal` on this artifact: the A2C-2 coverage gate refuses any tool
> outside the managed vocabulary, so declaring the ask lane forces `builtinToolDeny` for the 19
> unmanaged names, and the Goal tools are among them. In the packaged acceptance the Goal arm
> therefore ran on a **third Member without `capabilities`**. That split is a **v0.1.6 limitation forced by
> the coverage gate — not the target architecture**; the artifact offers no single fully-capable Member and
> this note claims none. The next-phase design proposes a host-domain Goal-authority classification instead
> (`WP-F2-GOAL-DOMAIN-AUTHORITY.md`), and it is not shipped. *(Corrected 2026-11-12: the earlier sentence
> called the split "the product allocation", which reads as a design principle rather than a limitation.)*

### 2.2 Experimental (opt-in; not on the default path)

The whole Alpha.6 plane is **opt-in experimental**. It is not covered by the Alpha.5 Preview contract
and it may refuse to boot rather than degrade silently.

| Surface | Status |
| --- | --- |
| **Approval routing** (`reviewRouting`) | Experimental. Requires a v5 blueprint and the opt-in; absent/false keeps the Alpha.5 path. |
| **Officer plane** (assigned-Officer review, transfer, escalation) | Experimental. Needs exactly one legal Officer template in the routing; zero or multiple live Officers is refused **per query** when a review is attempted (the Team itself boots — the boot only checks the template declaration). |
| **Review wake** (merge, single-flight latch, durable intent rows, Inbox delivery) | Experimental. Needs a Host live wake seam plus a native `reviewWakeInbox`; without them the Team refuses to boot. The accepted-but-unclaimed abandonment defect applies (§5). |
| **Sticky Stop** (human-Stop marker for **review wakes**; machine relays cannot clear it) | Experimental. It is armed only by the Alpha.6 opt-in and its listeners are not registered when the opt-in is absent. The marker is **latch-scoped, not session-scoped**: the durable marker is written **when a review wake latch exists** for that reviewer session (a wake was dispatched, or boot recovery adopted an intent/stopped row); a Stop issued with **no live wake** writes **no marker** and is **not persisted**, so the next review wake can activate the "stopped" reviewer. It stops the **review wake**, not every message (see §4.7). |
| **v5 blueprints** (`schemaVersion: 5`, `TeamBlueprintV5Core`) | Experimental. v5 extends v4 and one blueprint still carries the v4 I/O ceilings; v3/v4 documents remain supported and byte-identical. |
| **Member capability allocation** (F-2) | Experimental / a limit, not a promise. One Member cannot both declare the `bash` ask lane and own the Goal tools: the A2C-2 coverage gate is fatal for a tool outside the managed vocabulary on an agent that declares `capabilities.permissions`, so the ask lane forces `builtinToolDeny` over the 19 unmanaged names and `create_goal`/`update_goal` go with them. **v0.1.6 limitation, not an architecture principle**: the split across different Members is what the coverage gate forces; there is no single fully-capable Member on this artifact and none is promised. *(Clarified 2026-11-12 — see the erratum below.)* |
| **What "Officer approval" covers** (F-3) | Experimental. Officer routing applies to the `team-tool-execute` **plane** leg **and, since #733, to the `parameter-permission` leg**: that leg now carries the frozen `BoundBlueprintIdentity` (blueprintId/revision/schemaVersion/contentHash), the owner template and the verified tool coordinate, so `resolveAssignedOfficer` returns the Officer and a real `bash` ask wakes it (two runs; `dev/agent-workflow/evidence/j05j06-approval-lane-20261111/`). A field that cannot be supplied is refused by name at the route gate, never silently handed to the Leader. **Remaining gap:** the Officer's own `team_resolve_control` can still be refused by the trusted review-facts port when the operation-owner member row is not `RUNNING` (row `CREATED` for a relayed first turn, `SETTLED` for a second work unit) — that is register **PD-43**, open. "Officer approval" still never means every tool approval is Officer-decided: `hold` and `leader` are real declared outcomes. *(Corrected 2026-11-12: this row said the leg carried no Blueprint identity and the wake went to the Leader — true before #733, false now.)* |

> **Erratum, 2026-11-12 (CLOSEOUT-DOCS rebase; F-3 / PD-43).** The F-3 row above is a 2026-11-11 measurement
> and is superseded by **#733** (`49a66fea3`). The `parameter-permission` leg now carries the frozen
> `BoundBlueprintIdentity` (blueprintId/revision/schemaVersion/contentHash), the operation-owner template and
> the verified tool coordinate through the existing composition seam; `resolveAssignedOfficer` returns the
> **Officer**, a real `bash` ask wakes the Officer, and a field that cannot be supplied is refused **by name**
> at the route gate (`unroutable` / `operation-tool-identity-unavailable`), never silently handed to the
> Leader. Evidence: `dev/agent-workflow/evidence/j05j06-approval-lane-20261111/`, two agreeing real-Host runs
> (both legs decided by the same Officer member instance). **What is still open is a different defect**
> (register **PD-43**): the Officer can be routed and woken yet refused at the decision gate when the
> operation-owner member row is `CREATED` (a relayed first turn) or `SETTLED` (a second work unit) —
> `assigned-officer-facts.ts:444` requires `RUNNING`. That is not the identity carry, and it is not claimed
> fixed here. "Officer approval" still never means every tool approval is Officer-decided: `hold` and
> `leader` are declared, honoured outcomes.
>
> **Erratum, 2026-11-12 (F-2).** The F-2 row's "different Members for different capabilities" sentence is a
> **v0.1.6 limitation**, not the future architecture: the coverage gate forces the split today, and the
> next-phase `WP-F2-GOAL-DOMAIN-AUTHORITY.md` proposes replacing it with a host-domain Goal-authority class.
> The limitation itself is unchanged and still disclosed (§4.9).

> **Appended 2026-11-11 (F-1 / PD-42, the v5 row).** The v5 row's "one blueprint still carries the
> v4 I/O ceilings" sentence predates the gate fix: a v5 document may now also carry the
> `memberIoCeilings` family, and a v5 document that declares no family is refused with its own
> v5-specific message — still under the single typed code `MEMBER_POLICY_WITHOUT_BLUEPRINT`, i.e.
> three distinguishable messages, not three machine-readable codes. The gate admitting the family
> is **not** the same as the ceiling being enforced on an approved call in that composition; see
> §1 and §4.13.

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

9. **One Member cannot hold every capability (F-2, measured on the packaged artifact).** A Member that
   declares the `bash` ask lane has already accepted the A2C-2 coverage gate, which is fatal for any
   tool outside the managed vocabulary; the required `builtinToolDeny` for those names removes the
   Goal tools. So shell-asking and Goal-owning are two different Members. That split is a **v0.1.6
   limitation forced by the coverage gate — not the target architecture**; a single Member that both
   asks for shell and owns a Goal is not offered, must not be promised by these notes, and the
   next-phase `WP-F2-GOAL-DOMAIN-AUTHORITY.md` proposes replacing the forced split with a host-domain
   Goal-authority class. The measured run is
   `dev/agent-workflow/evidence/v016-packaged-acceptance/` (§6 F-2). *(Corrected 2026-11-12: the earlier
   sentence called the split "the product allocation".)*
10. **"Officer approval" is a plane-leg statement (F-3, measured).** Alpha.6 routes the
    `team-tool-execute` plane leg to the assigned Officer **and — since #733 — the
    `parameter-permission` leg too**: the leg now carries the frozen bound Blueprint identity
    (`blueprintContentHash`/`blueprintRevision`), the owner template and the verified tool coordinate, so
    `resolveAssignedOfficer` returns the Officer and a real `bash` ask wakes it (two runs,
    `dev/agent-workflow/evidence/j05j06-approval-lane-20261111/`). This is the exact coverage of the
    phrase; Alpha.6 does **not** make every tool approval Officer-handled (`hold` and `leader` are real
    declared outcomes), and a release note that says otherwise would be false. **What is still open is a
    different defect (register PD-43):** the facts port can refuse the woken Officer's decision when the
    operation-owner row is `CREATED`/`SETTLED`. *(Corrected 2026-11-12: this item said the adapter built
    the leg without an identity and the wake went to the Leader — true before #733, false now.)*
    *(Corrected 2026-11-13: the "still open … register PD-43" sentence was true when written and is
    false on this tree — **#738** (`76293c79f`, A6-LEG-VALIDITY, merged 2026-11-12, before the
    `cand-v0.1.6-3` freeze) fixed it. The subject of validity is the durable **pending approval leg**;
    the live operation-owner set is `CREATED`/`RUNNING`/`SETTLED`
    (`packages/runtime/alpha6/assigned-officer-facts.ts:341`, gate at `:495`). What remains is
    unchanged and still fail-closed: no pending leg, a decided/abandoned leg, an identity or
    generation mismatch, an unknown/absent lifecycle, `ARCHIVED` (revoked) and `DISPOSED` (terminal)
    all still produce "no facts" and the same typed refusal. Nothing else in this item changes.)*
11. **A second governed ask on the same root may be refused by the review-facts port (F-5; a defect,
    not a designed limit — see the erratum at the end of this item).** On the Stop arm the Officer's `team_resolve_control{decision:'escalate'}`
    is refused with `CONTROL_RESOLVER_NOT_AUTHORIZED … the trusted review-facts port produced no
    facts for this leg`; the **human fallback remains** and resolved that leg. The fence assertions
    are unaffected (the leg is a real governed leg). See §5 for why this is *not* the A6-26
    abandonment. **Erratum, 2026-11-12:** this is **not** an "A6 experimental limit" — it is a defect in
    the trusted review-facts port (`assigned-officer-facts.ts:444` requires the owner row `RUNNING`),
    tracked as register **PD-43** and still **open**; see §4.15 for the approved semantics. The
    limitation framing in the first sentence of this item is withdrawn, not the measurement.
    *(Corrected 2026-11-13: the erratum's last clause — "still **open**" — is false on this tree.
    **#738** (`76293c79f`, merged 2026-11-12, before the `cand-v0.1.6-3` freeze) implemented the
    approved semantics: the durable **pending approval leg** is the subject of validity, and the live
    operation-owner set is `CREATED`/`RUNNING`/`SETTLED`
    (`packages/runtime/alpha6/assigned-officer-facts.ts:341`, gate at `:495`). The measurement in the
    first sentence is kept as the historical F-5 reproduction; the fix is #738's, not this item's.
    The fail-closed answers — no pending leg, decided/abandoned leg, identity/generation mismatch,
    unknown/absent lifecycle, `ARCHIVED`, `DISPOSED` — are unchanged.)*
12. **The Stop terminal shape varies while the safety result does not (F-6).** Across runs the
    A6-12 family can end `already-decided` (no abandonment row) or with
    `control-request-abandoned` (e.g. reason `invocation-cancelled-before-consumption`). Both are
    recorded as what they are and are **not normalised** into one state. What is constant and
    asserted is the safety result: **no consumption, no execution, no side effect**, late allow
    refused.

13. **One Team can carry both families; the ceiling on an approved Alpha.6 call is not proven
    (F-1 / PD-42, appended 2026-11-11).** Alpha.5 and Alpha.6 used to be mutually exclusive
    modally: the governed realm derived Member ceilings only from a `schemaVersion: 4` blueprint,
    so a v5 blueprint that declared `memberIoCeilings` was refused
    (`MEMBER_POLICY_WITHOUT_BLUEPRINT`). The gate accepts v4 **and** v5 for that family and still
    reads it from the same bound, content-hashed document; it is **merged** (#720, `b29e10582`). The
    two planes are **not** disjoint modes. The `read`/`write` shape this item originally described —
    `TOOL_BINDING_UNVERIFIED`, 0 Alpha.5 guard facts — was a pre-#734 mount/ownership defect, repaired
    by #734, with the cold-boot settlement repaired by #736; on the merged tree the joint acceptance is
    **11/11 twice** (`dev/agent-workflow/evidence/joint-acceptance/`). So the gate is fixed and the
    composition runs, but the **conjunction is still not proven**: the approved `bash` arm (`J04`)
    asserts the pinned definition and a real execution, not that the call was bounded by the Member's
    compiled ceiling (`realmTerminalFacts=0` is disclosed in every run). That missing arm is **A1** and
    it is **OPEN**; it is not "a fix in progress" that can be assumed. The historical runs are
    `dev/agent-workflow/evidence/wp2-a6-governed-goal/` (the v5 refusal and the closest honest
    conjunction), the PD-42 lane's two fresh-HOME runs (gate admitted, ceiling arm FAIL ×4 in each) and
    the joint acceptance's three measurements. *(Corrected 2026-11-12: this item said #720 was
    unmerged, that the `read`/`write` refusal was the current shape, and that ceiling enforcement was
    "being fixed".)*
14. **An approval authorises one constrained dispatch attempt, not execution success (F-4 /
    PD-41, appended 2026-11-11).** `control-allow-consumed` means the one-shot authorisation was
    consumed — never "the body ran". With no observed completion the call must not be presented as
    `succeeded`: a cancelled/timed-out body reports `unknown`, and a Binding failure is a typed
    refusal (`TOOL_BINDING_UNVERIFIED`), refused at the dispatch door **after** the allow was
    consumed — measured as **1 consumption / 0 executions / 0 side effects**. A consumed allow is
    never auto-replayed; the operator raises a **new** request after repairing the Binding (never a
    resume of the consumed one). **Corrected 2026-11-12: the abort-class gap described in the first
    version of this item is CLOSED by #729 (`d8bdb0ce2`).** Classification now reads the backend's
    `settlement`: only `settlement.kind === 'completed'` is `succeeded`; every other settlement is
    `unknown`, and an abort-shaped throw (`AbortError` / `code:'ABORT_ERR'`, e.g. a host deadline or a
    forwarded inherited signal) is `unknown` too. The earlier sentence — "`succeeded` only on observed
    completion is the intended rule, not a total guarantee" — was true on 2026-11-11 and is no longer
    the state of the code; the rule is now the implementation, with a live `hook`-cause falsifier in
    `dev/agent-workflow/evidence/pd41-abort-class/`.
15. **F-5 is a defect in the facts port, not a policy limit (re-measured 2026-11-11; open as PD-43).** The declared
    `whenOfficerUnavailable` policy **is** honoured on a second ask: `hold` holds (no Officer wake,
    no Leader notification, no escalation — the only decision is an explicit human resolve) and
    `leader` hands both legs to the Leader, each arm 2/2 runs agreeing. The live-Officer second ask
    fails one gate earlier: the trusted review-facts port refuses at
    `packages/runtime/alpha6/assigned-officer-facts.ts:444` because the operation owner's lifecycle
    is `SETTLED` for the second work unit, so the Officer's escalation is refused with
    `CONTROL_RESOLVER_NOT_AUTHORIZED`. That is a **defect in the facts port**, not a violation of
    the declared policy, and it is **not fixed** (register **PD-43**). F-3's identity-carry defect is
    **fixed by #733** (`49a66fea3`): the parameter-permission leg carries the bound Blueprint identity
    and the assigned Officer receives the ask — see §4.10. **The approved semantics for the
    F-5/PD-43 fix, not yet implemented:** the subject of validity is the durable **pending approval
    leg**, with **all identity, generation and frozen-identity checks preserved**, and the answer stays
    **fail-closed** for archived, mismatched or unbound owners — the owner instance's `CREATED`/
    `SETTLED` phase alone must not manufacture "no facts" for a genuinely pending leg. Two
    reproductions are named in the register: the joint `JOINT_J10_RELAY=1` diagnostic (row `CREATED`)
    and the F-5 two-ask lane, PR #723 (row `SETTLED` on the second work unit).

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

**Correction, 2026-11-12 — the promise sentence, and what the accepted-not-claimed window actually
does on this tree (PD-39 Gap 2 re-measurement, tree `84baf304c`).**

- **The sentence "every accepted review wake is delivered or decidable" is FALSE today.** It was
  never a promise of `0.1.6`, and it is not one after this correction. The true promise of this
  artifact is: **every accepted review wake is delivered, decidable, or terminally abandoned with a
  typed `control-request-abandoned` fact naming the request and an operator-visible re-issue path.**
  "Abandoned" is a third, terminal outcome — not a fourth kind of delivery, and not a silent loss:
  the row names the request and the runbook below is the re-issue path.
- **The accepted-but-unclaimed window measured on this tree ends DECIDABLE, not abandoned.** Two
  fresh-`DSH_HOME` real-Host runs of the exact window (same construction, field-by-field comparison)
  show: wake intent rows `1 → 0 → 0`, **0** claimed wake turns after restart, the
  `control-request-recorded` row still present with **no** decision and **no** abandonment,
  `pendingControlCount: 1`, the request readable by id on the ledger page, and a
  `team.resolveControl` allow from the boot-root operator principal accepted (`status: 200`, a
  `control-decision-recorded allow`; zero consumption, zero execution, no duplicate). That is the
  audit's acceptable outcome (ii) — stranded but discoverable and resolvable. Evidence:
  `dev/agent-workflow/evidence/pd39-inbox-window-20261112/` (`run-1/`, `run-2/`,
  `compare-two-runs.mjs`).
- **The terminal abandonment is real, but on a different trigger.** A decision (`allow`) recorded
  before the crash with the invocation dead before consumption is closed by boot settlement on the
  restart: `control-request-abandoned`, reason `invocation-abandoned`, zero consumption, zero
  execution, no revival (measured once: `run-3-crash-after-allow/`: `sequence 11 allow` → kill →
  `sequence 14 abandonment`). The 0.1.6 abandonment in `a6-gaps-g2-unclaimed-r11` was a *resolve-time*
  classifier outcome on a `parameter-permission` row carrying `reviewPayloadDigest ===
  operationFingerprint` (`PA_MANIFEST_CORRUPT`); that row shape is absent on this tree, so the window
  no longer takes that path. See the corrected
  [RUNBOOK-CONTROL-ABANDONED.md](./RUNBOOK-CONTROL-ABANDONED.md) and the new
  [REVIEW-WAKE-ACCEPTED-NOT-CLAIMED.md](../../../runbooks/REVIEW-WAKE-ACCEPTED-NOT-CLAIMED.md).
- **P2, the count, is not wrong — it is narrower than the sentence above.** `pendingControlCount`
  (and `team_list_pending_control`) counts **live-undecided** requests only. An abandoned request is
  terminal and deliberately excluded; it remains readable by id on the ledger page. The
  operator-facing tool description now says exactly that (abandoned → terminal, not listed, find it
  by id, re-issue). A count of `0` therefore never means "nothing happened".

**Appended 2026-11-11 — two refusals that are NOT A6-26 (F-5, F-6).** Keep these apart from the
abandonment above, because both are correct, discoverable product answers rather than the
accepted-but-unclaimed crash window:

- **F-5** — a **second** governed ask on the same root may have its Officer escalation refused by the
  review-facts port: `CONTROL_RESOLVER_NOT_AUTHORIZED … the trusted review-facts port produced no
  facts for this leg`. That is a typed refusal of a resolver, not an abandonment; the leg is a real
  governed leg and the **human fallback remains** (the human resolved it in the packaged acceptance).
  Listed as a **defect** in §4.11 and §4.15 (register **PD-43**), not as a designed policy limit.
- **F-6** — the **Stop** terminal shape varies (`already-decided` vs an abandonment row such as
  `invocation-cancelled-before-consumption`) across runs. This is the A6-12 Stop family, not the
  A6-26 unclaimed-wake window: in both shapes the safety result is constant — no consumption, no
  execution, no side effect, late allow refused. The notes state both shapes instead of normalising
  them; see §4.12.

**F-5 re-measured (appended 2026-11-11).** The §4.15 measurement keeps F-5 apart from A6-26 and
narrows the shape: the declared policy branches are honoured on a second ask; the refusal on the
live-Officer second ask comes from the facts port's `owner.lifecycle !== 'RUNNING'` gate
(`packages/runtime/alpha6/assigned-officer-facts.ts:444`, owner `SETTLED` on the second work unit)
and is a **defect to fix**, not a documented limit — tracked as register **PD-43** and still **open**
(the approved semantics are stated in §4.15; this build does not contain the fix). The two-policy matrix
and the gate trace are in `dev/agent-workflow/evidence/f5-two-asks/` (the F-5 lane,
`task/f5-two-asks-20261111`, PR #723; not merged on this notes' baseline).

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
- They do not promise that an accepted review wake is always delivered or decidable (**false as
  stated**; corrected 2026-11-12): the true promise is delivered, decidable, **or terminally
  abandoned with a typed fact and an operator-visible re-issue path**. See A6-26 in §5 and the
  correction there.

**Appended 2026-11-11 — what these notes do not claim, stated explicitly (F-1/F-4/PD-42/PD-41).**

- They do not claim that the Alpha.6 approval plane runs inside the Alpha.5 governed realm today:
  the ceiling enforcement on an approved Alpha.6 execution has **not been measured** (A1 open; `J04`
  does not assert it), as stated in §1 and §4.13. **The conjunction in one Team is not proven.**
- They do not claim that Leader or Root sessions are inside the Alpha.5 governed realm. In this
  release the realm is **Member-scoped**; an Agent Execution Realm covering Root/Leader and Officer
  is next-phase design work (`WP-AGENT-EXECUTION-REALM.md`), not a property of this artifact.
- They do not claim OS-level network isolation. The network axis remains one admission-layer
  boolean (§4.1), not a netns or a per-host ACL.
- They do not claim that one Member can hold both a `bash` ask lane and the full Goal trio (F-2 /
  §4.9), and they do not claim a single fully-capable Member.
- They do not claim a machine-readable error code on the Host UI or on the RPC surface, and they do
  not claim that every dispatch refusal is typed today (see §10).
- They do not claim that the Preview is a security boundary against a malicious agent (§4.6).

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
- The two-plane composition limit and the closest honest conjunction (F-1 / PD-42):
  `dev/agent-workflow/evidence/wp2-a6-governed-goal/`
- PD-41 dispatch semantics and the typed-refusal scope:
  `dev/agent-workflow/evidence/pd41-allow-semantics/`
- F-5 two-ask policy matrix and the facts-port defect:
  `dev/agent-workflow/evidence/f5-two-asks/` (the F-5 lane; not yet merged on this notes'
  baseline)
- The closeout order that turns these disclosures into a release decision:
  `docs/plans/active/alpha5-sandbox-first/V016-PREVIEW-CLOSEOUT-PLAN.md`

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

---

## 9. 2026-11-11 — PD-41: what a human `allow` authorises (owner ruling, append-only)

The owner ruled on 2026-11-11 that the durable consumption order is **kept** and its semantics are
adopted formally. This section is appended; it deletes no earlier sentence.

**Semantics (adopted).** A human `allow` authorises **one constrained dispatch attempt**, not a
guarantee of execution. Corollaries, each of which this build must satisfy:

1. `control-allow-consumed` means **"the one-shot authorisation was consumed"** — never "execution
   succeeded". A consumption fact exists whether or not a body ever started.
2. A **Tool Binding failure returns an explicit typed refusal** (`TOOL_BINDING_UNVERIFIED`, with the
   measured reason and the governed name), distinguishable from "never governed"
   (`TEAM_TOOL_UNGOVERNED`) and "dispatcher not ACTIVE" (`ADAPTER_DRAINING`). The refusal sentence
   worlds already met is byte-identical; the typing is additive.
3. With **no observed execution completion** the product must not present the call as `succeeded`.
   A cancelled or timed-out body reports `unknown` (the ledger's existing value for "admitted, end
   never observed"); `succeeded` is reserved for a body whose end was observed. This fixed a real
   mis-report: the confined shell logged `cancelled=true exit=not-observed` with no side effect while
   the execution fact said `succeeded` (measured 29/29 in
   `dev/agent-workflow/evidence/wp3-fence-timing/`, decisive run `run-residual-s373`).
4. A consumed allow is **never auto-replayed**. There is no retry, no redelivery of a consumed
   authorisation.
5. After inspecting the **absence of side effects** and repairing the Binding, the operator may raise
   a **new** approval request. That is a new request id, not a resume of the consumed one.

**What the binding-failure path looks like (measured).** When a governed call's Tool Binding cannot
be verified, the human `allow` is consumed first and the dispatch is then refused at the dispatch
door: **1 consumption, 0 execution results, 0 side effects**. The exact refusal is
`team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the
native body)` (+ the positional suffix `[refused at the dispatch door, the stage nearest the Body]`
for the door form). The packaged acceptance measured the consumption/execution pair and the worktree
bundle measured the refusal; the PD-41 evidence record restates both on this tree
(`dev/agent-workflow/evidence/pd41-allow-semantics/README.md`).

**The pre-approval preflight (authorised "only if small").** It is **deferred**, not shipped: refusing
an already-unverified tool *before* the approval request exists requires the approval-request creator
(the pre-execute adapter's parameter-permission leg) to consult the closed-world dispatcher surface —
a different component from the one that owns the Binding facts, with no seam between them today.
Reaching it would be a cross-component resolver, which the ruling forbids; details and the one-line
reason are in the PD-41 evidence record §4. The final dispatch-time verification is unchanged and no
no-replay rule moved.

**Unexperimental surfaces are not upgraded by this section.** The F-2/F-3 allocation and Officer
coverage statements (§2.1 clarification, §2.2 rows, §4.9/§4.10) and the F-5/F-6 experimental limits
(§4.11/§4.12, §5) are disclosures of what the packaged artifact actually does; they change no
`V@B` cell, no matrix grade, and no claim that Alpha.6 is stable.

---

## 10. 2026-11-11 — what the typed refusal is, and is not (F-4 / PD-41 scope; append-only)

This section is appended. It deletes or rewords nothing in §9; where §9 reads broader than the code,
the narrower statement here is the one to quote.

**Where the type is observable.** A Tool Binding failure raises a typed
`ToolDispatchRefusalError` (`TOOL_BINDING_UNVERIFIED`, with the measured reason and the governed
name) **inside the Team process**, and it is distinguishable there from `TEAM_TOOL_UNGOVERNED` and
`ADAPTER_DRAINING`. The Host's `tools.guard` seam keeps its public shape
`(exec) => string | undefined`, and the Host's tool-error conversion carries only `message` for a
throw that is not a `HarnessError`. So the Host UI, the Host RPC result and the model still receive
the **byte-identical prose**, not a machine-readable code. The code appears in the plugin's own
`guard-denial` observation line as text (`… code=TOOL_BINDING_UNVERIFIED`). **Do not read this
release as "the Host UI exposes `TOOL_BINDING_UNVERIFIED`"** — no Host UI field, ledger row or RPC
payload carries it today.

**The §9 sentences on cancellation were narrower than they read on 2026-11-11 — and #729 has since
closed the gap.** On this tree the classifier reads the backend's **settlement**, not the rendered
`cancelled`/`timedOut` flags: `settlement.kind === 'completed'` is the only `succeeded`, every other
settlement is `unknown`, and an abort-shaped throw (`AbortError` / `code:'ABORT_ERR'`) is `unknown` too
(`packages/tools/a5p5-tools/src/pipeline.ts`). The counter-example this section used to disclose — an
abort whose reason is not `user`/`parent` being recorded `succeeded` — no longer exists; it is kept as
the measured pre-fix falsifier and re-tested live with a `hook` cause
(`dev/agent-workflow/evidence/pd41-abort-class/`). *(Corrected 2026-11-12: this paragraph previously
said the abort-class fix was "scheduled" and that the absolute was "a target".)*

**"Every dispatch refusal is typed" is still not true, by exactly one.** Typed refusals cover **Guard
denials**, the not-ACTIVE class, and — since **#729** — three of the four dispatch-door arms that used to
throw a bare `Error`: unreadable definition, kernel approval table no longer backing the definition, and
re-entry under one call id against two definitions. **One** refusal deliberately remains prose: the host
execution object cannot hold a cancellable signal, and no §5 code truthfully names it
(`packages/runtime/tool-dispatch/install.ts`). This release does not claim that one. *(Corrected
2026-11-12: this paragraph previously said four refusals were untyped; #729 typed three of them.)*

**No production recovery path reads the typed predicate.** `isToolBindingRefusal()` /
`dispatchRefusalOf()` are called by tests today, not by a daemon, an RPC response or a UI
projection. The operator recovery remains the one in §9 item 5: inspect for side effects, repair
the Binding, raise a **new** request.

**Scope correction.** The refusal is a product answer, but it is an answer *inside the Team
process*. Nothing here upgrades the experimental Alpha.6 plane, and nothing here moves a `V@B`
cell or a matrix grade.

---

## 11. Appended 2026-11-13 — the v0.1.6-rc.1 package split, line by line

This section exists because a reader of §2 still could not tell, **line by line**, which sentence is a
stable promise, which is an opt-in experiment, and what kind of evidence stands behind each. It adds no
tag, no RC and no candidate claim. Where a row below disagrees with an older sentence, the older sentence
is **narrowed**, not deleted; the dated corrections elsewhere in this file stay in force.

### 11.0 Evidence classes used below

| class | what it is | what it can never be |
| --- | --- | --- |
| **`CANDIDATE-C2`** | a frozen-candidate record produced by an independent adjudicator against **one immutable SHA**, verified against that SHA's manifest | a claim about another SHA; a `V@B`; a stability rate |
| **`DEV-LIVE`** | a real-Host development run (fresh `DSH_HOME`, sanctioned ports, pinned host `0.2.0-rc.2 @ 639ed01539`) | `CANDIDATE-C2`; a `V@B`; a matrix grade |
| **`HOST-FREE`** | a unit/gate test that pins a sentence or a seam without booting a Host | live behaviour |
| **`CODE/DOC`** | a static statement about the tree (a line of code, a runbook, a register row) | a measurement |

**Rule for this section:** a line without a repository path is not a claim these notes make. The path is
part of the sentence.

### 11.1 STABLE (Alpha.5) — what a reader may rely on

| # | status | surface | exact claim | evidence class | evidence that settles it |
| --- | --- | --- | --- | --- | --- |
| **S1** | **STABLE** | **A1 governance — seven clauses** | On the real Host and from the durable ledger: (1) a write **inside** the Member root succeeds (bytes read back, exit 0); (2) a write **outside** the Member ceiling is refused by the OS sandbox with `Read-only file system`, **0 bytes** and `ENOENT` on a real read after the refusal; (3) `cd` + `export` **persist** across consecutive calls; (4) a **second Member is isolated** (own `$PWD`, empty export, different shell start-time, Host PTY fd count grows); (5) a **wrong or prefixed session id is refused before a PTY exists** (3 typed refusals, PTY fds and model turns unchanged); (6) the Host's `danger-full-access` default is **narrowed by the Member ceiling** (root write lands, identical Member write stays absent); (7) a **denied approval ⇒ 0 executions** (`decision: deny`, 0 `control-execution-result`, 0 `control-allow-consumed`, target absent). **7/7 ×4** across two trees. | `DEV-LIVE` (real Host, OS backend `full`) | `tests/kits/a1-bash-governance-20261112/README.md`; `dev/agent-workflow/evidence/a1-bash-governance/README.md`; `dev/agent-workflow/evidence/a1-bash-governance/a1-agreement.json`; `dev/agent-workflow/evidence/a1-bash-governance/a1-agreement-current-tip.json` |
| **S2** | **STABLE** | **A6-off zero regression on the plane-takeover composition** | With `alpha6ReviewRouting` **explicitly `false`** on the plane-takeover composition (v5 blueprint carrying `memberIoCeilings` + `reviewRouting`, shipped governed preset, pinned native `bash` over the governed PTY, Host default `danger-full-access`), the **same seven clauses reproduce 7/7 twice**, and agree field-by-field with a **same-tree A6-on control** (also 7/7). Flipping only the flag leaves every clause verdict and every normalized measured detail unchanged. This is the zero-regression evidence **C2 on `cand-v0.1.6-3` refused to sign**; it is `DEV-LIVE`, not `CANDIDATE-C2`, and it covers the **`bash` face only** (restated as C2-B R1 on `cand-v0.1.6-4`). | `DEV-LIVE` (3 runs: A6-off ×2 + A6-on control; one retained instrument-race failure kept on disk) | `dev/agent-workflow/evidence/a6off-plane-takeover-20261113/README.md`; `…/a6off-agreement.json`; `…/a6on-vs-a6off-agreement.json`; `…/a6off-run2-turn-race/`; the fresh C2-B re-measurement on `cand-v0.1.6-4` (path and sha256 in `dev/agent-workflow/evidence/v016-rc1-release-package/c2-presence.txt`) |
| **S3** | **STABLE (scope clarity, not a capability)** | **The Alpha.5-only composition cannot run a governed `bash`** | On the composition with **no plane takeover**, the native `bash` is **typed-shut by design**: every governed `bash` answers `A5_NATIVE_ADMISSION_UNAVAILABLE`. pd33's `bash` arm scores it **16 PROVEN / 3 REFUTED**, and that `FAIL` is preserved as the honest verdict. The arm **predates #730** and is a **superseded instrument**, not a regression: it is pinned as superseded by `#744`, and its successor measurements are S2 and the A1 kit above. | `DEV-LIVE` (the 16/19 run) + `HOST-FREE` (the superseded-instrument pin) | `dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/README.md`; `tests/world-factory/a5sf-pd33-preview-e2e.test.mjs`; commit `45132a119` (`#744`); `dev/agent-workflow/evidence/a6off-plane-takeover-20261113/README.md` |
| **S4** | **STABLE (a configuration prerequisite, not a capability)** | **Governed `bash` needs the plane-takeover composition mounted** | Since **#730** (`d8490f74d`, NATIVE-BASH-PRESERVATION) the model-visible `bash` **is** the host's pinned `@deepseek-ai/dsh-tool-bash-persistent` definition over the Member's governed PTY, and its `execute` is wrapped by the Team admission middleware (`packages/runtime/src/plugin/live/native-bash-tool.mjs:97-102`): the wrapper looks up the plane's published admission edge at call time and **refuses with `A5_NATIVE_ADMISSION_UNAVAILABLE` when none is published**. That edge is published **only inside the `teamToolPlane` mount block** (`packages/runtime/src/plugin/live/agent-bindings.mjs:3135` gate, `:3390` publication). Therefore **governed `bash` in the Alpha.5 Preview works only on the plane-takeover composition**: a composition that mounts the governed realm **without** `teamToolPlane` answers `A5_NATIVE_ADMISSION_UNAVAILABLE` on **every** governed `bash` call, opens **no** approval request and executes **nothing**. This is a **formal configuration prerequisite of this Preview**, stated as a product fact — **not** "an old test expired" and not a regression introduced by a downstream lane. | `CODE` (the two files above, on this tree) + `DEV-LIVE` (typed-shut measured twice: pd33 16/19 ×2 with 3 stably REFUTED; the plane-takeover composition reproduces the A1 seven clauses 7/7 ×2) | `packages/runtime/src/plugin/live/native-bash-tool.mjs`; `packages/runtime/src/plugin/live/agent-bindings.mjs`; `dev/agent-workflow/evidence/native-bash-preservation/README.md` (P6c: no published edge ⇒ typed refusal, 0 execution); `dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/README.md` (2026-11-13 section); commit `45132a119` (`#744`, the arm is SUPERSEDED, not a regression); `dev/agent-workflow/evidence/a6off-plane-takeover-20261113/README.md`; `docs/INSTALL.md` §3.6 |

**How S1 and S2 relate to the frozen candidate.** S2's measured product tree is
`1a677c5d4…`; `git diff 1a677c5d4 0d31f9121 -- packages scripts` is **empty**, so the runtime shipped
in `cand-v0.1.6-4` is the tree S2 measured. C2-B then re-ran the A6-off A1 arm **on the candidate SHA**
and signed the same result (7/7 twice, identical blueprint document, legacy Leader deciders 11/11, no
Officer wake). Two cautions, both adjudicator-recorded: the #745 **committed composition JSONs** are
stale/misdescribed (null blueprint digest, a schema the frozen kit no longer emits, and the README's
"every request `reviewAuthority: leader`" is false for the five `team-tool-execute` plane legs), so the
claim is supported by the **fresh measurement**, not by those composition files — do not quote their
digests; and "zero regression" remains restricted to the **seven A1 clauses on one composition**, not
to Alpha.5 behaviour in general (C2-B R1, and NC7 below). Both C2 records for `cand-v0.1.6-4` exist and
verify; **both withhold candidate-level eligibility** (`candidateClaimEligibility.eligible: false`;
C2-B's verdict is `NOT PASS`).

**The operator consequence, stated plainly (this is the part an upgrading operator needs).** If your
composition was written **before #730** — the governed realm mounted, `teamToolPlane` **absent** — then
after upgrading to this artifact your governed `bash` is **typed-shut**: every call answers
`A5_NATIVE_ADMISSION_UNAVAILABLE`, nothing executes, and no approval request is created. It stays that
way **until you mount the takeover** (`config.teamToolPlane` with its `realmId` / `fsInstance` /
`confinedProvider` trust pair, plus a `bash` ask lane in the blueprint's `capabilities.permissions`) —
see `docs/INSTALL.md` §3.6, which also records the dated correction to §3.5's older
`BINDING_UNVERIFIED` sentence. The other governed faces (`read`, `write`, `edit`, `grep`, `glob`,
`web_fetch`, `web_search`, `skill`, `present`) are **not** gated on the plane takeover: the post-#730
re-measurement of the no-plane composition proves 16 of its 19 cases, and exactly the three shell
clauses are REFUTED.

**What this row does not claim.** It does not claim that a plane-takeover composition makes every
governed tool work (it does not: `grep`/`glob` and the read-only minimal recipe are §3.5's business), it
does not turn pd33's `FAIL` into a PASS, and it does not move a `V@B` cell, a matrix grade or a
`CANDIDATE-C2` claim. The three REFUTED shell clauses stay the honest verdict of that instrument; they
are **superseded** by `#744`, not retracted.

### 11.2 OPT-IN EXPERIMENTAL (Alpha.6) — default OFF

**Default-off proof, not a promise.** The opt-in is the boolean `config.alpha6ReviewRouting === true`
(`packages/runtime/src/plugin/root.ts:2509`). With it absent or `false`, the Alpha.6 composition thunk is
not invoked at all, and no Alpha.6 parse, member read or port exists. Everything in this table is
**experimental**: it is not covered by the Alpha.5 Preview contract, it may refuse to boot rather than
degrade, and it must not be read as stable because it is present in the artifact.

| # | status | surface | exact claim | evidence class | evidence that settles it |
| --- | --- | --- | --- | --- | --- |
| **E1** | **OPT-IN EXPERIMENTAL** | **Officer review routing — allow / deny / exception / Stop / crash** | Each outcome is measured twice on a real Host and evidenced by **durable ledger rows**, not by a driver boolean: **allow** consumes the one-shot authorisation exactly once and records the execution; **deny** leaves **zero consumption and zero execution-result** rows; **throw** records `outcome=failed` and never `succeeded`; a declared **exception** is honoured as declared; **Stop** cancels after the allow with **no consumption and an empty target**, and a late allow is refused; **crash** leaves the approval request readable, the late allow refused as `CONTROL_REQUEST_ABANDONED`, and both legs settled `unknown`. | `CANDIDATE-C2` — **valid only for `cand-v0.1.6-3` @ `17a24e2c3…`** | `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md`; `dev/agent-workflow/evidence/candidate-v0.1.6-3/C2-A.json`; `dev/agent-workflow/evidence/candidate-v0.1.6-3/C2-B.json`; `…/a6-allowdeny-agreement.json`; `…/a6-exception-agreement.json`; `…/a6-stop-agreement.json`; `…/a6-crash-agreement.json` |
| **E2** | **OPT-IN EXPERIMENTAL — disclosed limit, NOT fixed** | **PD-40: the human Stop marker is latch-scoped** | A human Stop writes its durable marker **only when a wake coordinator already exists** for that reviewer session. A Stop **between asks**, or **after a restart before the next ask**, writes **no durable marker** and the next review wake can activate a "stopped" reviewer. **Reproduced twice by an independent adjudicator**, and reproduced again on `cand-v0.1.6-4` by C2-B (arm B 4/4, no marker and the next wake activates; control arm A 6/6, durable marker survives SIGKILL). **Not fixed in this candidate**; making the marker session-scoped is a design change with crash semantics, tracked as **PD-40**. | `DEV-LIVE` (M11 + WP1 arms) and `CANDIDATE-C2` (C2-B reproduction, cand-3 only) | `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` (PD-40 row); `dev/agent-workflow/evidence/v016-fix/README.md` §2; `dev/agent-workflow/evidence/wp1-sticky-stop/`; `dev/agent-workflow/evidence/candidate-v0.1.6-3/C2-B.json`; `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md`; C2-B for `cand-v0.1.6-4` (path and sha256 in `dev/agent-workflow/evidence/v016-rc1-release-package/c2-presence.txt`) |
| **E3** | **OPT-IN EXPERIMENTAL** | **PD-39 Gap 2: accepted-but-not-claimed wake** | An accepted-but-not-claimed wake **no longer strands** on the current tree: after restart the request stays **pending**, is counted (`pendingControlCount: 1`), remains readable by id, and an operator `team.resolveControl` allow is accepted — zero consumption, zero execution, no duplicate. A **decided** invocation that dies **before consumption** is still **terminally abandoned at boot** with the typed fact `CONTROL_REQUEST_ABANDONED` (reason `invocation-abandoned`), with no revival; **recovery is re-issue**, never resolve, and there is **no automatic redelivery**. The promise is therefore *delivered, decidable, or terminally abandoned with a typed fact and an operator-visible re-issue path* — never "every accepted wake is delivered or decidable". | `DEV-LIVE` (2 agreeing runs of the window + 1 run of the terminal trigger) | `dev/agent-workflow/evidence/pd39-inbox-window-20261112/README.md`; `…/run-1/`; `…/run-2/`; `…/run-3-crash-after-allow/`; `…/two-run-agreement.txt`; `docs/runbooks/REVIEW-WAKE-ACCEPTED-NOT-CLAIMED.md`; `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` (PD-39 row) |

### 11.3 The boundary, stated once

A surface is **STABLE** only if it is in §11.1. Everything in §11.2 — and anything reached only after
`alpha6ReviewRouting: true` — is **OPT-IN EXPERIMENTAL**, including surfaces §2.2 labels experimental
(Officer plane, review wake, Sticky Stop, v5 blueprints, the F-2 allocation limit, the F-3 coverage of
"Officer approval"). Presence in the tarball is not promotion. No row in §11.1 is a `V@B`, a matrix grade
or a `CANDIDATE-C2` claim except where the row says so.

### 11.4 What these notes MUST NOT be read to claim

These are not omissions; they are **refusals recorded by the adjudicators**. A release built on these
notes may not imply any of them.

| # | must not be claimed | why | where the refusal is recorded |
| --- | --- | --- | --- |
| **NC1** | **Rates, reliability or stability beyond "two agreeing worlds"** | `n=2` is two existences that agree, not a probability. | `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md` ("What neither adjudication proves"); `…/C2-B.json` `refusedClaims` |
| **NC2** | **Real vendor-model behaviour** | The model is the **deterministic in-tree mock**; everything else (Host, OS sandbox, ledger, tarball) is real. | `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md`; `tests/kits/a1-bash-governance-20261112/README.md` |
| **NC3** | **OS-level network isolation** | The network axis is **one admission-layer boolean**, not an OS or per-host policy. Every A1 run records `osLevelNetworkIsolationClaimed: false`. | `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md`; `tests/kits/a1-bash-governance-20261112/README.md`; §4.1 above |
| **NC4** | **Any upgrade protocol** | None exists: no version negotiation, no data migration, no compatibility contract. Rollback is **re-installing the previous tarball** (byte-exact swap measured); the `0.1.5 → 0.1.6` path was **never measured**. | `dev/agent-workflow/evidence/packaging-v016-20261112/README.md` §7; `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md` |
| **NC5** | **PD-42's approved-`bash`-out-of-lane conjunction** | The v5 gate is fixed and the joint composition runs, but **the ceiling on an approved Alpha.6 `bash` call is unmeasured** (`J04`'s `realmTerminalFacts=0` in every run). The A1 record measures governance, not that conjunction. | `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` (PD-42 row); `dev/agent-workflow/evidence/joint-acceptance/README.md`; `dev/agent-workflow/evidence/candidate-v0.1.6-3/C2-B.json` `refusedClaims`; §4.13 above |
| **NC6** | **The operator re-issue path as a measured path** | Only **resolve-by-id** was measured for the accepted-but-not-claimed window. The runbook states the procedure; the procedure itself was not exercised in the record. | `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md` (C2-B non-claims); `docs/runbooks/REVIEW-WAKE-ACCEPTED-NOT-CLAIMED.md` |
| **NC7** | **`Goal ∧ plane-takeover ∧ A6-off`** | The A1 kit has no Goal arm and drives no goal rounds; the nearest A6-off goal evidence does not mount the plane takeover. This three-way conjunction is **unmeasured**. | `dev/agent-workflow/evidence/a6off-plane-takeover-20261113/README.md` ("A5 Goal path with A6 off — NOT MEASURED by this kit") |

### 11.5 Candidate binding of every `CANDIDATE-C2` line above

C2 records are **bound to one SHA**. The two records cited in §11.2 (E1, E2) were produced for
**`cand-v0.1.6-3` @ `17a24e2c302cd991c3ba495ae29576b58a6c1069`** against
`dev/engineering/candidates/cand-v0.1.6-3.json`, and they are valid **for that candidate only**. They do
**not** transfer to `cand-v0.1.6-4` (`0d31f9121…`) or to any later commit, and no sentence here should be
read as transferring them.

The release package is assembled against `cand-v0.1.6-4`; its frozen identity, manifest digest,
`verify-candidate` output and the current state of its C2 pair are recorded in
[`V016-RC1-GO-NO-GO.md`](./V016-RC1-GO-NO-GO.md) and in
`dev/agent-workflow/evidence/v016-rc1-release-package/`. Whether that candidate may be released is the
owner's decision on that document, not a claim of these notes.

### 11.6 Dated correction (2026-11-13) — PD-43 is fixed on this tree; four older sentences are superseded

This is an **append-only correction**, not a rewrite. Four statements earlier in this file still say
PD-43 is open or unfixed, and on this tree that is **false**:

- the §4.10 table row that says "that is register PD-43, open";
- the §4.10 F-3 erratum that says `assigned-officer-facts.ts:444` requires `RUNNING` and that the fix is
  "not claimed fixed here";
- §4.15 item 15 ("open as PD-43" / "not fixed" / "not yet implemented");
- the F-5 re-measured block that says the gate at line 444 is "still open".

**What is true today.** PD-43 is **FIXED by #738** (`76293c79f`): the durable **pending approval leg**
is the subject of validity, the live owner lifecycles are `CREATED` / `RUNNING` / `SETTLED`, and
archived/disposed/unknown owners, decided/abandoned legs and identity/generation/revision/ordinal
mismatches still refuse fail-closed. The gate now lives at
`packages/runtime/alpha6/assigned-officer-facts.ts:341` / `:495` with the typed downstream sentence at
`packages/runtime/control/service.ts:3059`; **line 444 no longer contains that gate**. The register row
carries the same dated correction and its anchors resolve; C2-B independently re-tested it (48/48
shipped tests + 18/18 adversarial probe, including two positive controls) and recorded the notes' stale
sentences as finding **A10**. The four statements above are kept as history and are **superseded by this
paragraph**; they are not to be quoted as the current state.
---

## Appended 2026-11-13 — PD-40 wording correction: Stop says what the code does (owner ruling; append-only record)

**The ruling.** PD-40 (the Alpha.6 Sticky Stop marker is latch-scoped, not session-scoped) stays an
**accepted opt-in-experimental limit for the v0.1.6 Preview** — but only if the user-visible text does
not promise more than the code delivers. A session-scoped durable marker is **deferred** (it is a
design change with crash semantics); **no unconditional-stop claim is permitted** in these notes, in
the UI copy or in the docs. No behaviour was changed to produce this section: the only product change
in this pass is wording, and none of it moves a `V@B` cell, a matrix grade or a `C2` claim.

**What the mechanism is, stated once, plainly.** `alpha6WakeUserStop()` writes the durable
`stopped-*` marker **inside** the wake-coordinator branch. A coordinator exists only when a review
wake latch exists for that reviewer session — a wake was dispatched, or boot recovery adopted an
intent/stopped row. A Stop issued with **no live wake** finds no coordinator, writes **nothing**, and
returns `false`. That Stop is **not persisted**, and the next review wake can activate the
"stopped" reviewer. This is the measured limit (independent review M11, re-measured by C2-A/C2-B on
`cand-v0.1.6-4`), not a possibility to hedge.

**Two sentences were therefore corrected (quoted before/after; nothing was deleted from history).**

1. §1 "What ships", the Alpha.6 bullet — **before:** *"Sticky Stop (a durable human-Stop marker that
   machine relays cannot clear)"* — an unconditional durability claim. **After:** *"Stop (a human-Stop
   marker written **only while a review wake latch exists** for that reviewer session; a Stop issued
   with no live wake writes nothing and is not persisted — §2.2/§4.7)"*. The "machine relays cannot
   clear it" property is still true and is kept in §2.2.
2. §2.2, the **Sticky Stop** row — **before:** *"a Stop issued between asks (or after a restart before
   the next ask) may not survive to the next wake"* — a softener that reads as "sometimes". **After:**
   *"the durable marker is written **when a review wake latch exists** for that reviewer session …; a
   Stop issued with **no live wake** writes **no marker** and is **not persisted**, so the next review
   wake can activate the 'stopped' reviewer"* — the mechanism, with the `latch-scoped, not
   session-scoped` phrase retained verbatim (it is the anchored line PD-40 cites).

**What was checked and deliberately not changed.**

- §4.7 (2026-11-09, the PD-40 disclosure) **already** states the mechanism exactly (coordinator absent
  ⇒ no marker, returns `false`, next wake can activate the stopped reviewer). It needed no edit, and it
  is the source of the wording used above.
- The **Web UI** (`packages/client/src/ui/locales.ts`, `member.stop.label` / `.hint` / `.stopped` /
  `.contradicted` / `.unverified` / `.noGoal` / `.already` / `.unavailable`, EN and ZH; rendered from
  `packages/client/src/ui/TeamMembers.tsx`) describes the **per-Member goal Stop only**: *"Pauses THIS
  Member's goal and aborts its current turn (resumable later). Once the pause is acknowledged no new
  round starts…"*. It claims a durable `pause` + turn abort, which is what it does; it makes **no**
  session-wide or review-wake durability promise, so correcting it would be a product-copy change, not
  a wording fix. **Not changed.**
- **No CLI Stop command exists in this repository** (the plugin registers no command; the Stop control
  is the Web UI path issuing `goals/get → goals/pause → session/cancel → goals/get`). There is
  therefore no command help to correct.
- `docs/PREVIEW-STOP-SEMANTICS.md` documents the same per-Member Stop and carries an appended dated
  scope note pointing at this section and PD-40; its own text is unchanged.
- `docs/PRODUCT-DEBT-REGISTER.md` PD-40 carries the dated owner-ruling note (accepted experimental
  limit, full session-scoped durable marker deferred, no unconditional-stop claim permitted).

**Consistency with #747 (this paragraph was added during the rebase).** §11.2 **E2**, which merged
after this correction was written, states the same limit independently: the durable marker is written
**only when a wake coordinator already exists** for that reviewer session, and a Stop between asks (or
after a restart before the next ask) writes **no durable marker**. E2 is the package-level row; this
section records that the two older sentences in §1 and §2.2 were corrected to say the same thing.
They do not contradict each other, and neither is a new claim.
