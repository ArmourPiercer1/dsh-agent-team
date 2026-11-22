# D acceptance report — UTE vNext A1 cut + centre (candidate)

**Worktree:** `.worktrees/vnext-a1-cut` · **Branch:** `vnext/a1-cut` ·
**HEAD measured at round 70:** `189d6cabca5b4de9ec3059f9949ab9302364f789` (the audit's own docs-only
commits sit on top of it) · **Base for the
cut:** `a19d1df01` (frozen A0, PR #821) · **Record class of everything below:** in-process `MECHANISM` +
`DEV-LIVE`. Never candidate evidence, never a gate.

This is the single reviewable document for the candidate. It is written to be audited line by line:
every product claim carries a `file:line` or an evidence path, and every row that is not proven says
what would prove it.

> **Read this first, it is the conclusion.** The candidate implements **A1 + B + C** and carries **live
> D evidence** for the items listed in §3. It is **not a completed product acceptance**. **Round 76
> closed the last REFUTED judge**: `d3:persistent-subprocess` is **PROVEN** in two agreeing DEV-LIVE
> boots (a persistent, OS-confined shell across two turns, with the in-lane write succeeding and the
> out-of-lane write refused by the kernel). Several product-entry gaps remain unreachable, and **no
> capability row is PRODUCT-PROVEN** (`CAPABILITY-MATRIX-C.md:71-74`) because a DEV-LIVE boot is not a
> gate. §6 lists the remaining limits; §7 states the verdict without rounding up.

> **Round 66 addendum (C11).** Three node:test arms were added after the HEAD measurement in §1:
> `ADM-107`…`ADM-109` prove the **Team-owned** projection (`projection/**`) is preserved in the new
> assembly and derives only from durable TeamDomain facts (positive control: a real
> `team_create_member` is what the next reader sees, read back across a cold reopen; negatives: a
> centre-REFUSED mutation moves nothing, the live overlay invents nothing, an absent TeamSession fails
> closed, and a projection pass writes nothing). The §2 C11 row, §4.1 leg counts and §7 counts are
> refreshed for those arms; §1's HEAD/diff facts stay as measured. C11's **host**
> `sessionProjections.stateOf` half is still unproven and needs a live boot. Nothing is upgraded to
> PRODUCT-PROVEN.

> **Round 67 addendum (C14b + audit).** The owner's C14b row now carries its own proof: six node:test
> arms (`ADM-110`…`ADM-115`) witness that the eight deleted family bodies are gone and that each
> preserved safety invariant — path bounds, network allow/deny, Control authority, Stop, plus the
> process family's fail-closed rule and dropped-name discipline — still holds in BOTH directions at its
> new owner. §2.2's C14b row, the new §2.3 drop→owner table, §3, §4.1/§4.2 and §7 are refreshed. The
> same round audited §2 row by row: three evidence citations were corrected (C1's live line number,
> C5's "resolved" wording, C15's placement path), §6.9's stale realm-less sentence was corrected (the
> code refuses that member), and §7's "Four live judges" was corrected to the nine it lists. Nothing is
> upgraded to PRODUCT-PROVEN.

> **Round 71 addendum (judge semantics).** Two judges were REFUTED for reasons about the JUDGE, not the
> product, and both clauses were REWRITTEN to measure the contract strictly rather than relaxed:
> `d2:revocation` now asserts the four directions (durable deny refuses with `ADMISSION_OVERLAY_DENY` +
> zero body + settlement `REFUSED` + overlay named + policy generation; deny removal restores the call
> as a NEW fact and `COMPLETED`; the in-lane control is admitted at every phase; and widening beyond the
> compiled ceiling is refused, with the product's own answer measured) and `d:member-read-denied` now
> measures the DECIDING CHANNEL (`LANE_DENY` with ZERO provider guard facts for that call, or
> `IO_READ_DENIED` with its own guard deny fact), plus zero secret bytes, not-ENOENT, and a separate
> in-process `ADM-100` clause for the provider channel. Both are **PROVEN on two agreeing boots** at
> HEAD `82dfda0c3`; `run-boot.mjs` and `run-boot-d2.mjs` now exit 0 with their full clause sets. The two
> rows in §3.2, §6.6, §6.13, §7 and the checklist are refreshed. Nothing is upgraded to PRODUCT-PROVEN,
> and no product code changed for this round.

> **Round 74 addendum (governed management plane).** The owner ruled on the round-59 escalation
> (`docs/reviews/20261122-1536.txt` §3): S6 Remote is restored as an authenticated **management control
> plane**, not a second agent-tool executor. A centre-configured row now builds/installs the S6 plane;
> `POST /team-remote/team.create` mints the Team at runtime through `createAndStartTeam()`. Commands are
> classified by ACTUAL EFFECT in one closed table (`s6-command-classification.ts`); the
> `agent-execution` class (`team.admitInitialWork`, `team.ensureRootLive`, `member.create`,
> `member.send`, `member.followup`) is refused with the existing `ADMISSION_REMOTE_UNAVAILABLE` on
> `team.control`, with a durable fact + `REFUSED`/`not-started` settlement. The round-60 boot-create
> workaround in the D driver is REMOVED; a new live judge `d:remote-creation` is **PROVEN on two
> agreeing boots** (`RESULT PASS 2/2`). §2 C1/C4/C9, §3.2, §6.2, §7 and the checklist are refreshed;
> the escalation is RESOLVED. This is not multi-user RBAC, and no S6 command may execute a model tool.

---

## 1. HEAD, branch, and scope facts

Round 70 re-measured every row below at the measurement commit `189d6cab` (the round-67 values are
superseded; the docs-only commits since `ef2ddbff7` moved the commit count and the diff). The audit's
docs-only commits change no code, so they add to `git rev-list --count` without changing any other number
below. Citation convention: a path
containing `/` is repo-root-relative; a bare filename in a row or section is shorthand for the full path
named in that same row/section (the reviewable set uses this to keep the tables readable).

| fact | value | how measured |
| --- | --- | --- |
| HEAD sha (measurement commit) | `189d6cabca5b4de9ec3059f9949ab9302364f789` | `git rev-parse HEAD` at the start of the audit |
| branch | `vnext/a1-cut` | `git rev-parse --abbrev-ref HEAD` |
| commits since A0 `a19d1df01` | **144** | `git rev-list --count a19d1df01..HEAD` |
| working tree at measurement start | clean | `git status --porcelain` (empty) |
| diff vs A0 | 1643 files changed, +107914 / −79603 | `git diff --stat a19d1df01..HEAD` |
| file-status counts vs A0 | 1199 A · 363 D · 76 M · 2 R060 · 1 R094 · 1 R095 · 1 R096 | `git diff --name-status a19d1df01..HEAD \| awk '{print $1}' \| sort \| uniq -c` |

### 1.1 Cut closure (fresh runs, this HEAD, pasted verbatim)

```
$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
```

```
$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
```

Reading the two together, precisely:

- **146 files deleted** and **2 entries replaced** — the frozen A0 delete/replace set.
- **148 sources gone** (`deleted=148`): 146 deleted + the 2 replaced entries.
- **32 files kept**, out of **180** across **37** modules; **69,512** lines in the frozen census.
- `cut=cut(0/148)` means the closure gate finds **zero** frozen-set files still present, and
  `cut=cut(148/148)` in the assets gate means all 148 are accounted for. `prodRefs=0` = no surviving
  production import of a retired entry; `distResiduals=0` = no stale dist mirror of a deleted source;
  `dupNames=0` = no duplicate tool-name declarations.

### 1.2 Dist mirror placement count

```
$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))
```

**28** byte-identical `.mjs`/`.py` placements (every line at the run reads `(byte-identical)`). This is a
*different measurement* from the frozen A0 figure: A0 counted **52 committed dist artifacts**, and the
closure gate cannot see the aggregated `packages/runtime/dist/packages/<other-pkg>/…` mirrors or `.mjs`
byte-copies — `CUT-BOUNDARY-ADDITIONS.md:27-32` explains the mapping. The two numbers are not comparable
and neither is quoted here as the other.

### 1.3 A0 frozen numbers (for comparison)

| measure | A0 frozen (`a19d1df01`) | this HEAD | source |
| --- | --- | --- | --- |
| modules / files / lines | 37 / 180 / 69,512 | unchanged (37 / 180 / 69,512) | `docs/plans/memo/ute-p0-20261121/01-ASSET-INVENTORY.md:8` |
| files deleted | 146 (wave 1 = 146, wave 2 = 0) | 146 deleted + 2 replaced = 148 sources gone | same; `ute-p0-assets` line above |
| entries replaced | 2 (`agent-bindings.mjs`, `root.ts`) | 2 (both replaced wholesale) | same |
| files kept | 32 | 32 | same |
| dist artifacts | 52 committed (A0 accounting) | + 28 current byte-copied placements (a different measure) | `CUT-BOUNDARY-ADDITIONS.md:27`; `place-dist-glue` line above |

---

## 2. The C1–C18 acceptance checklist

### 2.1 Where the list came from (authoritative, not reconstructed)

The owner's D requirement names "C1–C18 状态". The authoritative enumeration **exists** and is frozen:
`docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md`, section **"The list (A1 must dispose of
every row)"** (lines 30–52). It is the UTE P0 capability contract; the rule that makes it enforceable is
at `:86-90` ("A1 may not merge while a row is blank … 'dropped' must name the owner ruling"). Its own
phase split is at `:16-28`, and the "A1 must dispose of every row" framing is at `:30`.

**One structural detail, stated rather than smoothed over:** that table has **19 rows** — C1…C18 **plus
`C14b`**, because the owner split C14 into "drop the implementations" and "preserve the safety
invariants" (`06-CAPABILITY-CONTRACT.md:26`, `:54-63`, and the decision record at
`dev/agent-workflow/SESSION_ROUTER_LOG.md:9810`). So the 18 numbered criteria are all present, and C14b
is an additional sub-row of the same frozen contract. It is included below as its own row, labelled.

The **capability** and **disposition** columns below quote that table's wording verbatim. The **status**
and **what would prove it** columns are this report's honest measurement; they are not from the frozen
list.

### 2.2 The checklist (18 numbered rows + the contract's C14b split row)

Status vocabulary — these are not interchangeable:

- **MECHANISM** — the centre-side guarantee is implemented with passing in-process arms
  (`CAPABILITY-MATRIX-C.md:5`).
- **DEV-LIVE** — additionally measured on a real booted host by a live judge; a `DEV-LIVE` record is
  **not** a gate and upgrades no row (`CAPABILITY-MATRIX-C.md:7`, `:71-74`).
- **PRODUCT-PROVEN** — MECHANISM **and** a real product assembly exercised it end to end. **No row is in
  this state.**
- **REFUSED-BY-DESIGN** — the call is refused with its own typed code on its own axis; this is the A1 law
  working, not a defect (`CAPABILITY-MATRIX-C.md:72-74`).
- **DROPPED-AS-RULED** — deleted under an owner ruling named in the contract.
- **UNPROVEN** — nothing here should be reported as working.

