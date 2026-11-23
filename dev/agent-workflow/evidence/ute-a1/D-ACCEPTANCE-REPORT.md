# D acceptance report — UTE vNext A1 cut + centre (candidate)

**Worktree:** `.worktrees/vnext-a1-cut` · **Branch:** `vnext/a1-cut` ·
**HEAD measured for every number below (round 89):**
`97d7d7c8d1bb0410dac9dedac77dee97143851bf` · **Base for the cut:** `a19d1df01` (frozen A0, PR #821) ·
**Record class of everything below:** in-process `MECHANISM` + `DEV-LIVE`. Never candidate evidence,
never a gate.

> **Round 89 documentation-integrity round — read this block with `CANDIDATE-AUDIT.md`.** The round-86
> audit measured at `c29da52d3`; rounds 87 (the D4 live probe) and 88 (the BL-30 boundary measurement)
> then landed **5 commits** of NEW measured facts (`git rev-list --count c29da52d3..HEAD` = **5**). This
> revision re-measured every number the report and the PR body assert — scope counts, entry-file line
> counts, all ten local gates, the bound vitest/migrated/UTE-G1 legs, and the hosted verdicts — and folds
> in the two new in-repo seams. What changed materially: (a) the scope block (§1) is re-measured at this
> HEAD; (b) **`d4:routed-wake` is REFUTED on a live boot** and the two Team-side seams behind it are now
> named with `file:line` evidence (§6.5, new **§10**); (c) the live consequence of BL-30 — *a Member can
> ASK, be GRANTED, and still not run the granted call in production* — is stated in the C5/C6/C7 rows
> (§2.2) and **§10**; (d) **hosted `ci-integration` is FAILURE at this HEAD** (leg `tinf-instruments`;
> `EB3-REQUIRED fail layers=6 green=4 nongreen=ci-integration:failure,ci-census:skipped`), so the old
> "six layer jobs green" claim no longer holds. The hosted red is NOT reproduced by the same leg locally
> (§9.4) and is carried as an open item in §10, not papered over. Nothing is upgraded anywhere; the
> corrections total **19** (worst five listed in §11).

This is the single reviewable document for the candidate. It is written to be audited line by line:
every product claim carries a `file:line` or an evidence path, and every row that is not proven says
what would prove it.

> **Read this first, it is the conclusion.** The candidate implements **A1 + B + C** and carries **live
> D evidence** for the items listed in §3. It is **not a completed product acceptance**. **Round 76
> closed the last REFUTED D-driver judge**: `d3:persistent-subprocess` is **PROVEN** in two agreeing
> DEV-LIVE boots (a persistent, OS-confined shell across two turns, with the in-lane write succeeding and
> the out-of-lane write refused by the kernel). **Round 87 then REFUTED one D4 probe judge**
> (`d4:routed-wake`) — a blocker measurement, not a driver acceptance — because the product's own durable
> ask carries no Alpha.6 case (§6.5/§10 G1). Several product-entry gaps remain unreachable, and **no
> capability row is PRODUCT-PROVEN** (`CAPABILITY-MATRIX-C.md:71-74`) because a DEV-LIVE boot is not a
> gate. §6 lists the remaining limits; **§10 is the complete open-gap register**; §7 states the verdict
> without rounding up.

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

Round 70 measured the table below; **round 89 re-measured every row at `97d7d7c8d`** (the round-86
values are superseded: the branch grew from 205 to 210 commits and from 3,377 to 3,476 file paths, all
of it the rounds 87–88 product, test and evidence work). Citation convention: a path
containing `/` is repo-root-relative; a bare filename in a row or section is shorthand for the full path
named in that same row/section (the reviewable set uses this to keep the tables readable).

| fact | value | how measured |
| --- | --- | --- |
| HEAD sha (measurement commit) | `97d7d7c8d1bb0410dac9dedac77dee97143851bf` | `git rev-parse HEAD` |
| branch | `vnext/a1-cut` | `git rev-parse --abbrev-ref HEAD` |
| commits since A0 `a19d1df01` | **210** | `git rev-list --count a19d1df01..HEAD` |
| working tree at measurement start | clean | `git status --porcelain` (empty) |
| diff vs A0 | **3,476** files changed, **+249,967 / −160,719** | `git diff --shortstat a19d1df01..HEAD` |
| file-status counts vs A0 | **2,646 A · 616 D · 211 M · 2 R094 · 1 R095** | `git diff --name-status a19d1df01..HEAD \| awk '{print $1}' \| sort \| uniq -c` (git warns that exhaustive rename detection was skipped; the rename counts are a lower bound) |
| entry files | `agent-bindings.mjs` **4,302** lines (round 90: was 4,967; four cohesive spans moved VERBATIM into the sibling modules listed in §6.16) · `root.ts` **5,239** lines (unchanged) | `wc -l` on `packages/runtime/src/plugin/vnext/{agent-bindings.mjs,root.ts,governed-preset-modules.mjs,mcp-witness-lane.mjs,root-delivery.mjs,stop-drain-lane.mjs}` |
| `master` containment | `git merge-base --is-ancestor HEAD origin/master` → **false** | `origin/master` = `a19d1df01`, the A0 PR #821 |

### 1.1 Cut closure (fresh runs, this HEAD, pasted verbatim)

```
$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
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
place-dist-glue: done (34 placement(s))
```

**34** byte-identical `.mjs`/`.py` placements — round 90 added the four decomposition modules
(`scripts/dist-placements/260-ute-a1-decomposition.json`; 30 → 34). Every line at the run reads
`(byte-identical)`; the
`artifacts-at-head` leg independently reports 1,941 files and 30 glue placements). This is a *different measurement* from the frozen A0 figure: A0 counted **52 committed dist artifacts**, and the
closure gate cannot see the aggregated `packages/runtime/dist/packages/<other-pkg>/…` mirrors or `.mjs`
byte-copies — `CUT-BOUNDARY-ADDITIONS.md:27-32` explains the mapping. The two numbers are not comparable
and neither is quoted here as the other. (The `artifacts-at-head` "30 glue placements" figure in this
sentence is that leg's own class count at the round-89 head and was not re-measured this round; the
authoritative placement number is the `place-dist-glue` line above.)

### 1.3 A0 frozen numbers (for comparison)

