# feat(ute-vnext): A1 cut + centre (draft; not for merge)

Draft candidate for the UTE vNext floor on top of the frozen A0 contract
(`master @ a19d1df01`, PR #821). **Not for merge, not a release, not a deployment.** Citation
convention: a path containing `/` is repo-root-relative; a bare filename is shorthand for the full path
named in the same row or section.

## What this candidate is (one paragraph)

This is the UTE vNext floor, cut and measured in four stages. **A1** retires the old governed-family
plane: 148 frozen sources gone (146 deleted + 2 replaced), 200 stale dist mirrors, closure at four zeros
(`prodRefs`, `distResiduals`, `dupNames`, `findings`), census unchanged at 37/180/69,512. **B** makes the
centre real: one admission authority on three unmerged axes, durable facts, an ask path, Stop and crash
recovery that never replays, and a probe ladder over unmodified host tools. **C** disposes of all 19
contract rows — 15 team tools, member lifecycle, work delivery, a real MCP mount — and refuses remote,
Alpha.6 routing and PTC with their own codes. **D** adds live `dsh web` evidence: nine judges PROVEN
and the refuted items named (`d3:persistent-subprocess`, `d2:revocation`, `d:member-read-denied`, 405).

## What this branch is

- **A1 cut** — 146 frozen files deleted and 2 entries replaced wholesale (`agent-bindings.mjs`,
  `root.ts`) = 148 sources gone, plus 200 stale dist mirrors deleted (`place-dist-glue` restores the
  28 live placements). `ute-p0-assets` still reads `modules=37 files=180 lines=69512`; no legacy
  Plane/Family Body/Kernel/PA Bridge wrapped as an internal component and no legacy fallback.
  Closure gate: `deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0
  findings=0`.
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
gates. Closing that is step D, not this PR. Three contract questions are recorded rather than worked
around — one already answered by an implemented shape:

- `CONTRACT-CHANGE-REQUEST-process-lane.md` — subprocess/PTY/PTC have no single-source process-lane
  declaration, so the three families stay explicitly refused.
- `CONTRACT-CHANGE-REQUEST-settlement-recheck.md` — the frozen settlement contract has **no legal state**
  for "admitted as allow, then refused before the body"; the centre reports `SETTLEMENT_CONTRACT_GAP`
  rather than fabricate a Stop or claim UNKNOWN certainty.
- `CONTRACT-CHANGE-REQUEST-search-face.md` — shape B is implemented (the durable overlay abstains on an
  out-of-vocabulary face, the compiled lane judges it); shape A, a search face the overlay can deny, is
  still open.

## Owner decisions needed (six, all consolidated)

`dev/agent-workflow/evidence/ute-a1/OWNER-DECISIONS.md` states, per item, what is MEASURED today, the lawful
options and their cost — no item can be closed by re-enabling an ungoverned plane, inventing an axis, or
widening an invariant:

1. **process lane** (`bash`/PTY/`run_code`): refused `ADMISSION_AXIS_UNSUPPORTED`; v4's closed io set rejects
   `io.process`. Options A (add the lane), B (v5), C (declare unsupported);
2. **runtime team creation on a centre row**: `team.create` 405 — the acceptance Team is boot-created;
3. settlement recheck cell; 4. realmless admission (code refuses today); 5. search-face governance depth
   (shape B shipped, shape A open); 6. Alpha.6 routing (refusal recorded at the host entry, routed path
   unreachable).

## D acceptance report

The single reviewable document for this candidate is
`dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md`. It carries the C1–C18 checklist (wording
verbatim from `docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md`), the HEAD/scope facts, the
P1–P5 ladder with its live judges, all eight required-CI lines, the host-authority statement, and the
limits. Its verdict: **A1+B+C implemented with live D evidence for the listed items, not a completed
product acceptance** — the REFUTED judges (`d3:persistent-subprocess`, `d2:revocation`,
`d:member-read-denied`), the 405 creation entrance, and the absent PRODUCT-PROVEN row are named there.

## The 16 migrated capability suites were first RUN, not assumed (rounds 30-32)

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

Controls, all node:test in the `ute-vnext-a1` leg (119 pass at that round; 180 today): ADM-46 three wirings; ADM-47 deny ⇒ no
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

**Not proven, stated:** a Stop that lands AFTER an `allow` was recorded cannot be `REFUSED` under the frozen
settlement contract (that cell is the open `CONTRACT-CHANGE-REQUEST-settlement-recheck.md` option A); the
store's own Stop shape (Stop + `CANCELLED`, `not-started`) is recorded and asserted instead. An
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
`binding.process`. They are the standing `CONTRACT-CHANGE-REQUEST-process-lane.md`, which itself names "B's
rung-6 positive control". I did not mint a lane in the test or derive one from the write lane — that would be
the second authority this cut forbids. ADM-78 pins the block in code so a future process-lane change flips
the two skips loudly instead of leaving a stale waiver.

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
pass / 2 disclosed skips (182 tests / 180 pass today); vitest still 238. **No `CONTRACT-CHANGE-REQUEST`
was needed**: a replayed callId is refused BEFORE any
settlement decision, so the open `allow` record is left to recovery as UNKNOWN (option D of the open CCR).

## C stage, first slice: Remote, Alpha.6 and PTC are EXPLICITLY UNAVAILABLE (round 55)

Three C rows were neither wired nor visibly refused. Each is now refused with its OWN code, on the
subject's existing axis, through the product's own ledger and settlement — no new axis, no second authority:

| row | code | axis | refused at |
| --- | --- | --- | --- |
| C-remote (round 74: per command) | `ADMISSION_REMOTE_UNAVAILABLE` | `team.control` | `root.ts` per-command hook — the S6 plane IS built/installed; only `agent-execution` commands are refused before params/handlers (control-plane commands are served) |
| C-alpha6 | `ADMISSION_ALPHA6_UNAVAILABLE` | `host.service` | `centre-config.ts:73` (config) + `root.ts:2496` (recorded fact, then a typed boot refusal before any wake) |
| C-ptc | `ADMISSION_PTC_UNAVAILABLE` | `process.exec` | `admission.ts:326` — the ONE centre, before the body |

ADM-85..88 carry positives and negatives: an ungoverned remote row still dispatches (calls=1) while a
governed row records the deny and settles `REFUSED`/`not-started`; round 74 rewrote ADM-86 to the
per-command closed table (served control read, refused execution with zero ports, immutable fact +
settlement, unauthenticated refusal) and restored the S6 management plane on centre rows; a wake runs without the point and does
not with it; the same centre world admits an in-lane `read` (`COMPLETED`) while `run_code` never reaches the
body; and `bash` keeps `ADMISSION_AXIS_UNSUPPORTED`, so the two absences are distinguishable from the
durable record alone. ADM-88 pins the closed table: exactly three capabilities, pairwise distinct codes,
each naming its own missing axis.

**Disclosed cost:** a centre-configured row loses its remote API (`root.remoteDispatcher` is absent) — that
is the honest price of refusing rather than half-wiring. The PTC router-side refusal is not built (it needs
the open process-lane ruling); what is proven is the tool refusal that makes escalation unreachable.

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

**C-alpha6 (ADM-98/99).** The config rule refuses the opt-in on EVERY row, so no product-config path reaches
the capability at all. The machinery itself is fine: composed directly, the real Alpha.6 router takes a
recipient decision off a durable control row and the real dispatch latch + wake-intent directory persist a
row that a FRESH reader sees naming exactly the routed reviewer. What is missing is a review-routing AXIS in
the centre (`admission.ts:32/57/114`); driving one only fabricates a fallback-axis record. Two lawful shapes
are recorded (compiled axis = contract change, or a ruling that a record-only approval fact is adjudication).

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
| admitted-then-refused has no settlement state | **escalated** |

## Verification on this HEAD

Measured at `189d6cabca5b4de9ec3059f9949ab9302364f789` (round 70; all eight commands were re-run fresh
in this worktree, full output in `D-ACCEPTANCE-REPORT.md` §4). The audit's docs-only commits on top of it
change none of these results:

| gate | result |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | `suites=7 files=7` · `tests=182 pass=180 fail=0 skipped=2` · `exit=0` (the 2 skips are ADM-68/69, disclosed below) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=889 uncollected=41 excluded=14 refused=0 findings=0` (41 is the ceiling; zero headroom) |
| `ute-p0-assets --check` | `pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148)` |
| `ute-cut-closure --check` | `pass deleted=148 references=163 prodRefs=0 distResiduals=0 dupNames=0 findings=0` |
| `ute-a1-window --check` | `pass branch=vnext/a1-cut red=0/0 cut=(148/52)` |
| `eb3-ci-required` | `pass workflows=10 findings=0` |
| `docs-sync --check` | `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0` |
| `place-dist-glue` | `done (28 placement(s))` |
| `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` |

`git rev-list --count a19d1df01..HEAD` = **144**; `git diff --stat a19d1df01..HEAD` = **1643 files
changed, +107914 / −79603** (1199 A · 363 D · 76 M · 2 R060 · 1 R094 · 1 R095 · 1 R096).

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
  (`agent-bindings.mjs:688-706`); a row without one still refuses asks as `ADMISSION_ASK_UNWIRED`.
  What is missing at D is a live leader-approves → one-shot-consumed observation: the only live ask is
  `d2:stop`, which parks at the pending request and then stops it.
- Local environment: no `tsc`, no vitest, no product boot for this audit; the pinned rc.2 host is built,
  the rc.5 host is present but not installed (see `NEXT-HOST-RC5-FEASIBILITY.md`).
- The two giant files are being decomposed by ownership, not by line count; `agent-bindings.mjs` is
  **4,780** lines today, down from 5,301 when the decomposition plan started, and the progress table is
  append-only in `DECOMPOSITION-PLAN.md`.

## Not done here

Candidate must not auto-merge. No release, no deploy, no version bump. `master` is untouched.