| # | capability (verbatim) | disposition (verbatim) | status at this HEAD | evidence | what would prove it (if not PRODUCT-PROVEN) |
| --- | --- | --- | --- | --- | --- |
| **C1** | the **15** `team_*` tools (member/template/delegation/control board) | **preserve** — not the retired plane; the earlier draft credited the plane, which was wrong | MECHANISM + DEV-LIVE surface. The closed list is `CENTRE_TOOL_NAMES` (`packages/runtime/src/plugin/vnext/admission.ts:57-73`); `ADM-31` pins it against `createTeamTools` **in both directions**; `ADM-89/90/91` admit all 15 on `team.control`, refuse all 15 unbound, and refuse an unlisted name. Live: the booted centre row's model-visible surface carries all 15 (`ESCALATION-centre-row-creation-entrance.md:8-9`) | `packages/runtime/test/vnext-admission.test.mjs`; `ESCALATION-centre-row-creation-entrance.md:8-9` | a governed row that **creates and drives** the board end to end through a product entrance with a real model. **Round 74 removed the entrance blocker** (`POST /team-remote/team.create` mints the Team at runtime on a centre row); the live driver still uses the product's scripted mock, so a **real model** remains unproven |
| **C2** | member create / resume / archive | **preserve** | MECHANISM. `ADM-92` creates through `team_create_member` and installs the **member's own** centre at its bind; `ADM-93` archives through `team_archive_member` (production step ports: quiesce → settle-then-archive → `release-residency`), and the next call is `ADMISSION_MEMBER_CLOSED`. **DEV-LIVE (create only):** the D3 delegate produced a real `member-activated` effect with `instanceId`/`childSessionId` (`d3:work-delivery`, §15) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md` §15; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` | a live **archive** and a live **resume** on a booted host. Archive's live path currently refuses **earlier**, at the durable lifecycle gate (`LIFECYCLE_ADMISSION_CLOSED` / `memberResumeRefusal`) — `CAPABILITY-MATRIX-C.md:61-64`. Resume is not measured live at all |
| **C3** | work delegation + delivery receipts | **preserve** | **DEV-LIVE PROVEN** (`d3:work-delivery`, two agreeing boots). `team_delegate` → `effect.kind=member-activated`, prompt delivered **verbatim** as the Member's first user message, final text and `memberResult.body` both exactly `DBOOT_D3_DELIVERED_UNIT_ALPHA`; `team_collect` returns the terminal `succeeded` entry, **byte-identical when collected again after a SIGKILL cold restart**; the unit is on disk; every member call fact is in the member's own ledger. `ADM-94/95` carry the in-process positive and negative | `D-BOOT-FEASIBILITY.md:618-628`; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md`; `packages/runtime/test/vnext-admission.test.mjs` | a **real-model** interleaving (the current model is the product's scripted mock, §6.7) and a delivery driven at a product entrance rather than the driver's boot-bound team |
| **C4** | Blueprint binding + identity generation | **preserve** (KEEP module) | MECHANISM. `ADM-26` maps a compiled member onto a binding by reference, never by re-interpretation; `TB-1…TB-6` pin the durable-row resolution and the four typed refusal reasons with **no** legacy degradation. Live: the round-60 path-3 boot binds a v4 blueprint at boot and reaches a governed Member (`CAPABILITY-MATRIX-C.md:137-141`) | `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/test/vnext-template-binding.test.mjs`; `CAPABILITY-MATRIX-C.md:137-141` | an identity generated for a member **created at runtime** on a governed row — **round 74 now has the runtime Team/Leader identity** (`team.create` → `createAndStartTeam`); a runtime-created **Member** (`member.create`, which is refused as agent-execution) and a real-model identity are still unproven |
| **C5** | Control: ask / grant / deny / consume | **preserve** (KEEP module), fed by the three contracts | MECHANISM. `ADM-46…ADM-55` cover wiring, deny, expired, fault, the **real** `ControlService` (one request → one durable allow → one-shot spend), a real service deny, generation drift, incomplete identity, and the supply-chain pin. Live: `d2:stop` parked a Member turn at a durable `admission-ask` Control request `status=pending` and **stopped** it through the public `session/cancel` RPC — a Stop, not an approval (no decision row is granted; the live record stops at the pending request and the `ADMISSION_STOPPED` fact) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493` | a live **approval** (leader allows) and a live **consume** of the one-shot grant. Today the live ask is only exercised in its Stop terminal. The product *does* install the grant binder and the durable approval port when the row has a `controlServiceRef` (`agent-bindings.mjs:688-706`); a row without one still refuses asks as `ADMISSION_ASK_UNWIRED`, and no live approval/consume has been observed |
| **C6** | Officer assignment + ReviewCapability routing | **preserve** (KEEP module) — *and* the contract's own rule: if Alpha.6 is not wired, "the corresponding approval and auto-wake paths must be **explicitly disabled**, never silently fall back" (`06-CAPABILITY-CONTRACT.md:95-98`) | **REFUSED-BY-DESIGN**, and that is the contract-compliant state. `ADMISSION_ALPHA6_UNAVAILABLE` in two independent gates: `centre-config.ts:73` rejects the opt-in on **every** row (`ADM-34`, `ADM-99`), and `root.ts:2496-2510` records the refusal then types the boot refusal. **Live:** `d3:alpha6` **PROVEN** as the typed-refusal shape — no team root (`/__p6t6/state` 404), no decision, no wake intent. **ROUND 68:** the row's refusal is now RECORDED at the host entry through the product's own point (`host.ts` -> `createAlpha6RowRefusalHook` at the centre rule -> `createHostSurfaceRefusalPoint`): both live boots measured one `ADMISSION_ALPHA6_UNAVAILABLE` invocation-authority fact on `host.service` and a `REFUSED`/`not-started` settlement (`ADMITTED→REFUSED`) under the row's `centreStatePath`, while the same typed refusal and the same no-team-row boot outcome are unchanged. A row with no `centreStatePath` is still refused but unwritten (no durable directory). `ADM-116/117/118` carry the in-process shape | `D-BOOT-FEASIBILITY.md:629-643`; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md`; `packages/runtime/test/vnext-admission.test.mjs` | a compiled review-routing **axis** in the member contract, or an owner ruling that a record-only approval fact on `host.service` **is** adjudication (`CAPABILITY-MATRIX-C.md:119-123`) |
| **C7** | durable Wake intents + cold wake | **preserve** | MECHANISM, in-process only. `ADM-98` composes `createAlpha6RootWiring` directly, the ONE shared `createAlpha6RootRouter` takes a real `recipient` decision off a durable control row (Officer, `routeRole='officer'`), and the real `dispatchLatch` + `createFileWakeIntentDirectory` persist a row that a **fresh** reader sees naming exactly the routed reviewer | `packages/runtime/test/vnext-admission.test.mjs` | the same, reached at a **product entry**. Unreachable while C6's axis is missing: the config gate runs before root construction, so at a host entry the machinery is never built (§6.5) |
| **C8** | Stop (sticky, durable, non-replaying) | **preserve** | MECHANISM + **DEV-LIVE PROVEN** (`d2:stop`, two boots). Stop is the host's own `exec.signal` — no second stop mechanism. `ADM-56…ADM-62` cover Stop before the body, while an ask is pending, after the approval and before the body, lifecycle close with a call in flight, and the product composition's own close. Live: `POST /api/session/cancel` → tool result `ADMISSION_STOPPED`, centre fact `refusalCode=ADMISSION_STOPPED`, settlement `REFUSED`/`dispatch=not-started` with **no** execution fact, never `UNKNOWN`; a second Member completed with zero stops. **ROUND 79 — the rc.5 PRE-DISPATCH case (B6):** rc.5 cancels a call before dispatch without entering the pipeline, so `tools/result` never fires and event-only observation recorded nothing. The centre now reads the host's own `ABORTED_BEFORE_DISPATCH` result at the executor completion boundary (`pre-dispatch-abort.mjs`; `batch.ts:271-280` → `index.ts:375-377`), writes the SAME canonical execution fact (`aborted`, `abortPhase:'pre-dispatch'`, product ExecutionId) through ONE ExecutionId-keyed dedupe map, records `Stop(pre-dispatch)` + `CANCELLED` when an admission record exists, and when none exists writes **no** settlement and REPORTS `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` (no fabrication: no fake allow, no fabricated `tools/result`). `SLICE-21`/`SLICE-30` GREEN on rc.5 AND rc.2 with unchanged assertions; `SLICE-37` pins the dedupe (both paths firing ⇒ one fact, zero settlement) | `packages/runtime/test/vnext-fs-slice.test.mjs` (SLICE-21/30/37); `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493`; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md`; `RC5-MIGRATION.md` §7 | Stop **under load** and a real Stop keypress; and the one open cell: a Stop that lands **after** an `allow` was recorded cannot be `REFUSED` under the frozen settlement contract (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`). **Round 79 adds one:** the production `tools.execute` call site belongs to the host agent loop, so the pre-dispatch observer is exported and driven end to end in the slice composition but is NOT yet wired into a booted rc.5 member turn (`RC5-MIGRATION.md` §7.5) |
| **C9** | remote entry (`s6-remote`, remote control surface) | **preserve** | **RESTORED as a GOVERNED MANAGEMENT CONTROL PLANE (round 74)** under owner ruling `docs/reviews/20261122-1536.txt` §3. The S6 plane is BUILT and INSTALLED on a centre-configured row; `POST /team-remote/team.create` mints a Team at runtime through `createAndStartTeam()` with the existing S6 Principal + TeamDomain/Control + creation/start gates. Commands are classified by ACTUAL EFFECT in ONE closed table (`s6-command-classification.ts`): control-plane reads/creation/management are served; agent-execution commands (`team.admitInitialWork`, `team.ensureRootLive`, `member.create`, `member.send`, `member.followup`) are REFUSED with the existing `ADMISSION_REMOTE_UNAVAILABLE` on `team.control` + durable fact + `REFUSED`/`not-started` settlement. `ADM-86` (rewritten) pins the closed table both ways, the no-default-allow rule, a served control read, a refused execution (zero ports), the durable shapes, and the unauthenticated principal refusal; E3 pins the real production root (`installed===true`, served read, five type-refused executions with facts). Live `d:remote-creation` (round 74, two boots): unauthenticated refused/mints no Team, `TEAM_REMOTE_FOREIGN_TEAM`, runtime create success, duplicate no second Team/no provider request, `member.send` refused with zero provider requests. LIMIT: per-DSH_HOME authenticated operator, NOT multi-user RBAC | `CAPABILITY-MATRIX-C.md` C-remote; `ESCALATION-centre-row-creation-entrance.md` RESOLUTION; `packages/runtime/test/vnext-admission.test.mjs` (`ADM-86`); `a3p4-pr4-production-entry-regression.test.ts` (E3); `D-BOOT-FEASIBILITY.md` §17 | a real-model drive through the remote entrance, and a user-level identity isolation claim (out of scope/not claimed) |
| **C10** | MCP catalog + initial grant + live loss | **preserve** — "may land in C, but must never be enabled by default while unmanaged" (`06-CAPABILITY-CONTRACT.md:99`) | MECHANISM. `ADM-96` mounts the product's own real HTTP mini-MCP server through the **exact production call**, reads the tool off the model-visible surface, admits it on `net.mcp` with the **server** as locator, and the real body answers `pong:mounted`; `ADM-97` proves mounting ≠ permission, that a tool-level restriction narrows, and that a bare `mcp__` prefix is refused by name. `f15-mcp-live-loss` is green inside the 238-suite vitest population. Not enabled by default: the remote mount is `SKIPPED` on the centre row | `packages/runtime/test/vnext-admission.test.mjs`; `tests/checks/eb3-ute-migrated-suites.txt`; `D-BOOT-FEASIBILITY.md:171-222` | a **live mount at a host boot** (unknown at D: the row's remote mount is skipped) and a live server-loss observation. Also: the centre is **not mount-aware**, so a well-formed name for a never-mounted server is decided on the network axis alone (`ADM-97` step 5) |
| **C11** | state projections (`sessionProjections`) | **preserve** | **MECHANISM, measured (round 66).** The row names two owners. (a) The Team-owned projection (`projection/**`) is **PRESERVED in the new assembly** and proven to derive from the TeamDomain's own facts: `ADM-107` wires it exactly as the entry does — `createProjectionService(createTeamDomainReadPort(domain, readPortDeps), <live overlay>, { clock, schemaVersion: 2 })` (`root.ts:4275-4279`) — over the REAL durable `TeamDomain`, and asserts the identity core, every member row and the ledger summary field-by-field against the durable rows; a real `team_create_member` is then what the **next** reader sees (fresh port + service), and every durable value survives a **cold domain reopen**. `ADM-108` (negative) proves a mutation **REFUSED at the ONE centre** (`ADMISSION_NO_BINDING`, `LANE_DENY`) moves **nothing** — projection byte-identical, no new member row, no ledger entry, no generation move — with a same-world positive control. `ADM-109` (negative) proves the live overlay is **not a second authority** (a live handle invents no member; dropping one moves only residency, never lifecycle/creation/generation), that an absent TeamSession **fails closed** (`TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT`, never an invented empty team), and that a projection pass **writes nothing**. Falsified not assumed: stamping v1 and emptying the catalog template rows each turn the arms red. (b) The other named owner — the host's native `sessionProjections` service behind the `todo`/`goal` faces — is preserved **by construction, not by this cut**: neither the retired entry (`live/agent-bindings.mjs`, `root.ts` at `1617d5839^`) nor the new one references it (`grep -c sessionProjections` → **0** in all four files), so the entry replacement cannot have un-wired it; those faces stay bound on `host.service` (`ADM-32`). The Team-side uses are pass-through **reads** of the HOST's service, never a registration of its own: the PTY facade hands `ctx.get('sessionProjections')` to the pinned backend (`team-services/src/terminal-pty.ts:400`) and the P5-T5 real-instance harness restores the durable model selection with `stateOf(session, 'modelSelection')` (`root-binding/harness/plugin.mjs:969-982`) | `packages/runtime/test/vnext-admission.test.mjs` (`ADM-107`…`ADM-109`); `MIGRATED-SUITE-STATUS.md` "Round 66 (C11)" | (i) a **live boot** reading the Member's todo/goal projection state through the host's own `sessionProjections.stateOf` — that service is the HOST's, so no in-process arm can read it; (ii) a projection read at a **product entry** (`team.getProjection`), which a centre-configured row cannot reach today because the S6 plane is refused by design (C9). **The `sessionProjections.stateOf` half is NOT claimed here**, and no cell above is PRODUCT-PROVEN |
| **C12** | tool admission (guard, builtin deny, selector) | **preserve** (KEEP module) | MECHANISM + DEV-LIVE. `ADM-1…ADM-45` (lanes, deny precedence, unbound refusal, `ADMISSION_TOOL_UNBOUND`), `ADM-29/30` (tool restriction answers before the ceiling and only narrows), `ADM-31` (closed list matches `createTeamTools` both ways), `ADM-35` (a governed member refuses to run unrecorded), `ADM-44` (`MEMBER_CENTRE_UNWIRED`). Live: `d:centre-facts` PROVEN — 2 `fs.read` admissions (`allow` + `DENY/LANE_DENY`) and 2 execution facts, read back from disk | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:369-395` | a real model choosing tools adversarially (the mock is scripted), and a policy compiled at runtime rather than passed as an input (`CAPABILITY-MATRIX-C.md:66-67`) |
| **C13** | confined I/O faces (fs/web/subprocess/terminals/userQuestions) | **replace** with provider lanes | MECHANISM + DEV-LIVE for **fs, web and subprocess**; **process family ADMITTED ON A DECLARATION, live persistent shell PROVEN (round 76)**. fs: `d:guard-facts` **PROVEN** (2 `allow` facts, methods `stat`/`readText`, `memberIdentity=inst-0pe2z220bhfb`), `SLICE-1…SLICE-36`, and `d2:multi-member-concurrency` live. web: `SLICE-31/32` (transport reached / never reached), `ADM-67/74`. subprocess: keys on `toolBindings[].authorization` + `execution.executionBoundary` (`admission.ts:409-452`, `ADM-125`…`ADM-131`); round 76 additionally mounts the HOST's `dsh-tool-bash-persistent` (`backendType: a5sf-governed-shell`) beside the one-shot baseline and declares the binding, so the live D3 judge is **PROVEN** in two agreeing boots — the second turn reuses the same shell, and the out-of-lane write is refused by the OS profile (§6.3). PTC: `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:405-407`) **ROUND 77: the rc.5 FS confinement gap (`patchText`/`deleteFile`/`moveFile`) is CLOSED — SLICE-35 GREEN on rc.5 and rc.2, `ADM-135`…`ADM-140`; still in-process (§6.15).** | `D-BOOT-FEASIBILITY.md:349-414`; `packages/runtime/test/vnext-fs-slice.test.mjs`; `packages/runtime/test/vnext-b-probe-ladder.test.mjs` | a live `web_fetch` at a boot, and `userQuestions`/terminals beyond the PTY-owner refusal (`SLICE-33`) — the persistent (`a5sf-governed-shell`) live shell at a boot is no longer on this list (round 76 PROVEN); what remains unproven for it is a GATED (non-DEV-LIVE) status and a real-model interleaving |
| **C14** | **old governed-family execution implementations**: each family's own tool body, its duplicated policy computation, and the historical per-family semantic-equivalence requirement … | **dropped** — the host rows own execution now, and the equivalence criterion is retired with the bodies; the differences that mattered were defects of the deleted body (`SD-SEARCH-1`) | **DROPPED-AS-RULED**, and closure holds: `deleted=148 prodRefs=0 distResiduals=0 dupNames=0` (fresh run, §1.1); no legacy Plane/Family Body/Kernel/PA Bridge is wrapped as an internal component and there is no legacy fallback (`PR-BODY-draft.md` §"What this branch is") | `ute-cut-closure` line in §1.1; `CUT-BOUNDARY-ADDITIONS.md`; `docs/plans/memo/ute-p0-20261121/03-RETIRE-KEEP.md` | nothing — a drop is complete when the closure gate is green and the ruling is named, which it is (`06-CAPABILITY-CONTRACT.md:90`) |
| **C14b** *(the contract's split row, not a 19th criterion)* | **the safety invariants those families enforced**: path read/write upper bounds, network allow/deny, Control authority, Stop | **preserved** — never implied by C14's drop | **MECHANISM + DEV-LIVE, now with a per-invariant positive+negative pair (round 67).** §2.3 maps every dropped implementation to a surviving owner with `file:line`; `ADM-110` (path bounds: centre authored lane + provider resolved path, `..` and symlink), `ADM-111` (network: allow/unset/deny + tool-level narrowing), `ADM-112` (Control authority: the REAL durable `ControlService` asks, denies and one-shot spends), `ADM-113` (Stop: REFUSED/not-started, never UNKNOWN, durable across a fresh reader), `ADM-114` (process: fail-closed `ADMISSION_EXECUTION_UNAUTHORIZED`, never an unconfined shell), `ADM-115` (dropped names are unbound; preserved host faces keep `host.service`). The P1–P5 proofs (§3) and the OS controls still stand: `OS-1` Landlock ABI 7, `OS-2` **negative**, `OS-3` **positive**, `SLICE-4` (without the realm mount the outside read **succeeds**, so the confinement arms are falsifiable). **No invariant is enforced only by a deleted component** — checked, not assumed: the five `confined-*` shadows were mounted by the realm row itself (`a5sf-realm-row.mjs` at A0), so a realm-less member was never confined by them; the residual is the *ungoverned* (never-asked) row, which this row does not claim to govern (§2.3) | §2.3; §3; `packages/runtime/test/vnext-admission.test.mjs` (`ADM-110`…`ADM-115`); `packages/runtime/test/vnext-os-probe.test.mjs`; `packages/runtime/test/vnext-fs-slice.test.mjs` | a live OS-boundary measurement at a boot (today the OS probe runs in the node leg on the CI host); network containment under a real model; and a product entry that drives each invariant (not only the in-process centre) |
| **C15** | `team_skill` | **preserve, re-homed** — Team skill provider into a host-shaped row | MECHANISM + **recorded LIMIT**. Bound on `host.service` (`ADM-32`); `skill` is in `HOST_CAPABILITY_TOOL_NAMES` (`admission.ts:114-122`); the governed preset mounts `a5sf-skill-provider` (`scripts/dist-placements/190-a5sf-pd29-service-seam.json:5-6` places the module; the governed realm row mounts it at `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:989`). **Limit, not a confinement claim:** a skill file read by the host skill service is OUTSIDE the member's fs ceiling (`CAPABILITY-MATRIX-C.md:76-87`) | `packages/runtime/test/vnext-admission.test.mjs`; `CAPABILITY-MATRIX-C.md:29,76-87` | a D judge that has a governed Member invoke `team_skill` on a booted host and asserts the row is reachable — with the limit stated in the same evidence, not only here |
| **C16** | `subagent_fork` | **preserve, re-homed** — row over `subagent-fork-in-process` | MECHANISM. Bound as host capabilities (`subagent`, `send_message`, `interrupt_agent`, `admission.ts:114-122`, `ADM-32`); the **child's own** binding governs the child's tools (so the parent's ceiling is not a claim about the child) | `packages/runtime/test/vnext-admission.test.mjs`; `CAPABILITY-MATRIX-C.md:30` | a live fork at a boot, and an assertion that the child's own centre judges the child's calls — neither is measured in the D legs |
| **C17** | **Team's own `exit_plan_mode` tool** — not DSH plan mode, and not the goal tools | **dropped by owner ruling** — the host has only a `claude-code-mods` name mapping, and re-creating a plan-mode state machine is out of scope. `get_goal`/`create_goal`/`update_goal` are untouched | **DROPPED-AS-RULED**, provable by **absence**: zero `exit_plan_mode` references under `packages/runtime/src` and `packages/tools/src`, and it is in neither closed table (`admission.ts:32-41`, `:57-73`, `:114-122`). The goal tools **are** present on `host.service` | `grep -rn exit_plan_mode packages/runtime/src packages/tools/src` → no matches; `admission.ts:114-122` | nothing — the ruling is named and the absence is checkable |
| **C18** | `a5p5-tools` lane helpers (arg parsing, effects, render, spill) | **dropped** — dormant, nothing dispatched | **DROPPED-AS-RULED.** `packages/tools/a5p5-tools` no longer exists under `packages/tools/src` (only `builtin-deny.ts`, `guard.ts`, `index.ts`, `native-fs-binding.ts`, `tokens.ts`, `tool-selector.ts`, `tools.ts`, `types.ts`), it is absent from the migrated population, and the cut-closure run reports 148 sources gone with zero residual references | `ls packages/tools/src`; `grep a5p5 tests/checks/eb3-ute-migrated-suites.txt` → none; `ute-cut-closure` line in §1.1 | nothing — dormant-and-deleted with an empty dispatch path is the ruling's own completion criterion |

**Rows that are not proven, at a glance** (this is the honest subset a reviewer should carry forward):
**C1/C2/C4/C5/C6/C7/C9/C10/C15/C16** are MECHANISM at best and several are
REFUSED-BY-DESIGN by owner ruling; **C3/C8/C12/C13/C14b** carry DEV-LIVE evidence but are still not
PRODUCT-PROVEN. **C11 now has mechanism arms** (`ADM-107`…`ADM-109`, round 66) for the Team projection;
its host `sessionProjections.stateOf` half is still unproven and needs a live boot.
**No cell above says PRODUCT-PROVEN, and none may be upgraded by narration.**

### 2.3 C14's dropped implementations, and where their safety invariants live now

C14 drops **implementations**, never safety (`06-CAPABILITY-CONTRACT.md:54-63`). The frozen text
(`:40`) and the retirement inventory (`03-RETIRE-KEEP.md:21-22`, `01-ASSET-INVENTORY.md:14-21`; per-file
lists at `:54-218`) name **eight governed-family bodies** — fs, search, web, process, ui, inspect,
agent-control, agent-state — plus the retired pre-execution/dispatch components. The table is the
drop→owner enumeration the C14b row relies on; every "now enforced at" cell is a `file:line` a reviewer
can open, and the arm column names the round-67 positive+negative pair that proves the invariant after
the drop.

| dropped implementation (C14) | files | safety invariant it enforced | now enforced at (file:line) | arm (round 67) |
| --- | --- | --- | --- | --- |
| `family-fs` — read/write/edit/read_image executors over ONE controlled root | 17 | path READ/WRITE upper bounds, including the **resolved** path (symlink / `..`) | centre: authored locator decided in `admission.ts:380-389`; provider: `team-services/src/fs.ts:134,179` → `member-io-policy/src/provider-capabilities.ts:299-405` (`PATH_SYMLINK_ESCAPE`, resolved containment) | `ADM-110` (+ `SLICE-3/6/27`, `ADM-2`) |
| `family-search` — grep/glob executor + presentation | 9 | search-root bound; an omitted path means the workspace root, never "unbounded" | `admission.ts:35-36` (`TOOL_AXES`), `:145-149` (`DEFAULTED_LOCATORS`); the durable overlay ABSTAINS instead of faulting (`overlay-decision.mjs:226-228`) | `ADM-110` (provider half), `ADM-16`, `ADM-105/106` |
| `family-web` — fetch/search + redirect ownership | 10 | network allow/deny; an fs grant never stands in for it | centre `admission.ts:349-357` (`net.fetch`, tool-level narrowing included); provider face `team-services/src/web.ts` (compiled `network` axis) | `ADM-111` (+ `SLICE-31/32`, `ADM-17`) |
| `family-process` — bash + an unrouted pwsh + confined-shell executor | 11 | **no unconfined shell execution**; the OS boundary belongs to the provider, not a body | centre refuses a process with no compiled execution authorization `admission.ts:409-452` (`ADMISSION_EXECUTION_UNAUTHORIZED`/`_DENIED`/`ADMISSION_EXECUTOR_UNAVAILABLE`); PTC has its own code `:405-407`; OS profile `team-services/src/subprocess.ts:1372` (`compileExecutionProfile`) | `ADM-114`, `ADM-125`…`ADM-131` (+ `OS-1/2/3`; `d3:persistent-subprocess` **PROVEN** round 76, two agreeing boots) |
| `family-ui` — ask_user_question + present | 9 | no second declarant / no undeclared I/O surface | the names have no preserved home ⇒ `ADMISSION_TOOL_UNBOUND` (`admission.ts:316-319`); terminals stay the PTY-owner refusal (`SLICE-33`) | `ADM-115` |
| `family-inspect` — team_skill + two `team_cordis_*` rows | 10 | host-service I/O is RECORDED on its own axis, never judged by the fs lane | `HOST_CAPABILITY_TOOL_NAMES` (`admission.ts:114-122`, axis `host.service`); the limit is stated at `:100-108` | `ADM-115` (+ `ADM-32`) |
| `family-agent-control` — seven subagent/orchestration rows | 14 | the CHILD's own binding governs the child's tools | `host.service` table (`admission.ts:114-122`); the child's centre is installed at its own bind (`ADM-92`) | `ADM-115` (+ `ADM-32`) |
| `family-agent-state` — todo_write + goal rows + `exit_plan_mode` | 7 | preserved state faces recorded; `exit_plan_mode` dropped by ruling | `host.service` table (`admission.ts:114-122`); `exit_plan_mode` is in no closed table (`ADM-115`) | `ADM-115` |
| `pa-mount-registry`, `pa-control-bridge`, `pre-execute-adapter`, `native-tool-admission`, the five `confined-*` shadows, `family-assembly` | 10 | **Control authority**: one approval authority, current mount facts, no second dispatch authority | centre ask path `admission-port.mjs:94` (`createControlApprovalPort`), `:336-344`, `:477`; authority `packages/runtime/control/service.ts`; closed tables `admission.ts:32-41/57-73/114-122` | `ADM-112` (+ `ADM-46…55`) |
| `governance-center` + `tool-dispatch` (one group) | 11 | one decision, one durable closure; a Stop never becomes a completion | centre `refuseStop` `admission-port.mjs:336-344,477,801-802`; settlement `settlement/execution-settlement.ts` | `ADM-113` (+ `ADM-56…62`) |

**What the enumeration establishes.** Each of C14b's four named invariants has a surviving enforcer on
both layers the old bodies used: the centre's compiled lane (authored locator, network axis, approval
path, Stop) and the provider face (resolved path, web transport, OS profile, settlement). The old
per-family equivalence demands (`pwsh` parity, web redirect ownership) are retired **with** the bodies
because they were criteria of the deleted implementation, not safety properties (`06-…:40`).

**The one residual, measured rather than assumed (not a preserved enforcement).** The five `confined-*`
shadows existed because the preset scope otherwise resolved the inherited unconfined service (PD-17),
and they were mounted by the **realm row** itself (`a5sf-realm-row.mjs` at A0, `A5SF_CONFINED_FS_TOOL`).
They are gone, so the question is whether any member that used to be confined by them now is not. Two
cases, and the answer is the same in both: a member whose row **asked for the centre** but mounted no
realm is **refused** `MEMBER_CENTRE_UNWIRED` (`centre-config.ts:36-49`, called at
`agent-bindings.mjs:1942-1944`, `ADM-44`); a member whose row **never asked** also never mounted the
realm row, so the deleted shadows were never its enforcement either. **No invariant in C14b is left
enforced only by a component that is gone.** The ungoverned row remains ungoverned by design — a
capability limit, not a regression this cut introduced — and the open design question (admit against
the same compiled ceiling with an explicitly unconfined provider, or refuse) is
`ESCALATION-realmless-admission.md`, whose "What the code says" snippet predates the round-35 refusal.

---

## 3. The P1–P5 ladder and the OS negative controls

The P1–P5 obligation set is frozen in `docs/plans/memo/ute-p0-20261121/04-SEAMS.md:57-67`: "Each proof is
a *pair*: an assertion that must be green, and a mutation that must turn it red. A proof without its
mutation is a claim, not a test." The C14b row names them as the evidence that the safety invariants
survived the C14 drop (`06-CAPABILITY-CONTRACT.md:48`). Round 67 adds the invariant-shaped arms
`ADM-110`…`ADM-115` (§2.3): same proof shape (a green positive, a must-refuse negative), applied to the
four preserved invariants and to the process family's fail-closed rule. They supplement, never replace,
the P-rungs below.

| proof | what the rung proves (verbatim obligation) | arms that carry it | live judge that carries it | negative control / must-red mutation | committed evidence |
| --- | --- | --- | --- | --- | --- |
| **P1** | **Binding monotonicity** (UTE-06): `EffectiveIO ⊆ AgentCeiling ∩ ToolRestriction` on every admitted call | `ADM-2` (out of lane is `LANE_DENY`; a write grant is never read as a read grant), `ADM-7` (deny wins), `ADM-29/30` (a TOOL restriction answers before the ceiling and **can only narrow**), `ADM-39` (an omitted axis does not inherit the ceiling), `ADM-45` (the durable overlay can only REMOVE authority), `ADM-52` (post-approval generation drift refuses) | `d:centre-facts` — one ledger holding `allow` **and** `deny/LANE_DENY` for the same member; `d2:multi-member-concurrency` — A's read of B's in-lane file is `LANE_DENY`, **zero** B bytes reach A, and **zero** guard facts exist for B's locator under A's identity | must-red mutation: widen one axis after approval ⇒ the same call refuses (`ADM-52`, `ADM-37`); live widening is refused by the durable lane itself (`d2:revocation` direction (d): `changed:false`, reason `mutation-proposal-pending`, widened locator still `LANE_DENY`) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:452-461`; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` |
| **P2** | **Face completeness** (UTE-07): a tool with all required faces bound executes; a tool missing one face is refused **whole** | `ADM-4` (a tool with no declared axis is refused, never admitted by default), `ADM-18` (no compiled tool-level execution authorization ⇒ the subprocess family is EXPLICITLY refused), `ADM-33` (an MCP tool needs a **server** locator, no prefix matching), `ADM-78` (the binding IS the compiled answer; absent axes stay absent) | `d3:persistent-subprocess` — **PROVEN (round 76) and correct as a face-completeness witness**: `bash` now executes ONLY after the world declares `authorization` + `executionBoundary`, and a declaration the composition cannot place is refused whole (`ADMISSION_EXECUTOR_UNAVAILABLE`); before the declaration existed the same call was refused whole with `ADMISSION_EXECUTION_UNAUTHORIZED` rather than run without an execution declaration | must-red mutation: bind `faces.web = null` and assert the whole tool refuses, not "runs without web" (`04-SEAMS.md:63`); B's ladder rung 6 (`ADM-76`) is the live-shaped negative | `packages/runtime/test/vnext-b-probe-ladder.test.mjs` (`ADM-78`); `D-BOOT-FEASIBILITY.md:572-598` |
| **P3** | **Fail-closed** (UTE-09): provider absent ⇒ refuse | `ADM-3` (UNWIRED refuses; it does **not** fall through to the composition provider), `ADM-42` (a native module specifier is judged before it is imported), `ADM-83` (an unwritable ledger is a refusal), `ADM-102` (`GOVERNED_NATIVE_MODULE_*` typed refusal, **never** a base-provider fallback), `SLICE-9` (with no binding the in-ceiling call never reaches the provider) | `d:guard-facts` — `out-lane-never-reached-provider 0` guard facts; the refused call never enters the provider at all. Residual 1 of `FINDING-native-tool-provider.md` is exactly this law: the centre's `LANE_DENY` precedes the body | **negative control that makes it falsifiable:** `SLICE-4` — **without** the realm mount, the same outside read **SUCCEEDS**. Also `SLICE-17/18/19` (observation policy OFF accepts an unobserved overwrite; ON refuses it; a moved version is refused) | `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/test/vnext-fs-slice.test.mjs`; `FINDING-native-tool-provider.md:91-115` |
| **P4** | **One fact** (UTE-15/17): one `ExecutionId`, one canonical outcome per physical attempt; a crash between emit and return leaves a recoverable fact | `ADM-21` (`ADMITTED → RUNNING → COMPLETED`), `ADM-79` (crash between the admission fact and the execution fact ⇒ a **new process** recovers `ADMITTED→UNKNOWN`, never `COMPLETED`), `ADM-80` (a callId with a durable fact is refused on a second attempt in a **fresh process**, before the body), `ADM-81` (a duplicate execution fact on disk is a refusal), `ADM-84` (an open settlement is classified `UNKNOWN` from disk with what is missing) | **`d3:crash-cold-recovery` — PROVEN.** A real `SIGKILL` (`signal=SIGKILL`, pid gone) and a restart on the **same** `DSH_HOME`: the in-flight `RUNNING` becomes `UNKNOWN` with **no execution fact** and one admission fact (never replayed); the completed call's fact/settlement are **byte-identical**; a new call is admitted with a **new** fact and completes | must-red mutation: kill the process after emit and assert recovery yields `unknown`/fact, never `succeeded` from memory (`04-SEAMS.md:65`); `ADM-79`'s control also completes a **different** call before dying, which stays `COMPLETED` (no blanket rewrite) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:599-617`; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` |
| **P5** | **Stop is durable and non-replaying** (UTE-18): after stop + cold start, facts are restored and nothing re-executes | `ADM-56` (Stop before the body ⇒ `REFUSED`/not-started, never `UNKNOWN`, never an execution), `ADM-57` (Stop while the ask is pending closes the durable request; a later approval cannot revive it), `ADM-58` (Stop **after** the approval and **before** the body spends nothing), `ADM-59` (lifecycle close refuses a new call with its own code), `ADM-60` (close with a call in flight: it still settles; a second dispose neither throws nor double-settles), `ADM-61` (close while an ask is pending abandons it), `ADM-62` (the product composition closes the member) | **`d2:stop` — PROVEN.** Through the product's own public `POST /api/session/cancel` on the child session, while parked at a durable `admission-ask`: tool result `Error: ADMISSION_STOPPED: …`, centre fact `refusalCode=ADMISSION_STOPPED`, settlement `REFUSED`/`dispatch=not-started`/`bodyOutcome=not-started` with **no execution fact**; never a completion and never `UNKNOWN`. Member B completed with zero stops | must-red mutation: restart and assert the previous call is **not** resumed; a resume attempt must red (`04-SEAMS.md:66`). The live negative is the **second Member**: it completes, so Stop is not a blanket. Re-reported in **both** boots — no single-boot concession | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493`; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` |

**The honest gap in the P-ladder:** the "must-red mutation" half is recorded for P1/P2/P4/P5 as mutations
performed and reverted during those rounds (`PR-BODY-draft.md` §"B stage, second slice" and §"The durable half of B" — seven and six mutation edits
respectively, each reddening exactly its own arm). P3's mutation is the **missing-mount world**
(`SLICE-4`) rather than an edited source line. Nothing in this section is a substitute for a product
acceptance: P1–P5 are properties of the **binding and settlement**, which is what the contract says they
are (`04-SEAMS.md:69-73`).

### 3.1 OS negative controls (fresh, this HEAD)

Measured inside `ute-vnext-a1` (file `packages/runtime/test/vnext-os-probe.test.mjs`; leg definition
`dev/ci/eb3-ci-manifest.json` → `layers[4].legs[11]`, which sets `A5SF_REQUIRE_PINNED_HOST=1` and states
that "an OS enforcement claim is either measured with both controls or the leg is red"):

```
OS-1 measured landlock abiVersion=7
✔ OS-1 — the host answers the Landlock ABI the provider requires (32.884218ms)
✔ OS-2 — NEGATIVE CONTROL: a confined payload CANNOT read outside its allow set (3214.834264ms)
✔ OS-3 — POSITIVE CONTROL: the same payload CAN read inside its allow set (3194.526655ms)
```

The pair is load-bearing: a positive-only run would prove nothing about the boundary, and a
negative-only run would not distinguish "denied" from "broken". Both controls ran in this session's
`dispatch-tests --run --leg ute-vnext-a1` (§4). The OS probe needs `python3` and a Landlock-capable
kernel; both were present.

### 3.2 All live judges, actual verdicts (do not read the list as all-green)

| judge | rc.2 verdict (both boots) | rc.5 verdict (both boots) | recorded at |
| --- | --- | --- | --- |
| `d:member-read-admitted` | **PROVEN** | **PROVEN** | `D-BOOT-FEASIBILITY.md:369-395`; `dev/agent-workflow/evidence/d-boot-feasibility/runs/`; `dev/agent-workflow/evidence/ute-a1/rc5/run-boot.log` |
| `d:guard-facts` | **PROVEN** (2 allow facts: `stat`, `readText`; `memberIdentity=inst-0pe2z220bhfb`) | **PROVEN** (2 allow facts) | same |
| `d:centre-facts` | **PROVEN** (2 `fs.read` admissions `allow` + `DENY/LANE_DENY`, 2 execution facts) | **PROVEN** (same counters) | same |
| `d:native-read-surface` | **PROVEN** after the round-62 re-anchor (all six clauses; the `native-description` clause now reads the top-level field and `native-file-path-description` reads the parameter field) | **PROVEN** (same clauses) | `D-BOOT-FEASIBILITY.md:494-511` |
| `d:member-read-denied` | **PROVEN** after the round-71 rewrite (the clause measures the DECIDING CHANNEL: `LANE_DENY` with ZERO provider guard facts for that call, or `IO_READ_DENIED` with its own guard deny fact; zero secret bytes and not-ENOENT in both; plus a separate in-process `ADM-100` clause for the provider channel) | **PROVEN** after the rc.5 porting fix to the in-process world (batch `tools.execute` shape + `workingDirectory`/executor; assertions unchanged) | `FINDING-native-tool-provider.md` §"Round 71"; `dev/agent-workflow/evidence/d-boot-feasibility/runs/boot01/in-process-provider-channel.json` |
| `d2:multi-member-concurrency` | **PROVEN** | **PROVEN** | `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` |
| `d2:revocation` | **PROVEN** after the round-71 rewrite — (a) durable deny ⇒ `ADMISSION_OVERLAY_DENY`, zero body, settlement `REFUSED`, overlay named + policy generation; (b) deny removal ⇒ admitted + `COMPLETED`, a NEW fact; (c) in-lane control admitted at every phase; (d) widening beyond the compiled ceiling is a no-op proposal and the widened locator stays `LANE_DENY` | **PROVEN** (identical clauses; a/b admissions 9/9, guard facts 14/14) | `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md`; `FINDING-native-tool-provider.md` §"Round 71" |
| `d2:stop` | **PROVEN** | **PROVEN** (`stopSettlementState=REFUSED`) | `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` |
| `d3:persistent-subprocess` | **PROVEN (round 76)** — both boots, all clauses: `bash` on the Member surface, preset shell rows `["tool-bash","tool-bash-persistent"]`, first call admitted (`process.exec`, `allow`) writing durable state, second turn reusing the SAME shell and reading it back (`DBOOT_D3_PERSISTENT_SHELL_STATE`/`DBOOT_D3_STATE_READ`), both settlements `ADMITTED→RUNNING→COMPLETED`; the out-of-lane write is refused by the OS profile (`Read-only file system` in the shell, 0 bytes on disk from outside) while the in-lane 32-byte file is written. Round-75 history: the same judge was REFUTED with `ADMISSION_EXECUTION_UNAUTHORIZED` before the preset mounted the persistent row and the world declared the binding | **PROVEN** (identical clauses; both bash states `COMPLETED`) | `dev/agent-workflow/evidence/d-boot-feasibility/d3/runs/boot01/verdicts.json` + `confinement-probe.json`; `D-BOOT-FEASIBILITY.md` round-76 section |
| `d3:crash-cold-recovery` | **PROVEN** | **PROVEN** | `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` |
| `d3:work-delivery` | **PROVEN** | **PROVEN** (`collectStatus=succeeded`, `inflightAfter=UNKNOWN` by contract) | `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` |
| `d3:alpha6` | **PROVEN** (as the typed-refusal shape, now with its durable fact + settlement — round 68) | **PROVEN** (same typed refusal) | `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` |
| **`d:remote-creation`** | **PROVEN (round 74, new)** — unauthenticated refused (401) and mints NO Team; cross-team `TEAM_REMOTE_FOREIGN_TEAM`; legitimate runtime `team.create` 200 / `path:"fresh-root"`; duplicate mints no second root and adds 0 provider requests; `member.send` refused `ADMISSION_REMOTE_UNAVAILABLE` with 0 provider requests | **PROVEN** (identical observations) | `D-BOOT-FEASIBILITY.md` §17; `dev/agent-workflow/evidence/d-boot-feasibility/runs/boot01|boot02/remote-creation.json`; `round74-console.log` |

**rc.5 host column (round 78).** All twelve judges are `PROVEN` on 0.2.2-rc.5
with the same counted facts as rc.2 (two agreeing boots each). Three rc.5
drifts had to be ported to get there: (a) model selection must exist at Agent
creation (`AgentOptions` from the host's `agentDefaultModel`; rc.5's
`installModelSelection` no longer takes the rc.2 ref) — product fix in
`packages/runtime/src/plugin/host.ts` + `vnext/agent-bindings.mjs`; (b)
`{{cwd}}` is no longer a registered prompt variable, so the governed preset's
persona suffix now names "the session workspace" (`cordis.patch.yml`); (c) the
in-process ADM-100 world needs rc.5's `workingDirectory` service, executor and
batch `tools.execute` shape (`vnext-admission.test.mjs`; assertions unchanged).
Full side-by-side tables, the exact errors, and the deployment requirements are
in `RC5-ACCEPTANCE.md`; the rc.5 logs are kept under
`dev/agent-workflow/evidence/ute-a1/rc5/`.

**rc.5 limitations (not proven).** Only these three scripted drivers ran on
rc.5: the other 238-suite vitest population and the other node:test slices were
not executed on rc.5 (ADM-100 was re-run individually). The model is the
scripted mock; no real model, MCP server, PTY backend, Windows host or hosted
deployment was exercised. `d3` records `inflightAfter=UNKNOWN` by contract and
Alpha.6 routing is unavailable by design. The `{{cwd}}` removal changes the
persona text on both hosts (verdicts unchanged); that the runtime context still
states the same directory on rc.5 is assumed, not judged.

After round 76, `run-boot.mjs` (6/6 judges, incl. `d:remote-creation`), `run-boot-d2.mjs` (3/3) and
`run-boot-d3.mjs` (4/4, `evidence-complete=true allProven=true`) are `overall=PASS` on two agreeing
boots each, on rc.2 AND on rc.5 (round 78). A driver that exited 0 without a PROVEN judge would be the
finding; every PASS above is a measured clause set, not an exit code (`evidence-complete=true,
allProven` is per driver).

---

## 4. Required CI — gates and last measured output

All eight commands were run fresh at this HEAD in this worktree. Pasted verbatim.

### 4.1 `dispatch-tests --run --leg ute-vnext-a1`

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 194
ℹ pass 192
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
```

Round 68 adds three in-process arms (`ADM-116/117/118`), round 73 adds six settlement-Option-A arms
(`ADM-119`…`ADM-124`), and round 75 adds six process-execution-authority arms
(`ADM-125`…`ADM-130`); the two disclosed skips are unchanged (rung 5's positive control now exists in
`ADM-125`).

The **2 skips are disclosed and labelled**, never passes:

```
﹣ ADM-68 — BASH positive: NOT RUN in this world (no compiled execution authorization) — disclosed, never a pass
﹣ ADM-69 — RUN_CODE positive: NOT RUN (the PTC worker/nested/escalation/Stop proof does not exist) — disclosed, never a pass
VNEXT-B-LADDER rungs=read,write,grep,web_fetch,bash,run_code negatives=6/6 positives=4/6 blocked=bash,run_code reason=execution-authority-not-declared-in-this-world
```

### 4.2 `test-catalog --max-uncollected 41 --max-excluded 7`

```
$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
test-catalog (test-catalog/1) — discovery + the node:test predicate the dispatcher resolves legs against
  tests=785 instruments=3 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32
  DISCOVERED_AND_COLLECTED 733
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              38
  by runner: node=146 none=7 vitest=632
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
```

Note for the reviewer: `41` is the **ceiling**; the measured `UNCOLLECTED` is `38`, so the gate is green
with three units of headroom. New arms are added to an already-collected suite, so the catalog population
(785 files) is unchanged by round 73.

### 4.3 `ute-cut-closure --check`

```
$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0
```

### 4.4 `ute-p0-assets --check`

```
$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
```

### 4.5 `docs-sync --check`

```
$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
AUTHORITY_SOURCE_BINDING {"kind":"authority-pointer","pointer_file":"dev/engineering/current-authority.json","snapshot_file":"dev/engineering/authority-snapshots/as20261109r1.json","snapshot_version":"as20261109r1","content_digest":"sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3","pointer_digest_verified":true,"view_may_not_reverse_decide_authority":true}
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof
```

### 4.6 `place-dist-glue`

```
$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))
```

### 4.7 `eb3-ci-required`

```
$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0
```

### 4.8 `eb3-security-run --layer ci-integration --list-file …`

**The command as specified in the brief does not pass a real file**, and that is reported here rather than
silently swapped:

```
$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=REFUSED reason=suite list absent: tests/checks/ute-migrated-suites.txt
```

There is no `tests/checks/ute-migrated-suites.txt` in this tree; the population is declared in
`tests/checks/eb3-ute-migrated-suites.txt` (the `eb3-` prefix is in the committed filename, bound in
`20d5ee9b3`). With the file that exists, the leg is green:

```
$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

**The gate's refusal is itself a feature, not a wording problem:** the token runner refuses a list
shorter than its report, a listed-but-absent file, and an empty run
(`tests/checks/eb3-ute-migrated-suites.txt`, header comment). A typo in `--list-file` therefore cannot
grade green.

---

## 5. Host-modification authority

### 5.1 What was and was not done to the pinned host

The pinned host is `tests/deepseek-harness-test-use` (gitignored, its own git repo, detached). Check run
in this session:

```
$ git -C tests/deepseek-harness-test-use rev-parse HEAD
639ed015397290b3745d163aafe02ffee4aa3f84
$ git -C tests/deepseek-harness-test-use status --porcelain | wc -l
0
$ node -e "import('./tests/paths.mjs').then(m=>console.log(m.TEST_USE_BASELINE_SHA, m.DSH_BASELINE_VERSION))"
639ed015397290b3745d163aafe02ffee4aa3f84 0.2.0-rc.2
```

So: **pristine at the pinned SHA**, and the SHA equals `TEST_USE_BASELINE_SHA` from `tests/paths.mjs`
(version `0.2.0-rc.2`) — the single source of the pin, not a hard-coded copy.

What was **not** done, stated as facts rather than intentions:

- **No patch, no `git apply`, no `patch-package` / `pnpm patch` / postinstall rewrite, no vendored modified
  copy.** The host tree has **zero** porcelain entries before and after every boot; each D2/D3 evidence
  directory carries its own `host-tree-porcelain.txt`
  (`dev/agent-workflow/evidence/d-boot-feasibility/d2/`, `dev/agent-workflow/evidence/d-boot-feasibility/d3/`),
  and both READMEs record "porcelain empty before and after both boots".
- **No import of an upstream private/internal API.** The native-mount fix reaches upstream only through
  public seams: `compositionInventory()` and `readDocument()` on the `agentPresets` accessor
  (`FINDING-native-tool-provider.md:65-67`), and the host's own `mountHostModules` path.
- **No modification of the shared read-only baseline.** All code in this candidate lives under this
  repo's `packages/` and `scripts/`.

### 5.2 CORE PATCH BUDGET = 0 was honoured

`AGENTS.md` fixes the budget at zero and classes any path needing an upstream source patch as
`CORE_SEAM_BLOCKER`, not a TODO. Every gap found in D was therefore handled **without** a patch, in one
of three lawful shapes:

| gap | how it is carried | not a patch because |
| --- | --- | --- |
| subprocess / PTY / PTC | execution-authority decision + typed refusals; `CONTRACT-CHANGE-REQUEST-process-lane.md` is RESOLVED | the declaration source was ALWAYS there (`toolBindings[].authorization` + `execution`); round 75 fixed the carriage. What remains for subprocess/PTY is a COMPOSITION swap (persistent confined shell), not a contract question; PTC still lacks the worker/nested/escalation/Stop proof |
| search face and the durable overlay | shape B implemented in this repo (`overlay-decision.mjs`, `admission-port.mjs`), shape A left open in `CONTRACT-CHANGE-REQUEST-search-face.md` | the change is to this repo's plugin and its fact shape, not to the host |
| Alpha.6 review routing | typed refusal + two lawful shapes (`CAPABILITY-MATRIX-C.md:119-123`) | needs a compiled axis or an owner ruling; nothing upstream |
| runtime team creation on a centre row | **RESOLVED in round 74 by owner ruling** (`docs/reviews/20261122-1536.txt` §3) — S6 Remote restored as a governed management control plane, per-command refusal for agent execution; `ESCALATION-centre-row-creation-entrance.md` now RESOLVED | the change is inside this repo's plugin; the original was an owner decision and the owner ruled |
| admitted-then-refused settlement | **RESOLVED in round 73 by owner-approved Option A** — the settled contract now appends a durable recheck deny beside the allow and reaches `REFUSED`/`not-started` (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`; `ADM-119`…`ADM-124`) | the change is inside this repo's settlement store and plugin, not a host patch; the original escalation was an owner decision and the owner ruled |

### 5.3 No DSH upstream patch exists

To be explicit, because "we did not need one" and "we did not write one" are different claims: **there is
no upstream patch in this candidate to apply, and none was stashed.** The cut's closure gate proves the
positive side — `prodRefs=0` means no surviving production import of a retired entry, and
`distResiduals=0` means no dist mirror of a deleted source survives (§1.1/§4.3). The host tree's empty
porcelain (§5.1) proves the negative side at measurement time.

---

## 6. Limits and unproven claims (the honest list)

Assembled from `CAPABILITY-MATRIX-C.md`, `FINDING-native-tool-provider.md`, the three CCRs,
`ESCALATION-centre-row-creation-entrance.md`, and the D-BOOT-FEASIBILITY sections. Each item names what
would prove it.

### 6.1 No PRODUCT-PROVEN row

Every row is `MECHANISM` or `UNPROVEN`; **none** is PRODUCT-PROVEN (`CAPABILITY-MATRIX-C.md:71-74`). A row
moves only with a real host boot line at a named commit — and even the `DEV-LIVE` boots that exist are not
gates (`CAPABILITY-MATRIX-C.md:7`). *Would prove a row:* a gate-grade run (not a driver record) that boots
the product at a named commit and drives that row end to end.

### 6.2 Runtime team creation on a centre row — **RESOLVED (round 74)**

The round-59 measurement was `[boot1] team.create status=405 ok=false null`: the S6 plane was not built on
a centre-configured row, so the driver's only runtime creation entrance 404/405'd and D fell back to a
boot-created Team (shape 3). **Owner ruling** `docs/reviews/20261122-1536.txt` §3 rejected shapes 1/2/3 as
the product answer and restored S6 Remote as a **governed management control plane**:

- the plane is BUILT and INSTALLED on a centre row (`root.ts`; `host.ts` mounts the `installed` seam);
- `POST /team-remote/team.create` mints the Team at runtime through the existing
  `root.ts#createAndStartTeam()` (Principal + TeamDomain/Control + creation/start gates);
- every S6 command is classified by ACTUAL EFFECT in ONE closed table
  (`packages/runtime/src/plugin/s6-command-classification.ts`); only control-plane
  read/creation/management commands are served, while `agent-execution` commands are REFUSED before
  params/handlers with the existing `ADMISSION_REMOTE_UNAVAILABLE` on `team.control`, a durable
  invocation-authority fact and a `REFUSED`/`not-started` settlement;
- **no new admission axis**, no change to `admission.ts`, and no member admission on the management route.

Measured live (round 74, two agreeing boots): unauthenticated `team.create` → **401, no Team minted**;
foreign TeamSession → **`TEAM_REMOTE_FOREIGN_TEAM`**; legitimate create → **200, `path:"fresh-root"`**
with the durable TeamSession + leader row; duplicate create → **no second root, 0 provider requests**;
`member.send` → **`ADMISSION_REMOTE_UNAVAILABLE`, 0 provider requests**. See §3.2 and
`D-BOOT-FEASIBILITY.md` §17.

**Limit, stated rather than hidden:** the principal is a **per-DSH_HOME authenticated operator**
(Connection Gate), **not** multi-user RBAC, and no user-level identity isolation is claimed. The created
Team's Member runs with its OWN compiled Binding and its OWN centre ledger — the management request never
carries a member Binding.

### 6.3 Process execution: authority is declarable, and the live persistent shell is PROVEN (round 76)
Round 75 replaced the path-lane question with an EXECUTION-authority question (owner ruling
`docs/reviews/20261122-1536.txt` §1; full fitness check in
`CONTRACT-CHANGE-REQUEST-process-lane.md`, now RESOLVED).

- `bash` / `pwsh` → decided by `toolBindings[].authorization` + `execution.executionBoundary` and the
  composition's executor readiness (`admission.ts:409-452`). Absent declaration →
  `ADMISSION_EXECUTION_UNAUTHORIZED`; `deny` → `ADMISSION_EXECUTION_DENIED`; a declared boundary with
  no ready executor → `ADMISSION_EXECUTOR_UNAVAILABLE`; `ask` → the existing Control approval.
  `Binding.process` and `io.process` do not exist. Arms `ADM-125`…`ADM-130`; the B ladder's rung-5
  negative is `ADMISSION_EXECUTION_UNAUTHORIZED` (`ADM-75`).
- `run_code` (PTC) → its **own** `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:405-407`, `ADM-87/88`);
  the missing proof is its WORKER process, its NESTED tool calls, its escalation path and its Stop all
  passing this same centre — the refusal text names all four.
- The v4 member ceiling is still a **closed** io shape `{read, write, network}`
  (`packages/domain/blueprint/src/blueprint-v4.ts:187-197`); feeding `io.process` live still yields
  `unknown-field`. That is correct: process authority is a TOOL-level execution declaration, not a
  fourth lane.
- **ROUND 76 — THE SWAP WAS MADE AND THE LIVE ARM IS PROVEN.** The shipped governed preset now carries
  the HOST's `@deepseek-ai/dsh-tool-bash-persistent` as a TOP-LEVEL row
  (`cordis.patch.yml:363-368`, `config.backendType: a5sf-governed-shell`) BESIDE the one-shot
  `tool-bash`, which stays as the surface baseline the lane replaces. The D3 main blueprint declares
  `toolBindings[]` for `bash` (`run-boot-d3.mjs:309-321`: `authorization: allow`,
  `executionBoundary: confined-subprocess`, `implementationOrigin: dsh-native`, io lanes `all` + empty
  deny). `run-boot-d3.mjs --boots 2` (DEV-LIVE, two agreeing boots, 2026-11-22T12:17-12:23Z) answers
  `allProven=true` (2/2) with all four judges PROVEN: the first `bash` call is admitted
  (`process.exec`, `allow`), writes durable shell state, is `ADMITTED→RUNNING→COMPLETED`, and a SECOND
  turn reuses the SAME shell and reads that state back (`DBOOT_D3_PERSISTENT_SHELL_STATE` →
  `DBOOT_D3_STATE_READ`). Confinement is real at the kernel level with both controls: the in-lane state
  file is written (32 bytes) while the out-of-lane write is refused by the OS profile — the shell
  itself reports `Read-only file system`, and the driver, reading from OUTSIDE the sandbox, finds no
  file (0 bytes) at the out-of-lane path. The PTY spawn is wrapped by the HOST `sandbox` provider
  (`terminal-bash` → `sandbox.confine`), whose Linux chain prefers bubblewrap (verified usable:
  0.11.1) and falls back to the Landlock launcher.
- **DEPLOYMENT REQUIREMENT (measured).** The persistent row injects `terminals`, and a preset with a
  pending row refuses to bind (`agent-preset/invalid … waiting for terminals`, then
  `TEAM_RUNTIME_DURABLE_WRITE_FAILED` at member creation — measured in D3 and reproduced in D1/D2
  before their worlds composed the service). Every governed deployment must compose
  `@deepseek-ai/dsh-terminal` on an ancestor scope. The test worlds add the HOST's module with NO
  backend: inert and fail-closed (`NO_BACKEND`, zero processes); the Member's live `bash` is the realm
  mount of the same module on the governed face.
- **SURFACE CHANGE (deliberate, disclosed).** The model-visible `bash` is now the persistent definition:
  `{command}` ONLY — `description`/`workdir`/`timeoutMs` are gone (`ADM-132`). Every assertion that
  spoke the old surface was moved: the D3 scripted model, the preset persona, and the new arms. A
  second-turn `cd`/`export` is durable; the surface no longer accepts a per-call `workdir`.
- **THREE RUNTIME DEFECTS FIXED BY MAKING THE PATH REAL** (no core patch): the projection refused a
  `confined-subprocess` restriction although the answer had a confined process face
  (`product-assembly.ts`); the compiled answer stored for admission DROPPED the mounted faces, so
  readiness said `unavailable` for a realm that had mounted the face (`a5sf-realm-row.mjs`); and a
  process-class binding claimed `bash` for an `fs`-only IO realm, breaking shape A's untargeted mount
  (`mount.ts`). Arms `ADM-131`…`ADM-134` + the B-ladder face arm pin all three.
- B's rung-5/6 **positive controls are NOT RUN in the ladder world** (`ADM-68/69`, the 2 disclosed
  skips). Rung 5's positive control now EXISTS elsewhere (`ADM-125` + the round-76 live D3 judge);
  rung 6's does not exist at all this round.

*What is still NOT proven:* DEV-LIVE is not a gate; no real-model interleaving; the `ask`/`deny` arms
are in-process only; no Windows deployment (the persistent row is disabled on win32); the durable shell
state is shell-local across two turns, not a tmux/Processo env proof.

### 6.4 The search face is lane-only governance

Shape B is implemented and measured live (round 64): the durable overlay has **no opinion** on a face
outside its closed vocabulary, so an in-lane `grep` is admitted and runs
(`decision=allow`, `overlayOutcome=no-opinion`, execution fact `completed`, a real match at
`team-b/corpus/huge-7.txt`), while an out-of-lane `grep` is `LANE_DENY`. The **residual** is the point:
**a durable overlay rule cannot deny `grep`/`glob` (or `web_fetch`, …)** — those faces are outside the
vocabulary, so the lane ceiling is their entire governance. The centre also judges the **search root** the
call names, not every file a scan opens (`CAPABILITY-MATRIX-C.md:295-299`;
`CONTRACT-CHANGE-REQUEST-search-face.md`). *Would prove it:* shape A — a search face with a subtree
resource in the closed vocabulary, plus a durable deny that reaches it.

### 6.5 Alpha.6 is unreachable at a host entry; its refusal is now recorded there, its routed path is still unproven

Two independent gates refuse the opt-in **on every row** (`centre-config.ts:73`, `root.ts:2496-2510`),
so there is **no product-config path on which Alpha.6 is reachable at all** — stronger than "a
centre-configured row is refused" (`ADM-99`). The machinery behind it is measured **in-process, composed
directly** (`ADM-98`: real router takes a `recipient` decision; real `dispatchLatch` +
`createFileWakeIntentDirectory` persist a row a fresh reader sees). **Round 68 closed the recorded-fact
gap at the host entry:** `host.ts` runs `createAlpha6RowRefusalHook` (`vnext/row-refusal-entry.ts`) at the
config rule, before the unchanged typed throw, and that hook builds the product's own
`createHostSurfaceRefusalPoint` through `createCentreHostSurfacePoint` (shared with `root.ts`) and writes
the invocation-authority fact + `REFUSED`/`not-started` settlement under the row's `centreStatePath`.
Measured live in both D3 boots (`refusalFactCount=1`, `refusalSettlement.state=REFUSED`), with the row
still refused and no team row live. `d3:alpha6` is PROVEN **as the typed-refusal shape WITH its record**.
*Would prove the routed path:* a compiled review-routing axis (or the record-only ruling), and a boot
whose gate admits the opt-in. Remaining limit: a row with no `centreStatePath` is refused but unwritten
(there is no durable directory to write to), and no boot reaches a routed decision.

### 6.6 The overlay cannot widen authority — by design, and now measured in both directions

`overlay-decision.mjs:9` (deny-only), `admission-port.mjs:498-521` (consulted only when the compiled lane
allows; the only verdict is `ADMISSION_OVERLAY_DENY`), `permission-mutation.ts:435-436` (a revoke removes
restrictions and "never needs expansion authority"). Measured live through the ONE durable
`permissionOverlay` lane: pre-read admitted → `team_grant_permission` exact `read` deny (`changed:true`) →
same read `ADMISSION_OVERLAY_DENY`, zero body, settlement `REFUSED`, the fact naming the overlay
(`overlayOutcome=deny`, `laneDecision=allow`) and carrying the compiled `policyGeneration` →
`team_revoke_permission` (`changed:true`) → same read **admitted again** and `COMPLETED` as a NEW fact;
the untouched in-lane read is admitted at every phase.

Round 71 replaced the old REQUIRED clause — which had demanded that the overlay WIDEN (revoke the deny ⇒
the previously succeeded call must be refused with a new compiled generation) — with the contract's own
terms, strictly. It also MEASURED the widening direction: the same lane was asked for an `allow` on a
locator outside the member's compiled lane and answered
`{"status":"permission-mutated", …, "changed":false, "reason":"mutation-proposal-pending"}` (a durable
proposal, not a minted authority), and the widened locator stayed `LANE_DENY` with zero foreign bytes.
`centre-install.mjs:94` fixes the fact's `policyGeneration` to the COMPILED revision at bind, which is
what (a) and (b) now assert it carries.
**D's "permission revocation" acceptance is stated in the contract's own terms:** revocation of access =
a durable deny (refused with zero body), restoration = removing that deny, widening beyond the compiled
ceiling = refused. `d2:revocation` is **PROVEN** on both boots
(`dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md`;
`FINDING-native-tool-provider.md` §"Round 71").

### 6.7 The model is a scripted mock, not a real model

Every D record uses the product's **scripted mock model** over `dsh web` (D-BOOT-FEASIBILITY:59 `dsh web,
mock model, p6t6 directive`). Each round's "what this does NOT prove" names "a real-model interleaving
(scripted mock)" (`D-BOOT-FEASIBILITY.md:529`, `:678`, `:776`). So no claim here covers model-driven
choice, retries, or adversarial tool selection. *Would prove it:* the same judges with a real model, and
the interleaving recorded rather than scripted.

### 6.8 In-process vs live — the distinction, everywhere it matters

- `MECHANISM` arms run **in-process**. The named stand-ins decide nothing: the agent-context double, the
  member's live-agent handle (`dispose()` running the registered disposers), the child-session factory,
  and the work-delivery port (`CAPABILITY-MATRIX-C.md:54-59`, `:105-106`). The compiled member answer is an
  **input** (a ceiling), not a decision — so **policy COMPILATION is not exercised** anywhere
  (`CAPABILITY-MATRIX-C.md:67`, `:128`).
- `DEV-LIVE` boots are real host processes but **not gates**, and `overall=FAIL` for both drivers.
- Consequences that only exist in one class are stated per item: the archived member's **product route**
  refuses earlier at the durable lifecycle gate, so `ADM-93` proves the centre's own tombstone, not the
  product's refusal order (`CAPABILITY-MATRIX-C.md:61-64`); `IO_READ_DENIED` is unreachable on the live
  path by design and is proven **in-process** (`ADM-100`).

### 6.9 A realm-less member that asked for the centre is refused; one that never asked stays outside it

The centre is installed only inside `if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined)`
(`agent-bindings.mjs:1942-1948`). **Correction (round 67):** an earlier draft of this section said a
member with `centreStatePath` but no realm "runs unmediated and unreported". That was wrong and is
corrected here, not softened: `memberCentreUnwiredViolation` (`centre-config.ts:36-49`, called at
`agent-bindings.mjs:1942-1944`) **refuses** exactly that member with `MEMBER_CENTRE_UNWIRED` (`ADM-44`),
so it never runs a call. What remains outside the centre is the row that **never asked**
(`centreStatePath` unset): it keeps the host's own mediation with no admission, no ledger and no
settlement — unchanged behaviour by design, not a governance claim (and, per §2.3, the deleted
`confined-*` shadows were mounted by the realm row, so such a row was never confined by them either).
The open question is therefore not exposure of an asked-for member but whether a realm-less member
should be *admitted* against the same compiled ceiling with an explicitly unconfined provider (option A
of `ESCALATION-realmless-admission.md`, whose "What the code says" snippet predates the round-35
refusal). *Would prove it:* that ruling, then a test in both directions.

### 6.10 "Admitted, then refused before the body" is now settled by an appended deny decision — but only in process

The old limit — `REFUSED` was `SETTLEMENT_ADMISSION_MISMATCH` against a cited `allow`, `CANCELLED` needed
a Stop, and `UNKNOWN` asserted an unobserved effect for a body that provably never ran — was **closed in
round 73** by owner-approved Option A (`docs/reviews/20261122-1536.txt` §2;
`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`, RESOLVED). The recheck now appends a durable deny
decision for the same executionId (its own `policyGeneration`, the product's existing
`ADMISSION_RECHECK_*` code) beside the untouched allow, and the settlement reaches
`REFUSED`/`dispatch=not-started` citing it as `terminalDecision`. Without that durable deny the old
`SETTLEMENT_ADMISSION_MISMATCH` / `SETTLEMENT_CONTRACT_GAP` path is unchanged (negative 1); a call that
reached `RUNNING` cannot be back-filled (negative 2); a Stop remains `CANCELLED` (negative 3); the crash
window recovers `REFUSED` without replay; and a failed deny write keeps the refusal and surfaces the gap.
Arms `ADM-119`…`ADM-124` over the real store + real port + real ledger.

*Still not proven:* the arms are **in-process mechanism** evidence. No live `D` judge boots a host
through the recheck path in this round, so no row moves to PRODUCT-PROVEN (§6.1); the rule against
inventing a Stop for a refusal is unchanged.

### 6.11 `host.service` capabilities' I/O is outside the member's fs ceiling

Goal/Todo, Team Skill and Subagent are bound and recorded on `host.service`, but a skill file read by the
host skill service is **outside** the member's fs ceiling (`CAPABILITY-MATRIX-C.md:76-87`;
`admission.ts:100-108`). This is a **limit, not a confinement claim**, and it is repeated in C15 of §2.

### 6.12 The centre is not mount-aware

Its binding is installed at the member bind (`agent-bindings.mjs:2006` installs the member centre) while
`mcpMountTarget` is computed later per boundary (`agent-bindings.mjs:2241`), and `admission.ts:78-120` has no
mount input. A
**well-formed** name for a never-mounted server is therefore decided on the network axis alone; the
product excludes such a call at the **tool registry**, not at admission (`ADM-97` step 5). *Would prove
it:* an admission-time mount input, i.e. a contract change.

### 6.13 `d:member-read-denied` — the two channels, each measured at its own layer (round 71)

The live path's contract is: the centre decides **before** execution, so an out-of-lane call is refused
on the LANE channel (`LANE_DENY`) and never reaches the provider. The old clause required the provider's
`IO_READ_DENIED` on that path, which asked the product to run the provider before the centre — the wrong
order for a governance system — so it was an instrument defect about the judge, not a product gap.

The rewritten judge measures the deciding channel, strictly:

- the durable fact's `refusalCode` is `LANE_DENY` or `IO_READ_DENIED`, and the tool result names it;
- **lane channel**: the result carries `LANE_DENY` AND **zero provider guard facts exist for that exact
  call id** — the refusal genuinely preceded the provider;
- **provider channel** (the alternative): the result carries `IO_READ_DENIED` AND the provider guard
  recorded its own `deny` fact (`decidedBy=IO_READ_DENIED`) for that call;
- zero secret bytes and not-ENOENT are required on BOTH channels.

The provider channel is additionally evidenced in its own in-process population: a separate clause runs
`node --test --test-name-pattern ADM-100 packages/runtime/test/vnext-admission.test.mjs` in the boot and
requires the pass **and** the presence of that test's provider-deny assertion (a deleted assertion fails
the clause). Raw result: `runs/boot01/in-process-provider-channel.json`.

Measured live (two agreeing boots): `refusalCode=LANE_DENY`, `channel=lane`, `provider guard facts for
this call=0`, zero secret bytes, not-ENOENT, and ADM-100 green in process. The judge is **PROVEN**
(`D-BOOT-FEASIBILITY.md` §14; `FINDING-native-tool-provider.md` §"Round 71"). The two channels are both
evidenced; neither is conflated with the other.

### 6.14 Other measured-or-missing coverage

- **No Stop under load, no revocation under load, no multi-agent load beyond two Members.** `d2:stop` is a
  timing race by nature; it reproduced in both boots, but two agreeing boots is not load.
- **No real Stop keypress** (the public RPC was used).
- **`userQuestions` and terminals** are covered only by the PTY-owner refusal (`SLICE-33`), not by a
  positive.
- **C11 (state projections)** now has its Team-owned half measured (`ADM-107`…`ADM-109`, round 66): the
  projection is preserved in the new assembly and derives only from durable TeamDomain facts. What it still
  lacks is a **live boot** reading the HOST's `sessionProjections.stateOf` for a Member's todo/goal state —
  the host service, not the Team's (`§2` C11 row).
- **`test-catalog` is close to its ceiling** (`UNCOLLECTED=38` against a 41 ceiling), so the collected
  population has three units of headroom.
- **The measured Team is runtime-created** (round 74), removing the boot-bound concession (§6.2). The
  model is still the product's scripted mock.

### 6.15 The rc.5 FS additions were unconfined — **CLOSED (round 77)**, and what it does not prove

**The limitation, stated as it stood.** This report's C13 row is measured on DSH **0.2.0-rc.2**
(`vnext-fs-slice.test.mjs`, `ADM-100`…`ADM-102`) while A0 targets **0.2.2-rc.5**. rc.5's `FileSystem`
adds three methods — `patchText`, `deleteFile`, `moveFile` — and the Team confined provider overrode
ten methods ending at `editText`, so on rc.5 `apply_patch`, delete and move reached the base provider
**without the Member's lane**. The invariant that keeps this visible (SLICE-35) was RED on rc.5 and
named seven un-overridden names (`RC5-MIGRATION.md` §6). Until round 77 no "FS confinement holds on
rc.5" claim could be made for those three operations.

**What is now closed (round 77).**
- The three overrides exist in the SAME shape as the ten (`packages/runtime/team-services/src/fs.ts`):
  `patchText` like `editText`, `deleteFile` like a write, and `moveFile` judging BOTH paths (source as
  a removal of an existing file, destination as a write + read-if-existing) before either effect. An
  out-of-lane destination refuses with `IO_WRITE_DENIED` and the source is not removed.
- rc.2 compatibility is preserved by construction: the three are extra methods on a separate surface,
  reached through ONE local, commented cast; a base that implements none of them refuses TYPED with
  `IO_POLICY_UNSUPPORTED` (never a `TypeError`, never a fallthrough). `MANAGED_FS_METHODS` was not
  grown, so an rc.2 install is still accepted and the capability decision is per call.
- SLICE-35 is GREEN on **both** lanes, and the green is falsifiable (renaming the `patchText`
  override turns it red naming that method). SLICE-36 keeps its exact assertion with a fixture that
  adds three names the product does not cover.
- Six new arms `ADM-135`…`ADM-140` ride the `ute-vnext-a1` leg: in-lane reaches the provider exactly
  once with the same path(s); out-of-lane is a typed refusal with zero provider calls (for a move,
  the source survives); the cross-root case follows the product's per-path rule; an old backend is a
  typed refusal; and the REAL pinned provider performs the three on rc.5 while refusing them typed on
  rc.2.
- Leg population grew 182 → **204** (202 pass, 2 disclosed skips, exit 0); vitest stays **238**.

**What it does NOT prove (so this is not read as more than it is).**
- **In-process, not a boot.** The provider is mounted through Cordis in the test process; `ADM-140`
  uses the real pinned `LocalFileSystem` and the real lane guard, but there is no host boot, no model
  turn and no live `apply_patch`/delete/move through a Member.
- **No kernel boundary.** The lane is a guard in trusted code over a model-controlled path; the base
  provider's own TOCTOU between canonicalization and the syscall is inherited, not closed.
- **rc.5 semantics only partly exercised.** `moveFile`'s publish-then-remove shape, its
  `sourceDeleted:false` outcome and its version guards were read from the host source; the arms
  exercise the unconditional case (no hunks, no version guards).
- **The rc.5 lane still has pre-existing reds** unrelated to this round, measured against the
  reverted tree: `vnext-b-probe-ladder.test.mjs` hangs on rc.5 (so the leg cannot run as one
  invocation there), and `ADM-96/97` (`signals[0] is not of type AbortSignal`) and
  `ADM-100/101/102` (preset native-module default mount) fail. They are recorded, not bent.
- **No matrix upgrade.** C-fs stays MECHANISM: rc.5 greens are lane evidence, and a PRODUCT-PROVEN
  row would require a booted measurement.

---

## 7. Verdict

**What a reviewer may conclude.**

1. **The candidate implements A1 + B + C.** The A1 cut is closed by measurement, not by prose: 148 sources
   gone, `prodRefs=0`, `distResiduals=0`, `dupNames=0`, 28 byte-identical dist placements, and the 37/180/
   69,512-line frozen census unchanged (§1.1–§1.2). B and C are carried by `ADM-1…ADM-124` in the
   `ute-vnext-a1` node leg (**186 pass, 0 fail, 2 disclosed skips**) and by the 15 migrated capability
   suites (**238/238**, `verdict=PASS`) (§4). C14b's six invariant arms are part of that count, as are
   round 68's three entry-ordering arms and round 73's six settlement-Option-A arms (`ADM-119`…`ADM-124`).
2. **There is live D evidence for the listed items.** **Every live judge is PROVEN** at two agreeing
   boots each: thirteen at round 74, and round 76 adds `d3:persistent-subprocess` — `d:remote-creation`,
   `d:member-read-admitted`, `d:guard-facts`, `d:centre-facts`, `d:native-read-surface`
   (repaired, not deleted), `d:member-read-denied` (round 71: channel-typed, provider guard facts
   required to be ABSENT on the lane channel), `d2:multi-member-concurrency`, `d2:revocation` (round 71:
   the four contract directions, widening measured and refused), `d2:stop`,
   `d3:persistent-subprocess` (round 76: a persistent, OS-confined shell across two turns),
   `d3:crash-cold-recovery`, `d3:work-delivery`, `d3:alpha6` (as the typed-refusal shape). The P1–P5 obligations each have a green
   assertion, a negative control, and a live carrier (§3).
3. **It is NOT a completed product acceptance**, and the refuted items are named rather than rounded up:
   - **`d3:persistent-subprocess` is no longer refuted (round 76).** The governed preset mounts the
     persistent shell beside the one-shot baseline, the world declares the execution authorization, and
     two agreeing DEV-LIVE boots PROVE the first call admitted + durable state + a second turn reusing
     the same shell, with the out-of-lane write refused by the OS profile (§6.3). It is DEV-LIVE, not a
     gate; the `ask`/`deny` arms remain in-process. B's `bash`/`run_code` positives are still **NOT
     RUN** in the ladder world (§6.3).
   - **Runtime team creation is RESOLVED, not a gap** (round 74): the governed management plane is live
     and `d:remote-creation` is PROVEN on two boots (§6.2). The remaining limit is scope, not existence:
     per-DSH_HOME operator, not RBAC. This moves no C row to PRODUCT-PROVEN (the model is still a mock).
   - **Alpha.6 is unreachable at a host entry**, and its routed path is unproven there (§6.5).
   - **The search face is lane-only governance** — a durable overlay rule cannot deny it (§6.4).
   - **No row is PRODUCT-PROVEN**, and the model is a **scripted mock** (§6.1, §6.7).
   - **C11 (state projections)** has mechanism arms for its Team-owned projection (`ADM-107`…`ADM-109`,
     round 66), but its host `sessionProjections.stateOf` half is unproven and needs a live boot (§2.2).
   - **C14b** is preserved with its own positive+negative arms (`ADM-110`…`ADM-115`, round 67), but it is
     still **not PRODUCT-PROVEN**: the arms are in-process, the OS probe is a node-leg measurement, and
     the ungoverned (never-asked) row remains outside the centre by design (§2.3, §6.9).
   - **The two round-71 judges are PROVEN as instruments, not as new product capability.** The provider
     channel remains unreachable on the LIVE path by design (its proof is in-process, `ADM-100`), and
     widening beyond the compiled ceiling remains impossible by design (§6.6, §6.13). A reviewer must
     not read "PROVEN" there as "the overlay can widen" or "the live path reaches the provider".
   - **The round-73 settlement Option A is a MECHANISM result.** `ADM-119`…`ADM-124` prove the appended
     deny, the two negatives, the crash window and the fail-closed write in process; no live `D` judge
     boots a host through the recheck path, so no row moves to PRODUCT-PROVEN (§6.10).
4. **Therefore:** the honest description is *"A1+B+C implemented and measured, with D live evidence for
   the named, listed items — **not** a completed product acceptance."* The centre behaves as an A1 cut
   should: an unwired controlled call is **refused with a typed code**, not forwarded. That is a
   governance result, not a product-acceptance result, and the two must not be merged in any report,
   release note, or review summary.

**What would change this verdict** (in order): the composition swap to a persistent confined shell
(plus its `toolBindings[]` declaration) and a re-run of the live D3 driver, a ruling/wiring for
Alpha.6's review-routing axis, a real-model interleaving, and then a
gate-grade product acceptance run that boots at a named commit and drives each C row end to end. (The settlement-recheck ruling was given and implemented
in round 73; it removed a red cell, not the product-acceptance gap.)

**Nothing in this report authorises a merge, a release, or a deployment.** `master` is untouched by this
branch; the candidate must not auto-merge (`PR-BODY-draft.md` §"What this candidate is" and §"Not done
here").

---

## 8. Readiness checklist (for the reviewer)

A box a reviewer can tick against this HEAD. Every line names the check and where its measurement is.

| # | check | state | where to verify |
| --- | --- | --- | --- |
| 1 | **Branch and base** | `vnext/a1-cut`, measurement commit `189d6cabca5b4de9ec3059f9949ab9302364f789` (+ this docs-only audit's commits), base `a19d1df01` (frozen A0, PR #821, `master`) | `git rev-parse HEAD`; §1 |
| 2 | **No auto-merge** | PR #822 is **draft**, base **`master`**, state **OPEN**; the engine may sync the body but must never mark it ready or merge it. **Merging is the OWNER's act** — not the engine's, not this branch's | `gh pr view 822 --json isDraft,baseRefName,state` → `{"baseRefName":"master","isDraft":true,"state":"OPEN"}` |
| 3 | **Gates green** | all eight required commands pass at this HEAD (dispatch 188/186/0/2; catalog 785/38; closure four zeros; assets 37/180/69,512; docs-sync 0 findings; 28 placements; CI-required 10/0; migrated layer 238/238) | §4.1–§4.8, pasted verbatim |
| 4 | **Refuted / unreachable items listed** | `d3:persistent-subprocess` (round 76: PROVEN in two agreeing DEV-LIVE boots — a persistent OS-confined shell across two turns; its `ask`/`deny` arms and a gated status remain unproven), Alpha.6 routed path unreachable, search face lane-only, provider channel unreachable on the LIVE path (in-process only), widening beyond the ceiling impossible by design. **Runtime creation is no longer on this list** (round 74 RESOLVED, `d:remote-creation` PROVEN) | §3.2, §6.2–§6.5, §6.6, §6.13, §7 |
| 5 | **Owner decisions listed** | six, each with what is measured, the lawful options and their cost | `OWNER-DECISIONS.md` |
| 6 | **Host untouched** | pinned host `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain empty; CORE PATCH BUDGET = 0 with no upstream patch | §5.1–§5.3 |
| 7 | **No PRODUCT-PROVEN row** | by design at this stage: `DEV-LIVE` boots are not gates | §2.1, §6.1 |

**Plain statement.** This candidate is reviewable now and mergeable **only by the owner**. Nothing here
is a release, a deployment, a version bump, or a claim that the product is accepted.