| measure | A0 frozen (`a19d1df01`) | this HEAD | source |
| --- | --- | --- | --- |
| modules / files / lines | 37 / 180 / 69,512 | unchanged (37 / 180 / 69,512) | `docs/plans/memo/ute-p0-20261121/01-ASSET-INVENTORY.md:8` |
| files deleted | 146 (wave 1 = 146, wave 2 = 0) | 146 deleted + 2 replaced = 148 sources gone | same; `ute-p0-assets` line above |
| entries replaced | 2 (`agent-bindings.mjs`, `root.ts`) | 2 (both replaced wholesale) | same |
| files kept | 32 | 32 | same |
| dist artifacts | 52 committed (A0 accounting) | 52 A0-accounted + **151 additional** stale mirrors deleted by the boundary completion = 203; `place-dist-glue` now maintains **30** byte-copied placements (a different measure) | `CUT-BOUNDARY-ADDITIONS.md:27`; `place-dist-glue` line above |

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
| **C1** | the **15** `team_*` tools (member/template/delegation/control board) | **preserve** — not the retired plane; the earlier draft credited the plane, which was wrong | MECHANISM + DEV-LIVE surface. The closed list is `CENTRE_TOOL_NAMES` (`packages/runtime/src/plugin/vnext/admission.ts:86-102`); `ADM-31` pins it against `createTeamTools` **in both directions**; `ADM-89/90/91` admit all 15 on `team.control`, refuse all 15 unbound, and refuse an unlisted name. Live: the booted centre row's model-visible surface carries all 15 (`ESCALATION-centre-row-creation-entrance.md:8-9`) | `packages/runtime/test/vnext-admission.test.mjs`; `ESCALATION-centre-row-creation-entrance.md:8-9` | a governed row that **creates and drives** the board end to end through a product entrance with a real model. **Round 74 removed the entrance blocker** (`POST /team-remote/team.create` mints the Team at runtime on a centre row); the live driver still uses the product's scripted mock, so a **real model** remains unproven |
| **C2** | member create / resume / archive | **preserve** | MECHANISM. `ADM-92` creates through `team_create_member` and installs the **member's own** centre at its bind; `ADM-93` archives through `team_archive_member` (production step ports: quiesce → settle-then-archive → `release-residency`), and the next call is `ADMISSION_MEMBER_CLOSED`. **DEV-LIVE (create only):** the D3 delegate produced a real `member-activated` effect with `instanceId`/`childSessionId` (`d3:work-delivery`, §15) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md` §15; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md` | a live **archive** and a live **resume** on a booted host. Archive's live path currently refuses **earlier**, at the durable lifecycle gate (`LIFECYCLE_ADMISSION_CLOSED` / `memberResumeRefusal`) — `CAPABILITY-MATRIX-C.md:61-64`. Resume is not measured live at all |
| **C3** | work delegation + delivery receipts | **preserve** | **DEV-LIVE PROVEN** (`d3:work-delivery`, two agreeing boots). `team_delegate` → `effect.kind=member-activated`, prompt delivered **verbatim** as the Member's first user message, final text and `memberResult.body` both exactly `DBOOT_D3_DELIVERED_UNIT_ALPHA`; `team_collect` returns the terminal `succeeded` entry, **byte-identical when collected again after a SIGKILL cold restart**; the unit is on disk; every member call fact is in the member's own ledger. `ADM-94/95` carry the in-process positive and negative | `D-BOOT-FEASIBILITY.md:618-628`; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md`; `packages/runtime/test/vnext-admission.test.mjs` | a **real-model** interleaving (the current model is the product's scripted mock, §6.7) and a delivery driven at a product entrance rather than the driver's boot-bound team |
| **C4** | Blueprint binding + identity generation | **preserve** (KEEP module) | MECHANISM. `ADM-26` maps a compiled member onto a binding by reference, never by re-interpretation; `TB-1…TB-6` pin the durable-row resolution and the four typed refusal reasons with **no** legacy degradation. Live: the round-60 path-3 boot binds a v4 blueprint at boot and reaches a governed Member (`CAPABILITY-MATRIX-C.md:137-141`) | `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/test/vnext-template-binding.test.mjs`; `CAPABILITY-MATRIX-C.md:137-141` | an identity generated for a member **created at runtime** on a governed row — **round 74 now has the runtime Team/Leader identity** (`team.create` → `createAndStartTeam`); a runtime-created **Member** (`member.create` is SERVED as `work-delivery` since round 83 but has **no live proof** — §9.5) and a real-model identity are still unproven |
| **C5** | Control: ask / grant / deny / consume | **preserve** (KEEP module), fed by the three contracts | MECHANISM. `ADM-46…ADM-55` cover wiring, deny, expired, fault, the **real** `ControlService` (one request → one durable allow → one-shot spend), a real service deny, generation drift, incomplete identity, and the supply-chain pin. Live: `d2:stop` parked a Member turn at a durable `admission-ask` Control request `status=pending` and **stopped** it through the public `session/cancel` RPC — a Stop, not an approval (no decision row is granted; the live record stops at the pending request and the `ADMISSION_STOPPED` fact) | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493` | a live **approval** (leader allows) and a live **consume** of the one-shot grant. Today the live ask is only exercised in its Stop terminal. The product *does* install the grant binder and the durable approval port when the row has a `controlServiceRef` (`agent-bindings.mjs:692-710`); a row without one still refuses asks as `ADMISSION_ASK_UNWIRED`, and no live approval/consume has been observed  **ROUND 88 measured the ASK CONSUMER boundary and did NOT wire it** (`bl-30-ask-consumer/README.md`): `resolveAskClassCall` (the designed consumer) consumes a durable allow only through the last-mile guard `guardOperation`, which by design never authorizes or consumes an INLINE allow (`control/service.ts:4155-4165`, `:4289`) — and the ONLY production ask producer writes exactly that coupling (`admission-port.mjs:163`, measured live in the round-87 D4 row `executionCoupling: 'inline'`). Two new arms pin it over the REAL `ControlService`: same admission-shaped scope, guarded ⇒ adapter accepts and consumes 1; inline ⇒ `guardOperation` `no-request`, adapter `APPROVAL_DENIED`, 0 consumptions. The one-shot grant is also already SPENT by the host tool guard before the body reaches the refusing Provider plane (`admission-port.mjs:770-784`; `provider-capabilities.ts:315`). So a granted `ask` still cannot execute, and the wire-up is an owner decision (flip the coupling and lose the Stop-cancels-the-ask law `ADM-57`, or give the OS plane a read port onto the centre's enforced decision) — not a wiring change. No product code changed. **CONSEQUENCE, stated plainly: a Member can ASK, be GRANTED, and still not run the granted call in production** — measured both couplings over the REAL `ControlService` (guarded ⇒ guard allows + 1 consumption + `resolveAskClassCall` ok; inline = the production coupling ⇒ `no-request` + `APPROVAL_DENIED` + 0 consumption rows) and observed live in the round-87 row. This is **open gap G2** in §10 and needs an owner ruling, not a test change. |
| **C6** | Officer assignment + ReviewCapability routing | **preserve** (KEEP module) — *and* the contract's own rule: if Alpha.6 is not wired, "the corresponding approval and auto-wake paths must be **explicitly disabled**, never silently fall back" (`06-CAPABILITY-CONTRACT.md:95-98`) | **MECHANISM + the live REFUSAL shape.** (Round 86 audit: this cell opened with "REFUSED-BY-DESIGN … `centre-config.ts:73` rejects the opt-in on **every** row" — that was true through round 83 and is false since round 84: only an INCOHERENT row is refused.) `ADMISSION_ALPHA6_UNAVAILABLE` in two independent gates: `alpha6EnablementRefusal` (`centre-config.ts`) refuses each incoherent opt-in piece by piece and admits a coherent row (`root.ts:2508-2525` records either outcome through the same point) (`ADM-34`, `ADM-99`, `ADM-141`). **Live:** `d3:alpha6` **PROVEN** as the typed-refusal shape — no team root (`/__p6t6/state` 404), no decision, no wake intent. **ROUND 68:** the row's refusal is now RECORDED at the host entry through the product's own point (`host.ts` -> `createAlpha6RowRefusalHook` at the centre rule -> `createHostSurfaceRefusalPoint`): both live boots measured one `ADMISSION_ALPHA6_UNAVAILABLE` invocation-authority fact on `host.service` and a `REFUSED`/`not-started` settlement (`ADMITTED→REFUSED`) under the row's `centreStatePath`, while the same typed refusal and the same no-team-row boot outcome are unchanged. A row with no `centreStatePath` is still refused but unwritten (no durable directory). `ADM-116/117/118` carry the in-process shape. **ROUND 84 — THE FORMAL ROUTING IS IMPLEMENTED; the row is no longer unconditionally refused.** The pre-code determination (`ALPHA6-FORMAL-ROUTING.md`) found three missing pieces and **no `CORE_SEAM_BLOCKER`**: the routing AXIS (none is lawful and none is needed — a routing decision executes nothing, so no member I/O axis is invented for it); the WAKE (a bespoke `followup`/`steer` write is replaced by a governed DELIVERY: durable `team-review-wake-routed` intent → `SessionInputPort.submitAttributedInput` → `team-review-wake-delivered` confirmation, in the SAME TeamDomain ledger, with the SAME correlation token P6-T3 uses for `member.send`); the ENABLEMENT (`centre-config.ts#alpha6EnablementRefusal` admits a COHERENT row — authored v5 `reviewRouting.enabled`, non-empty `centreStatePath`, absolute `alpha6WakeIntentPath` — and refuses each incoherent one with its OWN typed piece code under the unchanged `ADMISSION_ALPHA6_UNAVAILABLE` prefix, so the recorded refusal still lands). The Officer's own `team_resolve_control` is admitted by the ONE centre on `team.control` under the OFFICER's binding, and the management plane never executes a tool during a wake. New arms: `ADM-141` (positive enablement + each piece refused AND recorded), `ADM-142` (officer route, nothing executed), `ADM-143` (intent + confirmation + machine attribution + zero executions), `ADM-144` (Officer's own call admitted under its binding), `ADM-146` (duplicate ⇒ ONE confirmation; unknown recipient ⇒ typed refusal, zero facts), plus `a6-pr4-review-wake-glue`, `a6-pr7-merged-wake-host` and `a6-root-wiring` (a PRODUCTION root boots a coherent Alpha.6 row). The refusal arms stay green (`ADM-34/85/99/116/117/118`; the D3 live `d3:alpha6` refusal). **Still NOT proven: a live host run of the ROUTED wake** — the D3 world's blueprint is v4 with a single worker member and no Officer/approval case, so it can express only the refusal side. **ROUND 87 measured the live answer (D4 probe, two agreeing DEV-LIVE boots):** a coherent v5 world with an Officer boots a real Team (`d4:enablement` PROVEN), the Officer comes up and ITS OWN call is admitted under ITS binding (`d4:officer-up` / `d4:officer-binding` PROVEN), and the refusal side is still PROVEN (`d4:refusal`) — but the routed wake is **REFUTED by the product itself**: the worker's authored `ask` lane mints a real durable `leader-approval` row with **no `approvalCaseId`/`legOrdinal`/`reviewAuthority`**, the product's own router answers `null` for it (`memberListCalls: 0`), zero `team-review-wake-*` facts and zero wake-intent files exist, the Officer is never woken, and the **Leader** receives the plain C1 ask. Two Team-side seams are missing and **neither is a `CORE_SEAM_BLOCKER`**: no live producer of a case-bearing ordinary ask (the only live leg producer is the envelope-mutation lane; the PA ask lane was deleted in `1617d5839`; `team_request_control`/the admission ask cannot carry a case), and no consumer for an `ask`-disposition call even after an allow (`IO_ASK_REQUIRES_APPROVAL`, "`resolveAskClassCall` has no production caller", BL-30). Claim stays MECHANISM | `D-BOOT-FEASIBILITY.md:629-643`; `dev/agent-workflow/evidence/d-boot-feasibility/d3/README.md`; **`dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md`**; `dev/agent-workflow/evidence/ute-a1/ALPHA6-FORMAL-ROUTING.md`; `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/src/plugin/vnext/review-wake-delivery.mjs` | a **live** routed review (an Officer approval case resolved through the mock model and the wake delivered at a boot); the live level remains the refusal shape (`CAPABILITY-MATRIX-C.md` C-alpha6), and round 87 shows the blocker is our own missing ask-case producer + BL-30, not an upstream seam |
| **C7** | durable Wake intents + cold wake | **preserve** | MECHANISM, in-process only. `ADM-98` composes `createAlpha6RootWiring` directly, the ONE shared `createAlpha6RootRouter` takes a real `recipient` decision off a durable control row (Officer, `routeRole='officer'`), and the real `dispatchLatch` + `createFileWakeIntentDirectory` persist a row that a **fresh** reader sees naming exactly the routed reviewer. **ROUND 87:** that in-process arm is still the ONLY place the intent is written from a routed case — on a real host the durable row the product actually mints carries no case, so `route()` returns `null` before any intent exists (`d4:routed-wake` REFUTED; `d4/runs/boot0{1,2}/route-probe.json`) | `packages/runtime/test/vnext-admission.test.mjs`; `packages/runtime/src/plugin/vnext/review-wake-delivery.mjs`; `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md` | the same, reached at a **product entry**: ROUND 84 makes the wake a governed delivery and a coherent row BOOTS (`a6-root-wiring`, `a6-pr7-merged-wake-host`, `ADM-143`), so the machinery is now built at a real production root — what is still missing is (i) a live producer of a CASE-bearing ordinary ask and (ii) a live boot that carries an Officer approval case (§6.5, §10 G1/G2) |
| **C8** | Stop (sticky, durable, non-replaying) | **preserve** | MECHANISM + **DEV-LIVE PROVEN** (`d2:stop`, two boots). Stop is the host's own `exec.signal` — no second stop mechanism. `ADM-56…ADM-62` cover Stop before the body, while an ask is pending, after the approval and before the body, lifecycle close with a call in flight, and the product composition's own close. Live: `POST /api/session/cancel` → tool result `ADMISSION_STOPPED`, centre fact `refusalCode=ADMISSION_STOPPED`, settlement `REFUSED`/`dispatch=not-started` with **no** execution fact, never `UNKNOWN`; a second Member completed with zero stops. **ROUND 79 — the rc.5 PRE-DISPATCH case (B6):** rc.5 cancels a call before dispatch without entering the pipeline, so `tools/result` never fires and event-only observation recorded nothing. The centre now reads the host's own `ABORTED_BEFORE_DISPATCH` result at the executor completion boundary (`pre-dispatch-abort.mjs`; `batch.ts:271-280` → `index.ts:375-377`), writes the SAME canonical execution fact (`aborted`, `abortPhase:'pre-dispatch'`, product ExecutionId) through ONE ExecutionId-keyed dedupe map, records `Stop(pre-dispatch)` + `CANCELLED` when an admission record exists, and when none exists writes **no** settlement and REPORTS `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` (no fabrication: no fake allow, no fabricated `tools/result`). `SLICE-21`/`SLICE-30` GREEN on rc.5 AND rc.2 with unchanged assertions; `SLICE-37` pins the dedupe (both paths firing ⇒ one fact, zero settlement) | `packages/runtime/test/vnext-fs-slice.test.mjs` (SLICE-21/30/37); `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:483-493`; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md`; `RC5-MIGRATION.md` §7 | Stop **under load** and a real Stop keypress; and the settlement-recheck cell, which is no longer open: the owner approved **Option A** in round 73 (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md:51`; `ADM-119`: allow `gen-1` → durable deny `gen-2` → `REFUSED`/`not-started`). **Round 79 adds one:** the production `tools.execute` call site belongs to the host agent loop, so the pre-dispatch observer is exported and driven end to end in the slice composition but is NOT yet wired into a booted rc.5 member turn (`RC5-MIGRATION.md` §7.5) |
| **C9** | remote entry (`s6-remote`, remote control surface) | **preserve** | **RESTORED as a GOVERNED MANAGEMENT CONTROL PLANE (round 74)** under owner ruling `docs/reviews/20261122-1536.txt` §3. The S6 plane is BUILT and INSTALLED on a centre-configured row; `POST /team-remote/team.create` mints a Team at runtime through `createAndStartTeam()` with the existing S6 Principal + TeamDomain/Control + creation/start gates. Commands are classified by ACTUAL EFFECT in ONE closed table (`s6-command-classification.ts`): control-plane reads/creation/management are served, and since round 83 `member.create` / `member.send` / `member.followup` are also served as the **`work-delivery`** class (`s6-command-classification.ts:125-130`) — a handover into the Member's own governed path that never executes a tool. Only the two ROOT commands whose effect is agent execution (`team.admitInitialWork`, `team.ensureRootLive`, `:111-112`) stay REFUSED with `ADMISSION_REMOTE_UNAVAILABLE` on `team.control` + durable fact + `REFUSED`/`not-started` settlement. `ADM-86` (rewritten) pins the closed table both ways, the no-default-allow rule, a served control read, a refused execution (zero ports), the durable shapes, and the unauthenticated principal refusal; E3 pins the real production root (`installed===true`, served read, five type-refused executions with facts). Live `d:remote-creation` (round 74, two boots): unauthenticated refused/mints no Team, `TEAM_REMOTE_FOREIGN_TEAM`, runtime create success, duplicate no second Team/no provider request. Live `d2:remote-delivery` (round 83, two boots, rc.2): `member.send` acknowledged with 0 admissions/0 executions at the acknowledgement, the delivered prompt then ran in the Member's own turn and its `allow` landed in the MEMBER's ledger ~113 ms later; unknown member, archived member, duplicate send (at-least-once, no operator-side execution), restore, and Stop during a delivered turn (`ADMISSION_STOPPED`) all measured on that row. LIMIT: **no live `member.create` / `member.followup`** (production-port + router-detach arms only, §9.5); per-DSH_HOME authenticated operator, NOT multi-user RBAC | `CAPABILITY-MATRIX-C.md` C-remote; `ESCALATION-centre-row-creation-entrance.md` RESOLUTION; `packages/runtime/test/vnext-admission.test.mjs` (`ADM-86`); `a3p4-pr4-production-entry-regression.test.ts` (E3); `D-BOOT-FEASIBILITY.md` §17 | a real-model drive through the remote entrance, and a user-level identity isolation claim (out of scope/not claimed) |
| **C10** | MCP catalog + initial grant + live loss | **preserve** — "may land in C, but must never be enabled by default while unmanaged" (`06-CAPABILITY-CONTRACT.md:99`) | MECHANISM. `ADM-96` mounts the product's own real HTTP mini-MCP server through the **exact production call**, reads the tool off the model-visible surface, admits it on `net.mcp` with the **server** as locator, and the real body answers `pong:mounted`; `ADM-97` proves mounting ≠ permission, that a tool-level restriction narrows, and that a bare `mcp__` prefix is refused by name. `f15-mcp-live-loss` is green inside the 238-suite vitest population. Not enabled by default: the remote mount is `SKIPPED` on the centre row | `packages/runtime/test/vnext-admission.test.mjs`; `tests/checks/eb3-ute-migrated-suites.txt`; `D-BOOT-FEASIBILITY.md:171-222` | a **live mount at a host boot** (unknown at D: the row's remote mount is skipped) and a live server-loss observation. Also: the centre is **not mount-aware**, so a well-formed name for a never-mounted server is decided on the network axis alone (`ADM-97` step 5) |
| **C11** | state projections (`sessionProjections`) | **preserve** | **MECHANISM, measured (round 66).** The row names two owners. (a) The Team-owned projection (`projection/**`) is **PRESERVED in the new assembly** and proven to derive from the TeamDomain's own facts: `ADM-107` wires it exactly as the entry does — `createProjectionService(createTeamDomainReadPort(domain, readPortDeps), <live overlay>, { clock, schemaVersion: 2 })` (`root.ts:4302`) — over the REAL durable `TeamDomain`, and asserts the identity core, every member row and the ledger summary field-by-field against the durable rows; a real `team_create_member` is then what the **next** reader sees (fresh port + service), and every durable value survives a **cold domain reopen**. `ADM-108` (negative) proves a mutation **REFUSED at the ONE centre** (`ADMISSION_NO_BINDING`, `LANE_DENY`) moves **nothing** — projection byte-identical, no new member row, no ledger entry, no generation move — with a same-world positive control. `ADM-109` (negative) proves the live overlay is **not a second authority** (a live handle invents no member; dropping one moves only residency, never lifecycle/creation/generation), that an absent TeamSession **fails closed** (`TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT`, never an invented empty team), and that a projection pass **writes nothing**. Falsified not assumed: stamping v1 and emptying the catalog template rows each turn the arms red. (b) The other named owner — the host's native `sessionProjections` service behind the `todo`/`goal` faces — is preserved **by construction, not by this cut**: neither the retired entry (`live/agent-bindings.mjs`, `root.ts` at `1617d5839^`) nor the new one references it (`grep -c sessionProjections` → **0** in all four files), so the entry replacement cannot have un-wired it; those faces stay bound on `host.service` (`ADM-32`). The Team-side uses are pass-through **reads** of the HOST's service, never a registration of its own: the PTY facade hands `ctx.get('sessionProjections')` to the pinned backend (`team-services/src/terminal-pty.ts:400`) and the P5-T5 real-instance harness restores the durable model selection with `stateOf(session, 'modelSelection')` (`root-binding/harness/plugin.mjs:969-982`) | `packages/runtime/test/vnext-admission.test.mjs` (`ADM-107`…`ADM-109`); `MIGRATED-SUITE-STATUS.md` "Round 66 (C11)" | (i) a **live boot** reading the Member's todo/goal projection state through the host's own `sessionProjections.stateOf` — that service is the HOST's, so no in-process arm can read it; (ii) a projection read at a **product entry** (`team.getProjection`), which a centre-configured row CAN now reach since round 74 (`team.getProjection` is a served `control-plane-read` command, `s6-command-classification.ts:99`) — what is missing is an arm that measures it, not reachability. **The `sessionProjections.stateOf` half is NOT claimed here**, and no cell above is PRODUCT-PROVEN |
| **C12** | tool admission (guard, builtin deny, selector) | **preserve** (KEEP module) | MECHANISM + DEV-LIVE. `ADM-1…ADM-45` (lanes, deny precedence, unbound refusal, `ADMISSION_TOOL_UNBOUND`), `ADM-29/30` (tool restriction answers before the ceiling and only narrows), `ADM-31` (closed list matches `createTeamTools` both ways), `ADM-35` (a governed member refuses to run unrecorded), `ADM-44` (`MEMBER_CENTRE_UNWIRED`). Live: `d:centre-facts` PROVEN — 2 `fs.read` admissions (`allow` + `DENY/LANE_DENY`) and 2 execution facts, read back from disk | `packages/runtime/test/vnext-admission.test.mjs`; `D-BOOT-FEASIBILITY.md:369-395` | a real model choosing tools adversarially (the mock is scripted), and a policy compiled at runtime rather than passed as an input (`CAPABILITY-MATRIX-C.md:66-67`) |
| **C13** | confined I/O faces (fs/web/subprocess/terminals/userQuestions) | **replace** with provider lanes | MECHANISM + **DEV-LIVE for fs and subprocess**; **web is in-process only** (round 86 audit corrected this cell: it said "DEV-LIVE for fs, web and subprocess" while its own gap cell says a live `web_fetch` is still missing); **process family ADMITTED ON A DECLARATION, live persistent shell PROVEN (round 76)**. fs: `d:guard-facts` **PROVEN** (2 `allow` facts, methods `stat`/`readText`, `memberIdentity=inst-0pe2z220bhfb`), `SLICE-1…SLICE-36`, and `d2:multi-member-concurrency` live. web: `SLICE-31/32` (transport reached / never reached), `ADM-67/74`. subprocess: keys on `toolBindings[].authorization` + `execution.executionBoundary` (`admission.ts:424-466`, `ADM-125`…`ADM-131`); round 76 additionally mounts the HOST's `dsh-tool-bash-persistent` (`backendType: a5sf-governed-shell`) beside the one-shot baseline and declares the binding, so the live D3 judge is **PROVEN** in two agreeing boots — the second turn reuses the same shell, and the out-of-lane write is refused by the OS profile (§6.3). PTC: `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:421-423`) **ROUND 77: the rc.5 FS confinement gap (`patchText`/`deleteFile`/`moveFile`) is CLOSED — SLICE-35 GREEN on rc.5 and rc.2, `ADM-135`…`ADM-140`; still in-process (§6.15).** **ROUND 85: the four parts were measured — nested calls, Control escalation and Stop HOLD; the worker's OS profile is the HOST session policy, not the member's compiled lanes (FAILS, `CORE_SEAM_BLOCKER`, `PTC-FOUR-PART-FINDING.md`).** | `D-BOOT-FEASIBILITY.md:349-414`; `packages/runtime/test/vnext-fs-slice.test.mjs`; `packages/runtime/test/vnext-b-probe-ladder.test.mjs` | a live `web_fetch` at a boot, and `userQuestions`/terminals beyond the PTY-owner refusal (`SLICE-33`) — the persistent (`a5sf-governed-shell`) live shell at a boot is no longer on this list (round 76 PROVEN); what remains unproven for it is a GATED (non-DEV-LIVE) status and a real-model interleaving |
| **C14** | **old governed-family execution implementations**: each family's own tool body, its duplicated policy computation, and the historical per-family semantic-equivalence requirement … | **dropped** — the host rows own execution now, and the equivalence criterion is retired with the bodies; the differences that mattered were defects of the deleted body (`SD-SEARCH-1`) | **DROPPED-AS-RULED**, and closure holds: `deleted=148 prodRefs=0 distResiduals=0 dupNames=0` (fresh run, §1.1); no legacy Plane/Family Body/Kernel/PA Bridge is wrapped as an internal component and there is no legacy fallback (`PR-BODY-draft.md` §"What this branch is") | `ute-cut-closure` line in §1.1; `CUT-BOUNDARY-ADDITIONS.md`; `docs/plans/memo/ute-p0-20261121/03-RETIRE-KEEP.md` | nothing — a drop is complete when the closure gate is green and the ruling is named, which it is (`06-CAPABILITY-CONTRACT.md:90`) |
| **C14b** *(the contract's split row, not a 19th criterion)* | **the safety invariants those families enforced**: path read/write upper bounds, network allow/deny, Control authority, Stop | **preserved** — never implied by C14's drop | **MECHANISM, with a per-invariant positive+negative pair; DEV-LIVE only for the fs/subprocess/Stop carriers** (round 86 audit narrowed this cell: the network-deny OS control is a node-leg probe, `ENV-LIMITED` on an incapable runner, so "MECHANISM + DEV-LIVE" overstated it). §2.3 maps every dropped implementation to a surviving owner with `file:line`; `ADM-110` (path bounds: centre authored lane + provider resolved path, `..` and symlink), `ADM-111` (network: allow/unset/deny + tool-level narrowing), `ADM-112` (Control authority: the REAL durable `ControlService` asks, denies and one-shot spends), `ADM-113` (Stop: REFUSED/not-started, never UNKNOWN, durable across a fresh reader), `ADM-114` (process: fail-closed `ADMISSION_EXECUTION_UNAUTHORIZED`, never an unconfined shell), `ADM-115` (dropped names are unbound; preserved host faces keep `host.service`). The P1–P5 proofs (§3) and the OS controls still stand: `OS-1` Landlock ABI 7, `OS-2` **negative**, `OS-3` **positive** on a host that proves the network-deny profile (this one), and `SLICE-4` (without the realm mount the outside read **succeeds**, so the confinement arms are falsifiable). On a runner that cannot prove that profile, `OS-2`/`OS-3` are ENV-LIMITED fail-closed controls and the kernel claims are NOT made — see §3.1 and `ENV-LIMITED-CAPABILITY-20261123.md`. **No invariant is enforced only by a deleted component** — checked, not assumed: the five `confined-*` shadows were mounted by the realm row itself (`a5sf-realm-row.mjs` at A0), so a realm-less member was never confined by them; the residual is the *ungoverned* (never-asked) row, which this row does not claim to govern (§2.3) | §2.3; §3; `packages/runtime/test/vnext-admission.test.mjs` (`ADM-110`…`ADM-115`); `packages/runtime/test/vnext-os-probe.test.mjs`; `packages/runtime/test/vnext-fs-slice.test.mjs` | a live OS-boundary measurement at a boot (today the OS probe runs in the node leg on the CI host); network containment under a real model; and a product entry that drives each invariant (not only the in-process centre) |
| **C15** | `team_skill` | **preserve, re-homed** — Team skill provider into a host-shaped row | MECHANISM + **recorded LIMIT**. Bound on `host.service` (`ADM-32`); `skill` is in `HOST_CAPABILITY_TOOL_NAMES` (`admission.ts:143-153`); the governed preset mounts `a5sf-skill-provider` (`scripts/dist-placements/190-a5sf-pd29-service-seam.json:5-6` places the module; the governed realm row mounts it at `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:989`). **Limit, not a confinement claim:** a skill file read by the host skill service is OUTSIDE the member's fs ceiling (`CAPABILITY-MATRIX-C.md:76-87`) | `packages/runtime/test/vnext-admission.test.mjs`; `CAPABILITY-MATRIX-C.md:29,76-87` | a D judge that has a governed Member invoke `team_skill` on a booted host and asserts the row is reachable — with the limit stated in the same evidence, not only here |
| **C16** | `subagent_fork` | **preserve, re-homed** — row over `subagent-fork-in-process` | MECHANISM. Bound as host capabilities (`subagent`, `send_message`, `interrupt_agent`, `admission.ts:143-153`, `ADM-32`); the **child's own** binding governs the child's tools (so the parent's ceiling is not a claim about the child) | `packages/runtime/test/vnext-admission.test.mjs`; `CAPABILITY-MATRIX-C.md:30` | a live fork at a boot, and an assertion that the child's own centre judges the child's calls — neither is measured in the D legs |
| **C17** | **Team's own `exit_plan_mode` tool** — not DSH plan mode, and not the goal tools | **dropped by owner ruling** — the host has only a `claude-code-mods` name mapping, and re-creating a plan-mode state machine is out of scope. `get_goal`/`create_goal`/`update_goal` are untouched | **DROPPED-AS-RULED**, provable by **absence**: zero `exit_plan_mode` references under `packages/runtime/src` and `packages/tools/src`, and it is in neither closed table (`admission.ts:61-74`, `:57-73`, `:114-122`). The goal tools **are** present on `host.service` | `grep -rn exit_plan_mode packages/runtime/src packages/tools/src` → no matches; `admission.ts:143-153` | nothing — the ruling is named and the absence is checkable |
| **C18** | `a5p5-tools` lane helpers (arg parsing, effects, render, spill) | **dropped** — dormant, nothing dispatched | **DROPPED-AS-RULED.** `packages/tools/a5p5-tools` no longer exists under `packages/tools/src` (only `builtin-deny.ts`, `guard.ts`, `index.ts`, `native-fs-binding.ts`, `tokens.ts`, `tool-selector.ts`, `tools.ts`, `types.ts`), it is absent from the migrated population, and the cut-closure run reports 148 sources gone with **zero production references** (`references=3`, `prodRefs=0`: three non-production references remain, and `retiredSurfaces=12`) | `ls packages/tools/src`; `grep a5p5 tests/checks/eb3-ute-migrated-suites.txt` → none; `ute-cut-closure` line in §1.1 | nothing — dormant-and-deleted with an empty dispatch path is the ruling's own completion criterion |

**Rows that are not proven, at a glance** (this is the honest subset a reviewer should carry forward):
**C1/C4/C5/C6/C7/C10/C11/C15/C16** are MECHANISM at best (C6/C7's formal routing is implemented; their
remaining gap is a LIVE routed wake, not a missing mechanism — §6.5 — and **round 87 measured that gap as
two in-repo seams**, not a missing abstract piece: no case-bearing ordinary-ask producer and no BL-30 ask
consumer; C5's grant/consume half is narrower still — a granted `ask` does not execute in production;
C11's host `sessionProjections.stateOf` half needs a live boot); **C2/C3/C8/C9/C12/C13/C14b** carry
DEV-LIVE evidence (C2 create only, C9 the delivery boundary, C13 fs/subprocess only — **not** web) but are
still not PRODUCT-PROVEN; **C13's PTC arm is REFUSED-BY-DESIGN** with a `CORE_SEAM_BLOCKER`. **C14/C17/C18
are DROPPED-AS-RULED** and are not coverage.
**No cell above says PRODUCT-PROVEN, and none may be upgraded by narration.** The complete open-gap list,
with the owner decision each needs, is **§10**.

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
| `family-fs` — read/write/edit/read_image executors over ONE controlled root | 17 | path READ/WRITE upper bounds, including the **resolved** path (symlink / `..`) | centre: authored locator decided in `admission.ts:387`; provider: `team-services/src/fs.ts:134,179` → `member-io-policy/src/provider-capabilities.ts:299-405` (`PATH_SYMLINK_ESCAPE`, resolved containment) | `ADM-110` (+ `SLICE-3/6/27`, `ADM-2`) |
| `family-search` — grep/glob executor + presentation | 9 | search-root bound; an omitted path means the workspace root, never "unbounded" | `admission.ts:61-62` (`TOOL_AXES`), `:196-199` (`DEFAULTED_LOCATORS`); the durable overlay ABSTAINS instead of faulting (`overlay-decision.mjs:226-228`) | `ADM-110` (provider half), `ADM-16`, `ADM-105/106` |
| `family-web` — fetch/search + redirect ownership | 10 | network allow/deny; an fs grant never stands in for it | centre `admission.ts:468-476` (`net.fetch`, tool-level narrowing included); provider face `team-services/src/web.ts` (compiled `network` axis) | `ADM-111` (+ `SLICE-31/32`, `ADM-17`) |
| `family-process` — bash + an unrouted pwsh + confined-shell executor | 11 | **no unconfined shell execution**; the OS boundary belongs to the provider, not a body | centre refuses a process with no compiled execution authorization `admission.ts:424-466` (`ADMISSION_EXECUTION_UNAUTHORIZED`/`_DENIED`/`ADMISSION_EXECUTOR_UNAVAILABLE`); PTC has its own code `:405-407`; OS profile `team-services/src/subprocess.ts:1372` (`compileExecutionProfile`) | `ADM-114`, `ADM-125`…`ADM-131` (+ `OS-1/2/3`; `d3:persistent-subprocess` **PROVEN** round 76, two agreeing boots) |
| `family-ui` — ask_user_question + present | 9 | no second declarant / no undeclared I/O surface | the names have no preserved home ⇒ `ADMISSION_TOOL_UNBOUND` (`admission.ts:396-398`); terminals stay the PTY-owner refusal (`SLICE-33`) | `ADM-115` |
| `family-inspect` — team_skill + two `team_cordis_*` rows | 10 | host-service I/O is RECORDED on its own axis, never judged by the fs lane | `HOST_CAPABILITY_TOOL_NAMES` (`admission.ts:143-153`, axis `host.service`); the limit is stated at `:100-108` | `ADM-115` (+ `ADM-32`) |
| `family-agent-control` — seven subagent/orchestration rows | 14 | the CHILD's own binding governs the child's tools | `host.service` table (`admission.ts:143-153`); the child's centre is installed at its own bind (`ADM-92`) | `ADM-115` (+ `ADM-32`) |
| `family-agent-state` — todo_write + goal rows + `exit_plan_mode` | 7 | preserved state faces recorded; `exit_plan_mode` dropped by ruling | `host.service` table (`admission.ts:143-153`); `exit_plan_mode` is in no closed table (`ADM-115`) | `ADM-115` |
| `pa-mount-registry`, `pa-control-bridge`, `pre-execute-adapter`, `native-tool-admission`, the five `confined-*` shadows, `family-assembly` | 10 | **Control authority**: one approval authority, current mount facts, no second dispatch authority | centre ask path `admission-port.mjs:94` (`createControlApprovalPort`), `:336-344`, `:477`; authority `packages/runtime/control/service.ts`; closed tables `admission.ts:61-74/57-73/114-122` | `ADM-112` (+ `ADM-46…55`) |
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
`agent-bindings.mjs:1972`, `ADM-44`); a member whose row **never asked** also never mounted the
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

### 3.1 OS negative controls (fresh, this HEAD) — PROVEN where the capability exists, ENV-LIMITED where it does not

Measured inside `ute-vnext-a1` (file `packages/runtime/test/vnext-os-probe.test.mjs`; leg definition
`dev/ci/eb3-ci-manifest.json` → `layers[4].legs[11]`, which sets `A5SF_REQUIRE_PINNED_HOST=1`).

**The precondition is measured, not assumed.** `OS-2`/`OS-3` request `networkProfile: 'deny'`, and the
product admits that request only when its own `runNetworkLeg` (the launcher's real `--net-leg`: a control
child reaching a loopback listener, a deny child landing in a DISTINCT network namespace and failing
tcp/udp with a kernel errno while the listener counters do not move) confirms it. The same proof gates
the confined subprocess face that `grep` runs through, so OS-2/3, `ADM-66`, `SLICE-28` and the `ADM-70`
grep rung all ride ONE capability. The leg asks that probe first (`tests/world-factory/lib/a5sf-env-capability.mjs`)
and prints its answer:

```
A5SF-CAPABILITY network-deny=present level=enforced code=NET_DENY_ENFORCED ... forced=false
  detail="runNetworkLeg verdict=NET-DENY-CONFIRMED mechanism=netns netns=…/(host …)"
```

**This host (capability present ⇒ real enforcement):**

```
OS-1 measured landlock abiVersion=7
✔ OS-1 — the host answers the Landlock ABI the provider requires
✔ OS-2 — NEGATIVE CONTROL: a confined payload CANNOT read outside its allow set (3214.834264ms)
✔ OS-3 — POSITIVE CONTROL: the same payload CAN read inside its allow set (3194.526655ms)
ℹ tests 211  ℹ pass 209  ℹ fail 0  ℹ skipped 2
```

The pair is load-bearing: a positive-only run would prove nothing about the boundary, and a
negative-only run would not distinguish "denied" from "broken". Both controls ran in this session's
`dispatch-tests --run --leg ute-vnext-a1`.

**The hosted `ci-census` runner (capability ABSENT).** The runner's `--net-leg` does not confirm a
network namespace (see `ENV-LIMITED-CAPABILITY-20261123.md` for the hosted probe line), so
`network-destination` is `unsupported` and the provider refuses every `network: deny` spawn BEFORE any
process exists (`IO_POLICY_UNSUPPORTED` / `NETWORK_UNCONFINED_REALM`). The five affected arms take the
truthful branch, assert the product's FAIL-CLOSED behaviour, and are reported ENV-LIMITED — never
counted as proven, never silently skipped:

| arm | disposition on an incapable runner | what IS asserted there | what is NOT proven there |
| --- | --- | --- | --- |
| `OS-2` | FAIL-CLOSED-CONTROL | `prepare()` refuses with `IO_POLICY_UNSUPPORTED`, names the unoffered `deny` profile and why an ABI number is not a network guarantee; no plan and no output dir exist | the kernel denial of the out-of-allow-set read |
| `OS-3` | FAIL-CLOSED-CONTROL | the positive payload is refused the same way before any plan exists | the in-allow-set read |
| `ADM-66` | ENV-BLOCK | admission fact `allow`/`fs.read` at the judged locator; execution `failed`; settlement `FAILED`; ZERO provider spawns; no fabricated match | the confined `grep` body/`Found 1 match` |
| `SLICE-28` | ENV-BLOCK | the same refused-spawn facts, PLUS the lane negative control (`LANE_DENY` before the body, `admission-refusal`) | the in-ceiling search |
| `ADM-70` | ENV-BLOCK | the runnable-rung order and the DURABLE admission order (grep included, as admitted) | the complete 4-rung positive ladder |

The arm count is small, named and stable: **five** env-limited arms, one code
(`NETWORK_DENY_UNPROVEN`), printed per arm as `UTE-VNEXT-A1-ENV-LIMITED …` and aggregated by the
dispatcher as `DSH-TEST-DISPATCH-ENV-LIMITED count=5 proven=0 env_blocks=3 fail_closed_controls=2`.
Each such arm calls `t.skip` only AFTER its assertions, so a regression in the fail-closed behaviour
turns the arm RED (a skip is not a shield). **An environment absence is not a PASS**: on the hosted
runner the five guarantees above are explicitly UNPROVEN, they increment no proven counter, and
`CAPABILITY-MATRIX-C.md` shows those cells as ENV-LIMITED rather than PROVEN. The OS probe needs
`python3` and a Landlock-capable kernel; on a host lacking THOSE, `OS-1`/the provider probe fail
loudly (a red leg), not as a skip.

**Product gap or runner limit?** Runner limit. The product's launcher already creates the namespace it
needs (`CLONE_NEWUSER|CLONE_NEWNET`, unprivileged) and the provider offers `deny` exactly when the
probe measures it; there is no realm-provisioning switch that could be flipped in product code to make
an incapable kernel capable. The failure mode is disclosed, not patched around. A future runner that
permits unprivileged user+net namespaces gets the real controls automatically: the same leg, with no
code change, reports `network-deny=present` and the five arms run as on this host.

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
| **`d:remote-creation`** | **PROVEN (round 74, new)** — unauthenticated refused (401) and mints NO Team; cross-team `TEAM_REMOTE_FOREIGN_TEAM`; legitimate runtime `team.create` 200 / `path:"fresh-root"`; duplicate mints no second Team (after round 74's fix) and adds 0 provider requests. The round-74 `member.send` refusal is **history**: round 83 re-classified it as work-delivery (next row) | **PROVEN** (identical observations) | `D-BOOT-FEASIBILITY.md` §17; `dev/agent-workflow/evidence/d-boot-feasibility/runs/boot01|boot02/remote-creation.json`; `round74-console.log` |
| **`d2:remote-delivery`** (round 83, **new**) | **PROVEN** (round 83, two boots, host `legacy` = rc.2) — `member.send` → HTTP 200 with the coordinator's `delivered` acknowledgement (intent 39 / confirmation 40) while the Member's delivered call had **0 admissions / 0 executions at the ack**; the delivered prompt then ran in the Member's own turn and the centre's `allow` for that `read` appeared in the MEMBER's ledger under the MEMBER's binding ~113 ms later, execution `completed`; unknown member, archived member, duplicate send (at-least-once, no operator-side execution), restore, and Stop during a delivered turn (`ADMISSION_STOPPED`) all measured on the same row | **NOT RECORDED on rc.5** — the rc.5 acceptance log (`ute-a1/rc5/run-boot-d2.log`) predates this judge and carries 3 d2 judges, not 4 | `dev/agent-workflow/evidence/d-boot-feasibility/d2/driver.log:1214-1313` (`"host":"legacy"`); `d2/README.md`; §9.3 |

**rc.5 host column (round 78).** **Thirteen of the fourteen** judges are `PROVEN` on 0.2.2-rc.5
with the same counted facts as rc.2 (two agreeing boots each). `d2:remote-delivery` was added in round 83,
after the rc.5 acceptance run, and has **rc.2 evidence only** — its rc.5 status is not recorded. Three rc.5
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

> **Round 89 note.** The pastes in §4 are the round-74/76 measurement and are kept as the historical
> record. Every required gate was re-run at `97d7d7c8d`; the fresh outputs are in **§9.4** and are the ones
> that apply to this candidate now (dispatch 211/209/0/2, catalog 785 collected / 38 uncollected / 14
> excluded, closure/assets/docs unchanged, 30 placements, ci-required 10/0, bound vitest 216, migrated
> population 238, UTE G1 89/89, `ci-pr-gate --full` 10/10).

### 4.1 `dispatch-tests --run --leg ute-vnext-a1`

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 211
ℹ pass 209
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
﹣ ADM-69 — RUN_CODE positive: NOT RUN (the PTC worker's OS profile is the HOST session policy, not the member ceiling) — disclosed, never a pass
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
place-dist-glue: done (30 placement(s))
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
| subprocess / PTY / PTC | execution-authority decision + typed refusals; `CONTRACT-CHANGE-REQUEST-process-lane.md` is RESOLVED | the declaration source was ALWAYS there (`toolBindings[].authorization` + `execution`); round 75 fixed the carriage. What remains for subprocess/PTY is a COMPOSITION swap (persistent confined shell), not a contract question; PTC's remaining gap is narrower (round 85): nested calls, Control escalation and Stop hold; only the WORKER's OS profile is not the member's compiled one (`CORE_SEAM_BLOCKER`, per-execution policy seam) |
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

No row is PRODUCT-PROVEN (`CAPABILITY-MATRIX-C.md:71-74`). (The round-70 sentence "every row is `MECHANISM` or `UNPROVEN`" was not accurate: rows are also `DROPPED-AS-RULED` — C14, C17, C18 —, `REFUSED-BY-DESIGN` — C13/PTC —, and `ENV-LIMITED` — five arms; the accurate claim is the one that matters: none is PRODUCT-PROVEN.) A row
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
  (`packages/runtime/src/plugin/s6-command-classification.ts`); control-plane
  read/creation/management commands and the round-83 `work-delivery` class (`member.create`,
  `member.send`, `member.followup`) are served, while `agent-execution` commands (the two root
  commands) are REFUSED before params/handlers with the existing `ADMISSION_REMOTE_UNAVAILABLE` on `team.control`, a durable
  invocation-authority fact and a `REFUSED`/`not-started` settlement;
- **no new admission axis**, no change to `admission.ts`, and no member admission on the management route.

Measured live (round 74, two agreeing boots): unauthenticated `team.create` → **401, no Team minted**;
foreign TeamSession → **`TEAM_REMOTE_FOREIGN_TEAM`**; legitimate create → **200, `path:"fresh-root"`**
with the durable TeamSession + leader row; duplicate create → **no second root, 0 provider requests**;
`member.send` → **served as work-delivery, acknowledged with 0 admissions / 0 executions at the ack**
(round 83's `d2:remote-delivery` measures the rest: the delivered prompt ran in the Member's own turn
and its `allow` landed in the Member's ledger; see §3.2 and §9.3). The round-74 measurement that
`member.send` was refused belongs to the pre-round-83 classification and is kept as history, not as
the current state.

**Limit, stated rather than hidden:** the principal is a **per-DSH_HOME authenticated operator**
(Connection Gate), **not** multi-user RBAC, and no user-level identity isolation is claimed. The created
Team's Member runs with its OWN compiled Binding and its OWN centre ledger — the management request never
carries a member Binding.

### 6.3 Process execution: authority is declarable, and the live persistent shell is PROVEN (round 76)
Round 75 replaced the path-lane question with an EXECUTION-authority question (owner ruling
`docs/reviews/20261122-1536.txt` §1; full fitness check in
`CONTRACT-CHANGE-REQUEST-process-lane.md`, now RESOLVED).

- `bash` / `pwsh` → decided by `toolBindings[].authorization` + `execution.executionBoundary` and the
  composition's executor readiness (`admission.ts:424-466`). Absent declaration →
  `ADMISSION_EXECUTION_UNAUTHORIZED`; `deny` → `ADMISSION_EXECUTION_DENIED`; a declared boundary with
  no ready executor → `ADMISSION_EXECUTOR_UNAVAILABLE`; `ask` → the existing Control approval.
  `Binding.process` and `io.process` do not exist. Arms `ADM-125`…`ADM-130`; the B ladder's rung-5
  negative is `ADMISSION_EXECUTION_UNAUTHORIZED` (`ADM-75`).
- `run_code` (PTC) → its **own** `ADMISSION_PTC_UNAVAILABLE` (`admission.ts:421-423`, `ADM-87/88`).
  **ROUND 85 measured the four parts**: nested calls re-enter the registry scheduler on the member
  agent's scope (**HOLDS**), escalation goes through `approval/request` → ControlService durable ask +
  one-shot grant (**HOLDS**), Stop aborts the run controller and terminates the Node child
  (**HOLDS**), and the WORKER's OS profile is the HOST session policy rather than the member's
  compiled read/write lanes (**FAILS**). The refusal text now names only that failing part and the
  per-execution policy seam it needs (`PTC-FOUR-PART-FINDING.md`, `CORE_SEAM_BLOCKER`).
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

### 6.5 Alpha.6: the refusal is recorded (round 68), the routed path is implemented (round 84), and the LIVE routed wake is REFUTED (round 87)

**Round 68** closed the recorded-fact gap at the host entry: `host.ts` runs
`createAlpha6RowRefusalHook` (`vnext/row-refusal-entry.ts`) at the config rule, before the unchanged typed
throw, and that hook builds the product's own `createHostSurfaceRefusalPoint` through
`createCentreHostSurfacePoint` (shared with `root.ts`) and writes the invocation-authority fact +
`REFUSED`/`not-started` settlement under the row's `centreStatePath`. Measured live in both D3 boots
(`refusalFactCount=1`, `refusalSettlement.state=REFUSED`), with the row still refused and no team row
live. `d3:alpha6` is PROVEN **as the typed-refusal shape WITH its record**.
**Round 84 changed the ENABLEMENT law:** the opt-in is no longer refused on every row. `centre-config.ts`
now admits a COHERENT configuration (authored v5 `reviewRouting.enabled === true`, a non-empty
`centreStatePath`, an ABSOLUTE `alpha6WakeIntentPath`) and refuses each incoherent one with its own typed
piece code (`ADMISSION_ALPHA6_ROUTING_REQUIRED` / `_CENTRE_REQUIRED` / `_WAKE_INTENT_PATH_REQUIRED`) under
the unchanged `ADMISSION_ALPHA6_UNAVAILABLE` prefix, so the recorded refusal still lands. The routed path
itself is implemented through the ONE centre interface: the decision is the shared policy's projection of
the durable control row (`ADM-142`), the wake is a governed DELIVERY (durable intent + confirmation facts
over the P6-T3 session-input port, machine-attributed, zero tool executions — `ADM-143`/`ADM-146`), and the
Officer's own `team_resolve_control` is admitted by the centre on `team.control` under the OFFICER's
binding (`ADM-144`). A PRODUCTION root boots a coherent row and merges three real asks into one wake
(`a6-root-wiring`, `a6-pr7-merged-wake-host`).
*Still NOT proven:* a **live host** run of the routed wake. The D3 world's blueprint is v4 with a single
worker member and no Officer/approval case, so that world can express only the refusal side, and no
mock-model path resolves a control. The live level therefore stays the refusal shape; the positive path
is MECHANISM-proven over the real ports. Remaining limit: a row with no `centreStatePath` is refused but
unwritten (there is no durable directory to write to).

**Round 87 — the live answer, measured (D4 probe; `dev/agent-workflow/evidence/d-boot-feasibility/d4/`).**
The v4 limitation above is gone: the probe authors the coherent **v5** world with an `officer` member and
boots it twice (rc.2 `639ed015…`, HEAD `775be06d7`, `agreeing=true differing=[]`). Four of the five judges
are **PROVEN live**: `d4:enablement` (the coherent row is admitted by `alpha6EnablementRefusal`, the host
boots, the TeamSession is served, zero refusal facts), `d4:officer-up` (the Officer is a RUNNING instance
with its own running child session), `d4:officer-binding` (the Officer's OWN `read` is admitted by the ONE
centre under ITS binding: one allow `invocation-authority` fact for its callId, settlement
`ADMITTED→RUNNING→COMPLETED`), and `d4:refusal` (the same v5 document without `reviewRouting` is refused
by name, recorded, settled `REFUSED`, zero wakes). The fifth, `d4:routed-wake`, is **REFUTED by the product
itself**: the worker's authored `ask` lane creates a REAL durable `leader-approval` row
(`control-request-recorded`, `actionName: admission-ask`, `toolName: write`) that carries **no
`approvalCaseId`, no `legOrdinal`, no `reviewAuthority`**; the product's own
`createAlpha6RootRouter.route()` answers **`null`** for that row with `memberListCalls: 0`; the durable fact
census of the world holds **zero** `team-review-wake-routed` / `team-review-wake-delivered` facts, **zero**
files in the wake-intent directory, and a disk-wide scan for `[team-review-wake` finds nothing; the
Officer's session never receives a review wake and the **Leader** receives the plain C1 ask
(`[team-control … waiting for Leader approval`). The ask WAS resolvable through the plain C1 path (the
Leader's `allow` is durably recorded), so the world is coherent — what is missing is the route.
**TWO Team-side seams, neither a `CORE_SEAM_BLOCKER`:** (1) no live producer of a case-bearing ordinary
ask — `route()` requires the case identity (`alpha6/root-router.ts:209`), the case-less notifier branch
wakes the Leader by design (`alpha6/notifier.ts:159-169`), the only live leg producer `requestApprovalLeg`
(`control/service.ts:5607`) is called solely by the envelope-mutation lane (`governance/service.ts:1016`,
excluded by `isDelegableOrdinaryToolAsk`, `review-router/policy.ts:68`), both ordinary-ask producers are
case-less by construction (`src/plugin/vnext/admission-port.mjs:155-165`; `packages/tools/src/tools.ts:973-1000`),
and the Alpha.4 PA ask lane was deleted by the A1 cut (`1617d5839`); (2) no consumer for an
`ask`-disposition call even after an allow — the centre refused the granted call verbatim
(`member-io-policy/src/provider-capabilities.ts:315`, `IO_ASK_REQUIRES_APPROVAL`, "`resolveAskClassCall`
has no production caller", BL-30; `ALPHA5-SANDBOX-BACKLOG.md:559/:562`). No leg was fabricated, no control
route was added to the harness, and no wake file was written by the driver.

**ROUND 88 — seam (2) is now measured to be a CONTRACT conflict, not an unwired call (and it is still open).**
The task was to wire `resolveAskClassCall` so a granted `ask` executes. The measurement
(`dev/agent-workflow/evidence/bl-30-ask-consumer/README.md`, two new arms in
`packages/runtime/test/a5sf-approval-takeover.test.ts`, real `ControlService`) shows the seam's contract
cannot be satisfied by the product's own ask: the adapter's authority is the last-mile guard
`guardOperation`, which by DESIGN never consumes or authorizes an INLINE allow (B2/§D.4,
`control/service.ts:4155-4165`, `:4289-4291`), while the admission ask — the only production producer — is
`executionCoupling: 'inline'` (`admission-port.mjs:76-79`, `:163`; measured on the round-87 live row). Same
scope, guarded ⇒ adapter accepts and one durable consumption; inline ⇒ `no-request`, `APPROVAL_DENIED`,
zero consumptions. And the one-shot grant that DOES authorize the call is spent by the host tool guard
before the body reaches the refusing Provider plane (`admission-port.mjs:770-784`), so the Provider cannot
be a second consumer without a second authority. **No product code changed, no grant ledger added, no
coupling flipped**: the lawful fixes are owner decisions (name them, don't pick one silently) — flip the
ask to `guarded` (loses the Stop-cancels-the-pending-ask law, `ADM-57`/round-62 live stop) or give the OS
plane a read port onto the centre's already-enforced per-call decision. `d4:routed-wake` therefore stays
**REFUTED**; gap (2)'s live status is unchanged and now precisely explained.

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
- `DEV-LIVE` boots are real host processes but **not gates**. Since round 76 all three drivers end `overall=PASS` (the round-70 sentence "`overall=FAIL` for both drivers" was stale and contradicted §3.2); `DEV-LIVE` is still not a gate and no row moves on it.
- Consequences that only exist in one class are stated per item: the archived member's **product route**
  refuses earlier at the durable lifecycle gate, so `ADM-93` proves the centre's own tombstone, not the
  product's refusal order (`CAPABILITY-MATRIX-C.md:61-64`); `IO_READ_DENIED` is unreachable on the live
  path by design and is proven **in-process** (`ADM-100`).

### 6.9 A realm-less member that asked for the centre is refused; one that never asked stays outside it

The centre is installed only inside `if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined)`
(`agent-bindings.mjs:1972-1978`). **Correction (round 67):** an earlier draft of this section said a
member with `centreStatePath` but no realm "runs unmediated and unreported". That was wrong and is
corrected here, not softened: `memberCentreUnwiredViolation` (`centre-config.ts:36-49`, called at
`agent-bindings.mjs:1972`) **refuses** exactly that member with `MEMBER_CENTRE_UNWIRED` (`ADM-44`),
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
`admission.ts:132-137`). This is a **limit, not a confinement claim**, and it is repeated in C15 of §2.

### 6.12 The centre is not mount-aware

Its binding is installed at the member bind (`agent-bindings.mjs:2036` installs the member centre) while
`mcpMountTarget` is computed later per boundary (`agent-bindings.mjs:2287`), and `admission.ts:364-368` has no
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

**Still-open register (round 89: re-issued as §10, which is the authoritative list; this paragraph keeps the
round-86 numbering so older citations still resolve).** The **fourteen** items are: (1) the root-work async
seam (`team.admitInitialWork` /
`team.ensureRootLive` refused; no enqueue-and-acknowledge seam exists); (2) no live `member.create` /
`member.followup` (only `member.send` was driven); (3) PTC's worker OS-profile seam
(`CORE_SEAM_BLOCKER`); (4) Alpha.6's **live routed wake** (the formal routing is implemented and the
refusal shape is live); (5) the rc.5 `{{cwd}}` persona change (rc.5 no longer registers the variable, so
the preset suffix names "the session workspace" — a substitution, not a governed feature); (6) the
operator is a **per-DSH_HOME authenticated human, not RBAC**, with no user-level isolation claimed;
(7) the census runner's **five ENV-LIMITED arms** (`ENV-LIMITED-CAPABILITY-20261123.md`); (8) the
**pre-dispatch Stop observer is not production-wired** (`RC5-MIGRATION.md:492-504`); (9) the realm-less
admission ruling (code refuses today; the ruling decides the final answer); (10) search-face shape A (the
durable overlay cannot deny a search); (11) the scripted mock model stands in for a real model;
(12) the census population counts differ from the published baseline (identity set identical);
**(13, round 87) no live producer of a case-bearing ordinary ask** — the only live leg producer
`requestApprovalLeg` serves the envelope-mutation lane, so every durable ordinary ask is case-less and
`alpha6/root-router.ts:209` returns `null` (`d4:routed-wake` REFUTED); **(14, round 88) no consumer for an
`ask`-disposition call (BL-30)** — `resolveAskClassCall` has no production caller and cannot be wired
without an invariant/owner decision, so a granted `ask` still does not execute.
`CANDIDATE-AUDIT.md` §6 carries the round-86 register with what closes each one; **§10 below supersedes it
for the current HEAD.**

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

### 6.16 The two entry files are still large — round 90 is a REVIEWABILITY change, and this is exactly what it does not prove

**The limitation.** The A1 cut replaced the two entry files wholesale and they carry the whole centre
assembly: `agent-bindings.mjs` was **4,967** lines and `root.ts` **5,239**. Nothing in the acceptance
argument depended on their size, but a reviewer cannot hold a 5,000-line closure in view, so the size
was itself the review risk. Round 90 (branch `vnext/a1-cut`, evidence
`round90/`) moves four cohesive spans of `agent-bindings.mjs` into sibling modules under
`packages/runtime/src/plugin/vnext/`, **verbatim**, and imports them back.

| span (what it owns) | new module | moved lines | module lines |
| --- | --- | --- | --- |
| the governed preset's enabled row module specifiers + each row's declared `config` (SHAPE A) | `governed-preset-modules.mjs` | 127 | 156 |
| the MCP CAPABILITY WITNESS: capability telemetry, the F15 public tool-surface readers, fiber retirement | `mcp-witness-lane.mjs` | 158 | 205 |
| the Root (Leader) input delivery ports: the ONE shared real-input path + the B6 context, TCM-M3 initial work, C1 control notification | `root-delivery.mjs` | 208 | 248 |
| the Member stop lane: interrupt + PD-29 goal disarm, the recursive descendant drain, the live-residency port | `stop-drain-lane.mjs` | 205 (3 chunks: 95 + 12 + 98) | 249 |

`agent-bindings.mjs` went **4,967 → 4,302** lines; `root.ts` is untouched (5,239). Every module is a
factory over one row instance — no module-level mutable state, exactly like the closure it came from.

**How "verbatim" was proved, not asserted.** Each moved range was copied by line range from
`git show HEAD:…/agent-bindings.mjs` and the receipt
(`round90/byte-identity.txt`) is a substring test in both directions: the exact original text is present
in the new module AND ABSENT from the rewritten glue. Six ranges, 698 lines, all
`verbatim_in_module=True absent_from_glue=True`. The only new lines at the move sites are the
import/destructure lines and a comment; the only deleted lines are the moved ones. The exported surface
of `agent-bindings.mjs` is unchanged (`createAgentBindings`, `a5PlaneSubtreeContains` and the existing
`createPtcEscalationRouter` re-export).

**Same counts, same digest, before and after.**

| gate | before | after |
| --- | --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | `suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975` | identical |
| `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` | identical |
| `run-boot.mjs --boots 1` | `RESULT FAIL` (5 PASS / 1 FAIL: `d:remote-creation`), exit 1 | identical |
| `run-boot-d2.mjs --boots 1` | `RESULT PASS`, 4/4 PASS, exit 0 | identical |
| `run-boot-d3.mjs --boots 1` | `evidence-complete=true allProven=true`, 4/4 PROVEN, exit 0 | identical |

The `run-boot` FAIL is the pre-existing `d:remote-creation` arm at this HEAD (it is FAIL before and
after the decomposition; this round neither fixes nor hides it — the point of the pair is that the
verdict is *unchanged*).

`place-dist-glue` mirrors all four new files (30 → 34 placements, every line `(byte-identical)`), and
the round-90 p4t6 booking (`packages/testkit/test/p4t6-bookings/round90decomposition.json`) records the
**measured** scannable-surface delta `1313 → 1317` — the scanner printed
`scanner counts 1317, ledger derives 0 + 1313 = 1313` with the four files unbooked, and the ledger is
green with exactly those four paths booked. No arm was relaxed.

**Three things deliberately did NOT move, each with its reason.**
- `observeMcpOperationalWitness` (the F15 confirmed-loss classifier) reads the row's `closing`
  primitive (`let closing`, set once by `close()`). A primitive cannot be passed by reference, so a move
  would have forced an edit to the moved condition — a logic edit this round refuses. It stays in the
  glue and consumes the moved readers through the factory return.
- `deliverRootWorkCompletionNotification` and `deliverReviewWake` read the same `closing` primitive; they
  stay for the same reason.
- `reconcileMcpSet` (the mount/dispose transaction) and the plugin-owned cooldown/reconnect constants
  stay: `f15-mcp-live-loss.test.ts` §9.2 is a STATIC call-site witness that reads `agent-bindings.mjs`
  and pins exactly one `state.mcpMountCtx.plugin(mcpClient,` site plus the literal policy constants.
  Moving the transaction would have required editing that test, which the round's rules forbid; the
  alternative — leaving the assertion pointing at a file that no longer holds the call site — would have
  been a silent weakening. This is the one span the round wanted and could not take without a test edit,
  and it is reported as such.

**What this does NOT prove.** No behaviour was changed, so nothing new is proven — and that is the whole
claim. Specifically: (a) the moved modules are exercised through the SAME suite population as before
(the leg populations did not grow; there is no new unit test for a factory boundary, because inventing
one would be new surface, not preservation); (b) `root.ts` was **not** decomposed, so the reviewer's
size concern is only partly addressed (5,239 lines remain); (c) the decomposition does not make the
centre assembly easier to *test* — it makes it easier to *review*, and that is a line-count and
diff-shape claim, not an acceptance level; (d) the `d:remote-creation` red at `run-boot` is unchanged and
still open (§10 register). CORE PATCH BUDGET = 0: no upstream file was touched, no port was opened, no
second server was started.

---

## 7. Verdict

**What a reviewer may conclude.**

1. **The candidate implements A1 + B + C.** The A1 cut is closed by measurement, not by prose: 148 sources
   gone, `prodRefs=0`, `distResiduals=0`, `dupNames=0`, 34 byte-identical dist placements (30 at the
   round-89 head; round 90 added the four decomposition modules), and the 37/180/
   69,512-line frozen census unchanged (§1.1–§1.2). B and C are carried by the arms through `ADM-146` and
   `SLICE-21…SLICE-38` in the `ute-vnext-a1` node leg (**211 tests / 209 pass, 0 fail, 2 disclosed skips**)
   and by the 15 migrated capability
   suites (**238/238**, `verdict=PASS`) (§4). C14b's six invariant arms are part of that count, as are
   round 68's three entry-ordering arms and round 73's six settlement-Option-A arms (`ADM-119`…`ADM-124`).
2. **There is live D evidence for the listed items.** **Every live judge is PROVEN** at two agreeing
   boots each — **fourteen** judges: the twelve measured through round 74, round 76's
   `d3:persistent-subprocess`, and round 83's `d2:remote-delivery` (rc.2 only; see §3.2) — `d:remote-creation`,
   `d:member-read-admitted`, `d:guard-facts`, `d:centre-facts`, `d:native-read-surface`
   (repaired, not deleted), `d:member-read-denied` (round 71: channel-typed, provider guard facts
   required to be ABSENT on the lane channel), `d2:multi-member-concurrency`, `d2:revocation` (round 71:
   the four contract directions, widening measured and refused), `d2:stop`,
   `d3:persistent-subprocess` (round 76: a persistent, OS-confined shell across two turns),
   `d3:crash-cold-recovery`, `d3:work-delivery`, `d3:alpha6` (as the typed-refusal shape). The P1–P5 obligations each have a green
   assertion, a negative control, and a live carrier (§3). **Round 87 adds four more PROVEN live probe
   judges** — `d4:enablement`, `d4:officer-up`, `d4:officer-binding`, `d4:refusal` — over a coherent v5
   world, and **one REFUTED** (`d4:routed-wake`). The D4 probe is a blocker measurement, not a driver
   acceptance; it upgrades no row and its REFUTED judge is carried in §6.5/§10, not hidden.
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
   - **Alpha.6's ENABLEMENT is no longer the gap; the ROUTED WAKE is REFUTED live (round 87).** A
     coherent v5 row boots, the Officer is up and its own calls are admitted under its own binding — but
     the product's own durable ordinary ask carries no case, `alpha6/root-router.ts:209` returns `null`,
     and the Leader receives the plain C1 ask (`d4:routed-wake` REFUTED). The blocker is two Team-side
     seams, **not** an upstream seam (§6.5, §10 G1/G2) — and the second one means **a granted `ask`
     still does not execute in production** (BL-30).
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
| 1 | **Branch and base** | `vnext/a1-cut`, measurement commit `97d7d7c8d1bb0410dac9dedac77dee97143851bf` (round 89), base `a19d1df01` (frozen A0, PR #821, `master`) | `git rev-parse HEAD`; §1 |
| 2 | **No auto-merge** | PR #822 is **draft**, base **`master`**, state **OPEN**; the engine may sync the body but must never mark it ready or merge it. **Merging is the OWNER's act** — not the engine's, not this branch's | `gh pr view 822 --json isDraft,baseRefName,state` → `{"baseRefName":"master","isDraft":true,"state":"OPEN"}` |
| 3 | **Gates green (local)** | every required command passes at this HEAD (dispatch 211/209/0/2; catalog 785 collected / 38 uncollected / 14 excluded; closure four zeros with `references=3`; assets 37/180/69,512; docs-sync 0 findings; 30 placements; CI-required 10/0; CI-security bound vitest 216; migrated layer 238/238; `ci-pr-gate --full --census-captures 2` 10/10; UTE G1 89/89). **Hosted is NOT all-green at this HEAD: `ci-integration` FAILED and `ci-census` was skipped; `ci-required` is red for both reasons** (§9.4, §10 G9) | §4.1–§4.8, §9.4; `round86-ci-pr-gate.log` (round-86 block) and the §9.4 block (round 89) |
| 4 | **Refuted / unreachable items listed** | `d3:persistent-subprocess` (round 76: PROVEN in two agreeing DEV-LIVE boots — a persistent OS-confined shell across two turns; its `ask`/`deny` arms and a gated status remain unproven), **`d4:routed-wake` REFUTED (round 87)** with the two in-repo seams named, search face lane-only, provider channel unreachable on the LIVE path (in-process only), widening beyond the ceiling impossible by design. **Runtime creation is no longer on this list** (round 74 RESOLVED, `d:remote-creation` PROVEN) | §3.2, §6.2–§6.5, §6.6, §6.13, §7, §10 |
| 5 | **Owner decisions listed** | **two remain open rulings** (realm-less admission; search-face shape A), the PTC upstream seam, **plus four rulings the two round-87/88 seams need** (one Alpha.6 ask-producer decision; three BL-30 routes: guarded coupling, an OS-plane decision read port, or accepting the refusal). The other four older items are resolved or implemented (process lane: `bash`/PTY live, PTC seam-blocked; runtime creation; settlement recheck; Alpha.6 formal routing — live routed wake REFUTED) | `OWNER-DECISIONS.md` (round-86 correction block + round-89 addendum), §9.5, §10 |
| 6 | **Host untouched** | pinned host `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain empty; CORE PATCH BUDGET = 0 with no upstream patch | §5.1–§5.3 |
| 7 | **No PRODUCT-PROVEN row** | by design at this stage: `DEV-LIVE` boots are not gates | §2.1, §6.1 |

**Plain statement.** This candidate is reviewable now and mergeable **only by the owner**. Nothing here
is a release, a deployment, a version bump, or a claim that the product is accepted.

---

## 9. Round 83 — work DELIVERY on the management plane, and the gates at this HEAD

### 9.1 What changed

Round 74 restored S6 Remote as a governed management plane and refused five commands as
`agent-execution`. Three of those were real product operations. Round 83 keeps the exact boundary and
delivers them the only lawful way:

> **The management plane may DELIVER work. It may never EXECUTE a tool.**

- **Classification** (`packages/runtime/src/plugin/s6-command-classification.ts`): a third SERVED class
  `work-delivery` = `member.create`, `member.send`, `member.followup`. The refused set shrinks to
  `team.admitInitialWork`, `team.ensureRootLive` (both `agent-execution`). Still ONE closed table, no
  default-allow, unknown commands still refused.
- **`member.create`** → the S6 admission port → `TeamRuntime.performAction({action:'create-member'})` →
  the ONE ActivationProvider; the effect is `member-activated`. Creation only: no work chain, no turn.
- **`member.send`** → the S6 messaging port → P6-T3 coordinator: durable intent fact → input ACCEPTANCE
  into the recipient's own session inbox → confirmation fact. The answer IS the acknowledgement.
- **`member.followup`** → the S6 admission port → `performAction({action:'follow-up',
  execution:'async'})`: Phase A commits the durable `team-work-admitted` receipt and returns it; Phase
  B/C run DETACHED inside the Team runtime. The request never awaits, and never observes, the turn.
- **`team.admitInitialWork` / `team.ensureRootLive` stay REFUSED**, stated as a ruling: the first's only
  seam awaits the root's turn to idle (and is root-scoped, not a Member delivery); the second starts an
  executor and returns no delivery acknowledgement at all. Neither can be expressed as a delivery.
- **Fail closed**: a delivery command on a row with no delivery port answers the EXISTING wire code
  `ADMISSION_REMOTE_UNAVAILABLE` with a message naming the unwired seam, typed, before any claim/param/
  durable write — never a fallback to executing. The refusal reason was shortened to fit the 512-char
  settlement reason cap (ADM-86 now asserts the cap; E3 runs with zero settlement faults).

### 9.2 Boundary arms (host-free)

- `packages/runtime/test/vnext-admission.test.mjs` **ADM-86** (rewritten): literal delivery set and
  refusal set; served `catalog.list`; `member.send` reaches the coordinator exactly once and returns the
  `delivered` outcome (no `toolResult|result|assistant|executionId`); `member.followup` reaches the
  action facade once; `member.create` reaches the creation action once with no execution mode; the
  refusal hook is NEVER consulted for a delivery command; the plane has no `tool|provider|execute|
  bridge` port; the two root commands keep the durable `team.control` refusal + `REFUSED`/`not-started`
  settlement; an unwired seam fails closed typed; unauthenticated is refused first.
- `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` **E3**: the production root
  installs the plane, serves a read, refuses ONLY the two root commands (facts on the row's own ledger),
  leaves NO deny fact for a member command, and at the exact production port
  (`createS6RemotePorts`) `member.followup` asks the facade for `execution:'async'`, `member.create`
  carries no execution mode, `member.send` reaches the coordinator.

### 9.3 Live proof (D2, DEV-LIVE, `--boots 2`, two agreeing boots)

`d2:remote-delivery` **PROVEN on both boots**; the driver runs its FULL declared set
(`selected=4 / totalCases=4`, `subset=false`) and `agreeing=true differing=[]`.

```
[ boot1] member.send ack: status=200 ok=true code=null deliveredSeq=40 facts=18 admissions=0 executions=0
[ boot1] member.send unknown member: ok=false code=TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED requestsAdded=0
[ boot1] member.send duplicate: ok=true distinct=true requestsAdded=0
[ boot1] member.send archived: lifecycle=ARCHIVED ok=false code=TEAM_RUNTIME_WORK_STATE_REJECTED requestsAdded=0
[ boot1] member.send restored: lifecycle=SETTLED ok=true code=null
[ boot1] delivered-stop: ackOk=true pending=true landed=true state=REFUSED refusal=ADMISSION_STOPPED
[ boot1] case d2:remote-delivery: PASS
```

Measured facts (boot1; boot2 identical): ack intent seq **39** / confirmation **40**; at the ack
**0 admissions / 0 executions** for the delivered call; after the member's own turn, B's ledger 18 → 20
facts with the centre's `allow` on `fs.read` (`instanceId = agentId = B`, B's in-lane locator) at
`…40.623Z` vs the ack at `…40.510Z` (**~113 ms later**), one `completed` execution, and B's in-lane bytes
in B's transcript. Duplicate send is a SECOND durable coordination (at-least-once, not a token replay)
with 0 provider requests at the ACK and still exactly one completed execution. Stop during a DELIVERED
turn is `ADMISSION_STOPPED` with a `REFUSED`/`not-started` settlement. Host porcelain empty after both
boots; DEV-LIVE slots released.

### 9.4 Required gates re-run at this HEAD

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 211
ℹ pass 209
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 0
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=785 instruments=3 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32
  DISCOVERED_AND_COLLECTED 733
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              38
  by runner: node=146 none=7 vitest=632
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (30 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-security      # the bound vitest leg
EB3-LAYER layer=ci-security verdict=PASS suites=14 files=14 describes=61 passed=216 failed=0 clock_ms=20000

$ npx vitest run <the 15 migrated files in evidence/ute-a1/migrated-entry-imports.json>
 Test Files  15 passed (15)
      Tests  238 passed (238)

$ node --test --test-force-exit --test-timeout=480000 --test-reporter=spec \
    tests/ute1-fs/native-fs-binding.test.mjs tests/ute-g1-fs/lane-suite.test.mjs \
    tests/ute-g1-fs/lib/refusal-categories.test.mjs tests/ute-g1-fs/product-route-image.test.mjs \
    tests/ute-g1-search/lane-suite.test.mjs tests/ute-g1-web/lane-suite.test.mjs \
    tests/ute-g1-process/lane-suite.test.mjs tests/ute-g1-agentctl/lane-suite.test.mjs \
    tests/ute-g1-uistate/lane-suite.test.mjs
ℹ tests 89
ℹ pass 89
ℹ fail 0
```

`ci-pr-gate --full --census-captures 2` (**PASS 10/10**, 275.7 s at `97d7d7c8d` (an earlier same-HEAD run measured 285.5 s; the verdict was identical); 2 captures, identical
identity sets, captured **599 files / 7,416 lines** vs the baseline-declared 626 / 7,936 — the counts moved
by the round-88 arms, the identity set did not). The PR settlement gate and the hosted verdicts are
recorded in the **round-89** settlement comment on PR #822 (the comment is the living record).

**Hosted at `97d7d7c8d` (queried this round; this supersedes the `c29da52d3` set pasted in round 86):**
`pr-gate`, `ci-fast`, `ci-security`, `ci-product`, `synthesize-merge-tree`, `candidate-protection`
**success**; `ci-census` **skipped (draft)**; **`ci-integration` FAILURE** — leg `tinf-instruments`,
`EB3-REQUIRED` grading `fail layers=6 green=4 nongreen=ci-integration:failure,ci-census:skipped` — and
`ci-required` / `ci-required-deferred` failure for exactly those two non-green layers;
`pr-settlement-gate` failure until the round-89 comment. **The `ci-integration` red is not claimed as
"solely the census skip" any more.** Its job log (run `45136105108`, job `137562782742`) names **no
failing assertion**: the leg's output ends mid-line at `D17` with no `DSH-TEST-DISPATCH` token, i.e. the
node process aborted. The same leg is **GREEN locally** (51 suites, `exit=0`, 334.3 s,
`sha256:6954daa63c627bfe8968b1221dadf58b2e6fcfdd8a562c39d3a7a51f6c49d556`), so the hosted red is **not
reproduced** here; it is carried as open item **G9** in §10, not explained away.
Hosted evidence: check-run API for `97d7d7c8d` (2026-11-23T08:07–08:10Z).

### 9.5 NOT proven in round 83

- `member.create` and `member.followup` have NO live S6 proof (production-port + router-detach arms
  only); only `member.send` was driven over the real API in the D2 world.
- `team.admitInitialWork` / `team.ensureRootLive` remain unavailable through this plane; no async
  root-work delivery seam exists and none was invented.
- The operator is the per-DSH_HOME authenticated human whose claim must be an owned root — not
  multi-user RBAC, and no user-level isolation is claimed.
- The model is the product's scripted mock; the delivery's timing is measured from durable fact
  timestamps, not from a real provider's scheduling.
- No PRODUCT-PROVEN row moves: every live claim here is DEV-LIVE.

### 9.6 What rounds 87–88 added to this section (and what they did not)

- **Round 87 (D4 probe, two agreeing boots):** a coherent v5 Alpha.6 world **boosts**, the Officer is up
  and its own binding admits its calls, and incoherent rows are refused by name — but the product's own
  durable ordinary ask is **case-less**, so `alpha6/root-router.ts:209` returns `null` and
  `d4:routed-wake` is **REFUTED**. Four judges PROVEN, one REFUTED; this adds no PRODUCT-PROVEN row.
- **Round 88 (BL-30 boundary):** the ask-consumer wire-up was attempted and **STOPPED** with the
  invariant measured over the real `ControlService`: the only production ask producer hard-codes
  `executionCoupling:'inline'` (`admission-port.mjs:163`), an inline durable allow is never a guard token
  (`control/service.ts:4155-4165`, `:4289`), and the one-shot grant is already spent at the host tool
  guard (`admission-port.mjs:770-784`). Two new arms in the seam's own suite (25/25 pass); **no product
  source was changed**. Consequence: a Member can ASK, be GRANTED, and still not run the granted call.
- **Neither round re-ran a boot for `member.create`/`followup` or the rc.5 pre-dispatch observer**, so
  those two gaps are unchanged (§10 G4/G5).


---

## 10. OPEN GAPS — the round-89 register (every still-open item, with the owner decision it needs)

This section is the authoritative open-gap list at `97d7d7c8d`. It **adds** the two round-87/88 seams to
the round-86 register (§6.14) and restates the older items so that no gap is discoverable only by reading
a cell. Nothing here is a TODO the engine may close by itself; each row that says **owner decision** is a
ruling, and the two seam rows are explicitly **not** upstream patches (`CORE PATCH BUDGET = 0`).

| id | open gap (measured, not inferred) | evidence (`file:line` / artefact) | what closes it |
| --- | --- | --- | --- |
| **G1** | **Alpha.6 has no case-bearing ordinary-ask producer (Team-side seam, NOT upstream).** `requestApprovalLeg` is only called for `envelope-mutation`; the ordinary `ask` lane does not call it and is explicitly excluded by `isDelegableOrdinaryToolAsk`, which needs `kind:'leader-approval'`, `reviewAuthority:'leader'`, an `operationFingerprint`, an `authorityScope` and a non-null `operationTool`. So the only live ordinary ask is **case-less**, `root-router.ts:209` returns `null`, and no wake intent is ever written. `d4:routed-wake` is **REFUTED** on two agreeing boots. | `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md` §4.2; `d4/runs/boot0{1,2}/control-row-durable.json` (no `approvalCaseId`/`legOrdinal`), `route-probe.json` (`null`, 0 member reads); `packages/runtime/alpha6/root-router.ts:209`; `packages/runtime/review-router/policy.ts:68-75`; `packages/runtime/src/plugin/vnext/admission-port.mjs:158-165` | **Owner decision R1** (below) — commission the Alpha.6-aware case-forming ask lane, or accept that the routed wake stays unproven this generation |
| **G2** | **BL-30: no production consumer for an `ask`-disposition call, and it cannot be wired without an invariant change.** The only production ask producer hard-codes `executionCoupling:'inline'`; an inline durable allow is never a guard token (`guardOperation` `no-request`); the one-shot grant is already spent at the host tool guard before the Provider plane runs; and `resolveAskClassCall` has no production caller, so the confined provider refuses `IO_ASK_REQUIRES_APPROVAL`. **Consequence: a Member can ASK, be GRANTED, and still not run the granted call in production.** | `dev/agent-workflow/evidence/bl-30-ask-consumer/README.md` §1–§3; `packages/runtime/src/plugin/vnext/admission-port.mjs:76-79`, `:163`, `:770-784`; `packages/runtime/control/service.ts:4155-4165`, `:4289-4291`; `packages/runtime/member-io-policy/src/provider-capabilities.ts:196-210`, `:315`; `d4/runs/boot01/wake-measurement.json#workerWrite.result`; measured arms `packages/runtime/test/a5sf-approval-takeover.test.ts` (25/25) | **Owner decision R2/R3/R4** (below) |
| **G3** | **PTC (`run_code`) is refused with `CORE_SEAM_BLOCKER` on the worker's OS profile.** Three of its four parts hold (nested calls, Control escalation, Stop); part (a) — the worker's OS confinement is not the member's compiled profile — needs a per-execution policy seam upstream, which this repo may not patch. | `PTC-FOUR-PART-FINDING.md`; `packages/runtime/src/plugin/vnext/admission.ts:421-423`; report §6.3 | upstream/owner acceptance of the `CORE_SEAM_BLOCKER` shape — not product work here |
| **G4** | **Two S6 root-work commands stay refused** on the management plane: `team.admitInitialWork`, `team.ensureRootLive`. No async enqueue-and-acknowledge root-work seam exists, and none was invented. | `packages/runtime/src/plugin/s6-command-classification.ts:111-112`; report §9.5; `d3:work-delivery` (landed=0 for root) | a new governed root-work delivery seam (product work) or an explicit owner ruling to keep them out of scope |
| **G5** | **The rc.5 pre-dispatch-abort observer is not wired into a booted production turn.** The rc.5 additions have mechanism arms and no production pre-dispatch wiring, so a Stop between admission and dispatch is not live-evidenced on rc.5. | `RC5-MIGRATION.md:492-504`; `packages/runtime/src/plugin/vnext/pre-dispatch-abort.mjs` (present, mechanism-only) | production wiring plus a live boot; owner ruling not needed, product work needed |
| **G6** | **No live evidence for `member.create` / `member.followup`.** Only `member.send` was driven through the real S6 API on two deterministic boots (plus production-port/router-detach arms for the other two). | report §9.3, §9.5; `dev/agent-workflow/evidence/d-boot-feasibility/d2/README.md` | extend the D2 driver's case set and re-boot (product instrumentation, no product semantic change) |
| **G7** | **Five ENV-LIMITED census arms are never counted as PASS.** Their guarantee is implemented and proven on a host that offers the physical capability; this runner does not (`unshare`/`CLONE_NEWUSER`), so the only admissible evidence here is the product's fail-closed refusal. | `ENV-LIMITED-CAPABILITY-20261123.md`; `CAPABILITY-MATRIX-C.md` round-82 section (`DSH-TEST-DISPATCH-ENV-LIMITED count=5 proven=0 env_blocks=3 fail_closed_controls=2`) | a runner/host that provisions the namespaces; not a product change |
| **G8** | **The operator is a per-DSH_HOME authenticated human, not RBAC.** Every management-plane claim is scoped to that operator; no multi-user isolation, no per-user authority, no tenant boundary is claimed. | `CAPABILITY-MATRIX-C.md` C-work row; report §6.2, §9.5 | owner decision on whether RBAC is in scope for a later stage |
| **G9** | **The model is the shipped scripted mock** (`packages/tools/harness/mock-deepseek.mjs`) in every live boot. Timing claims are measured from durable fact timestamps, not from a real provider's scheduling; no real-model interleaving is proven. | report §6.7; `CAPABILITY-MATRIX-C.md` round-63 section | a real-model live round; no owner ruling needed, a measurement is needed |
| **G10** | **Hosted CI is NOT all-green at `97d7d7c8d`.** `ci-integration` FAILED on leg `tinf-instruments`; its job log names no failing assertion and ends mid-line at `D17` with no `DSH-TEST-DISPATCH` token (abort), and the same leg is GREEN locally (51 suites, `exit=0`, 334.3 s). `ci-census` skipped (draft) and `ci-required` red for exactly `ci-integration:failure,ci-census:skipped`. | §9.4; run `45136105108`, jobs `137562782742` (integration) / `137563665337` (required); local `tinf-instruments` log in the round-89 session | a hosted re-run that reproduces or clears the abort; the cause is **unidentified**, and this report does not claim it is the census skip. **Round-89 update: at the next (docs-only) head `d1506acd1` the same hosted job set re-ran and `ci-integration` came back SUCCESS (2026-11-23T08:5xZ), so the `97d7d7c8d` failure was transient rather than a standing product red; `ci-required` still fails there for the draft `ci-census:skipped` layer only.** |

### 10.1 The four owner rulings the two new seams need

Neither seam is a `CORE_SEAM_BLOCKER`, and neither can be closed by re-enabling an ungoverned plane. The
four decisions are:

1. **R1 — Alpha.6 ask producer (G1).** Commission the Alpha.6-aware ordinary-ask lane: the admission `ask`
   path must open the durable request through `requestApprovalLeg` with `authorityScope`,
   `operationFingerprint` and `requestedEffect`, i.e. make an ordinary tool ask a first-class Alpha.6 case.
   *Cost:* a new admission ask shape; the current case-less `admission-ask` rows remain compatible.
   *Alternative:* rule that the live routed wake is out of scope for this generation and keep
   `d4:routed-wake` REFUTED as the disclosed state. Either way the report's level does not move.
2. **R2 — BL-30 route (a): flip the production ask coupling to `guarded`.** One approval would then have
   TWO one-shot paths (the binder grant and `guardOperation`'s `control-allow-consumed`) and a Stop would
   stop abandoning the pending ask (`ADM-57`, the round-62 live Stop arm), because `inlineAbortCascade`
   gates on `inline`. *Cost:* two authorities over one decision; a governance level change, stated openly.
3. **R3 — BL-30 route (d): let the OS/Provider plane read the ONE decision the centre already enforced.**
   The admission point publishes the resolved disposition it already writes into its `invocation-authority`
   fact (`decision: allow`, `laneDecision: ask`), and the confined provider narrows its ask on that
   decision only. *Cost:* a new cross-plane read port; the OS plane stops being an independent refusal and
   becomes a reader of the centre's decision (an admission-duty shape change).
4. **R4 — BL-30 status quo: keep the refusal.** Rule that an `ask`-disposition call does not execute in
   this generation, and carry `IO_ASK_REQUIRES_APPROVAL` as the intended level. *Cost:* none to safety;
   the capability stays at its honest "refused, no consumer" level, and BL-33's consumption half stays
   blocked.

Routes (b) (substitute a different `AskApprovalAuthority`) and (c) (mint a second guarded row) are **not**
offered as decisions: the product's own contract refuses both (`approval-takeover.ts:63-68`; "one call
site" / single consumer).

---

## 11. Corrections made in the round-89 pass

**19 claims were corrected or re-measured** (the instruction was to fix the claim, never the evidence; no
evidence file, test, skip or A0 artefact was edited). The worst five:

1. **`d4:routed-wake` was carried as "unproven" while the round-87 evidence says REFUTED.** Corrected in
   §2.2 C7, §6.14 (item 13), §7, §9.6 and §10 G1 — with the two named seams and the `root-router.ts:209`
   reason.
2. **The report implied a live grant could execute.** Round 88 measured that **a granted `ask` still cannot
   execute in production** (inline coupling; grant spent at the host guard; no consumer). Corrected in §2.2
   C5, §7 and §10 G2.
3. **The scope block was 5 commits stale**: 205→**210** commits, 3,377→**3,476** files,
   +241,087→**+249,967**, `2,548 A · 210 M`→**`2,646 A · 211 M`** (§1).
4. **Hosted CI was described as "six layer jobs green; red solely because the census is skipped."** At this
   HEAD `ci-integration` FAILED independently (`EB3-REQUIRED fail layers=6 green=4
   nongreen=ci-integration:failure,ci-census:skipped`), and the failure is not reproduced locally.
   Corrected in §9.4, §8 row 3 and §10 G10.
5. **`ci-pr-gate` and the census numbers were stale** (274.7 s→**275.7 s**; two same-HEAD runs: 275.7 / 285.5; census 599f/**7,414**l→
   **7,416**l from the round-88 arms; 10/10 unchanged, identity set unchanged) — §9.4.

The other corrections (documentation-only; not every one is a claim-level change): §1.1 closure line gains
`retiredSurfaces=12 placements=self`; §4's round-83 note no longer cites 206/204 and 29 placements; §4.2
gains the `by runner` line and §4/§9.4 gain the docs-sync block; §2.2 C5/C7 consequence text; §6.14
register renumbered 12→14 and pointed at §10; §7 adds the four round-87 PROVEN judges and one REFUTED;
§8 rows 1/3/4/5 re-stated for this HEAD; §9.5/§9.6 split; PR body HEAD/gate/limits blocks (the PR body's
own count is in its round-89 block); and the four
owner-decision items in `OWNER-DECISIONS.md` now carry the round-89 addendum.
