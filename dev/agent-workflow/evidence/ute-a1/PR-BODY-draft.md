# feat(ute-vnext): A1 cut + centre (draft; not for merge)

Draft candidate for the UTE vNext floor on top of the frozen A0 contract
(`master @ a19d1df01`, PR #821). **Not merged, not for merge, not a release, not a deployment.** Citation
convention: a path containing `/` is repo-root-relative; a bare filename is shorthand for the full path
named in the same row or section.

| field | value |
| --- | --- |
| **Head measured for every number below** | `c29da52d31ba52088eb58622b4858803031d060d` (round 86). This body's own docs-only commit sits on top and changes no code or gate result; the round-86 settlement comment names the final 40-hex head. |
| **Base** | `master @ a19d1df01` (frozen A0, PR #821) |
| **PR state** | **DRAFT**, `state=OPEN`, never merged (`gh pr view 822 --json isDraft,state,headRefOid`) |
| **Record class** | every live claim is `DEV-LIVE` (a real host boot, **not a gate**); no capability row is PRODUCT-PROVEN |
| **Read first** | `dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md` (the reviewable report) and `dev/agent-workflow/evidence/ute-a1/CANDIDATE-AUDIT.md` (the round-86 adversarial audit: corrections, capability table, fresh gate block, verdict) |
| **How to review** | (1) read the audit's corrections table first — it lists every number the report used to get wrong; (2) re-run the gate block in the audit §8 (single commands, ~7 min with the census) and diff the verdict lines; (3) for any capability row, follow its `file:line`/evidence path and check it says what the row claims; (4) treat every `DEV-LIVE` row as unproven for acceptance purposes; (5) do **not** mark this PR ready or merge it — that is the owner's act. |
| **Gate status at this head** | local: all required gates green, including `ci-pr-gate --full --census-captures 2` = **PASS 10/10**. Hosted: `pr-gate`, `ci-fast`, `ci-integration`, `ci-security`, `ci-product`, `synthesize-merge-tree`, `candidate-protection` green; `ci-census` **SKIPPED (draft)**; `ci-required` **RED solely because of that skip**; `pr-settlement-gate` red until the round-86 settlement comment. |

## What this candidate is (one paragraph)

This is the UTE vNext floor, cut and measured in four stages. **A1** retires the old governed-family
plane: 148 frozen sources gone (146 deleted + 2 replaced), **151 additional stale dist mirrors** on top
of the 52 A0-accounted ones, closure at four zeros (`prodRefs`, `distResiduals`, `dupNames`, `findings`)
with `references=3` non-production references remaining, census unchanged at 37/180/69,512. **B** makes
the centre real: one admission authority on three unmerged axes, durable facts, an ask path, Stop and
crash recovery that never replays, and a probe ladder over unmodified host tools. **C** disposes of all
19 contract rows — 15 team tools, member lifecycle, work delivery, a real MCP mount — and refuses PTC
with its own code and a `CORE_SEAM_BLOCKER` on the worker OS profile; the S6 management plane is
restored (round 74) and serves work delivery (round 83); Alpha.6's formal routing is implemented
(round 84) while its live routed wake is unproven. **D** adds live `dsh web` evidence: **fourteen**
judges PROVEN, the previously refuted three (`d3:persistent-subprocess`, `d2:revocation`,
`d:member-read-denied`) now PROVEN, and the 405 creation entrance gone (runtime creation since round 74).

## What this branch is

- **A1 cut** — 146 frozen files deleted and 2 entries replaced wholesale (`agent-bindings.mjs`,
  `root.ts`) = 148 sources gone, plus **151 additional** stale dist mirrors (52 were already A0-accounted;
  `CUT-BOUNDARY-ADDITIONS.md:27-32`) — `place-dist-glue` maintains the **30** live placements.
  `ute-p0-assets` still reads `modules=37 files=180 lines=69512`; no legacy
  Plane/Family Body/Kernel/PA Bridge wrapped as an internal component and no legacy fallback.
  Closure gate: `deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0
  retiredSurfaces=12 placements=self findings=0` (three non-production references remain; no production
  import of a retired entry).
- **The centre** — one admission authority: identity/IPC binding, `EffectiveIO ⊆ AgentCeiling ∩
  ToolRestriction` on three axes that are never merged, `InvocationAuthorityFacts` /
  `DurableAdmission` / `ExecutionFact`, Control allow/ask/deny with a post-approval recheck, one-shot
  grants, Stop priority, real FS enforcement through the confined provider, durable facts, UNKNOWN, and
  crash recovery that never replays.
- **The wiring** — native DSH `ToolsService` definitions and dispatch only. An unwired controlled call
  is **explicitly refused** (`ADMISSION_AXIS_UNSUPPORTED`, `NETWORK_DENY`, `ADMISSION_TOOL_UNBOUND`),
  never forwarded.

## Why it is a draft

No capability row in `dev/agent-workflow/evidence/ute-a1/CAPABILITY-MATRIX-C.md` is PRODUCT-PROVEN
(the matrix's own rule, `CAPABILITY-MATRIX-C.md:71-74`): the D boots below are `DEV-LIVE` records, not
gates. Closing that is step D, not this PR. The three contract requests it once raised are **two
resolved and one open** (round 86 audit corrected this section, which still described all three as open):

- `CONTRACT-CHANGE-REQUEST-process-lane.md` — **RESOLVED / SUPERSEDED** (round 75 + owner ruling §1). The
  v4 grammar already carried the declaration; the projection dropped it. `bash`/PTY are live-proven
  (round 76). What remains is **PTC only**, and it is a `CORE_SEAM_BLOCKER` on the worker OS profile
  (`PTC-FOUR-PART-FINDING.md`), not a lane question.
- `CONTRACT-CHANGE-REQUEST-settlement-recheck.md` — **RESOLVED, owner Option A (round 73)**: a durable
  deny is the legal state for "admitted as allow, then refused before the body"; `ADM-119` is the
  positive. The store's own Stop shape is `Stop + CANCELLED`, never a fabricated allow/UNKNOWN.
- `CONTRACT-CHANGE-REQUEST-search-face.md` — shape B is implemented (the durable overlay abstains on an
  out-of-vocabulary face, the compiled lane judges it); **shape A, a search face the overlay can deny, is
  still open** — this one needs a ruling.

## Owner decisions needed (two rulings; the rest is decided or blocked on an upstream seam)

`dev/agent-workflow/evidence/ute-a1/OWNER-DECISIONS.md` carries a round-86 correction block; its historical
text still describes states from rounds 59–68. Current state:

1. **PTC (`run_code`) only** — `bash`/PTY are no longer refused (round 76, live-proven). PTC is refused
   with a `CORE_SEAM_BLOCKER` on the **worker's OS profile**; the owner may accept the refusal for this
   generation or pursue the upstream per-execution `SandboxExecutionPolicy` seam.
2. **runtime team creation** — **answered and implemented** (round 74); `team.create` is served.
3. **settlement recheck** — **answered** (Option A, round 73); no action.
4. **realm-less admission** — one sentence: is `MEMBER_CENTRE_UNWIRED` the final answer?
5. **search face** — one sentence: is lane-only governance final (shape B), or is shape A wanted?
6. **Alpha.6** — formal routing **implemented** (round 84); the remaining gap is a **live routed wake**,
   not a ruling (unless the owner wants to rule that a record-only approval fact is adjudication).

## D acceptance report

The single reviewable document for this candidate is
`dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md`. It carries the C1–C18 checklist (wording
verbatim from `docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md`), the HEAD/scope facts, the
P1–P5 ladder with its live judges, all eight required-CI lines, the host-authority statement, and the
limits. Its verdict: **A1+B+C implemented with live D evidence for the listed items, not a completed
product acceptance** — no PRODUCT-PROVEN row, PTC refused on a named upstream seam, two open owner
rulings, and the known-open register in §6.14 are named there. (Round 86: the three judges this paragraph
used to call REFUTED are PROVEN, and the 405 creation entrance was removed in round 74.)

## The 15 migrated capability suites were first RUN, not assumed (rounds 30-32)

`migrated-entry-imports.json` said `missing: []` — every file imports the new entry — and that was read as
"migration done". Nothing had ever executed them. They run from the main worktree's vitest install (this
worktree's `.bin` points at a deleted sibling), and the first execution found **8 failures**, one a live
`ReferenceError` (`resolvePaMount`) on the authority-generation publish path.

That first run was **237/238** (the last red was fixed in rounds 48-50; today 238/238). The
population is declared in `tests/checks/eb3-ute-migrated-suites.txt`:

```
EB3-LAYER layer=ci-integration verdict=FAIL suites=15 files=15 describes=76 passed=237 failed=1
```

(The 16th bookkeeping entry is `t12a-live-bridge.mjs`, a helper with no tests — the token runner refuses a
list longer than its report, which is how the census found that out about itself.) At that round the leg
was **not bound to a Required layer** because its population was red: binding a red leg would need the
exemption this project forbids. The one red was fixed in rounds 48-50 and the leg is now in
`dev/ci/eb3-ci-manifest.json` (layer `ci-integration`, the migrated-suite leg).

## Two capability gaps found by running them (both escalated, neither papered over)

1. **The durable Alpha.4 permission overlay has no decision-side effect** (E3). The retired entry
   consulted it per call through a pre-execute adapter; the cut retired the adapter with the execution
   route, so the centre judges only the COMPILED binding lanes and a `grantInstance` deny persisted after
   bind changes nothing at execution time.
2. **Admission was conditional on the realm.** A member with `centreStatePath` but no confined-provider
   realm ran unmediated and unreported. Fixed for the rows that ASKED (they are now refused with
   `MEMBER_CENTRE_UNWIRED`); rows that never asked remain outside the centre and face the owner ruling in
   `ESCALATION-realmless-admission.md` (admit against the compiled ceiling vs refuse).

## E3 is GREEN, and the migrated suites are a Required leg (rounds 48-50)

The last red was not a wiring gap: **E3's world was pre-cut** (v3 document, no v4 `memberIoCeilings`, no
realm, no `centreStatePath`), so no centre installed and no ALLOW lane existed for its control — measured
with instrumentation, four facts with file:line. The assertion was right; the fixture was stale. It was
rebuilt on the v4 contract, and the centre got a real durable-overlay provider
(`overlay-decision.mjs`: async prepare keyed on the overlay generation, sync `decide` over the frozen
`resolveOperationPermission` — the async/sync split was one of the four measured facts).

```
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
EB3-CI-REQUIRED pass workflows=10 findings=0
```

G8's "flake" was also mislabelled: `bothFulfilled === false` was the retired `resolvePaMount`
`ReferenceError` **on the delivery path**, the same defect fixed for the f15 legs; the re-runs that cleared
it all came after that fix. It is now reproduced deterministically, and the arm awaits the world's own
`resumeGate` promise instead of polling a 3 s wall clock.

**Still not PRODUCT-PROVEN**: no host boot line. Overlay `ask`/`allow` are outside the port; subtree
matching is implemented but unexercised by the E3 probe. The realm-less admission ruling is open.

## B stage, first slice: the ask path is REAL (round 51)

Before this, every `ask` was a hard refusal: no approval binder was wired at all (`ADMISSION_ASK_UNWIRED`).
Now an `ask` becomes a durable Control request, its decision is recorded, the **post-approval recheck** runs
(lane AND policy generation), and a **one-shot** grant is minted and consumed exactly once — over the
EXISTING `ControlService.awaitControlDecision` bridge, not a second one. Host-native asks are preserved
(the host's own prompt is a legitimate approval authority).

Controls, all node:test in the `ute-vnext-a1` leg (119 pass at that round; **209 pass today**, 211 tests): ADM-46 three wirings; ADM-47 deny ⇒ no
execution + durable fact + REFUSED settlement; ADM-48 expired distinct from denied; ADM-49 fault; ADM-50
over the REAL durable ControlService (one request, one durable allow, spend counted once across the host's
double guard consultation, replay refused); ADM-51 real service deny; ADM-52 generation drift after
approval; ADM-53 incomplete identity refuses before asking a reviewer; ADM-54 supply-chain pin; ADM-55
aborted vs abandoned.

**Not proven:** no host boot (a member ask surfacing in a real leader's `team_list_pending_control` is not
exercised); the durable allow is `inline` and therefore not a guard token (`control/service.ts:4278-4290`),
so exactly-once rests on the binder grant + ledger replay refusal; `stale-denied` and the abort/abandon
distinction are proven at mapping level only; the grant binds member+call+tool+revision but not the locator.

## B stage, second slice: Stop priority and lifecycle close (round 52)

Stop is the host's own `exec.signal` — no second stop mechanism. A Stop decides BEFORE the lane and before
any reviewer (`ADMISSION_STOPPED`, distinct from deny/expired/fault), is recorded as the enforced deny with
settlement `REFUSED`/`not-started`, aborts a pending ask through the ControlService's existing inline-abort
cascade, and is re-checked after the durable decision returns so a late approval can never downgrade it.

Lifecycle close is a STATE, not a removal: `close()` keeps the pre-execute and guard installed in closed
mode, aborts a pending ask, refuses new calls with `ADMISSION_MEMBER_CLOSED` without ever consulting the
live binding, still settles in-flight calls, and is idempotent. ADM-56..62 (7 arms, 126 pass at that
round) each carry a positive and negative control; seven mutation edits (reverted) turned their own arm
red.

**Not proven, stated:** (round 86: this paragraph called the post-`allow` Stop cell "open"; it was
**closed by owner Option A in round 73** — `CONTRACT-CHANGE-REQUEST-settlement-recheck.md:51`,
`ADM-119`.) The rc.5 **pre-dispatch** Stop is measured in-process only: the observer is exported and driven
end to end in the slice composition but is **not wired into a booted rc.5 production turn**
(`RC5-MIGRATION.md:492-504`). The store's own Stop shape (Stop + `CANCELLED`, `not-started`) is recorded
and asserted. An
`allow`-admitted call that has not reached the guard is allowed to finish so it settles — refusing it would
hit the same wall and leave UNKNOWN. No host boot, no real Stop keypress.

## B probe ladder over UNMODIFIED native tools (round 53)

`packages/runtime/test/vnext-b-probe-ladder.test.mjs` (ADM-63..78) drives the host's real
`dsh-tool-fs` / `-fs-search` / `-web` / `-bash-persistent` through the product's ONE composition point, with
durable facts read back FROM DISK and the product settlement store:

| tool | positive | negative |
| --- | --- | --- |
| `read` | admitted, bytes arrive, provider counters move, `COMPLETED` | `LANE_DENY` before the body, counters byte-identical, settlement `REFUSED`/`not-started` |
| `write` | bytes on disk, `writeText ≥ 1` | `LANE_DENY`, file never created, zero provider calls |
| `grep` | match found, confined subprocess actually spawned | `LANE_DENY`, ZERO subprocess spawns |
| `web_fetch` | loopback fixture body, exactly one transport call | denied network axis ⇒ `NETWORK_DENY`, ZERO transport calls |
| persistent `bash` | **BLOCKED — NOT RUN** | `ADMISSION_AXIS_UNSUPPORTED`, zero spawns, zero `confine` calls |
| `run_code` | **BLOCKED — NOT RUN** | same refusal, zero spawns, zero confines |

**The two blocked positives are not environmental** (no ENV_BLOCK): `bash`/`run_code` are `process.exec`, and
the v4 member ceiling's frozen `io` set is `{read, write, network}`, so no compiled answer can carry
`binding.process`. I did not mint a lane in the test or derive one from the write lane — that would be
the second authority this cut forbids. ADM-78 pins the block in code so a future process-lane change flips
the two disclosures loudly instead of leaving a stale waiver.

**Round 86 correction (this table is a round-53 record, not the current state).** The process lane was
**resolved** in round 75 and the `CONTRACT-CHANGE-REQUEST-process-lane.md` is **RESOLVED / SUPERSEDED**:
`bash` is ADMITTED on a compiled execution declaration and the live persistent shell is **PROVEN** in two
agreeing boots (round 76, `d3:persistent-subprocess`). `run_code` (PTC) is still refused, but by a
narrowed, measured reason — the **worker's OS profile** is the host session's policy, not the Member's
compiled lanes, which needs an upstream public seam (`CORE_SEAM_BLOCKER`, round 85). The row above is
kept as the round-53 history.

ORDER and IDENTITY are asserted: facts read back in ladder order, and every rung must resolve the host
module's own body (compared against the preset definition object, not just "registered").

## The durable half of B: crash recovery, UNKNOWN, no replay (round 54)

The crash is simulated honestly — a CHILD PROCESS that admits a call, prints its state, and `process.exit()`s
without a disposer; the parent then opens fresh ledger/store/centre over the same directory and asserts on
disk read-backs. Dead writer lock asserted on disk and reclaimed.

| claim | positive | negative |
| --- | --- | --- |
| crash recovery (ADM-79) | disk has the admission fact + `ADMITTED`, **0** execution facts ⇒ fresh store recovers `ADMITTED→UNKNOWN`, `PROCESS_TERMINATED_WITHOUT_OUTCOME`, missing evidence names `dispatch-confirmation`, `bodyOutcome: unknown` | child also COMPLETES a different call before dying ⇒ it stays `COMPLETED` (no blanket rewrite); a new callId still works |
| no replay, cross-process (ADM-80) | 2nd child (different pid) refuses `replay-1` before the body, appends exactly one replay-refusal; a fresh ledger throws `LEDGER_REPLAY` and appends NOTHING (bytes unchanged) | new callId in the same child is admitted and completes |
| duplicate execution fact (ADM-81) | on-disk duplicate ⇒ `UNKNOWN/LEDGER_DUPLICATE_EXECUTION`; centre refuses `ADMISSION_LEDGER_UNREADABLE` with 0 settlement records | same file with ONE execution fact is `KNOWN` and completes |
| truncated / garbage line (ADM-82) | three corruptions ⇒ `UNKNOWN`, writes refused with the same code, centre denies (never `ask`) | complete ledger is `KNOWN` and the same call shape completes |
| unwritable ledger (ADM-83) | `ADMISSION_LEDGER_UNWRITABLE`, both stages agree, nothing created | precondition ASSERTED (a root runner is RED, not silently green); writable twin records |
| cold recovery of an open settlement (ADM-84) | only the two OPEN records reconcile to `UNKNOWN`, preserving the reached phase and deriving DIFFERENT missing evidence | already-decided `REFUSED` stays; promoting `UNKNOWN` to `COMPLETED` is `SETTLEMENT_CONFLICT` with the file byte-identical |

Six mutation edits each red exactly their own arm (all reverted, verified). At that round the leg was 146
pass / 2 disclosed skips (round 70: 182 tests / 180 pass; **today 211 tests / 209 pass**); vitest still 238. **No `CONTRACT-CHANGE-REQUEST`
was needed**: a replayed callId is refused BEFORE any
settlement decision, so the open `allow` record is left to recovery as UNKNOWN (option D of the open CCR).

## C stage, first slice: Remote, Alpha.6 and PTC are EXPLICITLY UNAVAILABLE (round 55)

Three C rows were neither wired nor visibly refused. Each is now refused with its OWN code, on the
subject's existing axis, through the product's own ledger and settlement — no new axis, no second authority:

| row | code | axis | refused at |
| --- | --- | --- | --- |
| C-remote (round 74: per command) | `ADMISSION_REMOTE_UNAVAILABLE` | `team.control` | `root.ts` per-command hook — the S6 plane IS built/installed; only `agent-execution` commands are refused before params/handlers (control-plane commands are served) |
| C-alpha6 | `ADMISSION_ALPHA6_UNAVAILABLE` | `host.service` | `centre-config.ts#alpha6EnablementRefusal` (config) + `root.ts:2508` (records the refusal or admits a coherent row, before any wake). Round 84 removed the "every row is refused" rule |
| C-ptc | `ADMISSION_PTC_UNAVAILABLE` | `process.exec` | `admission.ts:421-423` — the ONE centre, before the body; the reason names the worker OS-profile seam (round 85) |

ADM-85..88 carry positives and negatives: an ungoverned remote row still dispatches (calls=1) while a
governed row records the deny and settles `REFUSED`/`not-started`; round 74 rewrote ADM-86 to the
per-command closed table (served control read, refused execution with zero ports, immutable fact +
settlement, unauthenticated refusal) and restored the S6 management plane on centre rows; a wake runs without the point and does
not with it; the same centre world admits an in-lane `read` (`COMPLETED`) while `run_code` never reaches the
body; and `bash` keeps `ADMISSION_AXIS_UNSUPPORTED`, so the two absences are distinguishable from the
durable record alone. ADM-88 pins the closed table: exactly three capabilities, pairwise distinct codes,
each naming its own missing axis.

**Disclosed cost (round 55 record):** a centre-configured row loses its remote API (`root.remoteDispatcher`
is absent) — that was the price of refusing rather than half-wiring. **Round 74 removed that cost**: the S6
plane is built and installed as a governed management control plane, and only `agent-execution` commands
are refused per command. The PTC router-side refusal is still not built; what is proven is the tool
refusal that makes escalation unreachable, now with the worker-OS-profile reason (round 85).

## C stage, second slice: the 15 team tools, member lifecycle and work delivery (round 56)

Over the PRODUCT tool surface (`createTeamTools` on a real `createTeamRuntime`/`TeamDomain`/`ControlService`),
facts read back from disk with fresh ledgers:

- **C-tools** (ADM-89): all 15 `CENTRE_TOOL_NAMES` dispatched in declared order — allow before the body, every
  body reached, one authority fact each on `team.control`, one execution fact, every settlement `COMPLETED`.
- **unbound refusal** (ADM-90): binding removed ⇒ all 15 `ADMISSION_NO_BINDING`, zero bodies/deliveries/
  creations, settlements `REFUSED`/`not-started`; and a tool NOT in the closed list is `ADMISSION_TOOL_UNBOUND`
  (ADM-91) while `read` is still admitted — the refusal is not a blanket.
- **C-member** (ADM-92/93): `team_create_member` installs the MEMBER's own centre at its bind (its ledger,
  its generation, its lane — the Leader allows what the member denies); `team_archive_member` runs the
  centre's `close()`, after which the member's call is `ADMISSION_MEMBER_CLOSED` with transitions
  `['ADMITTED','REFUSED']` — never UNKNOWN.
- **C-work** (ADM-94/95): `team_delegate` delivers one unit (prompt verbatim at the seam), `team_collect`
  returns the terminal entry with a durable `settledSequence`; the collected work's calls are judged by THAT
  member's centre and never appear in the Leader's ledger. A refused delegation delivers nothing.

No row is PRODUCT-PROVEN (no host boot). Named host stand-ins decide nothing; policy compilation is an arm
input, not exercised.

## C stage, third slice: MCP's real mount and Alpha.6's reachable path (round 57)

**C-mcp (ADM-96/97).** A real HTTP MCP endpoint from the product's own harness is mounted through the exact
production call (`mcpClient.apply(ctx, <the seven-field literal reconcileMcpSet passes>)`); WHICH server
exists stays the product's mount gate. The centre admits `mcp__p5t5mini__ping` on `net.mcp` with the SERVER
as locator, the durable fact reads back from disk, and the REAL server answers `pong:mounted`. Negatives: a
mounted tool denied by the compiled per-tool answer or by the ceiling is refused with zero body while the
sibling tool of the SAME server still runs (mounting is not permission); `mcp__` and `mcp__<server>` are
`ADMISSION_TOOL_UNBOUND` (no prefix matching).

**New LIMIT, pinned rather than hidden:** the centre is not mount-aware (binding installed at the member
bind; the mount target is computed later), so a well-formed name for a never-mounted server is decided on the
network axis alone — the product excludes it at the tool registry, not at admission.

**C-alpha6 (ADM-98/99).** *(Round 55 record; **round 84 superseded it** — see the C-alpha6 correction at the
end of this section.)* The config rule then refused the opt-in on EVERY row, so no product-config path
reached the capability. The machinery itself is fine: composed directly, the real Alpha.6 router takes a
recipient decision off a durable control row and the real dispatch latch + wake-intent directory persist a
row that a FRESH reader sees naming exactly the routed reviewer. What was missing is a review-routing AXIS
in the centre (`admission.ts:61-74/86-102/143-153`); driving one only fabricates a fallback-axis record.
Two lawful shapes were recorded (compiled axis = contract change, or a ruling that a record-only approval
fact is adjudication).

**C-alpha6 — round 84 correction.** No new axis was invented and none is needed: the formal routing is
implemented as a **join on existing centre surfaces** (the routing decision is a projection of the durable
control row through the ONE policy; the wake is a governed **delivery** — `team-review-wake-routed` intent
→ `SessionInputPort.submitAttributedInput` → `team-review-wake-delivered` confirmation; the Officer's
approval is `team_resolve_control` under the Officer's own binding). A coherent row is admitted; each
incoherent piece is refused *and recorded* by its own typed piece code. Arms `ADM-141`…`ADM-146`. The
**live routed wake** is still unproven (`ALPHA6-FORMAL-ROUTING.md`).

## D stage, first live acceptance: the Provider-OS boundary now holds on a real host (round 61)

Round 60's live run REFUTED the owner's named risk: a governed Member's native `read` was served by the BASE
provider (ZERO guard consults). Round 61 implements the fix (shape A: mount by default) and re-measures with
the SAME unmodified driver, two agreeing boots:

**`d:guard-facts` moved from REFUTED to PROVEN** — 2 allow facts (`stat`, `readText`) naming the member
identity, `decidedBy=[ALLOW]`, zero out-of-lane provider facts. `d:member-read-admitted` still PASS, and
`d:centre-facts` still PASS (allow + `LANE_DENY` + executions).

How: a governed member's native tool modules are now mounted INTO ITS ISOLATED SCOPE by default. The candidate
set is derived from the preset's OWN rows (never a second hand-maintained list); each module is kept only if it
declares a realm face and registers a name the centre adjudicates; the HOST module is mounted through the
existing host-module path, so there is exactly ONE definition per name and no shadow. Unresolvable/invalid/
empty/ambiguous/conflicting cases are typed refusals (`GOVERNED_NATIVE_MODULE_*`,
`GOVERNED_NATIVE_SURFACE_CONFLICT/_CHANGED`) — never a base-provider fallback. Ungoverned rows are untouched.

Two residuals recorded, not relaxed:

1. `d:member-read-denied` still reports the centre's `LANE_DENY` rather than the provider's `IO_READ_DENIED`,
   because the centre decides BEFORE execution — by design. The provider-side refusal is proven in-process
   (ADM-100: provider deny with zero secret bytes).
2. `d:native-read-surface` reads the top-level description while the marker it looks for lives in the
   `file_path` PARAMETER description — an instrument defect, re-anchored rather than deleted.

ADM-100/101/102 pin the new behaviour: governed default mount through the confined face (identity changed,
same host `execute`, allow guard facts, provider deny), ungoverned unchanged, and unresolvable ⇒ typed refusal
with no fallback.

## D stage, live: the search face is restored without silencing faults (round 64)

Round 63 measured an IN-LANE `grep` being refused as `ADMISSION_OVERLAY_FAULT` (`tool-unsupported`) — the closed
permission vocabulary cannot canonicalize a search tool. Shape B of the search-face CCR is now implemented:

- the overlay classifies by **vocabulary membership** BEFORE canonicalizing; an out-of-vocabulary tool is
  `no-opinion` and never enters the canonicalizer, so it can never fault;
- the compiled LANE alone judges it;
- a fault on a COVERED tool still denies `ADMISSION_OVERLAY_FAULT` (faults are not silenced), and a stored deny
  still denies;
- the durable fact carries `overlayOutcome: 'deny' | 'no-opinion' | 'fault'`, so a reader can tell WHY the
  overlay abstained.

Live, two agreeing boots: the same `grep` is now `decision=allow`, `overlayOutcome=no-opinion`, execution
`completed`, real match returned; the fact is byte-identical after a SIGKILL cold restart. ADM-103..106 pin the
four directions (covered+deny, covered fault, out-of-vocabulary in lane, out-of-vocabulary out of lane).

Residual stated plainly: the durable overlay still cannot DENY a search (the lane ceiling is its whole
governance); shape A (a subtree search face in the vocabulary) remains open.

## The adversarial centre review (round 28)

No P0, seven P1. Six are fixed on this branch; the seventh is the settlement gap above. They were all
in the product composition, not the mechanism — which is the useful part of the finding:

| finding | state |
| --- | --- |
| settlement recorded the lane's raw answer, then overruled it | fixed — settles the enforced decision, fact keeps `decision` + `laneDecision` |
| shared settlement dir turned another member's live execution UNKNOWN | fixed — per member |
| post-approval recheck consulted a frozen binding | fixed — live resolver (ADM-37) |
| realm disposer registered twice → close started it before the tombstone | fixed — ordering |
| throwing ledger/settlement escaped instead of refusing | fixed — three deny codes (ADM-38) |
| per-call memo served any dispatch with the same callId | fixed — memo serves one execution (ADM-38) |
| admitted-then-refused has no settlement state | **resolved** — owner Option A, round 73 (`ADM-119`); this row was still "escalated" in round 28's table |

## Verification on this HEAD

Measured at `c29da52d31ba52088eb58622b4858803031d060d` (round 86; every command re-run fresh in this
worktree, full transcripts in `CANDIDATE-AUDIT.md` §8 and
`dev/agent-workflow/evidence/ute-a1/round86-*.log`). The audit's docs-only commit on top changes none of
these results:

| gate | result |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | `suites=7 files=7` · `tests=211 pass=209 fail=0 skipped=2` · `exit=0` · `set=sha256:edd4f1c4…` (the 2 disclosed skips are ADM-68 bash / ADM-69 run_code) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=785` · collected 733 · excluded 14 · **uncollected 38** (3 under the 41 ceiling) · `refused=0 findings=0` |
| `ute-p0-assets --check` | `pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148)` |
| `ute-cut-closure --check` | `pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0` |
| `ute-a1-window --check` | `pass branch=vnext/a1-cut red=0/0 cut=(148/52)` |
| `eb3-ci-required` | `pass workflows=10 findings=0` |
| `docs-sync --check` | `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20` |
| `place-dist-glue` | `done (30 placement(s))` |
| `eb3-security-run --layer ci-security` (bound vitest leg) | `verdict=PASS suites=14 files=14 describes=61 passed=216 failed=0` |
| `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` |
| `node --test` (the UTE G1 nine-file argv) | `tests 89 pass 89 fail 0 skipped 0` |
| `ci-pr-gate --full --census-captures 2` | **`DSH-CI-VERDICT pass pass=10 fail=0 skip=0 legs=10 refused=0`** (274.7 s; census 2 captures, identical identity sets, 599 files / 7,414 lines vs the published 626 / 7,936 — counts are context, the identity set is the verdict) |
| `eb3-ci-negative-controls` | `35/35 control(s) behaved as required` |

`git rev-list --count a19d1df01..HEAD` = **205**; `git diff --shortstat a19d1df01..HEAD` = **3,377 files
changed, +241,087 / −160,719** (2,548 A · 616 D · 210 M · 2 R094 · 1 R095; rename counts are a lower bound
because git skipped exhaustive rename detection). Entry files: `agent-bindings.mjs` **4,967** lines,
`root.ts` **5,239** lines.

**Hosted verdicts at this head (`gh`):** `pr-gate`, `ci-fast`, `ci-integration`, `ci-security`,
`ci-product`, `synthesize-merge-tree`, `candidate-protection` **success**; `ci-census` **skipped** (draft);
`ci-required` **failure — sole cause `ci-census:skipped`**; `pr-settlement-gate` failure until the
round-86 settlement comment. The hosted red is the draft's own state — `ci-required` treats a skip as not
green by design — and only the owner marking the PR ready runs the census.

## Limits stated plainly (not claims)

- **No gate-grade product acceptance.** The D boots are `DEV-LIVE` records with two agreeing boots each;
  they are not gates and no row is PRODUCT-PROVEN. No capability under load: no multi-agent load beyond
  two Members, no revocation-under-load, no Stop-under-load, no real Stop keypress.
- **The model is a scripted mock** in every D record, so model-driven choice, retries and adversarial
  tool selection are not measured.
- `host.service` capabilities (Goal/Todo, Team Skill, Subagent) are bound and recorded, but their I/O
  is the **host's** — a skill file read by the host skill service is outside the member's fs ceiling.
  This is a limit, not a confinement claim.
- **Ask is wired but no live approval is measured.** The product installs the grant binder and the
  durable Control approval port when the row has a `controlServiceRef`
  (`agent-bindings.mjs:692-710`); a row without one still refuses asks as `ADMISSION_ASK_UNWIRED`.
  What is missing at D is a live leader-approves → one-shot-consumed observation: the only live ask is
  `d2:stop`, which parks at the pending request and then stops it.
- Local environment at this audit: `tsc` and vitest **are** available and ran (`ci-pr-gate`'s typecheck
  and the bound vitest legs are green); no product boot was run for this audit — all live claims are the
  earlier rounds' DEV-LIVE records. The pinned rc.2 host is built; the rc.5 host is present but not
  installed (see `NEXT-HOST-RC5-FEASIBILITY.md`). (The round-70 sentence "no `tsc`, no vitest" is no longer
  true of this worktree.)
- The two giant files are being decomposed by ownership, not by line count; `agent-bindings.mjs` is
  **4,967** lines and `root.ts` is **5,239** lines today (the round-70 body said 4,780 for
  `agent-bindings.mjs`), and the progress table is append-only in `DECOMPOSITION-PLAN.md`.

## Not done here — status statement

**This PR is not merged and must not be auto-merged. No release, no deploy, no version bump, no tag.
`master` and `stable` are untouched.** PR #822 is `DRAFT`; only the owner marks it ready and merges.
No capability row is PRODUCT-PROVEN, PTC carries a `CORE_SEAM_BLOCKER`, and two owner rulings are open —
so even after review this candidate is **not** a completed product acceptance.

## Round 83 — work DELIVERY on the management plane (the round-74 refusal narrowed)

Round 74 restored S6 Remote as a governed management plane and refused five commands as
`agent-execution`. Round 83 keeps the boundary and makes the three real product operations reachable:

**The management plane may DELIVER work; it may never EXECUTE a tool.** A third served effect class
`work-delivery` (`s6-command-classification.ts`) hands each command into the target agent's own governed
path — `member.create` (the ONE activation authority), `member.send` (the messaging coordinator's durable
inbox acceptance), `member.followup` (the action facade's `execution: 'async'` delivery receipt, whose
Phase B/C run detached inside the Team runtime). `team.admitInitialWork` and `team.ensureRootLive` stay
REFUSED because their only seams await a root turn / start an executor with nothing to acknowledge.

Boundary arms: **ADM-86** (rewritten: literal delivery/refusal sets, the dispatcher's three handovers,
no tool port, an ack with no tool result, the durable refusal for the two root commands, typed
seam-unwired fail-closed, unauthenticated refusal, 512-char settlement reason cap) and **E3** (production
root: only the two root refusals leave deny facts; at `createS6RemotePorts` the follow-up requests
`execution: 'async'`, creation carries no execution mode, `member.send` reaches the coordinator).

Live proof (`d2:remote-delivery`, DEV-LIVE, `--boots 2`, two agreeing boots): `member.send` answered
HTTP 200 with the coordinator's `delivered` acknowledgement (intent 39 / confirmation 40) while the
Member's delivered call had **0 admissions and 0 executions at the acknowledgement**; the delivered
prompt then ran in the Member's own turn, and the centre's `allow` for that `read` appeared in the
MEMBER's own ledger under the MEMBER's binding ~113 ms after the ack, with a `completed` execution.
Error paths measured on the same row: unknown member, archived member, duplicate send (at-least-once,
no operator-side execution), restore, and Stop during a delivered turn (`ADMISSION_STOPPED`).

Not claimed: no live `member.create`/`member.followup`; the two root commands stay unavailable; the model
is the scripted mock; the operator is a per-DSH_HOME authenticated human, not RBAC.

**Round 86 audit note.** `d2:remote-delivery` is PROVEN on **two rc.2 boots** (`"host":"legacy"` in
`d-boot-feasibility/d2/driver.log`); it was added after the rc.5 acceptance run, so the rc.5 column for
that judge is **not recorded** — 13 of the 14 judges ran on rc.5. The report's §3.2 now says so.

